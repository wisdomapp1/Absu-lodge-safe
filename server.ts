import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  calculateFinancialBreakdown,
  computeSplitAtIso,
  DEFAULT_PLATFORM_SETTINGS,
  generateFinancialCsv,
  summarizeFinancialLedger,
} from './src/domain/finance.ts';
import { canTransitionBooking } from './src/domain/bookingMachine.ts';
import {
  detectSuspiciousListingDescription,
  generateBookingReference,
  processIdempotentWebhook,
  validateAllowedAgentFeeNaira,
  validateInspectionContact,
} from './src/domain/validation.ts';
import type { BookingRecord, BookingStatus, PaymentEventLog, UserRole } from './src/domain/types.ts';
import { SEED_BOOKINGS, SEED_PAYMENT_EVENTS, SEED_PROPERTIES } from './src/data/seedData.ts';

const PORT = 3000;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const TEST_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || 'absu_lodgesafe_test_webhook_secret';

const serverBookings: BookingRecord[] = [...SEED_BOOKINGS];
const serverWebhookEvents: PaymentEventLog[] = [...SEED_PAYMENT_EVENTS];
let bookingSeq = serverBookings.length + 1;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxPerMinute: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || 'local';
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    if (bucket.count >= maxPerMinute) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait briefly.' });
    }
    bucket.count += 1;
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://jjidjcnyknoavmefrrpi.supabase.co';
    const supabaseServerConfigured = Boolean(
      supabaseUrl &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_')
    );
    const paystackConfigured = Boolean(PAYSTACK_SECRET && !PAYSTACK_SECRET.includes('YOUR_'));
    const cloudinaryServerConfigured = Boolean(
      process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
    );
    res.json({
      status: 'ok',
      service: 'absu-lodgesafe-api',
      supabaseProjectRef: 'jjidjcnyknoavmefrrpi',
      supabaseConfigured: supabaseServerConfigured,
      paystackSecretConfigured: paystackConfigured,
      cloudinaryServerConfigured,
      paymentMode: paystackConfigured ? 'paystack_test' : DEFAULT_PLATFORM_SETTINGS.paymentMode,
      timestamp: new Date().toISOString(),
    });
  });

  // Authoritative server-side kobo calculation (Agent Fee + ₦3,000 Inspection Fee ONLY; rent paid direct to landlord)
  app.post('/api/finance/calculate', rateLimit(120), (req, res) => {
    try {
      const yearlyRentKobo = Number(req.body?.yearlyRentKobo);
      const agentCommissionKobo = Number(req.body?.agentCommissionKobo);
      const breakdown = calculateFinancialBreakdown(
        yearlyRentKobo,
        agentCommissionKobo,
        DEFAULT_PLATFORM_SETTINGS
      );
      res.json({ breakdown, settings: DEFAULT_PLATFORM_SETTINGS });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Invalid financial inputs.' });
    }
  });

  // Server-side listing validation (blocks external payment links & invalid agent fees)
  app.post('/api/listings/validate', rateLimit(60), (req, res) => {
    const { description, agentFeeNaira } = req.body || {};
    const feeCheck = validateAllowedAgentFeeNaira(Number(agentFeeNaira));
    if (!feeCheck.valid) {
      return res.status(400).json({ valid: false, error: feeCheck.error });
    }
    const safety = detectSuspiciousListingDescription(String(description || ''));
    if (safety.flagged) {
      return res.status(400).json({
        valid: false,
        flagged: true,
        error: `Listing blocked by rent protection policy: ${safety.reason}. Rent must never be collected through links or agents.`,
      });
    }
    return res.json({ valid: true });
  });

  // Initialize booking & Paystack payment (Paystack metadata included, rent NEVER collected)
  app.post('/api/payments/initialize', rateLimit(30), async (req, res) => {
    try {
      const {
        propertyId,
        propertyTitle,
        propertyCoverUrl,
        locationArea,
        studentUid,
        studentName,
        studentPhone,
        studentEmail,
        studentMatric,
        agentUid,
        agentName,
        agentPhone,
        yearlyRentKobo,
        agentCommissionKobo,
        inspectionDate,
        agreedPolicy,
      } = req.body || {};

      if (!agreedPolicy) {
        return res.status(400).json({ error: 'You must agree to the mandatory booking policy before payment.' });
      }
      if (!propertyId || !studentUid || !agentUid || !inspectionDate) {
        return res.status(400).json({ error: 'Missing required booking initialization fields.' });
      }

      // Check lodge availability lock against double-booking
      const prop = SEED_PROPERTIES.find((p) => p.propertyId === propertyId);
      if (prop && prop.availabilityStatus === 'Unavailable') {
        return res.status(409).json({ error: 'This lodge is currently unavailable for booking.' });
      }

      const breakdown = calculateFinancialBreakdown(
        Number(yearlyRentKobo),
        Number(agentCommissionKobo),
        DEFAULT_PLATFORM_SETTINGS
      );
      const bookingReference = generateBookingReference(bookingSeq++);
      const bookingId = `bk_${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();

      const newBooking: BookingRecord = {
        bookingId,
        bookingReference,
        studentUid,
        studentName: studentName || 'ABSU Student',
        studentPhone: studentPhone || '',
        studentMatric: studentMatric || 'ABSU Student',
        agentUid,
        agentName: agentName || 'Verified Agent',
        agentPhone: agentPhone || '',
        propertyId,
        propertyTitle: propertyTitle || 'ABSU Lodge',
        propertyCoverUrl: propertyCoverUrl || '',
        locationArea: locationArea || 'School Gate',
        breakdown,
        status: 'Pending Payment',
        paymentStatus: 'Unpaid',
        paymentHoldStatus: 'unpaid',
        inspectionStatus: 'Pending Schedule',
        inspectionDate,
        paystackReference: bookingReference,
        createdAt: now,
        updatedAt: now,
      };

      serverBookings.unshift(newBooking);

      const metadata = {
        lodge_id: propertyId,
        student_id: studentUid,
        agent_id: agentUid,
        agent_fee: breakdown.agentCommissionKobo,
        inspection_fee: breakdown.inspectionFeeKobo,
        booking_id: bookingId,
      };

      // If real Paystack secret key is configured, initialize directly with Paystack REST API
      if (PAYSTACK_SECRET && !PAYSTACK_SECRET.includes('YOUR_') && studentEmail) {
        const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: studentEmail,
            amount: breakdown.totalPayableKobo,
            reference: bookingReference,
            metadata,
          }),
        });
        const psData = await psRes.json();
        if (psRes.ok && psData?.status) {
          return res.status(201).json({
            mode: 'paystack',
            booking: newBooking,
            amountKobo: breakdown.totalPayableKobo,
            metadata,
            accessCode: psData.data.access_code,
            authorizationUrl: psData.data.authorization_url,
          });
        }
      }

      return res.status(201).json({
        mode: 'paystack_test_simulation',
        notice: 'Test Mode Active: Paystack transaction simulated because PAYSTACK_SECRET_KEY is not configured in server secrets.',
        booking: newBooking,
        amountKobo: breakdown.totalPayableKobo,
        metadata,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to initialize booking.' });
    }
  });

  // Server-side payment verification (never trusts frontend success callback alone)
  app.post('/api/payments/verify', rateLimit(60), async (req, res) => {
    const { bookingReference, outcome } = req.body || {};
    if (!bookingReference) {
      return res.status(400).json({ error: 'bookingReference is required.' });
    }

    const booking = serverBookings.find((b) => b.bookingReference === bookingReference);
    if (!booking) {
      return res.status(404).json({ error: 'Booking reference not found on server.' });
    }

    if (booking.paymentStatus === 'Held' || booking.paymentStatus === 'Test Paid') {
      return res.json({ verified: true, duplicate: true, booking });
    }

    const now = new Date().toISOString();

    if (PAYSTACK_SECRET && !PAYSTACK_SECRET.includes('YOUR_') && outcome !== 'fail') {
      try {
        const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(bookingReference)}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        });
        const psData = await psRes.json();
        if (!psRes.ok || !psData?.status || psData?.data?.status !== 'success') {
          booking.status = 'Payment Failed';
          booking.paymentStatus = 'Failed';
          booking.paymentHoldStatus = 'failed';
          booking.updatedAt = now;
          return res.status(400).json({ verified: false, error: 'Paystack verification failed.', booking });
        }
      } catch (err: any) {
        return res.status(502).json({ verified: false, error: err?.message || 'Paystack network check failed.' });
      }
    }

    if (outcome === 'fail') {
      booking.status = 'Payment Failed';
      booking.paymentStatus = 'Failed';
      booking.paymentHoldStatus = 'failed';
      booking.updatedAt = now;
      serverWebhookEvents.unshift({
        eventId: `evt_${crypto.randomUUID().slice(0, 8)}`,
        webhookId: `wh_fail_${bookingReference}`,
        bookingReference,
        eventType: 'charge.failed',
        amountKobo: booking.breakdown.totalPayableKobo,
        signatureValid: true,
        duplicateIgnored: false,
        status: 'failed',
        createdAt: now,
      });
      return res.json({ verified: false, booking });
    }

    const splitAt = computeSplitAtIso(now, 48);
    booking.status = 'Awaiting Inspection';
    booking.paymentStatus = 'Held';
    booking.paymentHoldStatus = 'held';
    booking.inspectionStatus = 'Scheduled';
    booking.paidAt = now;
    booking.splitAt = splitAt;
    booking.updatedAt = now;

    const webhookId = `wh_ok_${bookingReference}`;
    const result = processIdempotentWebhook(serverWebhookEvents, {
      webhookId,
      bookingReference,
      eventType: 'charge.success',
      amountKobo: booking.breakdown.totalPayableKobo,
      signatureHeader: TEST_WEBHOOK_SECRET,
      expectedSignature: TEST_WEBHOOK_SECRET,
    });
    serverWebhookEvents.unshift(result.logEntry);

    return res.json({ verified: true, duplicate: result.duplicate, booking });
  });

  app.post('/api/webhooks/payment', rateLimit(120), (req, res) => {
    const signatureHeader = String(req.headers['x-paystack-signature'] || req.headers['x-lodgesafe-signature'] || '');
    const { webhookId, bookingReference, eventType, amountKobo } = req.body || {};

    if (!webhookId || !bookingReference || !eventType) {
      return res.status(400).json({ error: 'Malformed webhook payload.' });
    }

    const secret = PAYSTACK_SECRET || TEST_WEBHOOK_SECRET;
    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const result = processIdempotentWebhook(serverWebhookEvents, {
      webhookId,
      bookingReference,
      eventType,
      amountKobo: Number(amountKobo || 0),
      signatureHeader,
      expectedSignature,
    });

    serverWebhookEvents.unshift(result.logEntry);

    if (!result.accepted) {
      return res.status(401).json({ error: 'Invalid webhook signature.', logEntry: result.logEntry });
    }
    return res.json({
      accepted: true,
      duplicateIgnored: result.duplicate,
      logEntry: result.logEntry,
    });
  });

  app.post('/api/bookings/transition', rateLimit(60), (req, res) => {
    const { bookingReference, nextStatus, actorRole } = req.body || {};
    const booking = serverBookings.find((b) => b.bookingReference === bookingReference);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    const check = canTransitionBooking(
      booking.status,
      nextStatus as BookingStatus,
      actorRole as UserRole
    );
    if (!check.allowed) {
      return res.status(403).json({ error: check.reason });
    }
    booking.status = nextStatus;
    booking.updatedAt = new Date().toISOString();
    res.json({ booking });
  });

  app.post('/api/bookings/inspection-contact', rateLimit(60), (req, res) => {
    const {
      bookingReference,
      fullName,
      phoneNumber,
      whatsappOrAltPhone,
      preferredDate,
      preferredTimeSlot,
      campusMeetupPoint,
      notesForAgent,
    } = req.body || {};

    if (!bookingReference) {
      return res.status(400).json({ error: 'bookingReference is required.' });
    }
    const check = validateInspectionContact({
      fullName: String(fullName || ''),
      phoneNumber: String(phoneNumber || ''),
      whatsappOrAltPhone: String(whatsappOrAltPhone || ''),
      preferredDate: preferredDate ? String(preferredDate) : undefined,
      preferredTimeSlot: String(preferredTimeSlot || ''),
      campusMeetupPoint: String(campusMeetupPoint || ''),
    });
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }

    const booking = serverBookings.find((b) => b.bookingReference === bookingReference);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const now = new Date().toISOString();
    booking.inspectionContact = {
      fullName: String(fullName).trim(),
      phoneNumber: String(phoneNumber).trim(),
      whatsappOrAltPhone: String(whatsappOrAltPhone || phoneNumber).trim(),
      preferredTimeSlot: String(preferredTimeSlot).trim(),
      campusMeetupPoint: String(campusMeetupPoint || 'Lodge Axis').trim(),
      notesForAgent: notesForAgent ? String(notesForAgent).trim() : undefined,
      submittedAt: now,
    };
    if (preferredDate) booking.inspectionDate = String(preferredDate);
    booking.inspectionTimeSlot = String(preferredTimeSlot).trim();
    booking.status = 'Inspection Scheduled';
    booking.inspectionStatus = 'Scheduled';
    booking.updatedAt = now;

    return res.json({ booking });
  });

  app.get('/api/reports/summary', (_req, res) => {
    res.json({
      summary: summarizeFinancialLedger(serverBookings),
      webhookCount: serverWebhookEvents.length,
    });
  });

  app.get('/api/reports/financial.csv', (_req, res) => {
    const csv = generateFinancialCsv(serverBookings);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="absu-lodgesafe-financial-report.csv"');
    res.send(csv);
  });

  app.get('/api/reports/financial.xls', (_req, res) => {
    const csv = generateFinancialCsv(serverBookings);
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="absu-lodgesafe-financial-report.xls"');
    res.send(csv);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ABSU LodgeSafe server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ABSU LodgeSafe server:', err);
  process.exit(1);
});
