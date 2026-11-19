export type UserRole =
  | 'student'
  | 'agent'
  | 'sug_admin'
  | 'sug_president'
  | 'tech_manager';

export type LocationArea =
  | 'School Gate'
  | 'Back Gate'
  | 'Inside School'
  | 'Uturu Main Town'
  | 'Eke-Okigwe Axis';

export type PropertyCategory =
  | 'Self-Contain'
  | 'Single Room'
  | 'Two-Bedroom'
  | 'Apartment'
  | 'Shared Hostel';

export type AvailabilityStatus = 'Available' | 'Unavailable';

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

export type DisputeReason =
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
  inspectionFeeKobo: number;
  platformSharePct: number;
  agentSharePct: number;
  sugPlatformSharePct: number;
  techManagerPlatformSharePct: number;
  maxCommissionPctOfRent: number;
  paymentMode: 'test_disabled';
  paystackPartnerApproved: boolean;
  updatedAt: string;
}

export interface FinancialBreakdown {
  yearlyRentKobo: number;
  agentCommissionKobo: number;
  inspectionFeeKobo: number;
  totalPayableKobo: number;
  platformSharePct: number;
  agentSharePct: number;
  sugPlatformSharePct: number;
  techManagerPlatformSharePct: number;
  platformCommissionKobo: number;
  agentEarningsKobo: number;
  sugAllocationKobo: number;
  techManagerAllocationKobo: number;
  landlordRentKobo: number;
  processingFeeEstimateKobo: number;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
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
  email: string;
  absuId: string;
  idDocumentName: string;
  profilePhotoUrl: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
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
  verificationStatus: VerificationStatus;
  featured: boolean;
  coverImageUrl: string;
  media: PropertyMediaItem[];
  videoTourUrl?: string;
  description: string;
  amenities: string[];
  landlordName: string;
  landlordPhone: string;
  landlordAuthorizationDoc: string;
  lastConfirmedAt: string;
  createdAt: string;
}

export interface InspectionContactDetails {
  fullName: string;
  phoneNumber: string;
  whatsappOrAltPhone?: string;
  preferredTimeSlot: string;
  campusMeetupPoint: string;
  notesForAgent?: string;
  submittedAt: string;
}

export interface BookingRecord {
  bookingId: string;
  bookingReference: string;
  studentUid: string;
  studentName: string;
  studentMatric: string;
  agentUid: string;
  agentName: string;
  propertyId: string;
  propertyTitle: string;
  propertyCoverUrl: string;
  locationArea: LocationArea;
  breakdown: FinancialBreakdown;
  status: BookingStatus;
  paymentStatus: 'Unpaid' | 'Test Paid' | 'Failed' | 'Refunded';
  inspectionStatus: 'Pending Schedule' | 'Scheduled' | 'Completed' | 'Disputed';
  inspectionDate: string;
  inspectionContact?: InspectionContactDetails;
  confirmedAt?: string;
  settlementAuthorizationCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEventLog {
  eventId: string;
  webhookId: string;
  bookingReference: string;
  eventType: 'charge.success' | 'charge.failed' | 'refund.processed' | 'transfer.settled';
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
  channel: 'in_app' | 'email';
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
  targetType: 'property' | 'agent' | 'booking' | 'dispute' | 'settings' | 'system' | 'payment';
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
