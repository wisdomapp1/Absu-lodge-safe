import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinancialBreakdown,
  DEFAULT_INSPECTION_FEE_KOBO,
  DEFAULT_PLATFORM_SETTINGS,
  formatNairaFromKobo,
  generateFinancialCsv,
  summarizeFinancialLedger,
} from './finance';
import { canTransitionBooking, isTerminalBookingStatus } from './bookingMachine';
import { getUnreadNotificationsCount, resolveNotificationDetails } from './notifications';
import {
  generateBookingReference,
  processIdempotentWebhook,
  validateAgentCommissionWithinLimit,
  validateInspectionContact,
  validateLodgeMediaRequirements,
  validateMediaUpload,
} from './validation';
import { BookingRecord } from './types';
import {
  SEED_BOOKINGS,
  SEED_DISPUTES,
  SEED_NOTIFICATIONS,
  SEED_PROPERTIES,
} from '../data/seedData';

test('calculates exact integer kobo 55/45 and 70/30 commission shares with ₦3,000 inspection fee', () => {
  const breakdown = calculateFinancialBreakdown(200000 * 100, 20000 * 100);
  assert.equal(breakdown.yearlyRentKobo, 20000000);
  assert.equal(breakdown.agentCommissionKobo, 2000000);
  assert.equal(breakdown.inspectionFeeKobo, DEFAULT_INSPECTION_FEE_KOBO);
  assert.equal(breakdown.totalPayableKobo, 22300000);
  assert.equal(breakdown.platformCommissionKobo, 1100000); // ₦11,000
  assert.equal(breakdown.agentEarningsKobo, 900000); // ₦9,000
  assert.equal(breakdown.sugAllocationKobo, 770000); // ₦7,700
  assert.equal(breakdown.techManagerAllocationKobo, 330000); // ₦3,300
  assert.equal(
    breakdown.sugAllocationKobo + breakdown.techManagerAllocationKobo,
    breakdown.platformCommissionKobo
  );
  assert.equal(
    breakdown.platformCommissionKobo + breakdown.agentEarningsKobo,
    breakdown.agentCommissionKobo
  );
});

test('100 bookings revenue projection reconciles dynamically without float drift', () => {
  const single = calculateFinancialBreakdown(20000000, 2000000);
  const bookings: BookingRecord[] = Array.from({ length: 100 }, (_, idx) => ({
    bookingId: `bk_${idx}`,
    bookingReference: `ABSU-LS-20261119-${idx}`,
    studentUid: 'stu_1',
    studentName: 'Test Student',
    studentMatric: '2022/1001',
    agentUid: 'agt_1',
    agentName: 'Test Agent',
    propertyId: 'prop_1',
    propertyTitle: 'Test Lodge',
    propertyCoverUrl: '/img.jpg',
    locationArea: 'School Gate',
    breakdown: single,
    status: 'Settled',
    paymentStatus: 'Test Paid',
    inspectionStatus: 'Completed',
    inspectionDate: '2026-11-20',
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
  }));

  const summary = summarizeFinancialLedger(bookings);
  assert.equal(summary.totalAgentCommissionKobo, 2000000 * 100); // ₦2,000,000
  assert.equal(summary.totalPlatformCommissionKobo, 1100000 * 100); // ₦1,100,000
  assert.equal(summary.totalAgentEarningsKobo, 900000 * 100); // ₦900,000
  assert.equal(summary.totalSugAllocationKobo, 770000 * 100); // ₦770,000
  assert.equal(summary.totalTechManagerAllocationKobo, 330000 * 100); // ₦330,000
  assert.equal(summary.totalInspectionFeeKobo, 300000 * 100); // ₦300,000
  assert.equal(summary.totalLandlordRentKobo, 20000000 * 100); // ₦20,000,000
});

test('enforces role permissions and booking state machine transitions', () => {
  // Student cannot approve refunds
  assert.equal(canTransitionBooking('Under SUG Review', 'Refund Approved', 'student').allowed, false);
  // Tech Manager cannot decide disputes
  assert.equal(canTransitionBooking('Under SUG Review', 'Refund Approved', 'tech_manager').allowed, false);
  // SUG Admin can approve refunds
  assert.equal(canTransitionBooking('Under SUG Review', 'Refund Approved', 'sug_admin').allowed, true);
  // Agent cannot confirm on behalf of student
  assert.equal(canTransitionBooking('Awaiting Inspection', 'Confirmed', 'agent').allowed, false);
  // Student confirms after inspection
  assert.equal(canTransitionBooking('Awaiting Inspection', 'Confirmed', 'student').allowed, true);
  // Terminal states cannot be mutated
  assert.equal(isTerminalBookingStatus('Settled'), true);
  assert.equal(canTransitionBooking('Settled', 'Refunded', 'sug_president').allowed, false);
});

test('validates duplicate webhook protection and invalid signatures', () => {
  const first = processIdempotentWebhook([], {
    webhookId: 'wh_001',
    bookingReference: 'ABSU-LS-20261119-0001',
    eventType: 'charge.success',
    amountKobo: 22300000,
    signatureHeader: 'sig_valid',
    expectedSignature: 'sig_valid',
  });
  assert.equal(first.accepted, true);
  assert.equal(first.duplicate, false);

  const duplicate = processIdempotentWebhook([first.logEntry], {
    webhookId: 'wh_001',
    bookingReference: 'ABSU-LS-20261119-0001',
    eventType: 'charge.success',
    amountKobo: 22300000,
    signatureHeader: 'sig_valid',
    expectedSignature: 'sig_valid',
  });
  assert.equal(duplicate.accepted, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.logEntry.status, 'ignored_duplicate');

  const invalidSig = processIdempotentWebhook([], {
    webhookId: 'wh_002',
    bookingReference: 'ABSU-LS-20261119-0001',
    eventType: 'charge.success',
    amountKobo: 22300000,
    signatureHeader: 'bad_sig',
    expectedSignature: 'sig_valid',
  });
  assert.equal(invalidSig.accepted, false);
  assert.equal(invalidSig.logEntry.status, 'rejected_signature');
});

test('validates media uploads, commission limits, formatting, and CSV export', () => {
  assert.equal(validateMediaUpload({ name: 'room.jpg', type: 'image/jpeg', size: 1024 }).valid, true);
  assert.equal(validateMediaUpload({ name: 'tour.mp4', type: 'video/mp4', size: 1024 * 1024 }).valid, true);
  assert.equal(validateMediaUpload({ name: 'script.exe', type: 'application/octet-stream', size: 500 }).valid, false);
  assert.equal(validateMediaUpload({ name: 'huge.mp4', type: 'video/mp4', size: 30 * 1024 * 1024 }).valid, false);

  assert.equal(
    validateAgentCommissionWithinLimit(20000000, 2000000, DEFAULT_PLATFORM_SETTINGS.maxCommissionPctOfRent).valid,
    true
  );
  assert.equal(
    validateAgentCommissionWithinLimit(20000000, 5000000, DEFAULT_PLATFORM_SETTINGS.maxCommissionPctOfRent).valid,
    false
  );

  assert.equal(formatNairaFromKobo(22300000), '₦223,000');
  assert.match(generateBookingReference(12), /^ABSU-LS-\d{8}-0012$/);

  const csv = generateFinancialCsv([]);
  assert.match(csv, /Landlord Rent \(NGN\)/);
  assert.match(csv, /Inspection Fee \(NGN\)/);
});

test('validates post-payment inspection contact details and 4-image + 1-video lodge upload rules', () => {
  assert.equal(
    validateInspectionContact({
      fullName: 'Chinedu Okafor',
      phoneNumber: '+234 803 412 8890',
      preferredTimeSlot: 'Morning (9:00 AM - 12:00 PM)',
      campusMeetupPoint: 'ABSU Main School Gate',
    }).valid,
    true
  );
  assert.equal(
    validateInspectionContact({
      fullName: 'C',
      phoneNumber: '123',
      preferredTimeSlot: '',
      campusMeetupPoint: '',
    }).valid,
    false
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
  assert.equal(
    validateLodgeMediaRequirements([
      { type: 'image' },
      { type: 'image' },
      { type: 'video' },
    ]).valid,
    false
  );
  assert.equal(
    validateLodgeMediaRequirements([
      { type: 'image' },
      { type: 'image' },
      { type: 'image' },
      { type: 'image' },
    ]).valid,
    false
  );
});

test('resolves linked booking, lodge, and unread counts for clickable notifications', () => {
  assert.equal(getUnreadNotificationsCount(SEED_NOTIFICATIONS, 'demo_stu_chinedu'), 1);
  assert.equal(getUnreadNotificationsCount(SEED_NOTIFICATIONS, 'demo_agt_emeka'), 1);

  const studentResolved = resolveNotificationDetails(SEED_NOTIFICATIONS[0], {
    bookings: SEED_BOOKINGS,
    properties: SEED_PROPERTIES,
    disputes: SEED_DISPUTES,
  });
  assert.equal(studentResolved.categoryLabel, 'Inspection & Meetup');
  assert.equal(studentResolved.booking?.bookingReference, 'ABSU-LS-20261115-0001');
  assert.equal(studentResolved.property?.propertyId, 'prop_unity_selfcon');

  // Even when a notification lacks explicit relatedBookingRef, regex extraction resolves it
  const textOnlyNotif = {
    ...SEED_NOTIFICATIONS[1],
    relatedBookingRef: undefined,
    relatedPropertyId: undefined,
    category: undefined,
  };
  const agentResolved = resolveNotificationDetails(textOnlyNotif, {
    bookings: SEED_BOOKINGS,
    properties: SEED_PROPERTIES,
    disputes: SEED_DISPUTES,
  });
  assert.equal(agentResolved.booking?.bookingReference, 'ABSU-LS-20261115-0001');
  assert.equal(agentResolved.property?.propertyId, 'prop_unity_selfcon');
});
