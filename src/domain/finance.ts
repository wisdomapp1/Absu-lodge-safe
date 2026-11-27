import type {
  BookingRecord,
  FinancialBreakdown,
  PlatformSettings,
} from './types.ts';

export const DEFAULT_INSPECTION_FEE_KOBO = 3000 * 100; // ₦3,000 = 300,000 kobo fixed (100% Platform Backend Management)
export const HOLD_DURATION_HOURS = 48;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  inspectionFeeKobo: DEFAULT_INSPECTION_FEE_KOBO,
  agentSharePct: 40,
  sugSharePct: 35,
  platformSharePct: 25,
  holdDurationHours: HOLD_DURATION_HOURS,
  maxCommissionPctOfRent: 25,
  paymentMode: 'paystack_test',
  paystackPartnerApproved: false,
  updatedAt: '2026-11-25T00:00:00.000Z',
};

/**
 * Validates that Agent Fee distribution percentages sum exactly to 100 (40% Agent / 35% SUG / 25% Platform).
 */
export function validatePlatformSettings(settings: PlatformSettings): void {
  if (settings.agentSharePct + settings.sugSharePct + settings.platformSharePct !== 100) {
    throw new Error(
      `Invalid agent fee split: ${settings.agentSharePct}/${settings.sugSharePct}/${settings.platformSharePct} must equal 100.`
    );
  }
  if (!Number.isInteger(settings.inspectionFeeKobo) || settings.inspectionFeeKobo !== DEFAULT_INSPECTION_FEE_KOBO) {
    throw new Error('Inspection fee must remain fixed at 300000 kobo (₦3,000).');
  }
}

/**
 * Computes exact integer kobo allocations for a booking.
 * CRITICAL: Rent is NEVER collected on the platform.
 * Platform checkout collects ONLY: Agent Fee + ₦3,000 Inspection Fee.
 * Agent Fee split: 40% Agent / 35% SUG / 25% Platform.
 * Inspection Fee: 100% Platform Backend Management.
 */
export function calculateFinancialBreakdown(
  yearlyRentKobo: number,
  agentCommissionKobo: number,
  settings: PlatformSettings = DEFAULT_PLATFORM_SETTINGS
): FinancialBreakdown {
  validatePlatformSettings(settings);

  if (!Number.isInteger(yearlyRentKobo) || yearlyRentKobo <= 0) {
    throw new Error('Yearly rent must be a positive integer in kobo.');
  }
  if (!Number.isInteger(agentCommissionKobo) || agentCommissionKobo < 0) {
    throw new Error('Agent fee must be a non-negative integer in kobo.');
  }

  const inspectionFeeKobo = settings.inspectionFeeKobo; // 300000 kobo
  const totalBookingFeeKobo = agentCommissionKobo + inspectionFeeKobo;
  const totalPayableKobo = totalBookingFeeKobo;

  const agentEarningsKobo = Math.round((agentCommissionKobo * settings.agentSharePct) / 100);
  const sugAllocationKobo = Math.round((agentCommissionKobo * settings.sugSharePct) / 100);
  const platformAgentShareKobo = agentCommissionKobo - agentEarningsKobo - sugAllocationKobo;
  const platformInspectionFeeKobo = inspectionFeeKobo;
  const platformTotalKobo = platformAgentShareKobo + platformInspectionFeeKobo;

  // Typical Nigerian Paystack processing fee estimate (1.5% + ₦100 for amounts >= ₦2,500, capped at ₦2,000)
  const rawFee = Math.round(totalPayableKobo * 0.015) + (totalPayableKobo >= 250000 ? 10000 : 0);
  const processingFeeEstimateKobo = Math.min(rawFee, 200000);

  return {
    yearlyRentKobo,
    agentCommissionKobo,
    inspectionFeeKobo,
    totalBookingFeeKobo,
    totalPayableKobo,
    agentSharePct: settings.agentSharePct,
    sugSharePct: settings.sugSharePct,
    platformSharePct: settings.platformSharePct,
    agentEarningsKobo,
    sugAllocationKobo,
    platformAgentShareKobo,
    platformInspectionFeeKobo,
    platformTotalKobo,
    processingFeeEstimateKobo,
  };
}

export function computeSplitAtIso(paidAtIso: string, holdHours = HOLD_DURATION_HOURS): string {
  const paidMs = new Date(paidAtIso).getTime();
  return new Date(paidMs + holdHours * 60 * 60 * 1000).toISOString();
}

export function formatNairaFromKobo(kobo: number): string {
  const naira = Math.round(kobo) / 100;
  return `₦${naira.toLocaleString('en-NG', {
    minimumFractionDigits: naira % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function nairaToKobo(naira: number): number {
  if (!Number.isFinite(naira) || naira < 0) {
    throw new Error('Invalid Naira amount.');
  }
  return Math.round(naira * 100);
}

export interface FinancialSummary {
  totalGrossBookingVolumeKobo: number;
  totalAgentCommissionKobo: number;
  totalAgentEarningsKobo: number;
  totalSugAllocationKobo: number;
  totalPlatformAgentShareKobo: number;
  totalInspectionFeeKobo: number;
  totalPlatformTotalKobo: number;
  totalRefundedKobo: number;
  pendingHoldVolumeKobo: number;
  settledVolumeKobo: number;
  processingFeesEstimateKobo: number;
}

/**
 * Dynamically aggregates financial totals across booking ledger records using each
 * booking's immutable historical breakdown snapshot.
 * Refunded bookings yield zero to Agent, SUG, and Platform.
 */
export function summarizeFinancialLedger(bookings: BookingRecord[]): FinancialSummary {
  return bookings.reduce<FinancialSummary>(
    (acc, booking) => {
      if (
        booking.status === 'Pending Payment' ||
        booking.status === 'Payment Failed' ||
        booking.status === 'Cancelled'
      ) {
        return acc;
      }

      const b = booking.breakdown;
      if (booking.status === 'Refunded' || booking.paymentStatus === 'Refunded') {
        acc.totalRefundedKobo += b.totalPayableKobo;
        return acc;
      }

      acc.totalGrossBookingVolumeKobo += b.totalPayableKobo;
      acc.totalAgentCommissionKobo += b.agentCommissionKobo;
      acc.totalAgentEarningsKobo += b.agentEarningsKobo;
      acc.totalSugAllocationKobo += b.sugAllocationKobo;
      acc.totalPlatformAgentShareKobo += b.platformAgentShareKobo;
      acc.totalInspectionFeeKobo += b.platformInspectionFeeKobo;
      acc.totalPlatformTotalKobo += b.platformTotalKobo;
      acc.processingFeesEstimateKobo += b.processingFeeEstimateKobo;

      if (booking.status === 'Settled') {
        acc.settledVolumeKobo += b.totalPayableKobo;
      } else {
        acc.pendingHoldVolumeKobo += b.totalPayableKobo;
      }
      return acc;
    },
    {
      totalGrossBookingVolumeKobo: 0,
      totalAgentCommissionKobo: 0,
      totalAgentEarningsKobo: 0,
      totalSugAllocationKobo: 0,
      totalPlatformAgentShareKobo: 0,
      totalInspectionFeeKobo: 0,
      totalPlatformTotalKobo: 0,
      totalRefundedKobo: 0,
      pendingHoldVolumeKobo: 0,
      settledVolumeKobo: 0,
      processingFeesEstimateKobo: 0,
    }
  );
}

/**
 * Generates RFC-4180 CSV content for financial reconciliation reports.
 */
export function generateFinancialCsv(bookings: BookingRecord[]): string {
  const headers = [
    'Booking Reference',
    'Date',
    'Lodge',
    'Student',
    'Agent',
    'Status',
    'Annual Rent Direct to Landlord (NGN)',
    'Agent Fee Paid on Platform (NGN)',
    'Inspection Fee 100% Platform (NGN)',
    'Total Paid on Platform (NGN)',
    'Agent 40% Share (NGN)',
    'SUG 35% Share (NGN)',
    'Platform 25% Agent Share (NGN)',
    'Platform Total incl. Inspection (NGN)',
  ];

  const escape = (val: string | number) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = bookings.map((bk) => {
    const b = bk.breakdown;
    const isRefunded = bk.status === 'Refunded';
    return [
      bk.bookingReference,
      bk.createdAt.slice(0, 10),
      bk.propertyTitle,
      bk.studentName,
      bk.agentName,
      bk.status,
      (b.yearlyRentKobo / 100).toFixed(2),
      (b.agentCommissionKobo / 100).toFixed(2),
      (b.inspectionFeeKobo / 100).toFixed(2),
      (b.totalPayableKobo / 100).toFixed(2),
      ((isRefunded ? 0 : b.agentEarningsKobo) / 100).toFixed(2),
      ((isRefunded ? 0 : b.sugAllocationKobo) / 100).toFixed(2),
      ((isRefunded ? 0 : b.platformAgentShareKobo) / 100).toFixed(2),
      ((isRefunded ? 0 : b.platformTotalKobo) / 100).toFixed(2),
    ]
      .map(escape)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
