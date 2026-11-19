import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  calculateFinancialBreakdown,
  DEFAULT_INSPECTION_FEE_KOBO,
  DEFAULT_PLATFORM_SETTINGS,
  nairaToKobo,
} from '../domain/finance';
import { canTransitionBooking } from '../domain/bookingMachine';
import {
  generateBookingReference,
  processIdempotentWebhook,
  validateAgentCommissionWithinLimit,
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
  NotificationItem,
  PaymentEventLog,
  PlatformSettings,
  PropertyListing,
  PropertyReview,
  SugAnnouncement,
  UserProfile,
  UserRole,
  VerificationStatus,
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
  SEED_REVIEWS,
} from '../data/seedData';
import { auth, googleAuthProvider, testConnection } from '../lib/firebase';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  testSupabaseConnection,
} from '../lib/supabase';

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
  firebaseConnected: boolean;
  supabaseConfigured: boolean;
  supabaseConnected: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  checkoutProperty: PropertyListing | null;
  setCheckoutProperty: (prop: PropertyListing | null) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithSupabaseEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  switchDemoRole: (role: 'student' | 'agent' | 'sug_president' | 'tech_manager') => void;
  registerStudentAccount: (input: {
    fullName: string;
    email: string;
    phone: string;
    matricNumber: string;
    department: string;
    faculty: string;
  }) => void;
  registerAgentAccount: (input: {
    fullName: string;
    phone: string;
    email: string;
    absuId: string;
    idDocumentName: string;
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
  properties: PropertyListing[];
  bookings: BookingRecord[];
  disputes: DisputeCase[];
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
    outcome: 'success' | 'fail';
  }) => Promise<{ ok: boolean; booking?: BookingRecord; error?: string }>;
  submitInspectionContactInfo: (input: {
    bookingId: string;
    fullName: string;
    phoneNumber: string;
    whatsappOrAltPhone?: string;
    preferredTimeSlot: string;
    campusMeetupPoint: string;
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
  processApprovedRefund: (bookingId: string) => { ok: boolean; error?: string };
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
    landlordAuthorizationDoc: string;
    mediaNames: { type: 'image' | 'video'; name: string; previewUrl?: string; sizeBytes: number }[];
  }) => { ok: boolean; error?: string };
  toggleLodgeAvailability: (propertyId: string) => void;
  reviewLodgeAsSug: (
    propertyId: string,
    status: VerificationStatus | 'Removed',
    editedFields?: { title?: string; availableRooms?: number }
  ) => void;
  reviewAgentAsSug: (agentId: string, status: AgentStatus) => void;
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

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    SEED_PROPERTIES[0].propertyId
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [supabaseConfigured] = useState(() => isSupabaseConfigured());
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [checkoutProperty, setCheckoutProperty] = useState<PropertyListing | null>(null);

  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [agents, setAgents] = useState<AgentProfile[]>(SEED_AGENTS);
  const [properties, setProperties] = useState<PropertyListing[]>(SEED_PROPERTIES);
  const [bookings, setBookings] = useState<BookingRecord[]>(SEED_BOOKINGS);
  const [disputes, setDisputes] = useState<DisputeCase[]>(SEED_DISPUTES);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEventLog[]>(SEED_PAYMENT_EVENTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(SEED_NOTIFICATIONS);
  const [reviews, setReviews] = useState<PropertyReview[]>(SEED_REVIEWS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(SEED_AUDIT_LOGS);
  const [backups, setBackups] = useState<BackupSnapshot[]>(SEED_BACKUPS);
  const [announcements, setAnnouncements] = useState<SugAnnouncement[]>(SEED_ANNOUNCEMENTS);
  const [appErrorLogs] = useState([
    {
      id: 'err_01',
      level: 'WARN',
      message: 'Paystack live settlement disabled: awaiting written conditional-settlement partner confirmation.',
      timestamp: '2026-11-19T04:10:00.000Z',
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

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (supabase) {
      testSupabaseConnection().then(setSupabaseConnected);
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        const sbUser = session?.user;
        if (sbUser) {
          const metaRole = (sbUser.user_metadata?.role as UserRole | undefined) || undefined;
          const isBootstrappedSug = sbUser.email === 'absuconnect.team@gmail.com';
          setCurrentUser((prev) => {
            if (prev && !prev.isDemo && prev.uid === sbUser.id) return prev;
            return {
              uid: sbUser.id,
              fullName:
                (sbUser.user_metadata?.full_name as string) ||
                sbUser.email?.split('@')[0] ||
                'ABSU Member',
              email: sbUser.email || '',
              phone: (sbUser.user_metadata?.phone as string) || '+234 800 000 0000',
              role: metaRole || (isBootstrappedSug ? 'sug_president' : 'student'),
              matricNumber:
                (sbUser.user_metadata?.matric_number as string) ||
                (isBootstrappedSug ? 'SUG-PRES-2026' : 'Pending Matric'),
              department: (sbUser.user_metadata?.department as string) || 'General Studies',
              faculty: (sbUser.user_metadata?.faculty as string) || 'ABSU Uturu',
              isDemo: false,
              createdAt: sbUser.created_at || new Date().toISOString(),
            };
          });
        }
        setAuthReady(true);
      });
      return () => subscription.unsubscribe();
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
            phone: '+234 800 000 0000',
            role: isBootstrappedSug ? 'sug_president' : 'student',
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
        actorRole: actorProfile?.role || 'tech_manager',
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
      showToast('error', 'Google authentication is not configured in this static deployment. Use Demo Role login or configure Supabase.');
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
        error: 'Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are not configured in AI Studio Secrets yet.',
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

  const switchDemoRole = (role: 'student' | 'agent' | 'sug_president' | 'tech_manager') => {
    const user = DEMO_USERS[role];
    setCurrentUser(user);
    setAuthModalOpen(false);
    if (role === 'student') setActivePage('student-dashboard');
    if (role === 'agent') setActivePage('agent-dashboard');
    if (role === 'sug_president') setActivePage('sug-dashboard');
    if (role === 'tech_manager') setActivePage('tech-dashboard');
    window.scrollTo(0, 0);
    showToast('info', `Switched to Demonstration Profile: ${user.fullName}`);
  };

  const registerStudentAccount = (input: {
    fullName: string;
    email: string;
    phone: string;
    matricNumber: string;
    department: string;
    faculty: string;
  }) => {
    const newStudent: UserProfile = {
      uid: `stu_${Date.now()}`,
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      role: 'student',
      matricNumber: input.matricNumber.trim(),
      department: input.department.trim(),
      faculty: input.faculty.trim(),
      isDemo: true,
      createdAt: new Date().toISOString(),
    };
    setCurrentUser(newStudent);
    setAuthModalOpen(false);
    setActivePage('student-dashboard');
    pushNotification(
      newStudent.uid,
      'student',
      'Welcome to ABSU LodgeSafe',
      `Your ABSU student profile (${newStudent.matricNumber}) is active. Always physically inspect before confirming settlement.`
    );
    showToast('success', 'Student account registered and signed in.');
  };

  const registerAgentAccount = (input: {
    fullName: string;
    phone: string;
    email: string;
    absuId: string;
    idDocumentName: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    emergencyContact: string;
    experienceYears: number;
  }) => {
    const uid = `agt_usr_${Date.now()}`;
    const newAgent: AgentProfile = {
      agentId: `agt_${Date.now().toString().slice(-5)}`,
      ownerUid: uid,
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      absuId: input.absuId.trim() || 'Not Provided',
      idDocumentName: input.idDocumentName || 'National_ID_Upload.pdf',
      profilePhotoUrl: IMAGES.courtyard,
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
      role: 'agent',
      isDemo: true,
      createdAt: newAgent.createdAt,
    };

    setAgents((prev) => [newAgent, ...prev]);
    setCurrentUser(user);
    setAuthModalOpen(false);
    setActivePage('agent-dashboard');

    pushNotification(
      'demo_sug_president',
      'sug_president',
      'New Agent Registration Pending Approval',
      `${newAgent.fullName} submitted agent KYC (${newAgent.idDocumentName}) for SUG verification.`
    );
    appendAudit(
      'AGENT_REGISTERED',
      'agent',
      newAgent.agentId,
      `New agent ${newAgent.fullName} entered Pending Approval.`,
      user
    );
    showToast('info', 'Agent application submitted! Status: Pending Approval by SUG.');
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
    showToast('info', 'Logged out of ABSU LodgeSafe.');
  };

  const updatePlatformSettings = (
    next: Partial<PlatformSettings>
  ): { ok: boolean; error?: string } => {
    if (!currentUser || !['sug_president', 'sug_admin'].includes(currentUser.role)) {
      return { ok: false, error: 'Only the SUG President or authorized SUG Admin can update commission policies.' };
    }
    const merged: PlatformSettings = {
      ...settings,
      ...next,
      updatedAt: new Date().toISOString(),
    };
    if (merged.platformSharePct + merged.agentSharePct !== 100) {
      return { ok: false, error: 'Platform share + Agent share must equal 100%.' };
    }
    if (merged.sugPlatformSharePct + merged.techManagerPlatformSharePct !== 100) {
      return { ok: false, error: 'SUG share + Technical Manager share must equal 100%.' };
    }
    setSettings(merged);
    appendAudit(
      'SETTINGS_UPDATED',
      'settings',
      'global',
      `Updated split: Platform ${merged.platformSharePct}% / Agent ${merged.agentSharePct}%, SUG ${merged.sugPlatformSharePct}% / Tech ${merged.techManagerPlatformSharePct}%.`
    );
    showToast('success', 'Platform commission rules updated.');
    return { ok: true };
  };

  const initializeAndVerifyBooking = async (input: {
    property: PropertyListing;
    inspectionDate: string;
    outcome: 'success' | 'fail';
  }): Promise<{ ok: boolean; booking?: BookingRecord; error?: string }> => {
    if (!currentUser) {
      return { ok: false, error: 'Please sign in as an ABSU student before booking.' };
    }
    if (input.property.verificationStatus !== 'SUG Verified') {
      return { ok: false, error: 'Only SUG Verified lodges can be booked.' };
    }

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
          studentMatric: currentUser.matricNumber || 'ABSU/PENDING',
          agentUid: input.property.agentUid,
          agentName: input.property.agentName,
          yearlyRentKobo: input.property.yearlyRentKobo,
          agentCommissionKobo: input.property.agentCommissionKobo,
          inspectionDate: input.inspectionDate,
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
        }),
      });
      const verifyData = await verifyRes.json();
      const verifiedBooking: BookingRecord = verifyData.booking;

      if (input.outcome === 'fail') {
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
          `Test payment failed for ${verifiedBooking.propertyTitle}; no active booking created.`
        );
        return {
          ok: false,
          error: 'Test payment declined. Failed payments do not create active inspection bookings.',
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
        `Booking Created — ${verifiedBooking.bookingReference}`,
        `Test payment verified for ${verifiedBooking.propertyTitle}. Inspection scheduled for ${input.inspectionDate}.`,
        {
          relatedBookingRef: verifiedBooking.bookingReference,
          relatedPropertyId: verifiedBooking.propertyId,
          category: 'booking',
        }
      );
      pushNotification(
        verifiedBooking.agentUid,
        'agent',
        `New Inspection Booking — ${verifiedBooking.bookingReference}`,
        `${currentUser.fullName} booked ${verifiedBooking.propertyTitle} for inspection on ${input.inspectionDate}.`,
        {
          relatedBookingRef: verifiedBooking.bookingReference,
          relatedPropertyId: verifiedBooking.propertyId,
          category: 'booking',
        }
      );
      pushNotification(
        'demo_sug_president',
        'sug_president',
        `New Booking Recorded — ${verifiedBooking.bookingReference}`,
        `Booking initialized in test environment awaiting student physical inspection.`,
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
        `Created booking ${verifiedBooking.bookingReference} (${verifiedBooking.propertyTitle}).`
      );
      return { ok: true, booking: verifiedBooking };
    } catch {
      // Fallback when hosted statically (e.g. GitHub Pages) or offline: compute exact kobo breakdown locally
      const breakdown = calculateFinancialBreakdown(
        input.property.yearlyRentKobo,
        input.property.agentCommissionKobo,
        settings
      );
      const ref = generateBookingReference(bookings.length + 1);
      if (input.outcome === 'fail') {
        return {
          ok: false,
          error: 'Test payment declined. Failed payments do not create active inspection bookings.',
        };
      }
      const now = new Date().toISOString();
      const bk: BookingRecord = {
        bookingId: `bk_${Date.now()}`,
        bookingReference: ref,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentMatric: currentUser.matricNumber || 'ABSU/PENDING',
        agentUid: input.property.agentUid,
        agentName: input.property.agentName,
        propertyId: input.property.propertyId,
        propertyTitle: input.property.title,
        propertyCoverUrl: input.property.coverImageUrl,
        locationArea: input.property.locationArea,
        breakdown,
        status: 'Awaiting Inspection',
        paymentStatus: 'Test Paid',
        inspectionStatus: 'Scheduled',
        inspectionDate: input.inspectionDate,
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
        `Booking Created — ${bk.bookingReference}`,
        `Test payment verified for ${bk.propertyTitle}. Inspection scheduled for ${input.inspectionDate}.`,
        {
          relatedBookingRef: bk.bookingReference,
          relatedPropertyId: bk.propertyId,
          category: 'booking',
        }
      );
      pushNotification(
        bk.agentUid,
        'agent',
        `New Inspection Booking — ${bk.bookingReference}`,
        `${currentUser.fullName} booked ${bk.propertyTitle} for inspection on ${input.inspectionDate}.`,
        {
          relatedBookingRef: bk.bookingReference,
          relatedPropertyId: bk.propertyId,
          category: 'booking',
        }
      );
      pushNotification(
        'demo_sug_president',
        'sug_president',
        `New Booking Recorded — ${bk.bookingReference}`,
        `Booking initialized in test environment awaiting student physical inspection.`,
        {
          relatedBookingRef: bk.bookingReference,
          relatedPropertyId: bk.propertyId,
          category: 'booking',
        }
      );
      appendAudit(
        'BOOKING_CREATED',
        'booking',
        bk.bookingReference,
        `Created booking ${bk.bookingReference} (${bk.propertyTitle}).`
      );
      return { ok: true, booking: bk };
    }
  };

  const submitInspectionContactInfo = async (input: {
    bookingId: string;
    fullName: string;
    phoneNumber: string;
    whatsappOrAltPhone?: string;
    preferredTimeSlot: string;
    campusMeetupPoint: string;
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
      whatsappOrAltPhone: input.whatsappOrAltPhone?.trim() || undefined,
      preferredTimeSlot: input.preferredTimeSlot.trim(),
      campusMeetupPoint: input.campusMeetupPoint.trim(),
      notesForAgent: input.notesForAgent?.trim() || undefined,
      submittedAt: now,
    };

    try {
      await fetch('/api/bookings/inspection-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: target.bookingReference,
          ...contactPayload,
        }),
      });
    } catch {
      // Keep client ledger synchronized even if server restarts
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === input.bookingId
          ? {
              ...b,
              inspectionContact: contactPayload,
              status: b.status === 'Awaiting Inspection' ? 'Inspection Scheduled' : b.status,
              inspectionStatus: 'Scheduled',
              updatedAt: now,
            }
          : b
      )
    );

    const altPhoneText = contactPayload.whatsappOrAltPhone
      ? ` · WhatsApp/Alt: ${contactPayload.whatsappOrAltPhone}`
      : '';
    const notesText = contactPayload.notesForAgent
      ? ` · Note: "${contactPayload.notesForAgent}"`
      : '';

    pushNotification(
      target.agentUid,
      'agent',
      `Student Inspection Contact Received — ${target.bookingReference}`,
      `For ${target.propertyTitle} (${target.inspectionDate}, ${contactPayload.preferredTimeSlot}): Contact ${contactPayload.fullName} at ${contactPayload.phoneNumber}${altPhoneText}. Meetup: ${contactPayload.campusMeetupPoint}${notesText}.`,
      {
        relatedBookingRef: target.bookingReference,
        relatedPropertyId: target.propertyId,
        category: 'inspection',
      }
    );
    pushNotification(
      target.studentUid,
      'student',
      `Inspection Contact Sent to ${target.agentName}`,
      `Your inspection contact details (${contactPayload.phoneNumber}, ${contactPayload.preferredTimeSlot}) have been delivered to ${target.agentName} for ${target.bookingReference}.`,
      {
        relatedBookingRef: target.bookingReference,
        relatedPropertyId: target.propertyId,
        category: 'inspection',
      }
    );
    appendAudit(
      'INSPECTION_CONTACT_SHARED',
      'booking',
      target.bookingReference,
      `Student shared inspection contact details with agent ${target.agentName} for ${target.inspectionDate}.`
    );
    showToast('success', `Inspection contact details sent to ${target.agentName}.`);
    return { ok: true };
  };

  const confirmLodgeAndReleaseFunds = async (
    bookingId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser || currentUser.role !== 'student') {
      return { ok: false, error: 'Only the booking student can confirm inspection and release funds.' };
    }
    const target = bookings.find((b) => b.bookingId === bookingId);
    if (!target) return { ok: false, error: 'Booking not found.' };
    if (target.studentUid !== currentUser.uid) {
      return { ok: false, error: 'Students can only confirm their own bookings.' };
    }

    const check = canTransitionBooking(target.status, 'Confirmed', 'student');
    if (!check.allowed) return { ok: false, error: check.reason };

    const now = new Date().toISOString();
    const authCode = `AUTH-STL-${Date.now().toString().slice(-6)}`;

    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === bookingId
          ? {
              ...b,
              status: 'Settled',
              inspectionStatus: 'Completed',
              confirmedAt: now,
              settlementAuthorizationCode: authCode,
              updatedAt: now,
            }
          : b
      )
    );

    setProperties((prev) =>
      prev.map((p) => {
        if (p.propertyId !== target.propertyId) return p;
        const nextRooms = Math.max(0, p.availableRooms - 1);
        return {
          ...p,
          availableRooms: nextRooms,
          availabilityStatus: nextRooms === 0 ? 'Unavailable' : p.availabilityStatus,
        };
      })
    );

    pushNotification(
      target.studentUid,
      'student',
      `Lodge Confirmed — ${target.bookingReference}`,
      `Physical inspection confirmed (${authCode}). Settlement recorded under conditional settlement ledger.`,
      {
        relatedBookingRef: target.bookingReference,
        relatedPropertyId: target.propertyId,
        category: 'payment',
      }
    );
    pushNotification(
      target.agentUid,
      'agent',
      `Settlement Processed — ${target.bookingReference}`,
      `${target.studentName} confirmed ${target.propertyTitle}. Your 45% agent share is cleared for payout.`,
      {
        relatedBookingRef: target.bookingReference,
        relatedPropertyId: target.propertyId,
        category: 'payment',
      }
    );
    appendAudit(
      'BOOKING_CONFIRMED_SETTLED',
      'booking',
      target.bookingReference,
      `Student confirmed physical inspection (${authCode}); commission allocations finalized.`
    );
    showToast('success', 'Lodge confirmed and conditional settlement recorded.');
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
      return { ok: false, error: 'Only the booking student can submit a refund request.' };
    }
    const target = bookings.find((b) => b.bookingId === input.bookingId);
    if (!target) return { ok: false, error: 'Booking not found.' };

    const check = canTransitionBooking(target.status, 'Dispute Requested', 'student');
    if (!check.allowed) return { ok: false, error: check.reason };

    const now = new Date().toISOString();
    const disputeId = `dsp_${Date.now().toString().slice(-6)}`;

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
          note: `Submitted refund dispute: ${input.reason}`,
        },
        {
          timestamp: now,
          actor: 'System Workflow',
          note: 'Transitioned from Dispute Requested to Under SUG Review.',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setDisputes((prev) => [newDispute, ...prev]);
    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === target.bookingId
          ? {
              ...b,
              status: 'Under SUG Review',
              inspectionStatus: 'Disputed',
              updatedAt: now,
            }
          : b
      )
    );

    pushNotification(
      target.studentUid,
      'student',
      `Refund Dispute Submitted — ${target.bookingReference}`,
      `Your complaint is now Under SUG Review. You will receive updates once adjudicated.`,
      {
        relatedBookingRef: target.bookingReference,
        relatedPropertyId: target.propertyId,
        relatedDisputeId: disputeId,
        category: 'dispute',
      }
    );
    pushNotification(
      'demo_sug_president',
      'sug_president',
      `New Refund Dispute — ${target.bookingReference}`,
      `${target.studentName} reported "${input.reason}" on ${target.propertyTitle}.`,
      {
        relatedBookingRef: target.bookingReference,
        relatedPropertyId: target.propertyId,
        relatedDisputeId: disputeId,
        category: 'dispute',
      }
    );
    appendAudit(
      'DISPUTE_SUBMITTED',
      'dispute',
      disputeId,
      `Student filed refund request on ${target.bookingReference}: ${input.reason}`
    );
    showToast('info', 'Refund request submitted to SUG Dispute Centre.');
    return { ok: true };
  };

  const resolveDisputeAsSug = (input: {
    disputeId: string;
    action: 'approve_refund' | 'reject_refund' | 'request_evidence' | 'escalate' | 'close';
    note: string;
  }): { ok: boolean; error?: string } => {
    if (!currentUser || !['sug_president', 'sug_admin'].includes(currentUser.role)) {
      return {
        ok: false,
        error: 'Access Denied: Only authorized SUG administrators can decide disputes or approve refunds.',
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
                {
                  timestamp: now,
                  actor: currentUser.fullName,
                  note: `${nextDisputeStatus}: ${input.note}`,
                },
              ],
              updatedAt: now,
            }
          : d
      )
    );

    if (input.action === 'approve_refund') {
      setBookings((prev) =>
        prev.map((b) =>
          b.bookingId === dispute.bookingId
            ? { ...b, status: 'Refund Approved', updatedAt: now }
            : b
        )
      );
      pushNotification(
        dispute.studentUid,
        'student',
        `Refund Approved — ${dispute.bookingReference}`,
        `SUG approved your refund request. Technical team will finalize reversal in test gateway.`
      );
    } else if (input.action === 'reject_refund') {
      setBookings((prev) =>
        prev.map((b) =>
          b.bookingId === dispute.bookingId
            ? { ...b, status: 'Awaiting Inspection', inspectionStatus: 'Scheduled', updatedAt: now }
            : b
        )
      );
      pushNotification(
        dispute.studentUid,
        'student',
        `Refund Request Declined — ${dispute.bookingReference}`,
        `SUG decision: ${input.note}`
      );
    } else {
      pushNotification(
        dispute.studentUid,
        'student',
        `Dispute Update (${nextDisputeStatus}) — ${dispute.bookingReference}`,
        input.note
      );
    }

    appendAudit(
      `DISPUTE_${input.action.toUpperCase()}`,
      'dispute',
      dispute.disputeId,
      `${nextDisputeStatus} on ${dispute.bookingReference}: ${input.note}`
    );
    showToast('success', `Dispute updated: ${nextDisputeStatus}.`);
    return { ok: true };
  };

  const processApprovedRefund = (bookingId: string): { ok: boolean; error?: string } => {
    if (!currentUser || !['sug_president', 'sug_admin', 'tech_manager'].includes(currentUser.role)) {
      return { ok: false, error: 'Unauthorized to process approved refund.' };
    }
    const target = bookings.find((b) => b.bookingId === bookingId);
    if (!target) return { ok: false, error: 'Booking not found.' };
    if (target.status !== 'Refund Approved' && target.status !== 'Refund Processing') {
      return {
        ok: false,
        error: 'Refund can only be processed after SUG Dispute Administrator approval.',
      };
    }

    const now = new Date().toISOString();
    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === bookingId
          ? { ...b, status: 'Refunded', paymentStatus: 'Refunded', updatedAt: now }
          : b
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
      `Full test refund of ₦${(target.breakdown.totalPayableKobo / 100).toLocaleString()} has been traced and recorded.`
    );
    appendAudit(
      'REFUND_PROCESSED',
      'payment',
      target.bookingReference,
      `Processed SUG-approved refund for ${target.bookingReference}.`
    );
    showToast('success', `Refund processed for ${target.bookingReference}.`);
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
    landlordAuthorizationDoc: string;
    mediaNames: { type: 'image' | 'video'; name: string; previewUrl?: string; sizeBytes: number }[];
  }): { ok: boolean; error?: string } => {
    if (!currentUser || currentUser.role !== 'agent') {
      return { ok: false, error: 'Only registered agents can submit lodges.' };
    }

    const agentProfile = agents.find((a) => a.ownerUid === currentUser.uid);
    if (!agentProfile || agentProfile.status !== 'Approved') {
      return {
        ok: false,
        error: 'Unapproved agents cannot publish listings. Your agent status must be Approved by SUG.',
      };
    }

    const yearlyRentKobo = nairaToKobo(input.yearlyRentNaira);
    const agentCommissionKobo = nairaToKobo(input.agentCommissionNaira);
    const capCheck = validateAgentCommissionWithinLimit(
      yearlyRentKobo,
      agentCommissionKobo,
      settings.maxCommissionPctOfRent
    );
    if (!capCheck.valid) {
      return { ok: false, error: capCheck.error };
    }

    const mediaCheck = validateLodgeMediaRequirements(input.mediaNames);
    if (!mediaCheck.valid) {
      return { ok: false, error: mediaCheck.error };
    }

    const now = new Date().toISOString();
    const propertyId = `prop_${Date.now().toString().slice(-6)}`;
    const firstImage = input.mediaNames.find((m) => m.type === 'image')?.previewUrl || IMAGES.selfContain;
    const videoItem = input.mediaNames.find((m) => m.type === 'video');

    const newProp: PropertyListing = {
      propertyId,
      agentUid: currentUser.uid,
      agentId: agentProfile.agentId,
      agentName: agentProfile.fullName,
      title: input.title.trim(),
      category: input.category,
      locationArea: input.locationArea,
      preciseAddress: input.preciseAddress.trim(),
      coordinates: { lat: 5.8265, lng: 7.394 },
      yearlyRentKobo,
      agentCommissionKobo,
      inspectionFeeKobo: DEFAULT_INSPECTION_FEE_KOBO, // Always generated by platform
      availableRooms: input.availableRooms,
      availabilityStatus: input.availableRooms > 0 ? 'Available' : 'Unavailable',
      verificationStatus: 'Pending Verification', // Always requires SUG approval
      featured: false,
      coverImageUrl: firstImage,
      media: input.mediaNames.map((m, idx) => ({
        id: `med_${idx}_${Date.now()}`,
        type: m.type,
        url: m.previewUrl || firstImage,
        caption: m.name,
        fileName: m.name,
        sizeBytes: m.sizeBytes,
      })),
      videoTourUrl: videoItem?.previewUrl || (videoItem ? 'uploaded-mp4-preview' : undefined),
      description: input.description.trim(),
      amenities: input.amenities,
      landlordName: input.landlordName.trim(),
      landlordPhone: input.landlordPhone.trim(),
      landlordAuthorizationDoc: input.landlordAuthorizationDoc.trim(),
      lastConfirmedAt: now,
      createdAt: now,
    };

    setProperties((prev) => [newProp, ...prev]);
    pushNotification(
      'demo_sug_president',
      'sug_president',
      'New Lodge Submission Pending Verification',
      `${agentProfile.fullName} submitted "${newProp.title}" (${newProp.locationArea}).`
    );
    pushNotification(
      currentUser.uid,
      'agent',
      'Lodge Submitted for SUG Review',
      `"${newProp.title}" entered Pending Verification status.`
    );
    appendAudit('PROPERTY_SUBMITTED', 'property', propertyId, `Agent submitted ${newProp.title}.`);
    showToast('success', 'Lodge submitted and awaiting SUG Verification.');
    return { ok: true };
  };

  const toggleLodgeAvailability = (propertyId: string) => {
    const now = new Date().toISOString();
    setProperties((prev) =>
      prev.map((p) => {
        if (p.propertyId !== propertyId) return p;
        const nextStatus = p.availabilityStatus === 'Available' ? 'Unavailable' : 'Available';
        return {
          ...p,
          availabilityStatus: nextStatus,
          availableRooms: nextStatus === 'Available' && p.availableRooms === 0 ? 1 : p.availableRooms,
          lastConfirmedAt: now,
        };
      })
    );
    showToast('info', 'Lodge availability status updated.');
  };

  const reviewLodgeAsSug = (
    propertyId: string,
    status: VerificationStatus | 'Removed',
    editedFields?: { title?: string; availableRooms?: number }
  ) => {
    if (!currentUser || !['sug_president', 'sug_admin'].includes(currentUser.role)) return;
    if (status === 'Removed') {
      setProperties((prev) => prev.filter((p) => p.propertyId !== propertyId));
      appendAudit('PROPERTY_REMOVED', 'property', propertyId, `Removed listing ${propertyId}.`);
      showToast('info', 'Listing removed by SUG Administration.');
      return;
    }

    setProperties((prev) =>
      prev.map((p) => {
        if (p.propertyId !== propertyId) return p;
        return {
          ...p,
          title: editedFields?.title ?? p.title,
          availableRooms: editedFields?.availableRooms ?? p.availableRooms,
          verificationStatus: status,
          lastConfirmedAt: new Date().toISOString(),
        };
      })
    );

    const target = properties.find((p) => p.propertyId === propertyId);
    if (target) {
      pushNotification(
        target.agentUid,
        'agent',
        `Lodge ${status}: ${target.title}`,
        `SUG Administration updated verification status to ${status}.`
      );
    }
    appendAudit(
      'PROPERTY_REVIEWED',
      'property',
      propertyId,
      `SUG set property status to ${status}${editedFields ? ' with audited field edits' : ''}.`
    );
    showToast('success', `Lodge marked as ${status}.`);
  };

  const reviewAgentAsSug = (agentId: string, status: AgentStatus) => {
    if (!currentUser || !['sug_president', 'sug_admin'].includes(currentUser.role)) return;
    const target = agents.find((a) => a.agentId === agentId);
    setAgents((prev) => prev.map((a) => (a.agentId === agentId ? { ...a, status } : a)));
    if (target) {
      pushNotification(
        target.ownerUid,
        'agent',
        `Agent Account ${status}`,
        `Your ABSU LodgeSafe agent profile status is now ${status}.`
      );
    }
    appendAudit('AGENT_STATUS_UPDATED', 'agent', agentId, `SUG changed agent ${agentId} to ${status}.`);
    showToast('success', `Agent status updated to ${status}.`);
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
      (b) =>
        b.propertyId === input.propertyId &&
        b.studentUid === currentUser.uid &&
        b.status === 'Settled'
    );
    if (!eligible) {
      return {
        ok: false,
        error: 'Verified reviews are restricted to students with a confirmed & settled booking for this lodge.',
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
      'sug_president',
      `Suspicious ${input.targetType === 'agent' ? 'Agent' : 'Property'} Report`,
      `${input.targetName} (${input.targetId}) reported: ${input.reason}`
    );
    appendAudit(
      'SUSPICIOUS_ACTIVITY_REPORTED',
      input.targetType,
      input.targetId,
      `Reported ${input.targetName}: ${input.reason}`
    );
    showToast('info', 'Report sent to SUG Accommodation Administrators.');
  };

  const simulateWebhookCheck = (duplicate: boolean) => {
    const sampleRef = bookings[0]?.bookingReference || 'ABSU-LS-20261115-0001';
    const webhookId = duplicate ? 'wh_test_20261115_001' : `wh_test_${Date.now()}`;
    const result = processIdempotentWebhook(paymentEvents, {
      webhookId,
      bookingReference: sampleRef,
      eventType: 'charge.success',
      amountKobo: 22300000,
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
      tablesCount: 18,
      recordsCount: agents.length + properties.length + bookings.length + disputes.length + auditLogs.length + 380,
      sizeKb: 1865,
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
      publishedBy: currentUser?.fullName || 'Office of the SUG President',
      createdAt: new Date().toISOString(),
    };
    setAnnouncements((prev) => [ann, ...prev]);
    appendAudit('ANNOUNCEMENT_PUBLISHED', 'system', ann.announcementId, `Published SUG notice: ${ann.title}`);
    showToast('success', 'SUG announcement published to homepage.');
  };

  const updateUserRoleAsTech = (uid: string, role: UserRole) => {
    if (currentUser?.uid === uid) {
      setCurrentUser((prev) => (prev ? { ...prev, role } : prev));
    }
    appendAudit('ROLE_ASSIGNMENT_UPDATED', 'system', uid, `Technical Admin updated role assignment for ${uid} to ${role}.`);
    showToast('info', `Role assignment updated to ${role}.`);
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
        firebaseConnected,
        supabaseConfigured,
        supabaseConnected,
        authModalOpen,
        setAuthModalOpen,
        checkoutProperty,
        setCheckoutProperty,
        signInWithGoogle,
        signInWithSupabaseEmail,
        switchDemoRole,
        registerStudentAccount,
        registerAgentAccount,
        logoutUser,
        settings,
        updatePlatformSettings,
        agents,
        properties,
        bookings,
        disputes,
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
        submitNewLodge,
        toggleLodgeAvailability,
        reviewLodgeAsSug,
        reviewAgentAsSug,
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
