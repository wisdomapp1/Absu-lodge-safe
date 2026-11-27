import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  ClipboardList,
  Download,
  Gavel,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  formatNairaFromKobo,
  generateFinancialCsv,
  summarizeFinancialLedger,
} from '../domain/finance';
import { isSugAdminRole, PropertyListing } from '../domain/types';
import { NotificationsPanel } from './NotificationsPanel';

type SugTab =
  | 'overview'
  | 'lodges'
  | 'bookings'
  | 'disputes'
  | 'notifications'
  | 'announcements';

export function SugAdminDashboard() {
  const {
    currentUser,
    properties,
    bookings,
    disputes,
    auditLogs,
    notifications,
    setActivePage,
    openPropertyDetails,
    reviewLodgeAsSug,
    toggleLodgeAvailability,
    resolveDisputeAsSug,
    publishAnnouncement,
    logoutUser,
    showToast,
  } = useMarketplace();

  const [tab, setTab] = useState<SugTab>('overview');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<PropertyListing | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  if (!currentUser || !isSugAdminRole(currentUser.role)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#111827]">
          SUG Admin Access Restricted
        </h1>
        <p className="text-sm text-slate-600">
          Unauthorized users cannot access the SUG Accommodation Admin Portal.
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

  const summary = useMemo(() => summarizeFinancialLedger(bookings), [bookings]);

  const pendingLodgesCount = useMemo(
    () =>
      properties.filter(
        (p) => p.lodgeStatus === 'Pending' || p.verificationStatus === 'Pending Verification'
      ).length,
    [properties]
  );

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const bookingsTodayCount = useMemo(
    () => bookings.filter((b) => b.createdAt.startsWith(todayPrefix)).length,
    [bookings, todayPrefix]
  );

  const totalStudentsBookedCount = useMemo(
    () => new Set(bookings.map((b) => b.studentUid)).size,
    [bookings]
  );

  const myNotifications = useMemo(
    () =>
      notifications.filter(
        (n) =>
          n.recipientUid === currentUser.uid ||
          n.recipientRole === 'sug_admin' ||
          n.recipientRole === 'sug_president'
      ),
    [notifications, currentUser.uid]
  );

  const unreadNotificationCount = useMemo(
    () => myNotifications.filter((n) => !n.read).length,
    [myNotifications]
  );

  const downloadSugReport = () => {
    const csv = generateFinancialCsv(bookings);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `absu-sug-35pct-earnings-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Downloaded SUG 35% earnings CSV.');
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    const res = reviewLodgeAsSug(rejectTarget.propertyId, 'Rejected', {
      rejectionReason,
    });
    if (!res.ok) {
      showToast('error', res.error || 'Please provide a rejection reason.');
      return;
    }
    setRejectTarget(null);
    setRejectionReason('');
  };

  const handlePublishAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    publishAnnouncement(annTitle, annBody);
    setAnnTitle('');
    setAnnBody('');
  };

  const tabs: { id: SugTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'lodges',
      label: pendingLodgesCount > 0 ? `Lodge Approval (${pendingLodgesCount})` : 'Lodge Approval',
      icon: <Building2 className="w-4 h-4" />,
    },
    { id: 'bookings', label: 'Bookings & SUG 35%', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'disputes', label: 'Complaints Review', icon: <Gavel className="w-4 h-4" /> },
    {
      id: 'notifications',
      label:
        unreadNotificationCount > 0
          ? `Notifications (${unreadNotificationCount})`
          : 'Notifications',
      icon: <Bell className="w-4 h-4" />,
    },
    { id: 'announcements', label: 'SUG Notices', icon: <Megaphone className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen text-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Executive Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#16A34A] inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>ABSU Students’ Union Government · SUG Admin Portal</span>
              </p>
              <h1 className="text-2xl font-display font-bold text-[#111827] mt-1">
                SUG Lodge Verification &amp; Oversight
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                SUG Admins approve lodges, monitor bookings/35% SUG earnings, and review student complaints. Gateway keys &amp; bank transfers are managed strictly by Super Admin.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <p className="text-xs text-slate-500">
                Signed in: <strong className="text-[#111827]">{currentUser.fullName}</strong>
              </p>
              <button
                type="button"
                onClick={logoutUser}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
                  tab === t.id
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* OVERVIEW: 4 Core KPIs */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Total Lodges Pending</p>
                <p className="text-2xl font-display font-bold text-amber-700 tabular-nums mt-1">
                  {pendingLodgesCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Total Bookings Today</p>
                <p className="text-2xl font-display font-bold text-[#111827] tabular-nums mt-1">
                  {bookingsTodayCount}
                </p>
              </div>
              <div className="bg-white border border-green-200 bg-green-50/50 rounded-2xl p-5">
                <p className="text-xs font-semibold text-[#15803D]">Total SUG Earnings (35%)</p>
                <p className="text-2xl font-mono font-bold text-[#16A34A] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalSugAllocationKobo)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Total Students Booked</p>
                <p className="text-2xl font-display font-bold text-[#111827] tabular-nums mt-1">
                  {totalStudentsBookedCount}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
              <h2 className="text-base font-display font-bold text-[#111827]">
                Recent SUG Verification &amp; Oversight Activity
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.logId}
                    className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1"
                  >
                    <div>
                      <span className="font-mono font-semibold text-[#15803D]">{log.action}</span>{' '}
                      <span className="text-slate-700">— {log.summary}</span>
                    </div>
                    <span className="font-mono text-slate-400 shrink-0">
                      {log.actorName} · {log.createdAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LODGE APPROVAL QUEUE */}
        {tab === 'lodges' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-display font-bold text-[#111827]">
                Lodge Approval Queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect photos, description, rent, agent fee, landlord &amp; caretaker contacts before approving. Rejection requires a mandatory reason.
              </p>
            </div>
            <div className="space-y-4">
              {properties.map((p) => (
                <div
                  key={p.propertyId}
                  className="border border-slate-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-2 text-xs flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-[#111827]">{p.title}</span>
                        <span
                          className={`font-bold px-2.5 py-0.5 rounded-full ${
                            p.lodgeStatus === 'Approved'
                              ? 'bg-green-50 text-[#15803D]'
                              : p.lodgeStatus === 'Rejected'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {p.lodgeStatus}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        {p.locationArea} · {p.category} · Agent: <strong>{p.agentName}</strong> · Rooms: {p.availableRooms}
                      </p>
                      <p className="font-mono text-[#111827] tabular-nums">
                        Annual Rent: {formatNairaFromKobo(p.yearlyRentKobo)} · Agent Fee:{' '}
                        {formatNairaFromKobo(p.agentCommissionKobo)}
                      </p>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid sm:grid-cols-2 gap-2">
                        <p>
                          Landlord: <strong>{p.landlordName}</strong> ({p.landlordPhone})
                        </p>
                        <p>
                          Caretaker: <strong>{p.caretakerName}</strong> ({p.caretakerPhone})
                        </p>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{p.description}</p>
                      {p.flaggedSuspiciousReason && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-rose-900 flex items-center gap-2 font-semibold">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Safety Flag: {p.flaggedSuspiciousReason}</span>
                        </div>
                      )}
                      {p.rejectionReason && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-rose-900">
                          <strong>Rejection Reason:</strong> {p.rejectionReason}
                        </div>
                      )}
                      <div className="flex gap-2 overflow-x-auto pt-1">
                        {p.media
                          .filter((m) => m.type === 'image')
                          .map((m) => (
                            <img
                              key={m.id}
                              src={m.url}
                              alt={m.caption}
                              className="w-20 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => reviewLodgeAsSug(p.propertyId, 'Approved')}
                        className="px-4 py-2.5 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
                      >
                        Approve Lodge
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectTarget(p);
                          setRejectionReason('');
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100"
                      >
                        Reject (With Reason)
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleLodgeAvailability(p.propertyId)}
                        className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
                      >
                        {p.availabilityStatus === 'Available' ? 'Mark Taken' : 'Mark Available'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REALTIME BOOKINGS TABLE (READ-ONLY) & SUG 35% EARNINGS */}
        {tab === 'bookings' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-display font-bold text-[#111827]">
                  Bookings &amp; SUG 35% Share Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Read-only oversight of student bookings and SUG 35% share of Agent Fees. Refunded bookings yield ₦0.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadSugReport}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-[#16A34A] text-white rounded-xl hover:bg-[#15803D] self-start"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV Report</span>
              </button>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              <div className="border border-green-200 bg-green-50/50 rounded-2xl p-4">
                <p className="text-[#15803D] font-semibold">SUG 35% Total Revenue</p>
                <p className="text-xl font-mono font-bold text-[#16A34A] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalSugAllocationKobo)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-2xl p-4">
                <p className="text-slate-500">Held (48h Inspection Window)</p>
                <p className="text-xl font-mono font-bold text-[#111827] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.pendingHoldVolumeKobo)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-2xl p-4">
                <p className="text-slate-500">Settled Volume</p>
                <p className="text-xl font-mono font-bold text-[#15803D] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.settledVolumeKobo)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Lodge</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Booking Fee</th>
                    <th className="py-2 text-right">SUG 35% Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {bookings.map((bk) => (
                    <tr key={bk.bookingId}>
                      <td className="py-2.5 pr-3">{bk.bookingReference}</td>
                      <td className="py-2.5 pr-3 font-sans">{bk.studentName}</td>
                      <td className="py-2.5 pr-3 font-sans">{bk.propertyTitle}</td>
                      <td className="py-2.5 pr-3 font-sans">{bk.status}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatNairaFromKobo(bk.breakdown.totalBookingFeeKobo)}
                      </td>
                      <td className="py-2.5 text-right text-[#15803D] font-bold">
                        {bk.status === 'Refunded'
                          ? '₦0'
                          : formatNairaFromKobo(bk.breakdown.sugAllocationKobo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMPLAINTS REVIEW (Recommendation Only — Paystack refund execution restricted to Super Admin) */}
        {tab === 'disputes' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-display font-bold text-[#111827]">
                Student Complaints &amp; Fraud Review
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review student evidence and record SUG findings. Approved refunds are executed securely via Paystack by Super Admin.
              </p>
            </div>
            {disputes.length === 0 ? (
              <p className="text-sm text-slate-500">No complaints filed.</p>
            ) : (
              <div className="space-y-4">
                {disputes.map((d) => {
                  const note = resolutionNotes[d.disputeId] || '';
                  return (
                    <div
                      key={d.disputeId}
                      className="border border-slate-200 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-slate-500">
                            {d.disputeId} · Booking {d.bookingReference} · Inspection {d.inspectionDate}
                          </p>
                          <h3 className="text-base font-bold text-[#111827]">{d.propertyTitle}</h3>
                        </div>
                        <span className="text-xs font-bold text-amber-800">{d.status}</span>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-500">Student:</span> <strong>{d.studentName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Agent:</span> <strong>{d.agentName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Held Amount:</span>{' '}
                          <strong className="font-mono">
                            {formatNairaFromKobo(d.amountPaidKobo)}
                          </strong>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-rose-900">Reason: {d.reason}</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{d.description}</p>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <input
                          value={note}
                          onChange={(e) =>
                            setResolutionNotes((prev) => ({ ...prev, [d.disputeId]: e.target.value }))
                          }
                          placeholder="Enter SUG investigation note..."
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              resolveDisputeAsSug({
                                disputeId: d.disputeId,
                                action: 'approve_refund',
                                note: note || 'SUG Admin verified complaint and recommended full refund.',
                              })
                            }
                            className="px-3.5 py-2 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
                          >
                            Recommend Refund
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveDisputeAsSug({
                                disputeId: d.disputeId,
                                action: 'reject_refund',
                                note: note || 'Complaint rejected after inspection verification.',
                              })
                            }
                            className="px-3.5 py-2 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl"
                          >
                            Reject Claim
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveDisputeAsSug({
                                disputeId: d.disputeId,
                                action: 'escalate',
                                note: note || 'Escalated to Super Admin for Paystack action.',
                              })
                            }
                            className="px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl"
                          >
                            Escalate to Super Admin
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'notifications' && (
          <NotificationsPanel
            role={currentUser.role}
            notifications={myNotifications}
            onNavigate={(target) => {
              if (target.type === 'property') {
                openPropertyDetails(target.propertyId);
              } else {
                setTab(target.section as SugTab);
              }
            }}
          />
        )}

        {tab === 'announcements' && (
          <form
            onSubmit={handlePublishAnnouncement}
            className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 max-w-2xl"
          >
            <h2 className="text-lg font-display font-bold text-[#111827] flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#16A34A]" />
              <span>Publish SUG Student Safety Notice</span>
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notice Title</label>
              <input
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g. Never Pay Rent to an Agent"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
              <textarea
                required
                rows={3}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 min-h-[48px] text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
            >
              Publish Notice
            </button>
          </form>
        )}
      </div>

      {/* Mandatory Rejection Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReject}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200"
          >
            <div className="flex items-center gap-2 text-rose-700">
              <XCircle className="w-5 h-5" />
              <h3 className="text-lg font-display font-bold text-[#111827]">
                Reject Lodge Listing
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              Lodge: <strong>{rejectTarget.title}</strong>. A clear rejection reason is required so the agent can fix and resubmit.
            </p>
            <div>
              <label htmlFor="sug-reject-reason" className="block text-xs font-medium text-slate-700 mb-1">
                Mandatory Rejection Reason
              </label>
              <textarea
                id="sug-reject-reason"
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Caretaker phone number unreachable; photos are blurry."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-bold text-white bg-rose-700 rounded-xl hover:bg-rose-800"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
