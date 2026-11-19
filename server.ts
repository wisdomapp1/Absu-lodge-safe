import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  calculateFinancialBreakdown,
  DEFAULT_PLATFORM_SETTINGS,
  generateFinancialCsv,
  summarizeFinancialLedger,
} from './src/domain/finance.ts';
import { canTransitionBooking } from './src/domain/bookingMachine.ts';
import { generateBookingReference, processIdempotentWebhook, validateInspectionContact } from './src/domain/validation.ts';
import type { BookingRecord, BookingStatus, PaymentEventLog, UserRole } from './src/domain/types.ts';
import { SEED_BOOKINGS, SEED_PAYMENT_EVENTS } from './src/data/seedData.ts';

const PORT = 3000;
const TEST_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || 'absu_lodgesafe_test_webhook_secret';

// Server-side in-memory store for API verification, idempotent webhook ledger, and reports
const serverBookings: BookingRecord[] = [...SEED_BOOKINGS];
const serverWebhookEvents: PaymentEventLog[] = [...SEED_PAYMENT_EVENTS];
let bookingSeq = serverBookings.length + 1;

// Simple sliding-window rate limiter per IP
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

  // Health & system diagnostics (no secrets leaked)
  app.get('/api/health', (_req, res) => {
    const supabaseServerConfigured = Boolean(
      process.env.SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        !process.env.SUPABASE_URL.includes('YOUR_PROJECT_REF')
    );
    res.json({
      status: 'ok',
      service: 'absu-lodgesafe-api',
      databaseProvider: supabaseServerConfigured ? 'supabase' : 'ai-studio-managed',
      supabaseConfigured: supabaseServerConfigured,
      paymentMode: DEFAULT_PLATFORM_SETTINGS.paymentMode,
      paystackPartnerApproved: DEFAULT_PLATFORM_SETTINGS.paystackPartnerApproved,
      timestamp: new Date().toISOString(),
    });
  });

  // Authoritative server-side kobo calculation
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

  // Test-mode booking & payment initialization
  app.post('/api/payments/initialize', rateLimit(30), (req, res) => {
    try {
      const {
        propertyId,
        propertyTitle,
        propertyCoverUrl,
        locationArea,
        studentUid,
        studentName,
        studentMatric,
        agentUid,
        agentName,
        yearlyRentKobo,
        agentCommissionKobo,
        inspectionDate,
      } = req.body || {};

      if (!propertyId || !studentUid || !agentUid || !inspectionDate) {
        return res.status(400).json({ error: 'Missing required booking initialization fields.' });
      }

      const breakdown = calculateFinancialBreakdown(
        Number(yearlyRentKobo),
        Number(agentCommissionKobo),
        DEFAULT_PLATFORM_SETTINGS
      );
      const bookingReference = generateBookingReference(bookingSeq++);
      const now = new Date().toISOString();

      const newBooking: BookingRecord = {
        bookingId: `bk_${crypto.randomUUID().slice(0, 8)}`,
        bookingReference,
        studentUid,
        studentName: studentName || 'ABSU Student',
        studentMatric: studentMatric || 'Pending Matric',
        agentUid,
        agentName: agentName || 'Verified Agent',
        propertyId,
        propertyTitle: propertyTitle || 'ABSU Lodge',
        propertyCoverUrl: propertyCoverUrl || '',
        locationArea: locationArea || 'School Gate',
        breakdown,
        status: 'Pending Payment',
        paymentStatus: 'Unpaid',
        inspectionStatus: 'Pending Schedule',
        inspectionDate,
        createdAt: now,
        updatedAt: now,
      };

      serverBookings.unshift(newBooking);

      res.status(201).json({
        mode: 'test_disabled',
        notice:
          'Test Environment Only: Live transactions require written conditional-settlement approval from an authorized payment partner.',
        booking: newBooking,
        expectedTestSignature: crypto
          .createHmac('sha256', TEST_WEBHOOK_SECRET)
          .update(bookingReference)
          .digest('hex'),
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to initialize booking.' });
    }
  });

  // Server-side payment verification (never trusts frontend success blindly)
  app.post('/api/payments/verify', rateLimit(60), (req, res) => {
    const { bookingReference, outcome } = req.body || {};
    if (!bookingReference) {
      return res.status(400).json({ error: 'bookingReference is required.' });
    }

    const booking = serverBookings.find((b) => b.bookingReference === bookingReference);
    if (!booking) {
      return res.status(404).json({ error: 'Booking reference not found on server.' });
    }

    const now = new Date().toISOString();
    if (outcome === 'fail') {
      booking.status = 'Payment Failed';
      booking.paymentStatus = 'Failed';
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

    booking.status = 'Awaiting Inspection';
    booking.paymentStatus = 'Test Paid';
    booking.inspectionStatus = 'Scheduled';
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

  // Idempotent webhook endpoint with HMAC/signature validation
  app.post('/api/webhooks/payment', rateLimit(120), (req, res) => {
    const signatureHeader = String(req.headers['x-lodgesafe-signature'] || '');
    const { webhookId, bookingReference, eventType, amountKobo } = req.body || {};

    if (!webhookId || !bookingReference || !eventType) {
      return res.status(400).json({ error: 'Malformed webhook payload.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', TEST_WEBHOOK_SECRET)
      .update(String(bookingReference))
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

  // Server-side validated booking status transition
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

  // Save student inspection contact info after payment for the listing agent
  app.post('/api/bookings/inspection-contact', rateLimit(60), (req, res) => {
    const {
      bookingReference,
      fullName,
      phoneNumber,
      whatsappOrAltPhone,
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
      whatsappOrAltPhone: whatsappOrAltPhone ? String(whatsappOrAltPhone).trim() : undefined,
      preferredTimeSlot: String(preferredTimeSlot).trim(),
      campusMeetupPoint: String(campusMeetupPoint).trim(),
      notesForAgent: notesForAgent ? String(notesForAgent).trim() : undefined,
      submittedAt: now,
    };
    booking.status = 'Inspection Scheduled';
    booking.inspectionStatus = 'Scheduled';
    booking.updatedAt = now;

    return res.json({ booking });
  });

  // Dynamic ledger summary & downloadable CSV/Excel reports
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
