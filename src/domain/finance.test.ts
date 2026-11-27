import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinancialBreakdown,
  computeSplitAtIso,
  DEFAULT_INSPECTION_FEE_KOBO,
  DEFAULT_PLATFORM_SETTINGS,
  generateFinancialCsv,
  nairaToKobo,
  summarizeFinancialLedger,
} from './finance.ts';
import { canTransitionBooking } from './bookingMachine.ts';
import {
  buildAgentWhatsAppLink,
  detectSuspiciousListingDescription,
  generateBookingReference,
  isInspectionConfirmationEligible,
  processIdempotentWebhook,
  validateAllowedAgentFeeNaira,
  validateInspectionContact,
  validateLodgeMediaRequirements,
  validateMediaUpload,
} from './validation.ts';
import { getUnreadNotificationsCount, resolveNotificationDetails } from './notifications.ts';
import { SEED_BOOKINGS, SEED_NOTIFICATIONS, SEED_PROPERTIES } from '../data/seedData.ts';
import type { BookingRecord, PaymentEventLog } from './types.ts';

test('calculates exact integer kobo 40/35/25 agent fee split + 100% ₦3,000 inspection fee excluding rent', () => {
  const yearlyRent = nairaToKobo(200000);
  const agentCommission = nairaToKobo(20000);
  const breakdown = calculateFinancialBreakdown(yearlyRent, agentCommission, DEFAULT_PLATFORM_SETTINGS);

  assert.equal(breakdown.yearlyRentKobo, 20000000); // Stored for display; paid directly to landlord after inspection
  assert.equal(breakdown.agentCommissionKobo, 2000000);
  assert.equal(breakdown.inspectionFeeKobo, DEFAULT_INSPECTION_FEE_KOBO); // 300000 kobo (₦3,000)
  assert.equal(breakdown.totalBookingFeeKobo, 2300000); // ₦23,000 (Agent Fee + Inspection Fee ONLY)
  assert.equal(breakdown.totalPayableKobo, 2300000);
  assert.equal(breakdown.agentEarningsKobo, 800000); // 40% of ₦20,000 = ₦8,000
  assert.equal(breakdown.sugAllocationKobo, 700000); // 35% of ₦20,000 = ₦7,000
  assert.equal(breakdown.platformAgentShareKobo, 500000); // 25% of ₦20,000 = ₦5,000
  assert.equal(breakdown.platformInspectionFeeKobo, 300000); // 100% of ₦3,000 = ₦3,000
  assert.equal(breakdown.platformTotalKobo, 800000); // ₦5,000 + ₦3,000 = ₦8,000
});

test('48-hour payment hold computes split_at exactly 48 hours after payment confirmation', () => {
  const paidAt = '2026-11-25T10:00:00.000Z';
  const splitAt = computeSplitAtIso(paidAt, 48);
  assert.equal(splitAt, '2026-11-27T10:00:00.000Z');
});

test('100 bookings financial ledger reconciles dynamically and zeroes out refunded transactions', () => {
  const yearlyRent = nairaToKobo(180000);
  const agentComm = nairaToKobo(20000);
  const breakdown = calculateFinancialBreakdown(yearlyRent, agentComm);

  const synthetic: BookingRecord[] = Array.from({ length: 100 }, (_, i) => ({
    bookingId: `bk_test_${i}`,
    bookingReference: generateBookingReference(i + 1),
    studentUid: `stu_${i % 10}`,
    studentName: `Student ${i}`,
    studentMatric: `2023/100${i}`,
    agentUid: `agt_${i % 3}`,
    agentName: `Agent ${i % 3}`,
    propertyId: 'prop_1',
    propertyTitle: 'Test Lodge',
    propertyCoverUrl: '',
    locationArea: 'School Gate',
    breakdown,
    status: i < 10 ? 'Refunded' : i < 70 ? 'Settled' : 'Awaiting Inspection',
    paymentStatus: i < 10 ? 'Refunded' : 'Held',
    paymentHoldStatus: i < 10 ? 'refunded' : i < 70 ? 'settled' : 'held',
    inspectionStatus: 'Completed',
    inspectionDate: '2026-11-20',
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
  }));

  const summary = summarizeFinancialLedger(synthetic);
  // 90 active/settled bookings * ₦23,000 = ₦2,070,000 (207,000,000 kobo)
  assert.equal(summary.totalGrossBookingVolumeKobo, 90 * 2300000);
  assert.equal(summary.totalRefundedKobo, 10 * 2300000);
  assert.equal(summary.totalAgentEarningsKobo, 90 * 800000);
  assert.equal(summary.totalSugAllocationKobo, 90 * 700000);
  assert.equal(summary.totalPlatformTotalKobo, 90 * 800000);
  assert.equal(summary.totalInspectionFeeKobo, 90 * 300000);
});

test('enforces strict role permissions between SUG Admin and Super Admin', () => {
  assert.equal(canTransitionBooking('Awaiting Inspection', 'Confirmed', 'agent').allowed, false);
  assert.equal(canTransitionBooking('Awaiting Inspection', 'Confirmed', 'student').allowed, true);
  assert.equal(canTransitionBooking('Settled', 'Refund Approved', 'sug_admin').allowed, false);
  // SUG Admin CANNOT execute Paystack refunds or settle transfers; only Super Admin can
  assert.equal(canTransitionBooking('Refund Approved', 'Refunded', 'sug_admin').allowed, false);
  assert.equal(canTransitionBooking('Refund Approved', 'Refunded', 'super_admin').allowed, true);
  assert.equal(canTransitionBooking('Confirmed', 'Settled', 'sug_admin').allowed, false);
  assert.equal(canTransitionBooking('Confirmed', 'Settled', 'super_admin').allowed, true);
});

test('validates duplicate webhook protection and invalid signatures', () => {
  const events: PaymentEventLog[] = [
    {
      eventId: 'evt_1',
      webhookId: 'wh_123',
      bookingReference: 'ABSU-LS-20261118-0001',
      eventType: 'charge.success',
      amountKobo: 2300000,
      signatureValid: true,
      duplicateIgnored: false,
      status: 'processed',
      createdAt: '2026-11-18T10:00:00.000Z',
    },
  ];

  const dup = processIdempotentWebhook(events, {
    webhookId: 'wh_123',
    bookingReference: 'ABSU-LS-20261118-0001',
    eventType: 'charge.success',
    amountKobo: 2300000,
    signatureHeader: 'secret_abc',
    expectedSignature: 'secret_abc',
  });
  assert.equal(dup.accepted, true);
  assert.equal(dup.duplicate, true);
  assert.equal(dup.logEntry.status, 'ignored_duplicate');

  const badSig = processIdempotentWebhook(events, {
    webhookId: 'wh_999',
    bookingReference: 'ABSU-LS-20261118-0002',
    eventType: 'charge.success',
    amountKobo: 2300000,
    signatureHeader: 'forged',
    expectedSignature: 'secret_abc',
  });
  assert.equal(badSig.accepted, false);
  assert.equal(badSig.logEntry.status, 'rejected_signature');
});

test('validates discrete agent fees, 3-6 images + optional video, anti-rent-link guard, and inspection time gate', () => {
  assert.equal(validateAllowedAgentFeeNaira(5000).valid, true);
  assert.equal(validateAllowedAgentFeeNaira(20000).valid, true);
  assert.equal(validateAllowedAgentFeeNaira(40000).valid, true);
  assert.equal(validateAllowedAgentFeeNaira(12500).valid, false);

  assert.equal(validateMediaUpload({ name: 'room.jpg', type: 'image/jpeg', size: 1024 * 1024 }).valid, true);
  assert.equal(validateMediaUpload({ name: 'tour.mp4', type: 'video/mp4', size: 10 * 1024 * 1024 }).valid, true);
  assert.equal(validateMediaUpload({ name: 'malware.exe', type: 'application/octet-stream', size: 100 }).valid, false);

  assert.equal(validateLodgeMediaRequirements([{ type: 'image' }, { type: 'image' }]).valid, false);
  assert.equal(
    validateLodgeMediaRequirements([
      { type: 'image' },
      { type: 'image' },
      { type: 'image' },
    ]).valid,
    true
  );
  assert.equal(
    validateLodgeMediaRequirements([
      { type: 'image' },
      { type: 'image' },
      { type: 'image' },
      { type: 'image' },
      { type: 'video' },
    ]).valid,
    true
  );

  assert.equal(detectSuspiciousListingDescription('Clean self contain near School Gate with prepaid meter.').flagged, false);
  assert.equal(detectSuspiciousListingDescription('Pay rent to agent via https://paystack.com/pay/fake').flagged, true);

  assert.equal(
    isInspectionConfirmationEligible('2026-11-20', 'Morning: 9am–12pm', new Date('2026-11-25T10:00:00')).eligible,
    true
  );
  assert.equal(
    isInspectionConfirmationEligible('2026-11-28', 'Afternoon: 12pm–4pm', new Date('2026-11-25T10:00:00')).eligible,
    false
  );

  const wa = buildAgentWhatsAppLink({
    phone: '08034128890',
    studentName: 'Chinedu Okafor',
    lodgeTitle: 'Unity Executive Lodge',
    bookingReference: 'ABSU-LS-20261118-0001',
    inspectionDate: '2026-11-25',
    inspectionTime: 'Morning: 9am–12pm',
  });
  assert.equal(wa.startsWith('https://wa.me/2348034128890?text='), true);

  assert.equal(
    validateInspectionContact({
      fullName: 'Chinedu Okafor',
      phoneNumber: '+2348034128890',
      whatsappOrAltPhone: '+2348034128890',
      preferredTimeSlot: 'Morning: 9am–12pm',
    }).valid,
    true
  );

  const csv = generateFinancialCsv(SEED_BOOKINGS);
  assert.equal(csv.includes('Booking Reference'), true);
});

test('resolves linked booking, lodge, and unread counts for clickable notifications', () => {
  const unreadForStudent = getUnreadNotificationsCount(SEED_NOTIFICATIONS, 'demo_stu_chinedu');
  assert.equal(unreadForStudent >= 1, true);

  const bookingNotif = SEED_NOTIFICATIONS.find((n) => n.relatedBookingRef);
  assert.ok(bookingNotif);

  const details = resolveNotificationDetails(bookingNotif, {
    bookings: SEED_BOOKINGS,
    properties: SEED_PROPERTIES,
    disputes: [],
  });

  assert.equal(details.booking?.bookingReference, bookingNotif.relatedBookingRef);
  assert.equal(details.property?.propertyId, bookingNotif.relatedPropertyId);
});
