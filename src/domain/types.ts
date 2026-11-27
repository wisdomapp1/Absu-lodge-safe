export type UserRole =
  | 'student'
  | 'agent'
  | 'sug_admin'
  | 'sug_president'
  | 'super_admin'
  | 'tech_manager'
  | 'tech_admin';

export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'super_admin' || role === 'tech_manager' || role === 'tech_admin';
}

export function isSugAdminRole(role?: string | null): boolean {
  return role === 'sug_admin' || role === 'sug_president';
}

export function normalizeRole(role?: string | null): UserRole {
  if (role === 'tech_manager' || role === 'tech_admin' || role === 'super_admin') {
    return 'super_admin';
  }
  if (role === 'sug_admin' || role === 'sug_president') {
    return role;
  }
  if (role === 'agent') return 'agent';
  return 'student';
}

export type LocationArea =
  | 'Uturu'
  | 'School Gate'
  | 'ABSU Gate'
  | 'Okigwe Road'
  | 'Back Gate'
  | 'Inside School'
  | 'Uturu Main Town'
  | 'Eke-Okigwe Axis';

export type PropertyCategory =
  | 'Self Contain'
  | 'Single Room'
  | '2 Bedroom'
  | '3 Bedroom'
  | 'Face Me I Face You'
  | 'Self-Contain'
  | 'Two-Bedroom'
  | 'Apartment'
  | 'Shared Hostel';

export const ALLOWED_AGENT_FEES_NAIRA = [5000, 10000, 15000, 20000, 30000, 40000] as const;
export type AllowedAgentFeeNaira = (typeof ALLOWED_AGENT_FEES_NAIRA)[number];

export type AvailabilityStatus = 'Available' | 'Unavailable';

export type LodgeStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Booked'
  | 'Taken';

export type VerificationStatus =
  | 'Pending Verification'
  | 'SUG Verified'
  | 'Rejected'
  | 'Suspended';

export type AgentStatus =
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Suspended'
  | 'Banned';

export type BookingStatus =
  | 'Pending Payment'
  | 'Payment Failed'
  | 'Payment Successful'
  | 'Awaiting Inspection'
  | 'Inspection Scheduled'
  | 'Dispute Requested'
  | 'Under SUG Review'
  | 'Refund Approved'
  | 'Refund Processing'
  | 'Refunded'
  | 'Confirmed'
  | 'Settlement Processing'
  | 'Settled'
  | 'Cancelled';

export type PaymentHoldStatus =
  | 'unpaid'
  | 'held'
  | 'refund_pending'
  | 'refunded'
  | 'settlement_processing'
  | 'settled'
  | 'failed';

export type TransferStatus =
  | 'pending'
  | 'processing'
  | 'successful'
  | 'failed'
  | 'reversed';

export type InspectionTimeSlot =
  | 'Morning: 9am–12pm'
  | 'Afternoon: 12pm–4pm'
  | 'Evening: 4pm–6pm';

export type DisputeReason =
  | 'Agent did not show up'
  | 'Lodge is fake'
  | 'Caretaker does not know agent'
  | 'Lodge already taken'
  | 'Agent asked for extra money'
  | 'Lodge does not exist.'
  | 'Agent showed a different property.'
  | 'Landlord authorization could not be verified.'
  | 'Property differs from advertised photographs.'
  | 'Property is not as described.'
  | 'Landlord changed the agreed price.'
  | 'Property is unavailable.'
  | 'Other.';

export type DisputeStatus =
  | 'Dispute Requested'
  | 'Under SUG Review'
  | 'Refund Approved'
  | 'Refund Rejected'
  | 'Escalated'
  | 'Closed';

export interface PlatformSettings {
  inspectionFeeKobo: number; // Fixed ₦3,000 = 300000 kobo (100% Platform Backend Management)
  agentSharePct: number; // 40% of agent fee
  sugSharePct: number; // 35% of agent fee
  platformSharePct: number; // 25% of agent fee
  holdDurationHours: number; // 48 hours
  maxCommissionPctOfRent: number;
  paymentMode: 'test_disabled' | 'paystack_test' | 'paystack_live';
  paystackPartnerApproved: boolean;
  updatedAt: string;
}

export interface FinancialBreakdown {
  yearlyRentKobo: number; // Paid DIRECT to landlord/caretaker after inspection (NEVER on platform)
  agentCommissionKobo: number; // Agent fee
  inspectionFeeKobo: number; // Fixed ₦3,000 (300000 kobo)
  totalBookingFeeKobo: number; // agentCommissionKobo + inspectionFeeKobo
  totalPayableKobo: number; // Amount payable now on platform (= totalBookingFeeKobo)
  agentSharePct: number; // 40
  sugSharePct: number; // 35
  platformSharePct: number; // 25
  agentEarningsKobo: number; // 40% of agentCommissionKobo
  sugAllocationKobo: number; // 35% of agentCommissionKobo
  platformAgentShareKobo: number; // 25% of agentCommissionKobo
  platformInspectionFeeKobo: number; // 100% of inspectionFeeKobo
  platformTotalKobo: number; // platformAgentShareKobo + platformInspectionFeeKobo
  processingFeeEstimateKobo: number;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  whatsappNumber?: string;
  role: UserRole;
  matricNumber?: string;
  department?: string;
  faculty?: string;
  isDemo?: boolean;
  createdAt: string;
}

export interface AgentProfile {
  agentId: string;
  ownerUid: string;
  fullName: string;
  phone: string;
  whatsappNumber?: string;
  email: string;
  absuId: string;
  ninLast4?: string;
  ninProtectedRef?: string; // Never exposed in public queries
  operatingArea: LocationArea;
  idDocumentName: string;
  idDocumentUrl?: string;
  profilePhotoUrl: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  paystackRecipientCode?: string;
  emergencyContact: string;
  experienceYears: number;
  status: AgentStatus;
  rating: number;
  completedInspections: number;
  complaintsCount: number;
  createdAt: string;
}

export interface PropertyMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  cloudinaryPublicId?: string;
  caption: string;
  fileName: string;
  sizeBytes: number;
}

export interface PropertyReview {
  reviewId: string;
  propertyId: string;
  bookingReference: string;
  studentName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface PropertyListing {
  propertyId: string;
  agentUid: string;
  agentId: string;
  agentName: string;
  title: string;
  category: PropertyCategory;
  locationArea: LocationArea;
  preciseAddress: string;
  coordinates: { lat: number; lng: number };
  yearlyRentKobo: number;
  agentCommissionKobo: number;
  inspectionFeeKobo: number;
  availableRooms: number;
  availabilityStatus: AvailabilityStatus;
  lodgeStatus: LodgeStatus;
  verificationStatus: VerificationStatus;
  rejectionReason?: string;
  flaggedSuspiciousReason?: string;
  landlordVerified?: boolean;
  featured: boolean;
  coverImageUrl: string;
  media: PropertyMediaItem[];
  videoTourUrl?: string;
  description: string;
  amenities: string[];
  landlordName: string;
  landlordPhone: string;
  caretakerName: string;
  caretakerPhone: string;
  landlordAuthorizationDoc: string;
  lastConfirmedAt: string;
  createdAt: string;
}

export interface InspectionContactDetails {
  fullName: string;
  phoneNumber: string;
  whatsappOrAltPhone: string;
  preferredTimeSlot: InspectionTimeSlot | string;
  campusMeetupPoint: string;
  notesForAgent?: string;
  submittedAt: string;
}

export interface BookingRecord {
  bookingId: string;
  bookingReference: string;
  studentUid: string;
  studentName: string;
  studentPhone?: string;
  studentMatric: string;
  agentUid: string;
  agentName: string;
  agentPhone?: string;
  agentPhotoUrl?: string;
  propertyId: string;
  propertyTitle: string;
  propertyRoomType?: string;
  propertyCoverUrl: string;
  locationArea: LocationArea;
  breakdown: FinancialBreakdown;
  status: BookingStatus;
  paymentStatus: 'Unpaid' | 'Held' | 'Test Paid' | 'Failed' | 'Refund Pending' | 'Refunded' | 'Settled';
  paymentHoldStatus: PaymentHoldStatus;
  inspectionStatus: 'Pending Schedule' | 'Scheduled' | 'Completed' | 'Disputed';
  inspectionDate: string;
  inspectionTimeSlot?: InspectionTimeSlot | string;
  inspectionContact?: InspectionContactDetails;
  paidAt?: string;
  splitAt?: string; // paidAt + 48 hours
  confirmedAt?: string;
  autoConfirmed?: boolean;
  settlementAuthorizationCode?: string;
  paystackReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementTransferRecord {
  settlementId: string;
  bookingId: string;
  bookingReference: string;
  recipientType: 'agent' | 'sug' | 'platform';
  recipientName: string;
  amountKobo: number;
  transferCode?: string;
  status: TransferStatus;
  retryCount: number;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRecord {
  refundId: string;
  bookingId: string;
  bookingReference: string;
  studentUid: string;
  amountKobo: number;
  reason: DisputeReason;
  paystackRefundRef?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEventLog {
  eventId: string;
  webhookId: string;
  bookingReference: string;
  eventType:
    | 'charge.success'
    | 'charge.failed'
    | 'refund.processed'
    | 'refund.pending'
    | 'refund.failed'
    | 'transfer.success'
    | 'transfer.failed'
    | 'transfer.reversed'
    | 'transfer.settled';
  amountKobo: number;
  signatureValid: boolean;
  duplicateIgnored: boolean;
  status: 'processed' | 'ignored_duplicate' | 'rejected_signature' | 'failed';
  createdAt: string;
}

export interface DisputeCase {
  disputeId: string;
  bookingId: string;
  bookingReference: string;
  propertyTitle: string;
  studentUid: string;
  studentName: string;
  agentUid: string;
  agentName: string;
  amountPaidKobo: number;
  reason: DisputeReason;
  description: string;
  evidenceFileName?: string;
  inspectionDate: string;
  status: DisputeStatus;
  resolutionNote?: string;
  decidedBy?: string;
  history: { timestamp: string; actor: string; note: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  notificationId: string;
  recipientUid: string;
  recipientRole: UserRole;
  title: string;
  message: string;
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms';
  read: boolean;
  createdAt: string;
  relatedBookingRef?: string;
  relatedPropertyId?: string;
  relatedDisputeId?: string;
  category?: 'booking' | 'inspection' | 'dispute' | 'verification' | 'payment' | 'system';
}

export interface AuditLogEntry {
  logId: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: 'property' | 'agent' | 'booking' | 'dispute' | 'settings' | 'system' | 'payment' | 'user' | 'settlement' | 'refund';
  targetId: string;
  summary: string;
  createdAt: string;
}

export interface BackupSnapshot {
  backupId: string;
  label: string;
  tablesCount: number;
  recordsCount: number;
  sizeKb: number;
  status: 'Verified' | 'Completed';
  createdAt: string;
}

export interface SugAnnouncement {
  announcementId: string;
  title: string;
  body: string;
  publishedBy: string;
  createdAt: string;
}
