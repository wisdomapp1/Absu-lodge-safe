import type {
  BookingRecord,
  FinancialBreakdown,
  PlatformSettings,
} from './types.ts';

export const DEFAULT_INSPECTION_FEE_KOBO = 3000 * 100; // ₦3,000 fixed automatic fee

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  inspectionFeeKobo: DEFAULT_INSPECTION_FEE_KOBO,
  platformSharePct: 55,
  agentSharePct: 45,
  sugPlatformSharePct: 70,
  techManagerPlatformSharePct: 30,
  maxCommissionPctOfRent: 15,
  paymentMode: 'test_disabled',
  paystackPartnerApproved: false,
  updatedAt: '2026-11-19T00:00:00.000Z',
};

/**
 * Validates that commission split percentages sum exactly to 100.
 */
export function validatePlatformSettings(settings: PlatformSettings): void {
  if (settings.platformSharePct + settings.agentSharePct !== 100) {
    throw new Error(
      `Invalid platform/agent split: ${settings.platformSharePct}/${settings.agentSharePct} must equal 100.`
    );
  }
  if (settings.sugPlatformSharePct + settings.techManagerPlatformSharePct !== 100) {
    throw new Error(
      `Invalid SUG/Tech Manager split: ${settings.sugPlatformSharePct}/${settings.techManagerPlatformSharePct} must equal 100.`
    );
  }
  if (!Number.isInteger(settings.inspectionFeeKobo) || settings.inspectionFeeKobo < 0) {
    throw new Error('Inspection fee must be a non-negative integer in kobo.');
  }
}

/**
 * Computes exact integer kobo allocations for a booking.
 * Never mixes landlord yearly rent or inspection fee into agent/platform commissions.
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
    throw new Error('Agent commission must be a non-negative integer in kobo.');
  }

  const inspectionFeeKobo = settings.inspectionFeeKobo;
  const totalPayableKobo = yearlyRentKobo + agentCommissionKobo + inspectionFeeKobo;

  const platformCommissionKobo = Math.round(
    (agentCommissionKobo * settings.platformSharePct) / 100
  );
  const agentEarningsKobo = agentCommissionKobo - platformCommissionKobo;

  const sugAllocationKobo = Math.round(
    (platformCommissionKobo * settings.sugPlatformSharePct) / 100
  );
  const techManagerAllocationKobo = platformCommissionKobo - sugAllocationKobo;

  // Typical Nigerian gateway estimate (1.5% + ₦100, capped at ₦2,000) tracked separately
  const rawFee = Math.round(totalPayableKobo * 0.015) + 10000;
  const processingFeeEstimateKobo = Math.min(rawFee, 200000);

  return {
    yearlyRentKobo,
    agentCommissionKobo,
    inspectionFeeKobo,
    totalPayableKobo,
    platformSharePct: settings.platformSharePct,
    agentSharePct: settings.agentSharePct,
    sugPlatformSharePct: settings.sugPlatformSharePct,
    techManagerPlatformSharePct: settings.techManagerPlatformSharePct,
    platformCommissionKobo,
    agentEarningsKobo,
    sugAllocationKobo,
    techManagerAllocationKobo,
    landlordRentKobo: yearlyRentKobo,
    processingFeeEstimateKobo,
  };
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
  totalGrossVolumeKobo: number;
  totalLandlordRentKobo: number;
  totalAgentCommissionKobo: number;
  totalPlatformCommissionKobo: number;
  totalAgentEarningsKobo: number;
  totalSugAllocationKobo: number;
  totalTechManagerAllocationKobo: number;
  totalInspectionFeeKobo: number;
  totalRefundedKobo: number;
  pendingSettlementKobo: number;
  settledVolumeKobo: number;
  processingFeesEstimateKobo: number;
}

/**
 * Dynamically aggregates financial totals across booking ledger records using each
 * booking's immutable historical breakdown snapshot.
 */
export function summarizeFinancialLedger(bookings: BookingRecord[]): FinancialSummary {
  return bookings.reduce<FinancialSummary>(
    (acc, booking) => {
      if (booking.status === 'Pending Payment' || booking.status === 'Payment Failed' || booking.status === 'Cancelled') {
        return acc;
      }

      const b = booking.breakdown;
      if (booking.status === 'Refunded') {
        acc.totalRefundedKobo += b.totalPayableKobo;
        return acc;
      }

      acc.totalGrossVolumeKobo += b.totalPayableKobo;
      acc.totalLandlordRentKobo += b.landlordRentKobo;
      acc.totalAgentCommissionKobo += b.agentCommissionKobo;
      acc.totalPlatformCommissionKobo += b.platformCommissionKobo;
      acc.totalAgentEarningsKobo += b.agentEarningsKobo;
      acc.totalSugAllocationKobo += b.sugAllocationKobo;
      acc.totalTechManagerAllocationKobo += b.techManagerAllocationKobo;
      acc.totalInspectionFeeKobo += b.inspectionFeeKobo;
      acc.processingFeesEstimateKobo += b.processingFeeEstimateKobo;

      if (booking.status === 'Settled') {
        acc.settledVolumeKobo += b.totalPayableKobo;
      } else {
        acc.pendingSettlementKobo += b.totalPayableKobo;
      }
      return acc;
    },
    {
      totalGrossVolumeKobo: 0,
      totalLandlordRentKobo: 0,
      totalAgentCommissionKobo: 0,
      totalPlatformCommissionKobo: 0,
      totalAgentEarningsKobo: 0,
      totalSugAllocationKobo: 0,
      totalTechManagerAllocationKobo: 0,
      totalInspectionFeeKobo: 0,
      totalRefundedKobo: 0,
      pendingSettlementKobo: 0,
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
    'Landlord Rent (NGN)',
    'Agent Commission (NGN)',
    'Agent 45% Share (NGN)',
    'Platform 55% Share (NGN)',
    'SUG 70% of Platform (NGN)',
    'Tech Manager 30% of Platform (NGN)',
    'Inspection Fee (NGN)',
    'Est. Processing Fee (NGN)',
    'Total Payable (NGN)',
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
    return [
      bk.bookingReference,
      bk.createdAt.slice(0, 10),
      bk.propertyTitle,
      bk.studentName,
      bk.agentName,
      bk.status,
      (b.landlordRentKobo / 100).toFixed(2),
      (b.agentCommissionKobo / 100).toFixed(2),
      (b.agentEarningsKobo / 100).toFixed(2),
      (b.platformCommissionKobo / 100).toFixed(2),
      (b.sugAllocationKobo / 100).toFixed(2),
      (b.techManagerAllocationKobo / 100).toFixed(2),
      (b.inspectionFeeKobo / 100).toFixed(2),
      (b.processingFeeEstimateKobo / 100).toFixed(2),
      (b.totalPayableKobo / 100).toFixed(2),
    ]
      .map(escape)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
