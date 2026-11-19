import React, { useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  Download,
  FileSpreadsheet,
  Gavel,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  formatNairaFromKobo,
  generateFinancialCsv,
  summarizeFinancialLedger,
} from '../domain/finance';
import { PropertyListing } from '../domain/types';
import { NotificationsPanel } from './NotificationsPanel';

type SugTab =
  | 'overview'
  | 'agents'
  | 'lodges'
  | 'disputes'
  | 'financials'
  | 'notifications'
  | 'governance';

export function SugAdminDashboard() {
  const {
    currentUser,
    agents,
    properties,
    bookings,
    disputes,
    settings,
    auditLogs,
    notifications,
    setActivePage,
    openPropertyDetails,
    reviewAgentAsSug,
    reviewLodgeAsSug,
    toggleLodgeAvailability,
    resolveDisputeAsSug,
    processApprovedRefund,
    updatePlatformSettings,
    publishAnnouncement,
    logoutUser,
    showToast,
  } = useMarketplace();

  const [tab, setTab] = useState<SugTab>('overview');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [editingProperty, setEditingProperty] = useState<PropertyListing | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editRooms, setEditRooms] = useState('1');

  // Commission policy controls
  const [platformPct, setPlatformPct] = useState(String(settings.platformSharePct));
  const [sugPct, setSugPct] = useState(String(settings.sugPlatformSharePct));
  const [maxCommPct, setMaxCommPct] = useState(String(settings.maxCommissionPctOfRent));
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  if (!currentUser || !['sug_president', 'sug_admin'].includes(currentUser.role)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-slate-900">
          SUG Administration Restricted
        </h1>
        <p className="text-sm text-slate-600">
          Unauthorized users cannot access SUG President &amp; Accommodation Administration.
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

  const summary = useMemo(() => summarizeFinancialLedger(bookings), [bookings]);

  const uniqueStudentsCount = useMemo(() => {
    const ids = new Set(bookings.map((b) => b.studentUid));
    return Math.max(ids.size, 2);
  }, [bookings]);

  const myNotifications = useMemo(
    () =>
      notifications.filter(
        (n) =>
          n.recipientUid === currentUser.uid ||
          n.recipientRole === 'sug_president' ||
          n.recipientRole === 'sug_admin'
      ),
    [notifications, currentUser.uid]
  );

  const unreadNotificationCount = useMemo(
    () => myNotifications.filter((n) => !n.read).length,
    [myNotifications]
  );

  const kpis = [
    { label: 'Total Registered Students', value: uniqueStudentsCount },
    { label: 'Total Registered Agents', value: agents.length },
    { label: 'Approved Agents', value: agents.filter((a) => a.status === 'Approved').length },
    { label: 'Pending Agent Applications', value: agents.filter((a) => a.status === 'Pending Approval').length },
    { label: 'Total Lodges', value: properties.length },
    { label: 'SUG Verified Lodges', value: properties.filter((p) => p.verificationStatus === 'SUG Verified').length },
    { label: 'Available Lodges', value: properties.filter((p) => p.availabilityStatus === 'Available').length },
    { label: 'Total Bookings', value: bookings.length },
    { label: 'Confirmed & Settled', value: bookings.filter((b) => b.status === 'Settled' || b.status === 'Confirmed').length },
    {
      label: 'Awaiting Inspections',
      value: bookings.filter((b) => b.status === 'Awaiting Inspection' || b.status === 'Inspection Scheduled').length,
    },
    {
      label: 'Open Disputes',
      value: disputes.filter((d) => !['Closed', 'Refund Rejected', 'Refund Approved'].includes(d.status)).length,
    },
    { label: 'Total Commission Generated', value: formatNairaFromKobo(summary.totalAgentCommissionKobo) },
    { label: 'SUG Revenue (70% of 55%)', value: formatNairaFromKobo(summary.totalSugAllocationKobo) },
    { label: 'Tech Manager Allocation (30% of 55%)', value: formatNairaFromKobo(summary.totalTechManagerAllocationKobo) },
    { label: 'Pending Conditional Settlements', value: formatNairaFromKobo(summary.pendingSettlementKobo) },
  ];

  const downloadReport = (format: 'csv' | 'xls') => {
    const csv = generateFinancialCsv(bookings);
    const mime =
      format === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.ms-excel;charset=utf-8';
    const blob = new Blob([csv], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `absu-lodgesafe-financial-report.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', `Downloaded financial report (.${format}).`);
  };

  const handleSavePropertyEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;
    reviewLodgeAsSug(editingProperty.propertyId, editingProperty.verificationStatus, {
      title: editTitle.trim(),
      availableRooms: Number(editRooms),
    });
    setEditingProperty(null);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(platformPct);
    const s = Number(sugPct);
    const m = Number(maxCommPct);
    const res = updatePlatformSettings({
      platformSharePct: p,
      agentSharePct: 100 - p,
      sugPlatformSharePct: s,
      techManagerPlatformSharePct: 100 - s,
      maxCommissionPctOfRent: m,
    });
    if (!res.ok) showToast('error', res.error || 'Invalid commission rules.');
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
    { id: 'agents', label: 'Agent Management', icon: <Users className="w-4 h-4" /> },
    { id: 'lodges', label: 'Lodge Verification', icon: <Building2 className="w-4 h-4" /> },
    { id: 'disputes', label: 'Dispute Centre', icon: <Gavel className="w-4 h-4" /> },
    { id: 'financials', label: 'Financial Dashboard', icon: <FileSpreadsheet className="w-4 h-4" /> },
    {
      id: 'notifications',
      label:
        unreadNotificationCount > 0
          ? `Notifications (${unreadNotificationCount})`
          : 'Notifications',
      icon: <Bell className="w-4 h-4" />,
    },
    { id: 'governance', label: 'Policy & Handover', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Executive Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-emerald-800 inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>ABSU Students’ Union Government · Executive Oversight</span>
              </p>
              <h1 className="text-2xl font-display font-bold text-slate-900 mt-1">
                SUG President Administration Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500">
                Signed in: <strong className="text-slate-800">{currentUser.fullName}</strong>
              </p>
              <button
                type="button"
                onClick={logoutUser}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  tab === t.id
                    ? 'bg-emerald-800 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 leading-snug">{kpi.label}</p>
                  <p className="text-lg font-mono font-bold text-slate-900 tabular-nums mt-1.5">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-display font-bold text-slate-900">
                Recent Governance &amp; Verification Audit Trail
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.slice(0, 6).map((log) => (
                  <div key={log.logId} className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <div>
                      <span className="font-mono font-semibold text-emerald-900">{log.action}</span>{' '}
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

        {tab === 'agents' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-slate-900">
              Agent Verification &amp; Disciplinary Control
            </h2>
            <div className="space-y-4">
              {agents.map((ag) => (
                <div
                  key={ag.agentId}
                  className="border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{ag.fullName}</span>
                      <span className="font-mono text-slate-500">({ag.absuId})</span>
                      <span
                        className={`font-semibold ${
                          ag.status === 'Approved'
                            ? 'text-emerald-800'
                            : ag.status === 'Pending Approval'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {ag.status}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {ag.email} · {ag.phone} · ID File: <span className="font-mono">{ag.idDocumentName}</span>
                    </p>
                    <p className="text-slate-600">
                      Payout Bank: {ag.bankName} ({ag.accountNumber}) · Inspections: {ag.completedInspections} · Complaints: {ag.complaintsCount}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => reviewAgentAsSug(ag.agentId, 'Approved')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewAgentAsSug(ag.agentId, 'Rejected')}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewAgentAsSug(ag.agentId, 'Suspended')}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewAgentAsSug(ag.agentId, 'Banned')}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg"
                    >
                      Ban
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'lodges' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-slate-900">
              Lodge Verification &amp; Availability Audit
            </h2>
            <div className="space-y-4">
              {properties.map((p) => (
                <div
                  key={p.propertyId}
                  className="border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{p.title}</span>
                      <span
                        className={`font-semibold ${
                          p.verificationStatus === 'SUG Verified'
                            ? 'text-emerald-800'
                            : p.verificationStatus === 'Pending Verification'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {p.verificationStatus}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {p.locationArea} · {p.category} · Agent: {p.agentName} · Landlord: {p.landlordName} ({p.landlordAuthorizationDoc})
                    </p>
                    <p className="font-mono text-slate-700 tabular-nums">
                      Rent: {formatNairaFromKobo(p.yearlyRentKobo)} · Commission:{' '}
                      {formatNairaFromKobo(p.agentCommissionKobo)} · Rooms: {p.availableRooms} ({p.availabilityStatus})
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => reviewLodgeAsSug(p.propertyId, 'SUG Verified')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewLodgeAsSug(p.propertyId, 'Rejected')}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewLodgeAsSug(p.propertyId, 'Suspended')}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleLodgeAvailability(p.propertyId)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
                    >
                      Toggle Availability
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProperty(p);
                        setEditTitle(p.title);
                        setEditRooms(String(p.availableRooms));
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg"
                    >
                      Edit (Audited)
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewLodgeAsSug(p.propertyId, 'Removed')}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'disputes' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-slate-900">
              SUG Dispute &amp; Refund Adjudication Centre
            </h2>
            {disputes.length === 0 ? (
              <p className="text-sm text-slate-500">No disputes filed.</p>
            ) : (
              <div className="space-y-4">
                {disputes.map((d) => {
                  const linkedBooking = bookings.find((b) => b.bookingId === d.bookingId);
                  const note = resolutionNotes[d.disputeId] || '';
                  return (
                    <div key={d.disputeId} className="border border-slate-200 rounded-xl p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-slate-500">
                            Dispute {d.disputeId} · Booking {d.bookingReference} · Inspection {d.inspectionDate}
                          </p>
                          <h3 className="text-base font-bold text-slate-900">{d.propertyTitle}</h3>
                        </div>
                        <span className="text-xs font-semibold text-amber-800">{d.status}</span>
                      </div>

                      <div className="grid sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-500">Student:</span> <strong>{d.studentName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Agent:</span> <strong>{d.agentName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Amount Paid:</span>{' '}
                          <strong className="font-mono tabular-nums">
                            {formatNairaFromKobo(d.amountPaidKobo)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Booking State:</span>{' '}
                          <strong>{linkedBooking?.status || 'Unknown'}</strong>
                        </div>
                      </div>

                      <div className="text-sm space-y-1">
                        <p className="font-semibold text-rose-900">Reason: {d.reason}</p>
                        <p className="text-slate-700 text-xs leading-relaxed">{d.description}</p>
                        {d.evidenceFileName && (
                          <p className="text-xs font-mono text-slate-500">
                            Evidence attached: {d.evidenceFileName}
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-2">
                        {d.history.map((h, i) => (
                          <p key={i}>
                            <span className="font-mono">{h.timestamp.slice(0, 16).replace('T', ' ')}</span> ·{' '}
                            <strong>{h.actor}</strong>: {h.note}
                          </p>
                        ))}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <input
                          value={note}
                          onChange={(e) =>
                            setResolutionNotes((prev) => ({ ...prev, [d.disputeId]: e.target.value }))
                          }
                          placeholder="Enter recorded SUG decision note or reason..."
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              resolveDisputeAsSug({
                                disputeId: d.disputeId,
                                action: 'approve_refund',
                                note: note || 'Approved for full refund after SUG review.',
                              })
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg"
                          >
                            Approve Refund
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveDisputeAsSug({
                                disputeId: d.disputeId,
                                action: 'reject_refund',
                                note: note || 'Rejected after physical verification.',
                              })
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg"
                          >
                            Reject Refund
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveDisputeAsSug({
                                disputeId: d.disputeId,
                                action: 'request_evidence',
                                note: note || 'Requested additional photo/video evidence from both parties.',
                              })
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
                          >
                            Request Additional Evidence
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveDisputeAsSug({
                                disputeId: d.disputeId,
                                action: 'escalate',
                                note: note || 'Escalated to SUG President Executive Council.',
                              })
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg"
                          >
                            Escalate Complaint
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveDisputeAsSug({
                                disputeId: d.disputeId,
                                action: 'close',
                                note: note || 'Dispute closed.',
                              })
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
                          >
                            Close Dispute
                          </button>
                          {linkedBooking?.status === 'Refund Approved' && (
                            <button
                              type="button"
                              onClick={() => processApprovedRefund(linkedBooking.bookingId)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                            >
                              Execute Approved Refund (Test Gateway)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'financials' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-display font-bold text-slate-900">
                  Transparent Financial Reconciliation Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Landlord yearly rent is isolated from platform commission revenue. All calculations use historical kobo snapshots.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadReport('csv')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadReport('xls')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 text-slate-800 rounded-lg hover:bg-slate-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Excel</span>
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              <div className="border border-slate-200 rounded-lg p-3.5">
                <p className="text-slate-500">Landlord Rent (Isolated)</p>
                <p className="text-base font-mono font-bold text-slate-900 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalLandlordRentKobo)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3.5">
                <p className="text-slate-500">Agent 45% Share</p>
                <p className="text-base font-mono font-bold text-slate-900 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalAgentEarningsKobo)}
                </p>
              </div>
              <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg p-3.5">
                <p className="text-emerald-900">SUG 70% of Platform (55%)</p>
                <p className="text-base font-mono font-bold text-emerald-900 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalSugAllocationKobo)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3.5">
                <p className="text-slate-500">Tech Manager 30% of Platform</p>
                <p className="text-base font-mono font-bold text-slate-900 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalTechManagerAllocationKobo)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3.5">
                <p className="text-slate-500">Inspection Fee Ledger (₦3k)</p>
                <p className="text-base font-mono font-bold text-slate-900 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalInspectionFeeKobo)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3.5">
                <p className="text-slate-500">Est. Processing Fees</p>
                <p className="text-base font-mono font-bold text-slate-900 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.processingFeesEstimateKobo)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3.5">
                <p className="text-slate-500">Refunds Issued</p>
                <p className="text-base font-mono font-bold text-rose-800 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalRefundedKobo)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3.5">
                <p className="text-slate-500">Net Settled Volume</p>
                <p className="text-base font-mono font-bold text-emerald-800 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.settledVolumeKobo)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Landlord Rent</th>
                    <th className="py-2 pr-3 text-right">Agent 45%</th>
                    <th className="py-2 pr-3 text-right">Platform 55%</th>
                    <th className="py-2 pr-3 text-right">SUG 70%</th>
                    <th className="py-2 pr-3 text-right">Tech 30%</th>
                    <th className="py-2 pr-3 text-right">Inspection</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {bookings.map((bk) => (
                    <tr key={bk.bookingId}>
                      <td className="py-2.5 pr-3">{bk.bookingReference}</td>
                      <td className="py-2.5 pr-3 font-sans">{bk.status}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatNairaFromKobo(bk.breakdown.landlordRentKobo)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatNairaFromKobo(bk.breakdown.agentEarningsKobo)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatNairaFromKobo(bk.breakdown.platformCommissionKobo)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-emerald-800 font-semibold">
                        {formatNairaFromKobo(bk.breakdown.sugAllocationKobo)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatNairaFromKobo(bk.breakdown.techManagerAllocationKobo)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatNairaFromKobo(bk.breakdown.inspectionFeeKobo)}
                      </td>
                      <td className="py-2.5 text-right font-bold">
                        {formatNairaFromKobo(bk.breakdown.totalPayableKobo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'governance' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleSaveSettings}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-lg font-display font-bold text-slate-900">
                Commission Sharing Policy Approval
              </h2>
              <p className="text-xs text-slate-600">
                Changes apply to future bookings only; existing bookings retain their immutable historical allocation snapshots.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Platform Share % (Agent gets {100 - Number(platformPct)}%)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={platformPct}
                    onChange={(e) => setPlatformPct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    SUG Share of Platform % (Tech gets {100 - Number(sugPct)}%)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={sugPct}
                    onChange={(e) => setSugPct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Max Agent Commission (% of Yearly Rent)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={25}
                    value={maxCommPct}
                    onChange={(e) => setMaxCommPct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Fixed Inspection Fee
                  </label>
                  <input
                    disabled
                    value="₦3,000 (Fixed)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
              >
                Approve Commission Policy
              </button>
            </form>

            <form
              onSubmit={handlePublishAnnouncement}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-emerald-800" />
                <span>Publish SUG Student Announcement</span>
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                <input
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. Semester Hostel Verification Reminder"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  required
                  rows={3}
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Publish Notice
              </button>
            </form>
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
      </div>

      {/* Audited Property Edit Modal */}
      {editingProperty && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePropertyEdit}
            className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 border border-slate-200"
          >
            <h3 className="text-lg font-display font-bold text-slate-900">
              Edit Listing (Creates Immutable Audit Record)
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lodge Title</label>
              <input
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Available Rooms
              </label>
              <input
                type="number"
                min={0}
                required
                value={editRooms}
                onChange={(e) => setEditRooms(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProperty(null)}
                className="px-4 py-2 text-xs border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg"
              >
                Save Audited Edit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
