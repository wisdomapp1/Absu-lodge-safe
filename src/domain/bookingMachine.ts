import type { BookingStatus, UserRole } from './types.ts';

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
  'Dispute Requested': ['Under SUG Review'],
  'Under SUG Review': ['Refund Approved', 'Awaiting Inspection'],
  'Refund Approved': ['Refund Processing', 'Refunded'],
  'Refund Processing': ['Refunded'],
  Refunded: [],
  Confirmed: ['Settlement Processing', 'Settled'],
  'Settlement Processing': ['Settled'],
  Settled: [],
  Cancelled: [],
};

const TRANSITION_ROLES: Record<string, UserRole[]> = {
  'Pending Payment->Payment Successful': ['student', 'sug_admin', 'sug_president', 'tech_manager'],
  'Pending Payment->Payment Failed': ['student', 'sug_admin', 'tech_manager'],
  'Pending Payment->Cancelled': ['student', 'sug_admin', 'sug_president'],
  'Payment Failed->Pending Payment': ['student'],
  'Payment Failed->Cancelled': ['student', 'sug_admin'],
  'Payment Successful->Awaiting Inspection': ['student', 'sug_admin', 'tech_manager'],
  'Awaiting Inspection->Inspection Scheduled': ['agent', 'student', 'sug_admin'],
  'Awaiting Inspection->Confirmed': ['student'],
  'Inspection Scheduled->Confirmed': ['student'],
  'Awaiting Inspection->Dispute Requested': ['student'],
  'Inspection Scheduled->Dispute Requested': ['student'],
  'Dispute Requested->Under SUG Review': ['sug_admin', 'sug_president', 'student'],
  'Under SUG Review->Refund Approved': ['sug_admin', 'sug_president'],
  'Under SUG Review->Awaiting Inspection': ['sug_admin', 'sug_president'],
  'Refund Approved->Refund Processing': ['tech_manager', 'sug_admin', 'sug_president'],
  'Refund Approved->Refunded': ['tech_manager', 'sug_admin', 'sug_president'],
  'Refund Processing->Refunded': ['tech_manager', 'sug_admin', 'sug_president'],
  'Confirmed->Settlement Processing': ['student', 'sug_admin', 'sug_president', 'tech_manager'],
  'Confirmed->Settled': ['student', 'sug_admin', 'sug_president', 'tech_manager'],
  'Settlement Processing->Settled': ['sug_admin', 'sug_president', 'tech_manager'],
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
  const permittedRoles = TRANSITION_ROLES[key] || [];
  if (!permittedRoles.includes(actorRole)) {
    return {
      allowed: false,
      reason: `Role "${actorRole}" is not authorized to perform transition "${key}".`,
    };
  }

  return { allowed: true };
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return status === 'Settled' || status === 'Refunded' || status === 'Cancelled';
}
