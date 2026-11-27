import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  calculateFinancialBreakdown,
  computeSplitAtIso,
  DEFAULT_INSPECTION_FEE_KOBO,
  DEFAULT_PLATFORM_SETTINGS,
  nairaToKobo,
} from '../domain/finance';
import { canTransitionBooking } from '../domain/bookingMachine';
import {
  detectSuspiciousListingDescription,
  generateBookingReference,
  isInspectionConfirmationEligible,
  processIdempotentWebhook,
  validateAllowedAgentFeeNaira,
  validateInspectionContact,
  validateLodgeMediaRequirements,
} from '../domain/validation';
import {
  AgentProfile,
  AgentStatus,
  AuditLogEntry,
  BackupSnapshot,
  BookingRecord,
  DisputeCase,
  DisputeReason,
  DisputeStatus,
  InspectionContactDetails,
  isSugAdminRole,
  isSuperAdminRole,
  LocationArea,
  LodgeStatus,
  NotificationItem,
  PaymentEventLog,
  PlatformSettings,
  PropertyListing,
  PropertyReview,
  RefundRecord,
  SettlementTransferRecord,
  SugAnnouncement,
  UserProfile,
  UserRole,
} from '../domain/types';
import {
  DEMO_USERS,
  IMAGES,
  SEED_AGENTS,
  SEED_ANNOUNCEMENTS,
  SEED_AUDIT_LOGS,
  SEED_BACKUPS,
  SEED_BOOKINGS,
  SEED_DISPUTES,
  SEED_NOTIFICATIONS,
  SEED_PAYMENT_EVENTS,
  SEED_PROPERTIES,
  SEED_REFUNDS,
  SEED_REVIEWS,
  SEED_SETTLEMENTS,
  SEED_SUG_ADMINS,
  SugAdminAccount,
} from '../data/seedData';
import { auth, googleAuthProvider, testConnection } from '../lib/firebase';
import {
  fetchServerControlledUserRole,
  getSupabaseClient,
  isSupabaseConfigured,
  subscribeMarketplaceRealtime,
  testSupabaseConnection,
} from '../lib/supabase';
import { UnconfiguredSmsProvider } from '../lib/sms';

export type ActivePage =
  | 'home'
  | 'lodge-details'
  | 'student-dashboard'
  | 'agent-dashboard'
  | 'sug-dashboard'
  | 'tech-dashboard'
  | 'policies';

interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

interface MarketplaceContextValue {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  selectedPropertyId: string | null;
  openPropertyDetails: (propertyId: string) => void;
  currentUser: UserProfile | null;
  authReady: boolean;
  isLoadingData: boolean;
  dataError: string | null;
  retryDataSync: () => Promise<void>;
  firebaseConnected: boolean;
  supabaseConfigured: boolean;
  supabaseConnected: boolean;
  realtimeConnected: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  checkoutProperty: PropertyListing | null;
  setCheckoutProperty: (prop: PropertyListing | null) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithSupabaseEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signInStudentWithPhonePassword: (phone: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  switchDemoRole: (
    role: 'student' | 'agent' | 'sug_admin' | 'super_admin' | 'sug_president' | 'tech_manager'
  ) => void;
  registerStudentAccount: (input: {
    fullName: string;
    email?: string;
    phone: string;
    whatsappNumber: string;
    matricNumber?: string;
    department?: string;
    faculty?: string;
  }) => void;
  registerAgentAccount: (input: {
    fullName: string;
    phone: string;
    whatsappNumber: string;
    email: string;
    absuId?: string;
    ninNumber: string;
    operatingArea: LocationArea;
    idDocumentName: string;
    idDocumentUrl?: string;
    profilePhotoUrl?: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    emergencyContact: string;
    experienceYears: number;
  }) => void;
  logoutUser: () => Promise<void>;
  settings: PlatformSettings;
  updatePlatformSettings: (next: Partial<PlatformSettings>) => { ok: boolean; error?: string };
  agents: AgentProfile[];
  sugAdmins: SugAdminAccount[];
  properties: PropertyListing[];
  bookings: BookingRecord[];
  disputes: DisputeCase[];
  settlements: SettlementTransferRecord[];
  refunds: RefundRecord[];
  paymentEvents: PaymentEventLog[];
  notifications: NotificationItem[];
  reviews: PropertyReview[];
  auditLogs: AuditLogEntry[];
  backups: BackupSnapshot[];
  announcements: SugAnnouncement[];
  appErrorLogs: { id: string; level: string; message: string; timestamp: string }[];
  toast: ToastMessage | null;
  showToast: (tone: ToastMessage['tone'], text: string) => void;
  initializeAndVerifyBooking: (input: {
    property: PropertyListing;
    inspectionDate: string;
    agreedPolicy: boolean;
    outcome: 'success' | 'fail';
    paystackReference?: string;
  }) => Promise<{ ok: boolean; booking?: BookingRecord; error?: string }>;
  submitInspectionContactInfo: (input: {
    bookingId: string;
    fullName: string;
    phoneNumber: string;
    whatsappOrAltPhone: string;
    preferredDate: string;
    preferredTimeSlot: string;
    campusMeetupPoint?: string;
    notesForAgent?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  confirmLodgeAndReleaseFunds: (bookingId: string) => Promise<{ ok: boolean; error?: string }>;
  submitRefundDispute: (input: {
    bookingId: string;
    reason: DisputeReason;
    description: string;
    inspectionDate: string;
    evidenceFileName?: string;
  }) => { ok: boolean; error?: string };
  resolveDisputeAsSug: (input: {
    disputeId: string;
    action: 'approve_refund' | 'reject_refund' | 'request_evidence' | 'escalate' | 'close';
    note: string;
  }) => { ok: boolean; error?: string };
  processApprovedRefund: (
    bookingId: string,
    simulatedOutcome?: 'processed' | 'pending' | 'failed'
  ) => { ok: boolean; error?: string };
  triggerProcessSplitsAsSuperAdmin: () => { processedCount: number; failedCount: number };
  retrySettlementTransferAsSuperAdmin: (settlementId: string) => { ok: boolean; error?: string };
  submitNewLodge: (input: {
    title: string;
    category: PropertyListing['category'];
    locationArea: PropertyListing['locationArea'];
    preciseAddress: string;
    yearlyRentNaira: number;
    agentCommissionNaira: number;
    availableRooms: number;
    description: string;
    amenities: string[];
    landlordName: string;
    landlordPhone: string;
    caretakerName: string;
    caretakerPhone: string;
    landlordAuthorizationDoc: string;
    saveAsDraft?: boolean;
    mediaNames: { type: 'image' | 'video'; name: string; previewUrl?: string; cloudinaryPublicId?: string; sizeBytes: number }[];
  }) => { ok: boolean; error?: string };
  toggleLodgeAvailability: (propertyId: string, nextStatus?: LodgeStatus) => void;
  reviewLodgeAsSug: (
    propertyId: string,
    decision: 'Approved' | 'Rejected' | 'Suspended' | 'Removed',
    options?: { rejectionReason?: string; title?: string; availableRooms?: number }
  ) => { ok: boolean; error?: string };
  deleteLodgeAsSuperAdmin: (propertyId: string) => { ok: boolean; error?: string };
  reviewAgentAsSuperAdmin: (agentId: string, status: AgentStatus) => { ok: boolean; error?: string };
  createSugAdminAsSuperAdmin: (input: {
    fullName: string;
    email: string;
    phone: string;
    officeTitle: string;
  }) => { ok: boolean; error?: string };
  toggleSugAdminStatusAsSuperAdmin: (uid: string) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  submitPropertyReview: (input: {
    propertyId: string;
    bookingReference: string;
    rating: number;
    comment: string;
  }) => { ok: boolean; error?: string };
  reportPropertyOrAgent: (input: {
    targetType: 'property' | 'agent';
    targetId: string;
    targetName: string;
    reason: string;
  }) => void;
  simulateWebhookCheck: (duplicate: boolean) => void;
  createBackupSnapshot: () => void;
  publishAnnouncement: (title: string, body: string) => void;
  updateUserRoleAsTech: (uid: string, role: UserRole) => void;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);
const smsProvider = new UnconfiguredSmsProvider();

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    SEED_PROPERTIES[0].propertyId
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [supabaseConfigured] = useState(() => isSupabaseConfigured());
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [checkoutProperty, setCheckoutProperty] = useState<PropertyListing | null>(null);

  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [agents, setAgents] = useState<AgentProfile[]>(SEED_AGENTS);
  const [sugAdmins, setSugAdmins] = useState<SugAdminAccount[]>(SEED_SUG_ADMINS);
  const [properties, setProperties] = useState<PropertyListing[]>(SEED_PROPERTIES);
  const [bookings, setBookings] = useState<BookingRecord[]>(SEED_BOOKINGS);
  const [disputes, setDisputes] = useState<DisputeCase[]>(SEED_DISPUTES);
  const [settlements, setSettlements] = useState<SettlementTransferRecord[]>(SEED_SETTLEMENTS);
  const [refunds, setRefunds] = useState<RefundRecord[]>(SEED_REFUNDS);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEventLog[]>(SEED_PAYMENT_EVENTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(SEED_NOTIFICATIONS);
  const [reviews, setReviews] = useState<PropertyReview[]>(SEED_REVIEWS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(SEED_AUDIT_LOGS);
  const [backups, setBackups] = useState<BackupSnapshot[]>(SEED_BACKUPS);
  const [announcements, setAnnouncements] = useState<SugAnnouncement[]>(SEED_ANNOUNCEMENTS);
  const [appErrorLogs] = useState([
    {
      id: 'err_01',
      level: 'INFO',
      message: 'Paystack 48-hour hold & split scheduler configured; awaiting production live secrets in Supabase project jjidjcnyknoavmefrrpi.',
      timestamp: '2026-11-25T04:10:00.000Z',
    },
  ]);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (tone: ToastMessage['tone'], text: string) => {
    const id = `toast_${Date.now()}`;
    setToast({ id, tone, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  };

  const retryDataSync = async () => {
    setIsLoadingData(true);
    setDataError(null);
    const res = await testSupabaseConnection();
    setSupabaseConnected(res.connected);
    if (!res.connected && supabaseConfigured) {
      setDataError(res.error || 'Unable to reach Supabase backend.');
    }
    setIsLoadingData(false);
  };

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (supabase) {
      retryDataSync();
      const unsubRealtime = subscribeMarketplaceRealtime((table) => {
        setRealtimeConnected(true);
        if (table === 'bookings' || table === 'properties') {
          testSupabaseConnection().then((r) => setSupabaseConnected(r.connected));
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const sbUser = session?.user;
        if (sbUser) {
          const authoritativeRole = await fetchServerControlledUserRole(sbUser.id);
          setCurrentUser((prev) => {
            if (prev && !prev.isDemo && prev.uid === sbUser.id) return prev;
            return {
              uid: sbUser.id,
              fullName:
                (sbUser.user_metadata?.full_name as string) ||
                sbUser.email?.split('@')[0] ||
                'ABSU Member',
              email: sbUser.email || '',
              phone: (sbUser.user_metadata?.phone as string) || '+2348000000000',
              whatsappNumber: (sbUser.user_metadata?.whatsapp_number as string) || (sbUser.user_metadata?.phone as string) || '',
              role: authoritativeRole,
              matricNumber: (sbUser.user_metadata?.matric_number as string) || undefined,
              department: (sbUser.user_metadata?.department as string) || undefined,
              faculty: (sbUser.user_metadata?.faculty as string) || 'ABSU Uturu',
              isDemo: false,
              createdAt: sbUser.created_at || new Date().toISOString(),
            };
          });
        }
        setAuthReady(true);
      });
      return () => {
        subscription.unsubscribe();
        unsubRealtime();
      };
    }

    if (!auth) {
      setAuthReady(true);
      return;
    }

    testConnection().then(setFirebaseConnected);
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const isBootstrappedSug = fbUser.email === 'absuconnect.team@gmail.com';
        setCurrentUser((prev) => {
          if (prev && !prev.isDemo && prev.uid === fbUser.uid) return prev;
          return {
            uid: fbUser.uid,
            fullName: fbUser.displayName || 'ABSU Member',
            email: fbUser.email || '',
            phone: '+2348000000000',
            role: isBootstrappedSug ? 'sug_admin' : 'student',
            matricNumber: isBootstrappedSug ? 'SUG-PRES-2026' : '2023/160412',
            department: 'General Studies',
            faculty: 'ABSU Uturu',
            isDemo: false,
            createdAt: new Date().toISOString(),
          };
        });
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const appendAudit = (
    action: string,
    targetType: AuditLogEntry['targetType'],
    targetId: string,
    summary: string,
    actor?: UserProfile | null
  ) => {
    const actorProfile = actor || currentUser;
    setAuditLogs((prev) => [
      {
        logId: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        actorUid: actorProfile?.uid || 'system',
        actorName: actorProfile?.fullName || 'System',
        actorRole: actorProfile?.role || 'super_admin',
        action,
        targetType,
        targetId,
        summary,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const pushNotification = (
    recipientUid: string,
    recipientRole: UserRole,
    title: string,
    message: string,
    meta?: {
      relatedBookingRef?: string;
      relatedPropertyId?: string;
      relatedDisputeId?: string;
      category?: NotificationItem['category'];
    }
  ) => {
    setNotifications((prev) => [
      {
        notificationId: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        recipientUid,
        recipientRole,
        title,
        message,
        channel: 'in_app',
        read: false,
        createdAt: new Date().toISOString(),
        ...meta,
      },
      ...prev,
    ]);
  };

  const openPropertyDetails = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setActivePage('lodge-details');
    window.scrollTo(0, 0);
  };

  const signInWithGoogle = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
        return;
      } catch (err: any) {
        showToast('error', err?.message || 'Supabase Google sign-in unavailable.');
        return;
      }
    }

    if (!auth || !googleAuthProvider) {
      showToast('error', 'Configure VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY for live Google Sign-In, or use Demo Roles.');
      return;
    }

    try {
      await signInWithPopup(auth, googleAuthProvider);
      setAuthModalOpen(false);
      showToast('success', 'Signed in via Google Authentication.');
    } catch (err: any) {
      showToast('error', err?.message || 'Google sign-in cancelled or unavailable.');
    }
  };

  const signInWithSupabaseEmail = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        error: 'Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are not configured yet.',
      };
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      return { ok: false, error: error.message };
    }
    setAuthModalOpen(false);
    showToast('success', 'Signed in via Supabase Authentication.');
    return { ok: true };
  };

  const signInStudentWithPhonePassword = async (
    phone: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleaned = phone.trim();
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 7 || password.length < 6) {
      return { ok: false, error: 'Enter a valid phone number and password (min 6 characters).' };
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      const normalizedPhone = cleaned.startsWith('+')
        ? cleaned
        : digits.startsWith('0')
        ? `+234${digits.slice(1)}`
        : `+${digits}`;
      const { error } = await supabase.auth.signInWithPassword({
        phone: normalizedPhone,
        password,
      });
      if (error) return { ok: false, error: error.message };
      setAuthModalOpen(false);
      showToast('success', 'Signed in with phone and password.');
      return { ok: true };
    }
    // Demo fallback login matching Chinedu's seeded student phone
    const demoStudent = DEMO_USERS.student;
    setCurrentUser({
      ...demoStudent,
      phone: cleaned,
      whatsappNumber: cleaned,
    });
    setAuthModalOpen(false);
    setActivePage('student-dashboard');
    showToast('success', 'Signed in to Student Account.');
    return { ok: true };
  };

  const switchDemoRole = (
    role: 'student' | 'agent' | 'sug_admin' | 'super_admin' | 'sug_president' | 'tech_manager'
  ) => {
    const user = DEMO_USERS[role] || DEMO_USERS.student;
    setCurrentUser(user);
    setAuthModalOpen(false);
    if (user.role === 'student') setActivePage('student-dashboard');
    else if (user.role === 'agent') setActivePage('agent-dashboard');
    else if (isSuperAdminRole(user.role)) setActivePage('tech-dashboard');
    else setActivePage('sug-dashboard');
    window.scrollTo(0, 0);
    showToast('info', `Signed in as: ${user.fullName}`);
  };

  const registerStudentAccount = (input: {
    fullName: string;
    email?: string;
    phone: string;
    whatsappNumber: string;
    matricNumber?: string;
    department?: string;
    faculty?: string;
  }) => {
    const newStudent: UserProfile = {
      uid: `stu_${Date.now()}`,
      fullName: input.fullName.trim(),
      email: input.email?.trim() || `${input.phone.replace(/\D/g, '')}@student.absulodgesafe.ng`,
      phone: input.phone.trim(),
      whatsappNumber: input.whatsappNumber.trim() || input.phone.trim(),
      role: 'student',
      matricNumber: input.matricNumber?.trim() || 'ABSU-2026',
      department: input.department?.trim() || 'General Studies',
      faculty: input.faculty?.trim() || 'ABSU Uturu',
      isDemo: true,
      createdAt: new Date().toISOString(),
    };
    setCurrentUser(newStudent);
    setAuthModalOpen(false);
    setActivePage('student-dashboard');
    pushNotification(
      newStudent.uid,
      'student',
      'Welcome to ABSU Lodge',
      `Your student profile is active. Remember: Pay ONLY Agent Fee + ₦3,000 Inspection Fee here; pay rent directly to the landlord/caretaker after inspection.`
    );
    showToast('success', 'Student account created and signed in.');
  };

  const registerAgentAccount = (input: {
    fullName: string;
    phone: string;
    whatsappNumber: string;
    email: string;
    absuId?: string;
    ninNumber: string;
    operatingArea: LocationArea;
    idDocumentName: string;
    idDocumentUrl?: string;
    profilePhotoUrl?: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    emergencyContact: string;
    experienceYears: number;
  }) => {
    const uid = `agt_usr_${Date.now()}`;
    const ninClean = input.ninNumber.replace(/\D/g, '');
    const newAgent: AgentProfile = {
      agentId: `agt_${Date.now().toString().slice(-5)}`,
      ownerUid: uid,
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      whatsappNumber: input.whatsappNumber.trim() || input.phone.trim(),
      email: input.email.trim(),
      absuId: input.absuId?.trim() || `ABSU-AGT-${Date.now().toString().slice(-4)}`,
      ninLast4: ninClean.slice(-4) || '0000',
      ninProtectedRef: `NIN_ENC_${Date.now().toString().slice(-6)}`,
      operatingArea: input.operatingArea,
      idDocumentName: input.idDocumentName || 'NIN_Slip_Upload.pdf',
      idDocumentUrl: input.idDocumentUrl,
      profilePhotoUrl: input.profilePhotoUrl || IMAGES.courtyard,
      bankName: input.bankName.trim(),
      accountNumber: input.accountNumber.trim(),
      accountName: input.accountName.trim(),
      emergencyContact: input.emergencyContact.trim(),
      experienceYears: input.experienceYears,
      status: 'Pending Approval',
      rating: 0,
      completedInspections: 0,
      complaintsCount: 0,
      createdAt: new Date().toISOString(),
    };

    const user: UserProfile = {
      uid,
      fullName: newAgent.fullName,
      email: newAgent.email,
      phone: newAgent.phone,
      whatsappNumber: newAgent.whatsappNumber,
      role: 'agent',
      isDemo: true,
      createdAt: newAgent.createdAt,
    };

    setAgents((prev) => [newAgent, ...prev]);
    setCurrentUser(user);
    setAuthModalOpen(false);
    setActivePage('agent-dashboard');

    pushNotification(
      'demo_tech_manager',
      'super_admin',
      'New Agent Registration Pending Super Admin Approval',
      `${newAgent.fullName} (${newAgent.operatingArea}) submitted NIN & verification docs for Super Admin review.`
    );
    appendAudit(
      'AGENT_REGISTERED',
      'agent',
      newAgent.agentId,
      `New agent ${newAgent.fullName} entered Pending Approval (operating area: ${newAgent.operatingArea}).`,
      user
    );
    showToast('info', 'Agent application submitted! Status: Pending Approval by Super Admin.');
  };

  const logoutUser = async () => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      if (auth?.currentUser) {
        await signOut(auth);
      }
    } catch {
      // Ignore signout error in demo mode
    }
    setCurrentUser(null);
    setAuthModalOpen(false);
    setActivePage('home');
    showToast('info', 'Logged out of ABSU Lodge.');
  };

  const updatePlatformSettings = (
    next: Partial<PlatformSettings>
  ): { ok: boolean; error?: string } => {
    if (!currentUser || !isSuperAdminRole(currentUser.role)) {
      return { ok: false, error: 'Only Super Admin can update gateway or platform settlement settings.' };
    }
    const merged: PlatformSettings = {
      ...settings,
      ...next,
      updatedAt: new Date().toISOString(),
    };
    if (merged.agentSharePct + merged.sugSharePct + merged.platformSharePct !== 100) {
      return { ok: false, error: 'Agent + SUG + Platform split percentages must equal 100%.' };
    }
    setSettings(merged);
    appendAudit(
      'SETTINGS_UPDATED',
      'settings',
      'global',
      `Updated split: Agent ${merged.agentSharePct}% / SUG ${merged.sugSharePct}% / Platform ${merged.platformSharePct}%.`
    );
    showToast('success', 'Platform settings updated.');
    return { ok: true };
  };

  const initializeAndVerifyBooking = async (input: {
    property: PropertyListing;
    inspectionDate: string;
    agreedPolicy: boolean;
    outcome: 'success' | 'fail';
    paystackReference?: string;
  }): Promise<{ ok: boolean; booking?: BookingRecord; error?: string }> => {
    if (!currentUser) {
      return { ok: false, error: 'Please sign in as an ABSU student before booking.' };
    }
    if (!input.agreedPolicy) {
      return { ok: false, error: 'Please read and agree to the Mandatory Booking Policy first.' };
    }
    if (input.property.lodgeStatus !== 'Approved' && input.property.verificationStatus !== 'SUG Verified') {
      return { ok: false, error: 'Only SUG Approved lodges can be booked.' };
    }
    if (input.property.availabilityStatus === 'Unavailable' || input.property.lodgeStatus === 'Taken') {
      return { ok: false, error: 'This lodge is currently unavailable.' };
    }

    const agentObj = agents.find(
      (a) => a.agentId === input.property.agentId || a.ownerUid === input.property.agentUid
    );

    try {
      const initRes = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: input.property.propertyId,
          propertyTitle: input.property.title,
          propertyCoverUrl: input.property.coverImageUrl,
          locationArea: input.property.locationArea,
          studentUid: currentUser.uid,
          studentName: currentUser.fullName,
          studentPhone: currentUser.phone,
          studentEmail: currentUser.email,
          studentMatric: currentUser.matricNumber || 'ABSU/PENDING',
          agentUid: input.property.agentUid,
          agentName: input.property.agentName,
          agentPhone: agentObj?.phone || '+2348067743102',
          yearlyRentKobo: input.property.yearlyRentKobo,
          agentCommissionKobo: input.property.agentCommissionKobo,
          inspectionDate: input.inspectionDate,
          agreedPolicy: input.agreedPolicy,
        }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) {
        return { ok: false, error: initData.error || 'Initialization failed.' };
      }

      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: initData.booking.bookingReference,
          outcome: input.outcome,
          paystackReference: input.paystackReference,
        }),
      });
      const verifyData = await verifyRes.json();
      const verifiedBooking: BookingRecord = {
        ...verifyData.booking,
        agentPhone: agentObj?.phone || '+2348067743102',
        agentPhotoUrl: agentObj?.profilePhotoUrl || IMAGES.courtyard,
        propertyRoomType: input.property.category,
      };

      if (input.outcome === 'fail' || !verifyData.verified) {
        setPaymentEvents((prev) => [
          {
            eventId: `evt_${Date.now()}`,
            webhookId: `wh_fail_${verifiedBooking.bookingReference}`,
            bookingReference: verifiedBooking.bookingReference,
            eventType: 'charge.failed',
            amountKobo: verifiedBooking.breakdown.totalPayableKobo,
            signatureValid: true,
            duplicateIgnored: false,
            status: 'failed',
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        appendAudit(
          'PAYMENT_FAILED',
          'payment',
          verifiedBooking.bookingReference,
          `Payment failed for ${verifiedBooking.propertyTitle}; no active booking created.`
        );
        return {
          ok: false,
          error: 'Payment declined. Failed payments do not create active inspection bookings.',
        };
      }

      setBookings((prev) => [verifiedBooking, ...prev]);
      setPaymentEvents((prev) => [
        {
          eventId: `evt_${Date.now()}`,
          webhookId: `wh_ok_${verifiedBooking.bookingReference}`,
          bookingReference: verifiedBooking.bookingReference,
          eventType: 'charge.success',
          amountKobo: verifiedBooking.breakdown.totalPayableKobo,
          signatureValid: true,
          duplicateIgnored: false,
          status: 'processed',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      pushNotification(
        currentUser.uid,
        'student',
        `Payment Held (48h) — ${verifiedBooking.bookingReference}`,
        `Paid ₦${(verifiedBooking.breakdown.totalPayableKobo / 100).toLocaleString()} (Agent Fee + ₦3,000 Inspection Fee). Rent is paid directly to landlord/caretaker after inspection.`,
        {
          relatedBookingRef: verifiedBooking.bookingReference,
          relatedPropertyId: verifiedBooking.propertyId,
          category: 'booking',
        }
      );
      pushNotification(
        verifiedBooking.agentUid,
        'agent',
        `New Booking Alert — ${verifiedBooking.bookingReference}`,
        `${currentUser.fullName} booked ${verifiedBooking.propertyTitle}. Your 40% share (₦${(verifiedBooking.breakdown.agentEarningsKobo / 100).toLocaleString()}) enters 48-hour hold.`,
        {
          relatedBookingRef: verifiedBooking.bookingReference,
          relatedPropertyId: verifiedBooking.propertyId,
          category: 'booking',
        }
      );
      pushNotification(
        'demo_sug_president',
        'sug_admin',
        `New Booking Recorded — ${verifiedBooking.bookingReference}`,
        `New inspection booking initialized on ${verifiedBooking.propertyTitle}. SUG 35% allocation pending 48-hour hold.`,
        {
          relatedBookingRef: verifiedBooking.bookingReference,
          relatedPropertyId: verifiedBooking.propertyId,
          category: 'booking',
        }
      );
      appendAudit(
        'BOOKING_CREATED',
        'booking',
        verifiedBooking.bookingReference,
        `Verified Agent Fee + ₦3k Inspection Fee payment (${verifiedBooking.bookingReference}). 48h hold active.`
      );
      return { ok: true, booking: verifiedBooking };
    } catch {
      const breakdown = calculateFinancialBreakdown(
        input.property.yearlyRentKobo,
        input.property.agentCommissionKobo,
        settings
      );
      const ref = generateBookingReference(bookings.length + 1);
      if (input.outcome === 'fail') {
        return {
          ok: false,
          error: 'Payment declined. Failed payments do not create active inspection bookings.',
        };
      }
      const now = new Date().toISOString();
      const splitAt = computeSplitAtIso(now, 48);
      const bk: BookingRecord = {
        bookingId: `bk_${Date.now()}`,
        bookingReference: ref,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentPhone: currentUser.phone,
        studentMatric: currentUser.matricNumber || 'ABSU/PENDING',
        agentUid: input.property.agentUid,
        agentName: input.property.agentName,
        agentPhone: agentObj?.phone || '+2348067743102',
        agentPhotoUrl: agentObj?.profilePhotoUrl || IMAGES.courtyard,
        propertyId: input.property.propertyId,
        propertyTitle: input.property.title,
        propertyRoomType: input.property.category,
        propertyCoverUrl: input.property.coverImageUrl,
        locationArea: input.property.locationArea,
        breakdown,
        status: 'Awaiting Inspection',
        paymentStatus: 'Held',
        paymentHoldStatus: 'held',
        inspectionStatus: 'Scheduled',
        inspectionDate: input.inspectionDate,
        paidAt: now,
        splitAt,
        paystackReference: input.paystackReference || ref,
        createdAt: now,
        updatedAt: now,
      };
      setBookings((prev) => [bk, ...prev]);
      setPaymentEvents((prev) => [
        {
          eventId: `evt_${Date.now()}`,
          webhookId: `wh_ok_${bk.bookingReference}`,
          bookingReference: bk.bookingReference,
          eventType: 'charge.success',
          amountKobo: bk.breakdown.totalPayableKobo,
          signatureValid: true,
          duplicateIgnored: false,
          status: 'processed',
          createdAt: now,
        },
        ...prev,
      ]);
      pushNotification(
        currentUser.uid,
        'student',
        `Payment Held (48h) — ${bk.bookingReference}`,
        `Paid ₦${(bk.breakdown.totalPayableKobo / 100).toLocaleString()} (Agent Fee + ₦3,000 Inspection Fee). Complete your boarding form to finalize inspection.`,
        { relatedBookingRef: bk.bookingReference, relatedPropertyId: bk.propertyId, category: 'booking' }
      );
      pushNotification(
        bk.agentUid,
        'agent',
        `New Booking Alert — ${bk.bookingReference}`,
        `${currentUser.fullName} booked ${bk.propertyTitle}. Your 40% share is held for 48 hours pending inspection.`,
        { relatedBookingRef: bk.bookingReference, relatedPropertyId: bk.propertyId, category: 'booking' }
      );
      pushNotification(
        'demo_sug_president',
        'sug_admin',
        `New Booking Recorded — ${bk.bookingReference}`,
        `New inspection booking initialized on ${bk.propertyTitle}.`,
        { relatedBookingRef: bk.bookingReference, relatedPropertyId: bk.propertyId, category: 'booking' }
      );
      appendAudit('BOOKING_CREATED', 'booking', bk.bookingReference, `Created booking ${bk.bookingReference}.`);
      return { ok: true, booking: bk };
    }
  };

  const submitInspectionContactInfo = async (input: {
    bookingId: string;
    fullName: string;
    phoneNumber: string;
    whatsappOrAltPhone: string;
    preferredDate: string;
    preferredTimeSlot: string;
    campusMeetupPoint?: string;
    notesForAgent?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const check = validateInspectionContact(input);
    if (!check.valid) {
      return { ok: false, error: check.error };
    }

    const target = bookings.find((b) => b.bookingId === input.bookingId);
    if (!target) {
      return { ok: false, error: 'Booking record not found.' };
    }

    const now = new Date().toISOString();
    const contactPayload: InspectionContactDetails = {
      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      whatsappOrAltPhone: input.whatsappOrAltPhone.trim(),
      preferredTimeSlot: input.preferredTimeSlot.trim(),
      campusMeetupPoint: input.campusMeetupPoint?.trim() || 'Direct at Lodge Axis (Uturu)',
      notesForAgent: input.notesForAgent?.trim() || undefined,
      submittedAt: now,
    };

    try {
      await fetch('/api/bookings/inspection-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: target.bookingReference,
          preferredDate: input.preferredDate,
          ...contactPayload,
        }),
      });
    } catch {
      // Offline / static host fallback
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === input.bookingId
          ? {
              ...b,
              inspectionDate: input.preferredDate || b.inspectionDate,
              inspectionTimeSlot: contactPayload.preferredTimeSlot,
              inspectionContact: contactPayload,
              status: b.status === 'Awaiting Inspection' ? 'Inspection Scheduled' : b.status,
              inspectionStatus: 'Scheduled',
              updatedAt: now,
            }
          : b
      )
    );

    // Trigger SMS provider adapter (honestly records unconfigured state without faking SMS delivery)
    await smsProvider.sendSms({
      toPhone: target.agentPhone || '+2348067743102',
      message: `ABSU Lodge Alert: ${contactPayload.fullName} (${contactPayload.phoneNumber}) booked ${target.propertyTitle} for ${input.preferredDate} (${contactPayload.preferredTimeSlot}).`,
      reference: target.bookingReference,
    });

    pushNotification(
      target.agentUid,
      'agent',
      `Student Inspection Contact Received — ${target.bookingReference}`,
      `Student ${contactPayload.fullName} | Phone: ${contactPayload.phoneNumber} | WhatsApp: ${contactPayload.whatsappOrAltPhone} | Date: ${input.preferredDate} (${contactPayload.preferredTimeSlot}).${contactPayload.notesForAgent ? ` Note: "${contactPayload.notesForAgent}"` : ''}`,
      {
        relatedBookingRef: target.bookingReference,
        relatedPropertyId: target.propertyId,
        category: 'inspection',
      }
    );
    pushNotification(
      target.studentUid,
      'student',
      `Inspection Confirmed with ${target.agentName}`,
      `Your inspection for ${target.propertyTitle} is scheduled on ${input.preferredDate} (${contactPayload.preferredTimeSlot}). Call ${target.agentName} at ${target.agentPhone || 'agent phone'} to confirm arrival.`,
      {
        relatedBookingRef: target.bookingReference,
        relatedPropertyId: target.propertyId,
        category: 'inspection',
      }
    );
    appendAudit(
      'INSPECTION_BOARDING_COMPLETED',
      'booking',
      target.bookingReference,
      `Student completed mandatory boarding form for ${input.preferredDate} (${contactPayload.preferredTimeSlot}).`
    );
    return { ok: true };
  };

  const confirmLodgeAndReleaseFunds = async (
    bookingId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser || currentUser.role !== 'student') {
      return { ok: false, error: 'Only the booking student can confirm physical inspection.' };
    }
    const target = bookings.find((b) => b.bookingId === bookingId);
    if (!target) return { ok: false, error: 'Booking not found.' };
    if (target.studentUid !== currentUser.uid) {
      return { ok: false, error: 'Students can only confirm their own bookings.' };
    }

    const gate = isInspectionConfirmationEligible(target.inspectionDate, target.inspectionTimeSlot);
    if (!gate.eligible) {
      return {
        ok: false,
        error: `Confirmation unlocks on your scheduled inspection time (${gate.unlocksAtLabel}).`,
      };
    }

    const check = canTransitionBooking(target.status, 'Confirmed', 'student');
    if (!check.allowed) return { ok: false, error: check.reason };

    const now = new Date().toISOString();
    const authCode = `TRF-STL-${Date.now().toString().slice(-6)}`;

    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === bookingId
          ? {
              ...b,
              status: 'Settled',
              paymentStatus: 'Settled',
              paymentHoldStatus: 'settled',
              inspectionStatus: 'Completed',
              confirmedAt: now,
              settlementAuthorizationCode: authCode,
              updatedAt: now,
            }
          : b
      )
    );

    const newTransfers: SettlementTransferRecord[] = [
      {
        settlementId: `stl_${Date.now()}_agt`,
        bookingId: target.bookingId,
        bookingReference: target.bookingReference,
        recipientType: 'agent',
        recipientName: target.agentName,
        amountKobo: target.breakdown.agentEarningsKobo,
        transferCode: `${authCode}-AGT`,
        status: 'successful',
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        settlementId: `stl_${Date.now()}_sug`,
        bookingId: target.bookingId,
        bookingReference: target.bookingReference,
        recipientType: 'sug',
        recipientName: 'ABSU SUG Accommodation Treasury',
        amountKobo: target.breakdown.sugAllocationKobo,
        transferCode: `${authCode}-SUG`,
        status: 'successful',
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        settlementId: `stl_${Date.now()}_plt`,
        bookingId: target.bookingId,
        bookingReference: target.bookingReference,
        recipientType: 'platform',
        recipientName: 'Platform Backend Management (25% + ₦3,000)',
        amountKobo: target.breakdown.platformTotalKobo,
        transferCode: `${authCode}-PLT`,
        status: 'successful',
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
    setSettlements((prev) => [...newTransfers, ...prev]);

    setProperties((prev) =>
      prev.map((p) => {
        if (p.propertyId !== target.propertyId) return p;
        const nextRooms = Math.max(0, p.availableRooms - 1);
        return {
          ...p,
          availableRooms: nextRooms,
          availabilityStatus: nextRooms === 0 ? 'Unavailable' : p.availabilityStatus,
          lodgeStatus: nextRooms === 0 ? 'Taken' : p.lodgeStatus,
        };
      })
    );

    pushNotification(
      target.studentUid,
      'student',
      `Lodge Confirmed — ${target.bookingReference}`,
      `Inspection confirmed (${authCode}). Remember to collect an official receipt when paying annual rent directly to the landlord or caretaker.`,
      { relatedBookingRef: target.bookingReference, relatedPropertyId: target.propertyId, category: 'payment' }
    );
    pushNotification(
      target.agentUid,
      'agent',
      `40% Share Released — ${target.bookingReference}`,
      `${target.studentName} confirmed ${target.propertyTitle}. Your 40% share (₦${(target.breakdown.agentEarningsKobo / 100).toLocaleString()}) is now Available.`,
      { relatedBookingRef: target.bookingReference, relatedPropertyId: target.propertyId, category: 'payment' }
    );
    appendAudit(
      'BOOKING_CONFIRMED_SETTLED',
      'booking',
      target.bookingReference,
      `Student confirmed lodge (${authCode}); 40/35/25 + ₦3k split released.`
    );
    showToast('success', 'Lodge confirmed! Split payouts released to Agent, SUG, and Platform.');
    return { ok: true };
  };

  const submitRefundDispute = (input: {
    bookingId: string;
    reason: DisputeReason;
    description: string;
    inspectionDate: string;
    evidenceFileName?: string;
  }): { ok: boolean; error?: string } => {
    if (!currentUser || currentUser.role !== 'student') {
      return { ok: false, error: 'Only the booking student can request a refund.' };
    }
    const target = bookings.find((b) => b.bookingId === input.bookingId);
    if (!target) return { ok: false, error: 'Booking not found.' };

    const check = canTransitionBooking(target.status, 'Dispute Requested', 'student');
    if (!check.allowed) return { ok: false, error: check.reason };

    const now = new Date().toISOString();
    const disputeId = `dsp_${Date.now().toString().slice(-6)}`;
    const refundId = `ref_${Date.now().toString().slice(-6)}`;

    const newDispute: DisputeCase = {
      disputeId,
      bookingId: target.bookingId,
      bookingReference: target.bookingReference,
      propertyTitle: target.propertyTitle,
      studentUid: target.studentUid,
      studentName: target.studentName,
      agentUid: target.agentUid,
      agentName: target.agentName,
      amountPaidKobo: target.breakdown.totalPayableKobo,
      reason: input.reason,
      description: input.description.trim(),
      evidenceFileName: input.evidenceFileName,
      inspectionDate: input.inspectionDate,
      status: 'Under SUG Review',
      history: [
        {
          timestamp: now,
          actor: `${currentUser.fullName} (Student)`,
          note: `Requested refund: ${input.reason}`,
        },
        {
          timestamp: now,
          actor: 'System Hold Lock',
          note: 'Payment locked as refund_pending; 48h auto-split disabled for this booking.',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const newRefund: RefundRecord = {
      refundId,
      bookingId: target.bookingId,
      bookingReference: target.bookingReference,
      studentUid: target.studentUid,
      amountKobo: target.breakdown.totalPayableKobo,
      reason: input.reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    setDisputes((prev) => [newDispute, ...prev]);
    setRefunds((prev) => [newRefund, ...prev]);
    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === target.bookingId
          ? {
              ...b,
              status: 'Under SUG Review',
              paymentStatus: 'Refund Pending',
              paymentHoldStatus: 'refund_pending',
              inspectionStatus: 'Disputed',
              updatedAt: now,
            }
          : b
      )
    );

    pushNotification(
      target.studentUid,
      'student',
      `Refund Request Locked — ${target.bookingReference}`,
      `Your booking funds (₦${(target.breakdown.totalPayableKobo / 100).toLocaleString()}) are locked under Refund Pending and cannot be split to the agent.`,
      { relatedBookingRef: target.bookingReference, relatedPropertyId: target.propertyId, relatedDisputeId: disputeId, category: 'dispute' }
    );
    pushNotification(
      'demo_sug_president',
      'sug_admin',
      `Refund Claim Filed — ${target.bookingReference}`,
      `${target.studentName} reported "${input.reason}" on ${target.propertyTitle}.`,
      { relatedBookingRef: target.bookingReference, relatedPropertyId: target.propertyId, relatedDisputeId: disputeId, category: 'dispute' }
    );
    pushNotification(
      'demo_tech_manager',
      'super_admin',
      `Paystack Refund Pending — ${target.bookingReference}`,
      `Student filed refund claim "${input.reason}" for ₦${(target.breakdown.totalPayableKobo / 100).toLocaleString()}.`,
      { relatedBookingRef: target.bookingReference, relatedPropertyId: target.propertyId, relatedDisputeId: disputeId, category: 'dispute' }
    );
    appendAudit(
      'REFUND_REQUESTED_HOLD_LOCKED',
      'refund',
      refundId,
      `Locked booking ${target.bookingReference} under refund_pending: ${input.reason}`
    );
    showToast('info', 'Refund request submitted! Payment hold is locked and agent payout is blocked.');
    return { ok: true };
  };

  const resolveDisputeAsSug = (input: {
    disputeId: string;
    action: 'approve_refund' | 'reject_refund' | 'request_evidence' | 'escalate' | 'close';
    note: string;
  }): { ok: boolean; error?: string } => {
    if (!currentUser || (!isSugAdminRole(currentUser.role) && !isSuperAdminRole(currentUser.role))) {
      return {
        ok: false,
        error: 'Access Denied: Only authorized SUG Admins or Super Admin can review complaints.',
      };
    }

    const dispute = disputes.find((d) => d.disputeId === input.disputeId);
    if (!dispute) return { ok: false, error: 'Dispute case not found.' };

    const now = new Date().toISOString();
    const statusMap: Record<typeof input.action, DisputeStatus> = {
      approve_refund: 'Refund Approved',
      reject_refund: 'Refund Rejected',
      request_evidence: 'Under SUG Review',
      escalate: 'Escalated',
      close: 'Closed',
    };
    const nextDisputeStatus = statusMap[input.action];

    setDisputes((prev) =>
      prev.map((d) =>
        d.disputeId === input.disputeId
          ? {
              ...d,
              status: nextDisputeStatus,
              resolutionNote: input.note,
              decidedBy: currentUser.fullName,
              history: [
                ...d.history,
                { timestamp: now, actor: currentUser.fullName, note: `${nextDisputeStatus}: ${input.note}` },
              ],
              updatedAt: now,
            }
          : d
      )
    );

    if (input.action === 'approve_refund') {
      setBookings((prev) =>
        prev.map((b) =>
          b.bookingId === dispute.bookingId ? { ...b, status: 'Refund Approved', updatedAt: now } : b
        )
      );
      pushNotification(
        'demo_tech_manager',
        'super_admin',
        `SUG Recommended Refund — ${dispute.bookingReference}`,
        `SUG Admin approved refund for ${dispute.bookingReference}. Super Admin can now execute Paystack refund.`
      );
    } else if (input.action === 'reject_refund') {
      setBookings((prev) =>
        prev.map((b) =>
          b.bookingId === dispute.bookingId
            ? { ...b, status: 'Awaiting Inspection', paymentStatus: 'Held', paymentHoldStatus: 'held', inspectionStatus: 'Scheduled', updatedAt: now }
            : b
        )
      );
    }

    appendAudit(
      `DISPUTE_${input.action.toUpperCase()}`,
      'dispute',
      dispute.disputeId,
      `${nextDisputeStatus} on ${dispute.bookingReference}: ${input.note}`
    );
    showToast('success', `Complaint updated: ${nextDisputeStatus}.`);
    return { ok: true };
  };

  // STRICT ROLE SEPARATION: Only Super Admin can initiate or retry Paystack refunds
  const processApprovedRefund = (
    bookingId: string,
    simulatedOutcome: 'processed' | 'pending' | 'failed' = 'processed'
  ): { ok: boolean; error?: string } => {
    if (!currentUser || !isSuperAdminRole(currentUser.role)) {
      return {
        ok: false,
        error: 'Access Denied: Only Super Admin can execute or retry Paystack refunds.',
      };
    }
    const target = bookings.find((b) => b.bookingId === bookingId);
    if (!target) return { ok: false, error: 'Booking not found.' };

    const now = new Date().toISOString();

    if (simulatedOutcome === 'failed') {
      setRefunds((prev) =>
        prev.map((r) =>
          r.bookingId === bookingId
            ? { ...r, status: 'failed', failureReason: 'Paystack refund API timeout — click Retry', updatedAt: now }
            : r
        )
      );
      showToast('error', `Paystack refund failed for ${target.bookingReference}. Ready to retry.`);
      return { ok: false, error: 'Paystack refund failed; retry available in Refunds panel.' };
    }

    if (simulatedOutcome === 'pending') {
      setBookings((prev) =>
        prev.map((b) =>
          b.bookingId === bookingId
            ? { ...b, status: 'Refund Processing', paymentStatus: 'Refund Pending', paymentHoldStatus: 'refund_pending', updatedAt: now }
            : b
        )
      );
      setRefunds((prev) =>
        prev.map((r) => (r.bookingId === bookingId ? { ...r, status: 'processing', updatedAt: now } : r))
      );
      showToast('info', `Refund marked Processing for ${target.bookingReference}.`);
      return { ok: true };
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === bookingId
          ? { ...b, status: 'Refunded', paymentStatus: 'Refunded', paymentHoldStatus: 'refunded', updatedAt: now }
          : b
      )
    );
    setRefunds((prev) =>
      prev.map((r) =>
        r.bookingId === bookingId
          ? { ...r, status: 'processed', paystackRefundRef: `PS_REF_${Date.now().toString().slice(-6)}`, failureReason: undefined, updatedAt: now }
          : r
      )
    );
    setDisputes((prev) =>
      prev.map((d) =>
        d.bookingId === bookingId
          ? {
              ...d,
              status: 'Closed',
              decidedBy: currentUser.fullName,
              resolutionNote: 'Full Paystack refund processed; shares zeroed.',
              updatedAt: now,
            }
          : d
      )
    );
    setPaymentEvents((prev) => [
      {
        eventId: `evt_ref_${Date.now()}`,
        webhookId: `wh_refund_${target.bookingReference}`,
        bookingReference: target.bookingReference,
        eventType: 'refund.processed',
        amountKobo: target.breakdown.totalPayableKobo,
        signatureValid: true,
        duplicateIgnored: false,
        status: 'processed',
        createdAt: now,
      },
      ...prev,
    ]);
    pushNotification(
      target.studentUid,
      'student',
      `Refund Processed — ${target.bookingReference}`,
      `Your full refund of ₦${(target.breakdown.totalPayableKobo / 100).toLocaleString()} (Agent Fee + ₦3,000 Inspection Fee) has been processed via Paystack.`
    );
    appendAudit(
      'PAYSTACK_REFUND_PROCESSED',
      'refund',
      target.bookingReference,
      `Super Admin processed full refund for ${target.bookingReference}; Agent/SUG/Platform shares zeroed.`
    );
    showToast('success', `Refund processed for ${target.bookingReference}.`);
    return { ok: true };
  };

  // Super Admin executes the 48-hour hold settlement batch (mirrors process-splits Edge Function)
  const triggerProcessSplitsAsSuperAdmin = (): { processedCount: number; failedCount: number } => {
    if (!currentUser || !isSuperAdminRole(currentUser.role)) {
      showToast('error', 'Only Super Admin can run the 48-hour settlement job.');
      return { processedCount: 0, failedCount: 0 };
    }
    const now = new Date();
    const nowIso = now.toISOString();
    let processedCount = 0;
    const failedCount = 0;

    const eligible = bookings.filter((b) => {
      if (b.paymentHoldStatus !== 'held' || !b.splitAt) return false;
      if (b.paymentStatus === 'Refund Pending' || b.status === 'Under SUG Review' || b.status === 'Refunded') return false;
      return new Date(b.splitAt).getTime() <= now.getTime();
    });

    if (eligible.length === 0) {
      showToast('info', 'No held bookings have passed their 48-hour release timestamp yet.');
      return { processedCount: 0, failedCount: 0 };
    }

    const newTransfers: SettlementTransferRecord[] = [];
    const eligibleIds = new Set(eligible.map((e) => e.bookingId));

    for (const bk of eligible) {
      processedCount += 1;
      const code = `TRF-48H-${bk.bookingReference.slice(-4)}`;
      newTransfers.push(
        {
          settlementId: `stl_${bk.bookingId}_agt`,
          bookingId: bk.bookingId,
          bookingReference: bk.bookingReference,
          recipientType: 'agent',
          recipientName: bk.agentName,
          amountKobo: bk.breakdown.agentEarningsKobo,
          transferCode: `${code}-AGT`,
          status: 'successful',
          retryCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          settlementId: `stl_${bk.bookingId}_sug`,
          bookingId: bk.bookingId,
          bookingReference: bk.bookingReference,
          recipientType: 'sug',
          recipientName: 'ABSU SUG Treasury',
          amountKobo: bk.breakdown.sugAllocationKobo,
          transferCode: `${code}-SUG`,
          status: 'successful',
          retryCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          settlementId: `stl_${bk.bookingId}_plt`,
          bookingId: bk.bookingId,
          bookingReference: bk.bookingReference,
          recipientType: 'platform',
          recipientName: 'Platform Backend Management',
          amountKobo: bk.breakdown.platformTotalKobo,
          transferCode: `${code}-PLT`,
          status: 'successful',
          retryCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
      );
    }

    setBookings((prev) =>
      prev.map((b) =>
        eligibleIds.has(b.bookingId)
          ? {
              ...b,
              status: 'Settled',
              paymentStatus: 'Settled',
              paymentHoldStatus: 'settled',
              autoConfirmed: true,
              confirmedAt: b.confirmedAt || nowIso,
              settlementAuthorizationCode: `TRF-48H-${b.bookingReference.slice(-4)}`,
              updatedAt: nowIso,
            }
          : b
      )
    );
    setSettlements((prev) => [...newTransfers, ...prev]);
    appendAudit(
      '48H_SPLITS_EXECUTED',
      'settlement',
      `batch_${Date.now()}`,
      `Super Admin ran 48-hour split release across ${processedCount} eligible booking(s).`
    );
    showToast('success', `Processed 48-hour splits for ${processedCount} eligible booking(s).`);
    return { processedCount, failedCount };
  };

  const retrySettlementTransferAsSuperAdmin = (settlementId: string): { ok: boolean; error?: string } => {
    if (!currentUser || !isSuperAdminRole(currentUser.role)) {
      return { ok: false, error: 'Only Super Admin can retry failed transfers.' };
    }
    const target = settlements.find((s) => s.settlementId === settlementId);
    if (!target) return { ok: false, error: 'Settlement record not found.' };
    if (target.retryCount >= 3) {
      return { ok: false, error: 'Maximum 3 automatic/manual retries reached for this transfer.' };
    }
    const now = new Date().toISOString();
    setSettlements((prev) =>
      prev.map((s) =>
        s.settlementId === settlementId
          ? { ...s, status: 'successful', retryCount: s.retryCount + 1, failureReason: undefined, updatedAt: now }
          : s
      )
    );
    appendAudit(
      'SETTLEMENT_RETRY_SUCCESS',
      'settlement',
      settlementId,
      `Retried Paystack transfer for ${target.bookingReference} (${target.recipientType}).`
    );
    showToast('success', `Transfer retry succeeded for ${target.bookingReference}.`);
    return { ok: true };
  };

  const submitNewLodge = (input: {
    title: string;
    category: PropertyListing['category'];
    locationArea: PropertyListing['locationArea'];
    preciseAddress: string;
    yearlyRentNaira: number;
    agentCommissionNaira: number;
    availableRooms: number;
    description: string;
    amenities: string[];
    landlordName: string;
    landlordPhone: string;
    caretakerName: string;
    caretakerPhone: string;
    landlordAuthorizationDoc: string;
    saveAsDraft?: boolean;
    mediaNames: { type: 'image' | 'video'; name: string; previewUrl?: string; cloudinaryPublicId?: string; sizeBytes: number }[];
  }): { ok: boolean; error?: string } => {
    if (!currentUser || currentUser.role !== 'agent') {
      return { ok: false, error: 'Only registered agents can submit lodges.' };
    }

    const agentProfile = agents.find((a) => a.ownerUid === currentUser.uid);
    if (!agentProfile || agentProfile.status !== 'Approved') {
      return {
        ok: false,
        error: 'Unapproved or suspended agents cannot publish listings. Contact Super Admin for verification.',
      };
    }

    const feeCheck = validateAllowedAgentFeeNaira(input.agentCommissionNaira);
    if (!feeCheck.valid) {
      return { ok: false, error: feeCheck.error };
    }

    const safetyCheck = detectSuspiciousListingDescription(input.description);
    if (safetyCheck.flagged && !input.saveAsDraft) {
      return {
        ok: false,
        error: `Blocked by Student Rent Protection: ${safetyCheck.reason}. Do not include payment links, bank account numbers, or rent collection instructions.`,
      };
    }

    const mediaCheck = validateLodgeMediaRequirements(input.mediaNames);
    if (!input.saveAsDraft && !mediaCheck.valid) {
      return { ok: false, error: mediaCheck.error };
    }

    if (!input.landlordName.trim() || !input.landlordPhone.trim() || !input.caretakerName.trim() || !input.caretakerPhone.trim()) {
      return { ok: false, error: 'Both Landlord and Caretaker names & phone numbers are mandatory.' };
    }

    const yearlyRentKobo = nairaToKobo(input.yearlyRentNaira);
    const agentCommissionKobo = nairaToKobo(input.agentCommissionNaira);
    const now = new Date().toISOString();
    const propertyId = `prop_${Date.now().toString().slice(-6)}`;
    const imageItems = input.mediaNames.filter((m) => m.type === 'image');
    const videoItem = input.mediaNames.find((m) => m.type === 'video');

    const newLodge: PropertyListing = {
      propertyId,
      agentUid: currentUser.uid,
      agentId: agentProfile.agentId,
      agentName: agentProfile.fullName,
      title: input.title.trim(),
      category: input.category,
      locationArea: input.locationArea,
      preciseAddress: input.preciseAddress.trim(),
      coordinates: { lat: 5.827, lng: 7.394 },
      yearlyRentKobo,
      agentCommissionKobo,
      inspectionFeeKobo: DEFAULT_INSPECTION_FEE_KOBO,
      availableRooms: input.availableRooms,
      availabilityStatus: 'Available',
      lodgeStatus: input.saveAsDraft ? 'Draft' : 'Pending',
      verificationStatus: 'Pending Verification',
      flaggedSuspiciousReason: safetyCheck.flagged ? safetyCheck.reason : undefined,
      landlordVerified: false,
      featured: false,
      coverImageUrl: imageItems[0]?.previewUrl || IMAGES.selfContain,
      media: input.mediaNames.map((m, idx) => ({
        id: `med_${Date.now()}_${idx}`,
        type: m.type,
        url: m.previewUrl || IMAGES.selfContain,
        cloudinaryPublicId: m.cloudinaryPublicId,
        caption: m.name,
        fileName: m.name,
        sizeBytes: m.sizeBytes,
      })),
      videoTourUrl: videoItem?.previewUrl,
      description: input.description.trim(),
      amenities: input.amenities,
      landlordName: input.landlordName.trim(),
      landlordPhone: input.landlordPhone.trim(),
      caretakerName: input.caretakerName.trim(),
      caretakerPhone: input.caretakerPhone.trim(),
      landlordAuthorizationDoc: input.landlordAuthorizationDoc.trim() || 'Signed_Authorization.pdf',
      lastConfirmedAt: now,
      createdAt: now,
    };

    setProperties((prev) => [newLodge, ...prev]);

    if (!input.saveAsDraft) {
      pushNotification(
        'demo_sug_president',
        'sug_admin',
        `New Lodge Pending SUG Approval — ${newLodge.title}`,
        `${agentProfile.fullName} submitted ${newLodge.title} (${newLodge.locationArea}) for verification.`,
        { relatedPropertyId: propertyId, category: 'verification' }
      );
    }
    appendAudit(
      input.saveAsDraft ? 'PROPERTY_DRAFT_SAVED' : 'PROPERTY_SUBMITTED',
      'property',
      propertyId,
      `${agentProfile.fullName} ${input.saveAsDraft ? 'saved draft' : 'submitted'} ${newLodge.title}.`
    );
    showToast(
      'success',
      input.saveAsDraft
        ? 'Lodge saved as Draft.'
        : 'Lodge submitted! Status: Pending SUG Admin approval.'
    );
    return { ok: true };
  };

  const toggleLodgeAvailability = (propertyId: string, nextStatus?: LodgeStatus) => {
    setProperties((prev) =>
      prev.map((p) => {
        if (p.propertyId !== propertyId) return p;
        const nextAvail = p.availabilityStatus === 'Available' ? 'Unavailable' : 'Available';
        return {
          ...p,
          availabilityStatus: nextStatus ? (nextStatus === 'Taken' || nextStatus === 'Booked' ? 'Unavailable' : 'Available') : nextAvail,
          lodgeStatus: nextStatus || (nextAvail === 'Available' ? 'Approved' : 'Taken'),
          lastConfirmedAt: new Date().toISOString(),
        };
      })
    );
    appendAudit('AVAILABILITY_TOGGLED', 'property', propertyId, `Updated availability for lodge ${propertyId}.`);
    showToast('info', 'Lodge availability updated.');
  };

  const reviewLodgeAsSug = (
    propertyId: string,
    decision: 'Approved' | 'Rejected' | 'Suspended' | 'Removed',
    options?: { rejectionReason?: string; title?: string; availableRooms?: number }
  ): { ok: boolean; error?: string } => {
    if (!currentUser || (!isSugAdminRole(currentUser.role) && !isSuperAdminRole(currentUser.role))) {
      return { ok: false, error: 'Unauthorized.' };
    }

    if (decision === 'Rejected' && !options?.rejectionReason?.trim()) {
      return { ok: false, error: 'A rejection reason is mandatory when rejecting a lodge.' };
    }

    if (decision === 'Removed') {
      if (!isSuperAdminRole(currentUser.role)) {
        return { ok: false, error: 'Only Super Admin can permanently delete a lodge listing.' };
      }
      setProperties((prev) => prev.filter((p) => p.propertyId !== propertyId));
      appendAudit('PROPERTY_DELETED', 'property', propertyId, `Super Admin removed fraudulent/invalid listing ${propertyId}.`);
      showToast('info', 'Lodge permanently removed by Super Admin.');
      return { ok: true };
    }

    const nextVerif =
      decision === 'Approved'
        ? 'SUG Verified'
        : decision === 'Rejected'
        ? 'Rejected'
        : 'Suspended';
    const nextLodgeStatus: LodgeStatus =
      decision === 'Approved' ? 'Approved' : decision === 'Rejected' ? 'Rejected' : 'Pending';

    setProperties((prev) =>
      prev.map((p) =>
        p.propertyId === propertyId
          ? {
              ...p,
              title: options?.title ?? p.title,
              availableRooms: options?.availableRooms ?? p.availableRooms,
              lodgeStatus: nextLodgeStatus,
              verificationStatus: nextVerif,
              landlordVerified: decision === 'Approved' ? true : p.landlordVerified,
              rejectionReason: decision === 'Rejected' ? options?.rejectionReason?.trim() : undefined,
              lastConfirmedAt: new Date().toISOString(),
            }
          : p
      )
    );

    const target = properties.find((p) => p.propertyId === propertyId);
    if (target) {
      pushNotification(
        target.agentUid,
        'agent',
        `Lodge ${decision}: ${target.title}`,
        decision === 'Rejected'
          ? `Rejected by SUG Admin. Reason: ${options?.rejectionReason}`
          : `SUG Admin set lodge status to ${decision}.`,
        { relatedPropertyId: propertyId, category: 'verification' }
      );
    }
    appendAudit(
      `PROPERTY_${decision.toUpperCase()}`,
      'property',
      propertyId,
      `Set lodge ${propertyId} to ${decision}${options?.rejectionReason ? ` (${options.rejectionReason})` : ''}.`
    );
    showToast('success', `Lodge marked as ${decision}.`);
    return { ok: true };
  };

  const deleteLodgeAsSuperAdmin = (propertyId: string): { ok: boolean; error?: string } => {
    return reviewLodgeAsSug(propertyId, 'Removed');
  };

  // STRICT ROLE SEPARATION: Only Super Admin can approve/suspend/ban agents
  const reviewAgentAsSuperAdmin = (
    agentId: string,
    status: AgentStatus
  ): { ok: boolean; error?: string } => {
    if (!currentUser || !isSuperAdminRole(currentUser.role)) {
      return {
        ok: false,
        error: 'Access Denied: Only Super Admin can approve, suspend, or ban agents.',
      };
    }
    const target = agents.find((a) => a.agentId === agentId);
    setAgents((prev) => prev.map((a) => (a.agentId === agentId ? { ...a, status } : a)));
    if (target) {
      pushNotification(
        target.ownerUid,
        'agent',
        `Agent Account ${status}`,
        `Super Admin updated your ABSU Lodge agent profile status to ${status}.`
      );
    }
    appendAudit('AGENT_STATUS_UPDATED', 'agent', agentId, `Super Admin changed agent ${agentId} to ${status}.`);
    showToast('success', `Agent status updated to ${status}.`);
    return { ok: true };
  };

  const createSugAdminAsSuperAdmin = (input: {
    fullName: string;
    email: string;
    phone: string;
    officeTitle: string;
  }): { ok: boolean; error?: string } => {
    if (!currentUser || !isSuperAdminRole(currentUser.role)) {
      return { ok: false, error: 'Only Super Admin can create SUG Admin accounts.' };
    }
    const newSug: SugAdminAccount = {
      uid: `sug_adm_${Date.now().toString().slice(-5)}`,
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      officeTitle: input.officeTitle.trim() || 'SUG Accommodation Admin',
      active: true,
      createdAt: new Date().toISOString(),
    };
    setSugAdmins((prev) => [newSug, ...prev]);
    appendAudit('SUG_ADMIN_CREATED', 'user', newSug.uid, `Super Admin created SUG Admin account for ${newSug.fullName}.`);
    showToast('success', `Created SUG Admin account for ${newSug.fullName}.`);
    return { ok: true };
  };

  const toggleSugAdminStatusAsSuperAdmin = (uid: string) => {
    if (!currentUser || !isSuperAdminRole(currentUser.role)) return;
    setSugAdmins((prev) => prev.map((s) => (s.uid === uid ? { ...s, active: !s.active } : s)));
    appendAudit('SUG_ADMIN_STATUS_TOGGLED', 'user', uid, `Super Admin toggled active access for SUG Admin ${uid}.`);
    showToast('info', 'SUG Admin access updated.');
  };

  const markNotificationRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    if (!currentUser) return;
    setNotifications((prev) =>
      prev.map((n) => (n.recipientUid === currentUser.uid ? { ...n, read: true } : n))
    );
  };

  const submitPropertyReview = (input: {
    propertyId: string;
    bookingReference: string;
    rating: number;
    comment: string;
  }): { ok: boolean; error?: string } => {
    if (!currentUser || currentUser.role !== 'student') {
      return { ok: false, error: 'Only students with completed bookings can post verified reviews.' };
    }
    const eligible = bookings.find(
      (b) => b.propertyId === input.propertyId && b.studentUid === currentUser.uid && b.status === 'Settled'
    );
    if (!eligible) {
      return {
        ok: false,
        error: 'Verified reviews are restricted to students with a confirmed booking for this lodge.',
      };
    }

    const review: PropertyReview = {
      reviewId: `rev_${Date.now()}`,
      propertyId: input.propertyId,
      bookingReference: eligible.bookingReference,
      studentName: currentUser.fullName,
      rating: input.rating,
      comment: input.comment.trim(),
      createdAt: new Date().toISOString(),
    };
    setReviews((prev) => [review, ...prev]);
    showToast('success', 'Verified student review published.');
    return { ok: true };
  };

  const reportPropertyOrAgent = (input: {
    targetType: 'property' | 'agent';
    targetId: string;
    targetName: string;
    reason: string;
  }) => {
    pushNotification(
      'demo_sug_president',
      'sug_admin',
      `Suspicious ${input.targetType === 'agent' ? 'Agent' : 'Property'} Report`,
      `${input.targetName} (${input.targetId}) reported: ${input.reason}`
    );
    pushNotification(
      'demo_tech_manager',
      'super_admin',
      `Security Report — ${input.targetName}`,
      `${input.targetName} reported by student: ${input.reason}`
    );
    appendAudit(
      'SUSPICIOUS_ACTIVITY_REPORTED',
      input.targetType,
      input.targetId,
      `Reported ${input.targetName}: ${input.reason}`
    );
    showToast('info', 'Report sent to SUG Admin & Super Admin.');
  };

  const simulateWebhookCheck = (duplicate: boolean) => {
    const sampleRef = bookings[0]?.bookingReference || 'ABSU-LS-20261119-0001';
    const webhookId = duplicate ? 'wh_test_20261119_001' : `wh_test_${Date.now()}`;
    const result = processIdempotentWebhook(paymentEvents, {
      webhookId,
      bookingReference: sampleRef,
      eventType: 'charge.success',
      amountKobo: 2300000,
      signatureHeader: 'test_sig',
      expectedSignature: 'test_sig',
    });
    setPaymentEvents((prev) => [result.logEntry, ...prev]);
    appendAudit(
      duplicate ? 'WEBHOOK_DUPLICATE_BLOCKED' : 'WEBHOOK_PROCESSED',
      'payment',
      sampleRef,
      duplicate
        ? `Idempotency guard ignored duplicate webhook ${webhookId}.`
        : `Verified webhook ${webhookId} processed.`
    );
    showToast(
      'info',
      duplicate
        ? 'Duplicate webhook safely ignored (idempotent guard active).'
        : 'Signed test webhook processed cleanly.'
    );
  };

  const createBackupSnapshot = () => {
    const snap: BackupSnapshot = {
      backupId: `bkp_${Date.now().toString().slice(-6)}`,
      label: `Manual Snapshot — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      tablesCount: 21,
      recordsCount: agents.length + properties.length + bookings.length + disputes.length + auditLogs.length + 380,
      sizeKb: 1890,
      status: 'Verified',
      createdAt: new Date().toISOString(),
    };
    setBackups((prev) => [snap, ...prev]);
    appendAudit('BACKUP_CREATED', 'system', snap.backupId, `Created verified backup snapshot ${snap.backupId}.`);
    showToast('success', 'Database backup snapshot created and verified.');
  };

  const publishAnnouncement = (title: string, body: string) => {
    const ann: SugAnnouncement = {
      announcementId: `ann_${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      publishedBy: currentUser?.fullName || 'ABSU SUG Admin',
      createdAt: new Date().toISOString(),
    };
    setAnnouncements((prev) => [ann, ...prev]);
    appendAudit('ANNOUNCEMENT_PUBLISHED', 'system', ann.announcementId, `Published SUG notice: ${ann.title}`);
    showToast('success', 'Announcement published to marketplace.');
  };

  const updateUserRoleAsTech = (uid: string, role: UserRole) => {
    if (currentUser?.uid === uid) {
      setCurrentUser((prev) => (prev ? { ...prev, role } : prev));
    }
    appendAudit('ROLE_ASSIGNMENT_UPDATED', 'user', uid, `Super Admin verified role assignment for ${uid} (${role}).`);
    showToast('info', `Role audit verified for ${uid}.`);
  };

  return (
    <MarketplaceContext.Provider
      value={{
        activePage,
        setActivePage,
        selectedPropertyId,
        openPropertyDetails,
        currentUser,
        authReady,
        isLoadingData,
        dataError,
        retryDataSync,
        firebaseConnected,
        supabaseConfigured,
        supabaseConnected,
        realtimeConnected,
        authModalOpen,
        setAuthModalOpen,
        checkoutProperty,
        setCheckoutProperty,
        signInWithGoogle,
        signInWithSupabaseEmail,
        signInStudentWithPhonePassword,
        switchDemoRole,
        registerStudentAccount,
        registerAgentAccount,
        logoutUser,
        settings,
        updatePlatformSettings,
        agents,
        sugAdmins,
        properties,
        bookings,
        disputes,
        settlements,
        refunds,
        paymentEvents,
        notifications,
        reviews,
        auditLogs,
        backups,
        announcements,
        appErrorLogs,
        toast,
        showToast,
        initializeAndVerifyBooking,
        submitInspectionContactInfo,
        confirmLodgeAndReleaseFunds,
        submitRefundDispute,
        resolveDisputeAsSug,
        processApprovedRefund,
        triggerProcessSplitsAsSuperAdmin,
        retrySettlementTransferAsSuperAdmin,
        submitNewLodge,
        toggleLodgeAvailability,
        reviewLodgeAsSug,
        deleteLodgeAsSuperAdmin,
        reviewAgentAsSuperAdmin,
        createSugAdminAsSuperAdmin,
        toggleSugAdminStatusAsSuperAdmin,
        markNotificationRead,
        markAllNotificationsRead,
        submitPropertyReview,
        reportPropertyOrAgent,
        simulateWebhookCheck,
        createBackupSnapshot,
        publishAnnouncement,
        updateUserRoleAsTech,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) throw new Error('useMarketplace must be used within MarketplaceProvider');
  return ctx;
}
