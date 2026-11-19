import React, { useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileWarning,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  PhoneCall,
  RotateCcw,
  Send,
  User,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatNairaFromKobo } from '../domain/finance';
import { getUnreadNotificationsCount } from '../domain/notifications';
import { BookingRecord, DisputeReason } from '../domain/types';
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
  'Lodge does not exist.',
  'Agent showed a different property.',
  'Landlord authorization could not be verified.',
  'Property differs from advertised photographs.',
  'Property is not as described.',
  'Landlord changed the agreed price.',
  'Property is unavailable.',
  'Other.',
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
  const [contactTarget, setContactTarget] = useState<BookingRecord | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactTimeSlot, setContactTimeSlot] = useState('Morning (9:00 AM - 12:00 PM)');
  const [contactMeetup, setContactMeetup] = useState('ABSU Main School Gate');
  const [contactNotes, setContactNotes] = useState('');
  const [refundTarget, setRefundTarget] = useState<BookingRecord | null>(null);
  const [refundReason, setRefundReason] = useState<DisputeReason>(DISPUTE_REASONS[0]);
  const [refundDesc, setRefundDesc] = useState('');
  const [refundDate, setRefundDate] = useState('2026-11-21');
  const [refundEvidence, setRefundEvidence] = useState('');

  if (!currentUser || currentUser.role !== 'student') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-slate-900">
          Student Dashboard Access
        </h1>
        <p className="text-sm text-slate-600">
          Sign in with an ABSU Student account to view your private bookings, inspection confirmations, and payment receipts.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-800 rounded-lg"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  // Strict student isolation: students can access ONLY their own bookings & disputes
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
      showToast('error', res.error || 'Could not submit dispute.');
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
      'ABSU LODGESAFE — OFFICIAL BOOKING RECEIPT (TEST ENVIRONMENT)',
      '==============================================================',
      `Booking Reference: ${bk.bookingReference}`,
      `Student: ${bk.studentName} (${bk.studentMatric})`,
      `Lodge: ${bk.propertyTitle}`,
      `Axis: ${bk.locationArea}, Uturu`,
      `Agent: ${bk.agentName}`,
      `Booking Date: ${bk.createdAt.slice(0, 10)}`,
      `Inspection Date: ${bk.inspectionDate}`,
      `Status: ${bk.status}`,
      '--------------------------------------------------------------',
      `Yearly Rent: ${formatNairaFromKobo(bk.breakdown.yearlyRentKobo)}`,
      `Agent Commission: ${formatNairaFromKobo(bk.breakdown.agentCommissionKobo)}`,
      `Inspection Fee (Fixed): ${formatNairaFromKobo(bk.breakdown.inspectionFeeKobo)}`,
      `Total Paid: ${formatNairaFromKobo(bk.breakdown.totalPayableKobo)}`,
      bk.confirmedAt ? `Confirmed Timestamp: ${bk.confirmedAt}` : 'Confirmed Timestamp: Pending Inspection',
      bk.settlementAuthorizationCode ? `Settlement Authorization: ${bk.settlementAuthorizationCode}` : '',
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
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <p className="text-xs font-semibold text-emerald-800">Student Portal</p>
            <h1 className="text-base font-display font-bold text-slate-900 mt-0.5">
              {currentUser.fullName}
            </h1>
            <p className="text-xs font-mono text-slate-500">
              {currentUser.matricNumber || 'ABSU Student'}
            </p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                  section === item.id
                    ? 'bg-emerald-800 text-white font-semibold'
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
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors text-left"
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
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">My Bookings</p>
                  <p className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-1">
                    {myBookings.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Awaiting My Inspection</p>
                  <p className="text-2xl font-display font-bold text-emerald-800 tabular-nums mt-1">
                    {
                      myBookings.filter(
                        (b) =>
                          b.status === 'Awaiting Inspection' ||
                          b.status === 'Inspection Scheduled'
                      ).length
                    }
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Open Refund Requests</p>
                  <p className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-1">
                    {myDisputes.length}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="text-lg font-display font-bold text-slate-900">
                  Your Inspection Workflow
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Visit your booked lodge on the scheduled inspection date. Once satisfied, open My Bookings and click <strong>Confirm Lodge &amp; Release Funds</strong>. If anything differs from what was advertised, click <strong>Request Refund</strong> immediately.
                </p>
                <button
                  type="button"
                  onClick={() => setSection('bookings')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                >
                  Go to My Bookings
                </button>
              </div>
            </div>
          )}

          {section === 'browse' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-slate-900">
                  SUG Verified Lodges Available Now
                </h2>
                <button
                  type="button"
                  onClick={() => setActivePage('home')}
                  className="text-xs font-semibold text-emerald-800 underline"
                >
                  Open Full Marketplace Filters
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {properties
                  .filter((p) => p.verificationStatus === 'SUG Verified')
                  .map((p) => (
                    <div
                      key={p.propertyId}
                      className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">
                          {p.locationArea} · {p.category}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                        <p className="text-sm font-mono font-bold text-emerald-900 tabular-nums">
                          {formatNairaFromKobo(p.yearlyRentKobo)} / yr
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPropertyDetails(p.propertyId)}
                        className="px-3 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg shrink-0"
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
                <h2 className="text-xl font-display font-bold text-slate-900">
                  My Bookings &amp; Physical Inspection Decisions
                </h2>
              </div>

              {myBookings.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                  <p className="text-base font-semibold text-slate-900">No bookings yet</p>
                  <p className="text-sm text-slate-600">
                    Browse SUG-verified lodges and schedule a physical inspection.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActivePage('home')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg"
                  >
                    Browse Lodges
                  </button>
                </div>
              ) : (
                myBookings.map((bk) => {
                  const awaitingDecision =
                    bk.paymentStatus === 'Test Paid' &&
                    (bk.status === 'Awaiting Inspection' || bk.status === 'Inspection Scheduled');

                  return (
                    <article
                      key={bk.bookingId}
                      className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row gap-4 justify-between">
                        <div className="flex gap-4">
                          <img
                            src={bk.propertyCoverUrl}
                            alt={bk.propertyTitle}
                            referrerPolicy="no-referrer"
                            className="w-24 h-20 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                              <span>{bk.bookingReference}</span>
                              <span>·</span>
                              <span>Booked {bk.createdAt.slice(0, 10)}</span>
                              <span>·</span>
                              <span>Inspection {bk.inspectionDate}</span>
                            </div>
                            <h3 className="text-base font-display font-bold text-slate-900">
                              {bk.propertyTitle}
                            </h3>
                            <p className="text-xs text-slate-600">
                              Agent: <strong>{bk.agentName}</strong> · Axis: {bk.locationArea}
                            </p>
                          </div>
                        </div>

                        <div className="sm:text-right space-y-1 shrink-0">
                          <p className="text-xs text-slate-500">Amount Paid (Test)</p>
                          <p className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                            {formatNairaFromKobo(bk.breakdown.totalPayableKobo)}
                          </p>
                          <p className="text-xs font-semibold text-emerald-800">
                            Status: {bk.status}
                          </p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-500">Payment Status:</span>{' '}
                          <strong className="text-slate-800">{bk.paymentStatus}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Inspection Status:</span>{' '}
                          <strong className="text-slate-800">{bk.inspectionStatus}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Rent:</span>{' '}
                          <strong className="font-mono tabular-nums">
                            {formatNairaFromKobo(bk.breakdown.yearlyRentKobo)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Inspection Fee:</span>{' '}
                          <strong className="font-mono tabular-nums">
                            {formatNairaFromKobo(bk.breakdown.inspectionFeeKobo)}
                          </strong>
                        </div>
                      </div>

                      {bk.inspectionContact ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
                          <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Inspection Contact Sent to {bk.agentName}</span>
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
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
                            <span>
                              Add your contact details so <strong>{bk.agentName}</strong> knows how to reach you for this inspection.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setContactTarget(bk);
                                setContactName(currentUser.fullName);
                                setContactPhone(currentUser.phone);
                                setContactWhatsapp('');
                                setContactNotes('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 text-white font-semibold rounded-lg hover:bg-emerald-900"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Send Contact Info to Agent</span>
                            </button>
                          </div>
                        )
                      )}

                      {awaitingDecision && (
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmTarget(bk);
                              setConfirmChecked(false);
                            }}
                            className="px-4 py-2.5 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900"
                          >
                            Confirm Lodge &amp; Release Funds
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRefundTarget(bk);
                              setRefundDate(bk.inspectionDate);
                            }}
                            className="px-4 py-2.5 bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold rounded-lg hover:bg-rose-100"
                          >
                            Request Refund
                          </button>
                        </div>
                      )}

                      {bk.confirmedAt && (
                        <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Confirmed on {bk.confirmedAt.slice(0, 16).replace('T', ' ')} · Auth:{' '}
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
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Payment History &amp; Receipts
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4">Reference</th>
                      <th className="py-2 pr-4">Lodge</th>
                      <th className="py-2 pr-4">Total Paid</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myBookings.map((bk) => (
                      <tr key={bk.bookingId}>
                        <td className="py-3 pr-4 font-mono">{bk.bookingReference}</td>
                        <td className="py-3 pr-4 font-medium text-slate-900">{bk.propertyTitle}</td>
                        <td className="py-3 pr-4 font-mono tabular-nums">
                          {formatNairaFromKobo(bk.breakdown.totalPayableKobo)}
                        </td>
                        <td className="py-3 pr-4">{bk.status}</td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => downloadReceipt(bk)}
                            className="inline-flex items-center gap-1 text-emerald-800 font-semibold hover:underline"
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
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-display font-bold text-slate-900">
                My Refund Requests
              </h2>
              {myDisputes.length === 0 ? (
                <p className="text-sm text-slate-600">
                  You have no active refund disputes.
                </p>
              ) : (
                <div className="space-y-3">
                  {myDisputes.map((d) => (
                    <div key={d.disputeId} className="border border-slate-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-500">{d.bookingReference}</span>
                        <span className="font-semibold text-amber-800">{d.status}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{d.reason}</p>
                      <p className="text-xs text-slate-600">{d.description}</p>
                      {d.resolutionNote && (
                        <p className="text-xs text-emerald-900 bg-emerald-50 p-2 rounded">
                          SUG Decision Note: {d.resolutionNote}
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
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-slate-900">
                    ABSU Student Profile
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verified student account details and active session controls.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logoutUser}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
              <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Full Name</dt>
                  <dd className="font-semibold text-slate-900">{currentUser.fullName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Matriculation Number</dt>
                  <dd className="font-mono font-semibold text-slate-900">
                    {currentUser.matricNumber || 'Not set'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="text-slate-800">{currentUser.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Phone</dt>
                  <dd className="text-slate-800">{currentUser.phone}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Faculty</dt>
                  <dd className="text-slate-800">{currentUser.faculty || 'Physical Sciences'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Department</dt>
                  <dd className="text-slate-800">{currentUser.department || 'Computer Science'}</dd>
                </div>
              </dl>
            </div>
          )}

          {section === 'support' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-lg font-display font-bold text-slate-900">
                SUG Student Accommodation Support
              </h2>
              <p className="text-sm text-slate-600">
                Need immediate help during an Uturu inspection? Visit the SUG Secretariat Accommodation Desk or email <span className="font-mono">support@absulodgesafe.ng</span>.
              </p>
              <button
                type="button"
                onClick={() => setActivePage('policies')}
                className="px-4 py-2 text-xs font-semibold text-emerald-900 bg-emerald-100 rounded-lg"
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
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-lg font-display font-bold text-slate-900">
              Confirm Lodge &amp; Release Funds
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Booking: {confirmTarget.bookingReference} · {confirmTarget.propertyTitle}
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-sm text-emerald-950 leading-relaxed">
              "I have physically inspected this accommodation, verified the agreed property and accept the lodge under the booking terms."
            </div>
            <label className="flex items-start gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 accent-emerald-800"
              />
              <span>
                I explicitly confirm physical inspection and authorize conditional settlement release.
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmChecked}
                onClick={handleConfirmSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-40"
              >
                Confirm &amp; Release Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Refund Complaint Screen */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleRefundSubmit}
            className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 my-8"
          >
            <div className="flex items-center gap-2 text-rose-800">
              <FileWarning className="w-5 h-5" />
              <h3 className="text-lg font-display font-bold text-slate-900">
                Request Refund — Submit SUG Complaint
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Booking: {refundTarget.bookingReference} · {refundTarget.propertyTitle}
            </p>

            <div>
              <label htmlFor="refund-reason" className="block text-xs font-medium text-slate-700 mb-1">
                Select Reason
              </label>
              <select
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value as DisputeReason)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
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
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700"
                />
              </div>
            </div>

            <div>
              <label htmlFor="refund-desc" className="block text-xs font-medium text-slate-700 mb-1">
                Complaint Description
              </label>
              <textarea
                id="refund-desc"
                required
                rows={3}
                value={refundDesc}
                onChange={(e) => setRefundDesc(e.target.value)}
                placeholder="Explain clearly what occurred during the physical inspection..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-800"
              >
                Submit Complaint to SUG
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
            className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 my-8"
          >
            <div>
              <h3 className="text-lg font-display font-bold text-slate-900">
                Send Inspection Contact Info to Agent
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Booking <span className="font-mono">{contactTarget.bookingReference}</span> · Agent:{' '}
                <strong>{contactTarget.agentName}</strong>
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  WhatsApp / Alt Phone
                </label>
                <input
                  value={contactWhatsapp}
                  onChange={(e) => setContactWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Time Window
                </label>
                <select
                  value={contactTimeSlot}
                  onChange={(e) => setContactTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Morning (9:00 AM - 12:00 PM)">Morning (9:00 AM - 12:00 PM)</option>
                  <option value="Afternoon (12:00 PM - 3:00 PM)">Afternoon (12:00 PM - 3:00 PM)</option>
                  <option value="Late Afternoon (3:00 PM - 5:30 PM)">Late Afternoon (3:00 PM - 5:30 PM)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Campus Meetup Point
              </label>
              <select
                value={contactMeetup}
                onChange={(e) => setContactMeetup(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="ABSU Main School Gate">ABSU Main School Gate</option>
                <option value="Back Gate Junction">Back Gate Junction</option>
                <option value="SUG Secretariat Front">SUG Secretariat Front</option>
                <option value="Direct at Lodge Axis (Uturu)">Direct at Lodge Axis (Uturu)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Notes for Agent (Optional)
              </label>
              <textarea
                rows={2}
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContactTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
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
