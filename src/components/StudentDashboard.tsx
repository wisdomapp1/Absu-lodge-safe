import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileWarning,
  HelpCircle,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageCircle,
  PhoneCall,
  RotateCcw,
  Send,
  User,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatNairaFromKobo } from '../domain/finance';
import { getUnreadNotificationsCount } from '../domain/notifications';
import { BookingRecord, DisputeReason } from '../domain/types';
import {
  buildStudentToAgentWhatsAppLink,
  INSPECTION_TIME_SLOTS,
  isInspectionConfirmationEligible,
} from '../domain/validation';
import { NotificationsPanel } from './NotificationsPanel';

type StudentSection =
  | 'overview'
  | 'browse'
  | 'bookings'
  | 'payments'
  | 'refunds'
  | 'notifications'
  | 'profile'
  | 'support';

const DISPUTE_REASONS: DisputeReason[] = [
  'Agent did not show up',
  'Lodge is fake',
  'Caretaker does not know agent',
  'Lodge already taken',
  'Agent asked for extra money',
];

export function StudentDashboard() {
  const {
    currentUser,
    bookings,
    disputes,
    notifications,
    properties,
    openPropertyDetails,
    setActivePage,
    confirmLodgeAndReleaseFunds,
    submitInspectionContactInfo,
    submitRefundDispute,
    logoutUser,
    showToast,
  } = useMarketplace();

  const [section, setSection] = useState<StudentSection>('bookings');
  const [confirmTarget, setConfirmTarget] = useState<BookingRecord | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [contactTarget, setContactTarget] = useState<BookingRecord | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactDate, setContactDate] = useState(todayIso);
  const [contactTimeSlot, setContactTimeSlot] = useState<string>(INSPECTION_TIME_SLOTS[0]);
  const [contactMeetup, setContactMeetup] = useState('ABSU Main School Gate');
  const [contactNotes, setContactNotes] = useState('');

  const [refundTarget, setRefundTarget] = useState<BookingRecord | null>(null);
  const [refundReason, setRefundReason] = useState<DisputeReason>(DISPUTE_REASONS[0]);
  const [refundDesc, setRefundDesc] = useState('');
  const [refundDate, setRefundDate] = useState(todayIso);
  const [refundEvidence, setRefundEvidence] = useState('');

  if (!currentUser || currentUser.role !== 'student') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#111827]">
          Student Dashboard Access
        </h1>
        <p className="text-sm text-slate-600">
          Sign in with an ABSU Student account to view your bookings, inspection schedules, and 48-hour payment protection.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="px-5 py-3 min-h-[48px] text-sm font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  const myBookings = useMemo(
    () => bookings.filter((b) => b.studentUid === currentUser.uid),
    [bookings, currentUser.uid]
  );
  const myDisputes = useMemo(
    () => disputes.filter((d) => d.studentUid === currentUser.uid),
    [disputes, currentUser.uid]
  );
  const myNotifications = useMemo(
    () => notifications.filter((n) => n.recipientUid === currentUser.uid),
    [notifications, currentUser.uid]
  );
  const unreadNotificationCount = useMemo(
    () => getUnreadNotificationsCount(notifications, currentUser.uid),
    [notifications, currentUser.uid]
  );

  const handleConfirmSubmit = async () => {
    if (!confirmTarget || !confirmChecked) return;
    const res = await confirmLodgeAndReleaseFunds(confirmTarget.bookingId);
    if (res.ok) {
      setConfirmTarget(null);
      setConfirmChecked(false);
    } else {
      showToast('error', res.error || 'Confirmation failed.');
    }
  };

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget || !refundDesc.trim()) return;
    const res = submitRefundDispute({
      bookingId: refundTarget.bookingId,
      reason: refundReason,
      description: refundDesc,
      inspectionDate: refundDate,
      evidenceFileName: refundEvidence || undefined,
    });
    if (res.ok) {
      setRefundTarget(null);
      setRefundDesc('');
      setRefundEvidence('');
    } else {
      showToast('error', res.error || 'Could not submit refund request.');
    }
  };

  const handleInspectionContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactTarget) return;
    const res = await submitInspectionContactInfo({
      bookingId: contactTarget.bookingId,
      fullName: contactName,
      phoneNumber: contactPhone,
      whatsappOrAltPhone: contactWhatsapp,
      preferredDate: contactDate,
      preferredTimeSlot: contactTimeSlot,
      campusMeetupPoint: contactMeetup,
      notesForAgent: contactNotes,
    });
    if (res.ok) {
      setContactTarget(null);
    } else {
      showToast('error', res.error || 'Could not submit inspection contact details.');
    }
  };

  const downloadReceipt = (bk: BookingRecord) => {
    const content = [
      'ABSU LODGE — OFFICIAL BOOKING RECEIPT',
      '==============================================================',
      `Booking Reference: ${bk.bookingReference}`,
      `Student: ${bk.studentName} (${bk.studentMatric})`,
      `Lodge: ${bk.propertyTitle}`,
      `Location: ${bk.locationArea}, Uturu`,
      `Agent: ${bk.agentName} (${bk.agentPhone || ''})`,
      `Booking Date: ${bk.createdAt.slice(0, 10)}`,
      `Inspection Date: ${bk.inspectionDate} (${bk.inspectionTimeSlot || ''})`,
      `Booking Status: ${bk.status}`,
      `Payment Hold Status: ${bk.paymentHoldStatus}`,
      '--------------------------------------------------------------',
      `Agent Fee Paid Online: ${formatNairaFromKobo(bk.breakdown.agentCommissionKobo)}`,
      `Inspection Fee Paid Online: ${formatNairaFromKobo(bk.breakdown.inspectionFeeKobo)}`,
      `Total Booking Fee Paid: ${formatNairaFromKobo(bk.breakdown.totalBookingFeeKobo)}`,
      `Annual Rent (Pay Direct to Landlord w/ Receipt): ${formatNairaFromKobo(bk.breakdown.yearlyRentKobo)}`,
      bk.confirmedAt ? `Confirmed Timestamp: ${bk.confirmedAt}` : 'Confirmed Timestamp: Pending Inspection',
      bk.settlementAuthorizationCode ? `Settlement Reference: ${bk.settlementAuthorizationCode}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bk.bookingReference}-receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navItems: { id: StudentSection; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'browse', label: 'Browse Lodges', icon: <Building2 className="w-4 h-4" /> },
    { id: 'bookings', label: 'My Bookings', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'payments', label: 'Payment History', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'refunds', label: 'Refund Requests', icon: <RotateCcw className="w-4 h-4" /> },
    {
      id: 'notifications',
      label:
        unreadNotificationCount > 0
          ? `Notifications (${unreadNotificationCount})`
          : 'Notifications',
      icon: <Bell className="w-4 h-4" />,
    },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'support', label: 'Support', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen text-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <p className="text-xs font-semibold text-[#16A34A]">Student Portal</p>
            <h1 className="text-base font-display font-bold text-[#111827] mt-0.5">
              {currentUser.fullName}
            </h1>
            <p className="text-xs font-mono text-slate-500">
              {currentUser.phone} · {currentUser.matricNumber || 'ABSU Student'}
            </p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors text-left ${
                  section === item.id
                    ? 'bg-[#16A34A] text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={logoutUser}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 rounded-xl transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="lg:col-span-9 space-y-6">
          {section === 'overview' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <p className="text-xs text-slate-500">My Bookings</p>
                  <p className="text-2xl font-display font-bold text-[#111827] tabular-nums mt-1">
                    {myBookings.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <p className="text-xs text-slate-500">Held (Awaiting Inspection)</p>
                  <p className="text-2xl font-display font-bold text-[#16A34A] tabular-nums mt-1">
                    {myBookings.filter((b) => b.paymentHoldStatus === 'held').length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <p className="text-xs text-slate-500">Refund Requests</p>
                  <p className="text-2xl font-display font-bold text-[#111827] tabular-nums mt-1">
                    {myDisputes.length}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <h2 className="text-lg font-display font-bold text-[#111827]">
                  Your 48-Hour Inspection Protection
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Only your Agent Fee + ₦3,000 Inspection Fee are held safely for 48 hours. After your physical inspection starts, click{' '}
                  <strong>CONFIRM — I am okay with this lodge</strong> to release funds, or click{' '}
                  <strong>REFUND — Agent tried to scam me</strong> immediately to freeze splits and get a full refund.
                </p>
                <button
                  type="button"
                  onClick={() => setSection('bookings')}
                  className="px-5 py-3 min-h-[48px] text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
                >
                  Open My Bookings
                </button>
              </div>
            </div>
          )}

          {section === 'browse' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-[#111827]">
                  SUG Approved Lodges Available Now
                </h2>
                <button
                  type="button"
                  onClick={() => setActivePage('home')}
                  className="text-xs font-semibold text-[#16A34A] underline"
                >
                  Open Full Marketplace Filters
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {properties
                  .filter(
                    (p) =>
                      p.lodgeStatus === 'Approved' || p.verificationStatus === 'SUG Verified'
                  )
                  .map((p) => (
                    <div
                      key={p.propertyId}
                      className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">
                          {p.locationArea} · {p.category}
                        </p>
                        <p className="text-sm font-semibold text-[#111827]">{p.title}</p>
                        <p className="text-sm font-mono font-bold text-[#16A34A] tabular-nums">
                          {formatNairaFromKobo(p.yearlyRentKobo)} / yr
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPropertyDetails(p.propertyId)}
                        className="px-4 py-2.5 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl shrink-0"
                      >
                        View
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {section === 'bookings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display font-bold text-[#111827]">
                  My Bookings &amp; Physical Inspection Decisions
                </h2>
              </div>

              {myBookings.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                  <p className="text-base font-semibold text-[#111827]">No bookings yet</p>
                  <p className="text-sm text-slate-600">
                    Browse SUG-approved lodges and schedule a physical inspection.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActivePage('home')}
                    className="px-5 py-3 min-h-[48px] text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
                  >
                    Browse Lodges
                  </button>
                </div>
              ) : (
                myBookings.map((bk) => {
                  const awaitingDecision =
                    bk.paymentHoldStatus === 'held' &&
                    (bk.status === 'Awaiting Inspection' || bk.status === 'Inspection Scheduled');
                  const gate = isInspectionConfirmationEligible(
                    bk.inspectionDate,
                    bk.inspectionTimeSlot
                  );

                  return (
                    <article
                      key={bk.bookingId}
                      className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row gap-4 justify-between">
                        <div className="flex gap-4">
                          <img
                            src={bk.propertyCoverUrl}
                            alt={bk.propertyTitle}
                            referrerPolicy="no-referrer"
                            className="w-24 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                              <span>{bk.bookingReference}</span>
                              <span>·</span>
                              <span>Booked {bk.createdAt.slice(0, 10)}</span>
                              <span>·</span>
                              <span>
                                Inspection {bk.inspectionDate}
                                {bk.inspectionTimeSlot ? ` (${bk.inspectionTimeSlot})` : ''}
                              </span>
                            </div>
                            <h3 className="text-base font-display font-bold text-[#111827]">
                              {bk.propertyTitle}
                            </h3>
                            <p className="text-xs text-slate-600">
                              Agent: <strong>{bk.agentName}</strong> · {bk.locationArea}, Uturu
                            </p>
                          </div>
                        </div>

                        <div className="sm:text-right space-y-1 shrink-0">
                          <p className="text-xs text-slate-500">Booking Fee Paid</p>
                          <p className="text-lg font-mono font-bold text-[#111827] tabular-nums">
                            {formatNairaFromKobo(bk.breakdown.totalBookingFeeKobo)}
                          </p>
                          <p className="text-xs font-semibold text-[#16A34A]">
                            {bk.status} ({bk.paymentStatus})
                          </p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-500">Payment Hold:</span>{' '}
                          <strong className="uppercase">{bk.paymentHoldStatus.replace('_', ' ')}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Annual Rent (Direct):</span>{' '}
                          <strong className="font-mono tabular-nums">
                            {formatNairaFromKobo(bk.breakdown.yearlyRentKobo)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Agent Fee:</span>{' '}
                          <strong className="font-mono tabular-nums">
                            {formatNairaFromKobo(bk.breakdown.agentCommissionKobo)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Inspection Fee:</span>{' '}
                          <strong className="font-mono tabular-nums">
                            {formatNairaFromKobo(bk.breakdown.inspectionFeeKobo)}
                          </strong>
                        </div>
                      </div>

                      {bk.splitAt && awaitingDecision && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#16A34A] shrink-0" />
                          <span>
                            48-Hour Payment Protection: Funds auto-split on{' '}
                            <strong className="font-mono">
                              {bk.splitAt.slice(0, 16).replace('T', ' ')} UTC
                            </strong>{' '}
                            unless you confirm earlier or request a refund.
                          </span>
                        </div>
                      )}

                      {/* Agent Call & WhatsApp Direct Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-green-50/60 border border-green-200 rounded-xl p-3.5 text-xs">
                        <div>
                          <p className="font-bold text-[#111827]">
                            Agent: {bk.agentName} ({bk.agentPhone || '+2348067743102'})
                          </p>
                          <p className="text-slate-600">
                            REMINDER: Get receipt before paying rent directly to landlord/caretaker.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${bk.agentPhone || '+2348067743102'}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-xl"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Call Agent</span>
                          </a>
                          <a
                            href={buildStudentToAgentWhatsAppLink({
                              agentPhone: bk.agentPhone || '+2348067743102',
                              agentName: bk.agentName,
                              lodgeTitle: bk.propertyTitle,
                              bookingReference: bk.bookingReference,
                              inspectionDate: bk.inspectionDate,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-green-300 text-[#15803D] font-semibold rounded-xl hover:bg-green-50"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>

                      {bk.inspectionContact ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1">
                          <p className="font-semibold text-[#15803D] flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Your Boarding Info Sent to {bk.agentName}</span>
                          </p>
                          <p className="text-slate-700">
                            <strong>{bk.inspectionContact.fullName}</strong> ·{' '}
                            <span className="font-mono">{bk.inspectionContact.phoneNumber}</span>
                            {bk.inspectionContact.whatsappOrAltPhone
                              ? ` (WhatsApp: ${bk.inspectionContact.whatsappOrAltPhone})`
                              : ''}
                          </p>
                          <p className="text-slate-600">
                            Meetup: <strong>{bk.inspectionContact.campusMeetupPoint}</strong> ·{' '}
                            {bk.inspectionContact.preferredTimeSlot}
                          </p>
                          {bk.inspectionContact.notesForAgent && (
                            <p className="text-slate-500">Note: {bk.inspectionContact.notesForAgent}</p>
                          )}
                        </div>
                      ) : (
                        awaitingDecision && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
                            <span>
                              Add your contact details so <strong>{bk.agentName}</strong> knows how to reach you for inspection.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setContactTarget(bk);
                                setContactName(currentUser.fullName);
                                setContactPhone(currentUser.phone);
                                setContactWhatsapp(currentUser.whatsappNumber || currentUser.phone);
                                setContactDate(bk.inspectionDate || todayIso);
                                setContactNotes('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#16A34A] text-white font-semibold rounded-xl hover:bg-[#15803D]"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Complete Boarding Form</span>
                            </button>
                          </div>
                        )
                      )}

                      {awaitingDecision && (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          {!gate.eligible && (
                            <p className="text-xs text-slate-600 flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              <span>
                                <strong>CONFIRM</strong> unlocks at your scheduled inspection time ({gate.unlocksAtLabel}). You can request a refund anytime if an issue occurs.
                              </span>
                            </p>
                          )}
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              type="button"
                              disabled={!gate.eligible}
                              onClick={() => {
                                setConfirmTarget(bk);
                                setConfirmChecked(false);
                              }}
                              className="min-h-[48px] px-5 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                              CONFIRM — I am okay with this lodge
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRefundTarget(bk);
                                setRefundDate(bk.inspectionDate);
                              }}
                              className="min-h-[48px] px-5 py-3 bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold rounded-xl hover:bg-rose-100"
                            >
                              REFUND — Agent tried to scam me
                            </button>
                          </div>
                        </div>
                      )}

                      {bk.confirmedAt && (
                        <div className="text-xs text-[#15803D] bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Confirmed on {bk.confirmedAt.slice(0, 16).replace('T', ' ')} · Ref:{' '}
                            <span className="font-mono">{bk.settlementAuthorizationCode}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => downloadReceipt(bk)}
                            className="inline-flex items-center gap-1 font-semibold underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Receipt</span>
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}

          {section === 'payments' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display font-bold text-[#111827]">
                Payment History &amp; Receipts
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4">Reference</th>
                      <th className="py-2 pr-4">Lodge</th>
                      <th className="py-2 pr-4">Booking Fee Paid</th>
                      <th className="py-2 pr-4">Hold Status</th>
                      <th className="py-2 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myBookings.map((bk) => (
                      <tr key={bk.bookingId}>
                        <td className="py-3 pr-4 font-mono">{bk.bookingReference}</td>
                        <td className="py-3 pr-4 font-medium text-[#111827]">{bk.propertyTitle}</td>
                        <td className="py-3 pr-4 font-mono tabular-nums">
                          {formatNairaFromKobo(bk.breakdown.totalBookingFeeKobo)}
                        </td>
                        <td className="py-3 pr-4">{bk.paymentStatus}</td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => downloadReceipt(bk)}
                            className="inline-flex items-center gap-1 text-[#16A34A] font-semibold hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'refunds' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display font-bold text-[#111827]">
                My Refund Requests
              </h2>
              {myDisputes.length === 0 ? (
                <p className="text-sm text-slate-600">
                  You have no active refund requests.
                </p>
              ) : (
                <div className="space-y-3">
                  {myDisputes.map((d) => (
                    <div key={d.disputeId} className="border border-slate-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-500">{d.bookingReference}</span>
                        <span className="font-semibold text-amber-800">{d.status}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#111827]">{d.reason}</p>
                      <p className="text-xs text-slate-600">{d.description}</p>
                      {d.resolutionNote && (
                        <p className="text-xs text-[#15803D] bg-green-50 p-2.5 rounded-xl">
                          Resolution Note: {d.resolutionNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'notifications' && (
            <NotificationsPanel
              role="student"
              notifications={myNotifications}
              onNavigate={(target) => {
                if (target.type === 'property') {
                  openPropertyDetails(target.propertyId);
                } else {
                  setSection(target.section as StudentSection);
                }
              }}
            />
          )}

          {section === 'profile' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-[#111827]">
                    ABSU Student Profile
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your student contact &amp; account session details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logoutUser}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
              <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Full Name</dt>
                  <dd className="font-semibold text-[#111827]">{currentUser.fullName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Matriculation Number</dt>
                  <dd className="font-mono font-semibold text-[#111827]">
                    {currentUser.matricNumber || 'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Phone</dt>
                  <dd className="font-mono text-slate-800">{currentUser.phone}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">WhatsApp</dt>
                  <dd className="font-mono text-slate-800">
                    {currentUser.whatsappNumber || currentUser.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="text-slate-800">{currentUser.email || 'Optional'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Faculty / Dept</dt>
                  <dd className="text-slate-800">
                    {currentUser.faculty || 'ABSU Uturu'} · {currentUser.department || 'General'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {section === 'support' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
              <h2 className="text-lg font-display font-bold text-[#111827]">
                SUG Student Accommodation Support
              </h2>
              <p className="text-sm text-slate-600">
                Need immediate help during an Uturu inspection? Use the floating WhatsApp Support button, visit the SUG Secretariat Accommodation Desk, or email{' '}
                <span className="font-mono">support@absulodgesafe.ng</span>.
              </p>
              <button
                type="button"
                onClick={() => setActivePage('policies')}
                className="px-4 py-2.5 text-xs font-semibold text-[#15803D] bg-green-50 border border-green-200 rounded-xl"
              >
                Read Student &amp; Refund Policies
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Explicit Confirmation Dialogue */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-lg font-display font-bold text-[#111827]">
              CONFIRM — I am okay with this lodge
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Booking: {confirmTarget.bookingReference} · {confirmTarget.propertyTitle}
            </p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-sm text-[#111827] leading-relaxed">
              &quot;I have physically inspected this accommodation, verified the landlord/caretaker authorization, and authorize release of the held booking fee splits (40% Agent / 35% SUG / 25% Platform).&quot;
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>Remember: Always collect an official lodge receipt when paying annual rent directly to the landlord or caretaker.</span>
            </div>
            <label className="flex items-start gap-2.5 text-xs font-semibold text-[#111827] cursor-pointer">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 accent-[#16A34A]"
              />
              <span>
                I confirm physical inspection and authorize fund release.
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmChecked}
                onClick={handleConfirmSubmit}
                className="px-4 py-2.5 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl disabled:opacity-40"
              >
                Confirm &amp; Release Funds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Refund Complaint Modal */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleRefundSubmit}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 my-8"
          >
            <div className="flex items-center gap-2 text-rose-800">
              <FileWarning className="w-5 h-5" />
              <h3 className="text-lg font-display font-bold text-[#111827]">
                REFUND — Agent tried to scam me
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Booking: {refundTarget.bookingReference} · Amount to Refund:{' '}
              {formatNairaFromKobo(refundTarget.breakdown.totalBookingFeeKobo)}
            </p>

            <div>
              <label htmlFor="refund-reason" className="block text-xs font-medium text-slate-700 mb-1">
                Select Fraud / Inspection Issue Reason
              </label>
              <select
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value as DisputeReason)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
              >
                {DISPUTE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="refund-date" className="block text-xs font-medium text-slate-700 mb-1">
                  Inspection Date
                </label>
                <input
                  id="refund-date"
                  type="date"
                  required
                  value={refundDate}
                  onChange={(e) => setRefundDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="refund-evidence" className="block text-xs font-medium text-slate-700 mb-1">
                  Evidence Upload (Optional)
                </label>
                <input
                  id="refund-evidence"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.pdf"
                  onChange={(e) => setRefundEvidence(e.target.files?.[0]?.name || '')}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700"
                />
              </div>
            </div>

            <div>
              <label htmlFor="refund-desc" className="block text-xs font-medium text-slate-700 mb-1">
                Describe What Happened
              </label>
              <textarea
                id="refund-desc"
                required
                rows={3}
                value={refundDesc}
                onChange={(e) => setRefundDesc(e.target.value)}
                placeholder="Explain clearly what occurred during the physical inspection..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="px-4 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-bold text-white bg-rose-700 rounded-xl hover:bg-rose-800"
              >
                Freeze Splits &amp; Request Full Refund
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inspection Contact Modal */}
      {contactTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleInspectionContactSubmit}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 my-8"
          >
            <div>
              <h3 className="text-lg font-display font-bold text-[#111827]">
                Complete Boarding Form for {contactTarget.agentName}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Booking <span className="font-mono">{contactTarget.bookingReference}</span>
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  WhatsApp Number
                </label>
                <input
                  required
                  value={contactWhatsapp}
                  onChange={(e) => setContactWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Inspection Date
                </label>
                <input
                  type="date"
                  min={todayIso}
                  required
                  value={contactDate}
                  onChange={(e) => setContactDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Time Window
                </label>
                <select
                  value={contactTimeSlot}
                  onChange={(e) => setContactTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  {INSPECTION_TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Campus Meetup Point
                </label>
                <select
                  value={contactMeetup}
                  onChange={(e) => setContactMeetup(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  <option value="ABSU Main School Gate">ABSU Main School Gate</option>
                  <option value="ABSU Gate Junction">ABSU Gate Junction</option>
                  <option value="Okigwe Road Junction">Okigwe Road Junction</option>
                  <option value="Direct at Lodge Axis (Uturu)">Direct at Lodge Axis (Uturu)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Notes for Agent (Optional)
              </label>
              <textarea
                rows={2}
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContactTarget(null)}
                className="px-4 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-bold text-white bg-[#16A34A] rounded-xl hover:bg-[#15803D]"
              >
                Send to {contactTarget.agentName}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
