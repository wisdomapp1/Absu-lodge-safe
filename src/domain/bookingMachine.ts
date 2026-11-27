import type { BookingStatus, UserRole } from './types.ts';
import { isSugAdminRole, isSuperAdminRole } from './types.ts';

export const ALL_BOOKING_STATUSES: BookingStatus[] = [
  'Pending Payment',
  'Payment Failed',
  'Payment Successful',
  'Awaiting Inspection',
  'Inspection Scheduled',
  'Dispute Requested',
  'Under SUG Review',
  'Refund Approved',
  'Refund Processing',
  'Refunded',
  'Confirmed',
  'Settlement Processing',
  'Settled',
  'Cancelled',
];

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  'Pending Payment': ['Payment Successful', 'Payment Failed', 'Cancelled'],
  'Payment Failed': ['Pending Payment', 'Cancelled'],
  'Payment Successful': ['Awaiting Inspection'],
  'Awaiting Inspection': ['Inspection Scheduled', 'Confirmed', 'Dispute Requested', 'Cancelled'],
  'Inspection Scheduled': ['Confirmed', 'Dispute Requested'],
  'Dispute Requested': ['Under SUG Review', 'Refund Processing'],
  'Under SUG Review': ['Refund Approved', 'Refund Processing', 'Awaiting Inspection', 'Inspection Scheduled'],
  'Refund Approved': ['Refund Processing', 'Refunded'],
  'Refund Processing': ['Refunded'],
  Refunded: [],
  Confirmed: ['Settlement Processing', 'Settled'],
  'Settlement Processing': ['Settled'],
  Settled: [],
  Cancelled: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
  actorRole: UserRole
): { allowed: boolean; reason?: string } {
  const nextStates = ALLOWED_TRANSITIONS[from] || [];
  if (!nextStates.includes(to)) {
    return {
      allowed: false,
      reason: `Booking cannot transition directly from "${from}" to "${to}".`,
    };
  }

  const key = `${from}->${to}`;
  const isSug = isSugAdminRole(actorRole);
  const isSuper = isSuperAdminRole(actorRole);

  // Strict permission checks
  if (key === 'Pending Payment->Payment Successful' || key === 'Pending Payment->Payment Failed') {
    if (actorRole === 'student' || isSuper || isSug) return { allowed: true };
  }
  if (key === 'Payment Successful->Awaiting Inspection') {
    if (actorRole === 'student' || isSuper || isSug) return { allowed: true };
  }
  if (key === 'Awaiting Inspection->Inspection Scheduled') {
    if (actorRole === 'student' || actorRole === 'agent' || isSuper || isSug) return { allowed: true };
  }
  if (key === 'Awaiting Inspection->Confirmed' || key === 'Inspection Scheduled->Confirmed') {
    if (actorRole === 'student' || isSuper) return { allowed: true };
  }
  if (key === 'Awaiting Inspection->Dispute Requested' || key === 'Inspection Scheduled->Dispute Requested') {
    if (actorRole === 'student') return { allowed: true };
  }
  if (key === 'Dispute Requested->Under SUG Review' || key === 'Dispute Requested->Refund Processing') {
    if (actorRole === 'student' || isSug || isSuper) return { allowed: true };
  }
  if (
    key === 'Under SUG Review->Refund Approved' ||
    key === 'Under SUG Review->Refund Processing' ||
    key === 'Under SUG Review->Awaiting Inspection' ||
    key === 'Under SUG Review->Inspection Scheduled'
  ) {
    if (isSug || isSuper) return { allowed: true };
  }
  // CRITICAL: Only Super Admin executes Paystack refunds or settlements (SUG Admin CANNOT initiate refunds or bank transfers)
  if (
    key === 'Refund Approved->Refund Processing' ||
    key === 'Refund Approved->Refunded' ||
    key === 'Refund Processing->Refunded'
  ) {
    if (isSuper) return { allowed: true };
    return {
      allowed: false,
      reason: 'Only Super Admin can initiate or finalize refund transfers with Paystack.',
    };
  }
  if (
    key === 'Confirmed->Settlement Processing' ||
    key === 'Confirmed->Settled' ||
    key === 'Settlement Processing->Settled'
  ) {
    if (isSuper) return { allowed: true };
    return {
      allowed: false,
      reason: 'Settlement payouts are processed strictly after the 48-hour hold by scheduled Super Admin jobs.',
    };
  }
  if (key === 'Pending Payment->Cancelled' || key === 'Payment Failed->Cancelled' || key === 'Awaiting Inspection->Cancelled') {
    if (actorRole === 'student' || isSug || isSuper) return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Role "${actorRole}" is not authorized to perform transition "${key}".`,
  };
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return status === 'Settled' || status === 'Refunded' || status === 'Cancelled';
}
