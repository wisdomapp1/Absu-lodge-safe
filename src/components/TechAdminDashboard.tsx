import React, { useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Webhook,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  formatNairaFromKobo,
  generateFinancialCsv,
  summarizeFinancialLedger,
} from '../domain/finance';
import { isSuperAdminRole } from '../domain/types';

type SuperTab =
  | 'overview'
  | 'agents'
  | 'sug_admins'
  | 'lodges'
  | 'splits'
  | 'refunds'
  | 'diagnostics';

export function TechAdminDashboard() {
  const {
    currentUser,
    supabaseConfigured,
    supabaseConnected,
    realtimeConnected,
    agents,
    sugAdmins,
    properties,
    bookings,
    disputes,
    settlements,
    refunds,
    paymentEvents,
    backups,
    auditLogs,
    appErrorLogs,
    settings,
    setActivePage,
    reviewAgentAsSuperAdmin,
    createSugAdminAsSuperAdmin,
    toggleSugAdminStatusAsSuperAdmin,
    deleteLodgeAsSuperAdmin,
    triggerProcessSplitsAsSuperAdmin,
    retrySettlementTransferAsSuperAdmin,
    processApprovedRefund,
    simulateWebhookCheck,
    createBackupSnapshot,
    logoutUser,
    showToast,
  } = useMarketplace();

  const [tab, setTab] = useState<SuperTab>('overview');
  const [newSugName, setNewSugName] = useState('');
  const [newSugEmail, setNewSugEmail] = useState('');
  const [newSugPhone, setNewSugPhone] = useState('');
  const [newSugOffice, setNewSugOffice] = useState('SUG Accommodation Admin');

  if (!currentUser || !isSuperAdminRole(currentUser.role)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#111827]">
          Super Admin Control Centre Restricted
        </h1>
        <p className="text-sm text-slate-600">
          Sign in as the Platform Super Admin to manage agents, SUG Admins, 48-hour Paystack splits, Inspection Fee earnings, and system diagnostics.
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

  const handleCreateSugAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSugName.trim() || !newSugEmail.trim() || !newSugPhone.trim()) return;
    const res = createSugAdminAsSuperAdmin({
      fullName: newSugName,
      email: newSugEmail,
      phone: newSugPhone,
      officeTitle: newSugOffice,
    });
    if (res.ok) {
      setNewSugName('');
      setNewSugEmail('');
      setNewSugPhone('');
    } else {
      showToast('error', res.error || 'Could not create SUG Admin.');
    }
  };

  const downloadLedgerCsv = () => {
    const csv = generateFinancialCsv(bookings);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'absu-lodge-super-admin-ledger.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: SuperTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview & Revenue', icon: <Activity className="w-4 h-4" /> },
    { id: 'agents', label: 'Agents KYC', icon: <Users className="w-4 h-4" /> },
    { id: 'sug_admins', label: 'SUG Admins', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'lodges', label: 'Lodges Audit', icon: <Building2 className="w-4 h-4" /> },
    { id: 'splits', label: '48h Splits & Transfers', icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'refunds', label: 'Paystack Refunds', icon: <RotateCcw className="w-4 h-4" /> },
    { id: 'diagnostics', label: 'Webhooks, Backups & Logs', icon: <Server className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen text-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-[#111827] text-white rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#16A34A] inline-flex items-center gap-1.5">
                <Server className="w-4 h-4" />
                <span>Super Admin Control Centre · Project jjidjcnyknoavmefrrpi</span>
              </p>
              <h1 className="text-2xl font-display font-bold mt-1">
                ABSU Lodge Super Admin &amp; Treasury Console
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Full operational control: Agent approvals, SUG Admin accounts, 48-hour Paystack split payouts (40/35/25 + 100% Inspection Fee), refunds, and system diagnostics.
              </p>
            </div>
            <button
              type="button"
              onClick={logoutUser}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-rose-200 bg-slate-800 border border-rose-500/40 rounded-xl hover:bg-rose-950/60 shrink-0 self-start"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-800 pt-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
                  tab === t.id
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* OVERVIEW & REVENUE BREAKDOWN */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Gross Booking Volume (Excl. Refunds)</p>
                <p className="text-2xl font-mono font-bold text-[#111827] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalGrossBookingVolumeKobo)}
                </p>
              </div>
              <div className="bg-white border border-amber-200 bg-amber-50/40 rounded-2xl p-5">
                <p className="text-xs font-semibold text-amber-900">Held in 48-Hour Window</p>
                <p className="text-2xl font-mono font-bold text-amber-800 tabular-nums mt-1">
                  {formatNairaFromKobo(summary.pendingHoldVolumeKobo)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Agent Share Total (40%)</p>
                <p className="text-2xl font-mono font-bold text-[#111827] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalAgentEarningsKobo)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">SUG Revenue Total (35%)</p>
                <p className="text-2xl font-mono font-bold text-[#15803D] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalSugAllocationKobo)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Platform Agent Fee Share (25%)</p>
                <p className="text-2xl font-mono font-bold text-[#111827] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalPlatformAgentShareKobo)}
                </p>
              </div>
              <div className="bg-white border-2 border-[#16A34A] bg-green-50/50 rounded-2xl p-5">
                <p className="text-xs font-bold text-[#15803D]">
                  Backend Inspection Fee Revenue (₦3,000 × 100% Platform)
                </p>
                <p className="text-2xl font-mono font-bold text-[#16A34A] tabular-nums mt-1">
                  {formatNairaFromKobo(summary.totalInspectionFeeKobo)}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-display font-bold text-[#111827]">
                  Platform Treasury Snapshot
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Combined Platform Earnings (25% Agent Share + 100% Inspection Fee):{' '}
                  <strong className="font-mono text-[#16A34A]">
                    {formatNairaFromKobo(summary.totalPlatformTotalKobo)}
                  </strong>{' '}
                  · Refunded Total (Zeroed from Splits):{' '}
                  <strong className="font-mono text-rose-700">
                    {formatNairaFromKobo(summary.totalRefundedKobo)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={downloadLedgerCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
              >
                <Download className="w-4 h-4" />
                <span>Export Complete Ledger CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* AGENTS KYC MANAGEMENT */}
        {tab === 'agents' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-[#111827]">
              Agent Verification &amp; Disciplinary Control (Super Admin Only)
            </h2>
            <div className="space-y-4">
              {agents.map((ag) => (
                <div
                  key={ag.agentId}
                  className="border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#111827]">{ag.fullName}</span>
                      <span className="font-mono text-slate-500">({ag.absuId})</span>
                      <span
                        className={`font-bold px-2.5 py-0.5 rounded-full ${
                          ag.status === 'Approved'
                            ? 'bg-green-50 text-[#15803D]'
                            : ag.status === 'Pending Approval'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {ag.status}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Area: <strong>{ag.operatingArea}</strong> · Phone: {ag.phone} · Email: {ag.email} · NIN Last-4: <span className="font-mono">••••{ag.ninLast4 || '0000'}</span>
                    </p>
                    <p className="text-slate-600">
                      Payout Bank: {ag.bankName} ({ag.accountNumber}) · Doc: <span className="font-mono">{ag.idDocumentName}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => reviewAgentAsSuperAdmin(ag.agentId, 'Approved')}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewAgentAsSuperAdmin(ag.agentId, 'Rejected')}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewAgentAsSuperAdmin(ag.agentId, 'Suspended')}
                      className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl"
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewAgentAsSuperAdmin(ag.agentId, 'Banned')}
                      className="px-3.5 py-2 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl"
                    >
                      Ban
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUG ADMINS MANAGEMENT */}
        {tab === 'sug_admins' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-display font-bold text-[#111827]">
                Authorized SUG Admin Accounts
              </h2>
              <div className="space-y-3">
                {sugAdmins.map((s) => (
                  <div
                    key={s.uid}
                    className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#111827]">{s.fullName}</p>
                      <p className="text-slate-600">
                        {s.officeTitle} · {s.email} · {s.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSugAdminStatusAsSuperAdmin(s.uid)}
                      className={`px-3 py-1.5 font-bold rounded-xl border ${
                        s.active
                          ? 'bg-green-50 text-[#15803D] border-green-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {s.active ? 'Active (Disable)' : 'Disabled (Enable)'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleCreateSugAdmin}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
            >
              <h2 className="text-base font-display font-bold text-[#111827] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#16A34A]" />
                <span>Create New SUG Admin</span>
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  value={newSugName}
                  onChange={(e) => setNewSugName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">SUG Email</label>
                <input
                  type="email"
                  required
                  value={newSugEmail}
                  onChange={(e) => setNewSugEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                <input
                  required
                  value={newSugPhone}
                  onChange={(e) => setNewSugPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Office Title</label>
                <input
                  required
                  value={newSugOffice}
                  onChange={(e) => setNewSugOffice(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[48px] py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl"
              >
                Create SUG Admin Account
              </button>
            </form>
          </div>
        )}

        {/* LODGES AUDIT & DELETE */}
        {tab === 'lodges' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-[#111827]">
              All Marketplace Lodges (Super Admin Audit &amp; Removal)
            </h2>
            <div className="space-y-3">
              {properties.map((p) => (
                <div
                  key={p.propertyId}
                  className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="text-sm font-bold text-[#111827]">{p.title}</p>
                    <p className="text-slate-600">
                      Status: <strong>{p.lodgeStatus}</strong> · Agent: {p.agentName} · Landlord: {p.landlordName} ({p.landlordPhone}) · Caretaker: {p.caretakerName} ({p.caretakerPhone})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteLodgeAsSuperAdmin(p.propertyId)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Fraudulent Lodge</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 48H SPLITS & SETTLEMENT TRANSFERS */}
        {tab === 'splits' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-display font-bold text-[#111827]">
                  48-Hour Payment Hold &amp; Paystack Split Transfers
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Splits execute automatically at split_at = paid_at + 48 hours unless locked under refund_pending. Max 3 retries on failed transfers.
                </p>
              </div>
              <button
                type="button"
                onClick={triggerProcessSplitsAsSuperAdmin}
                className="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Trigger 48h Process Splits</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Booking Ref</th>
                    <th className="py-2 pr-3">Recipient</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {settlements.map((s) => (
                    <tr key={s.settlementId}>
                      <td className="py-2.5 pr-3">{s.bookingReference}</td>
                      <td className="py-2.5 pr-3 font-sans">{s.recipientName}</td>
                      <td className="py-2.5 pr-3 uppercase">{s.recipientType}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatNairaFromKobo(s.amountKobo)}
                      </td>
                      <td className="py-2.5 pr-3">{s.status}</td>
                      <td className="py-2.5 text-right">
                        {s.status === 'failed' ? (
                          <button
                            type="button"
                            onClick={() => retrySettlementTransferAsSuperAdmin(s.settlementId)}
                            className="px-2.5 py-1 bg-[#16A34A] text-white rounded-lg font-sans font-bold"
                          >
                            Retry ({s.retryCount}/3)
                          </button>
                        ) : (
                          <span className="text-[#15803D]">Verified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYSTACK REFUNDS */}
        {tab === 'refunds' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-display font-bold text-[#111827]">
                Paystack Refund Execution &amp; Retry Console (Super Admin Only)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Refunded transactions automatically yield ₦0 to Agent, SUG, and Platform.
              </p>
            </div>
            {refunds.length === 0 ? (
              <p className="text-sm text-slate-500">No refund records found.</p>
            ) : (
              <div className="space-y-3">
                {refunds.map((r) => {
                  const linkedDispute = disputes.find((d) => d.bookingId === r.bookingId);
                  return (
                    <div
                      key={r.refundId}
                      className="border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-mono font-bold text-[#111827]">
                          {r.bookingReference} · {formatNairaFromKobo(r.amountKobo)} · Status:{' '}
                          <span className="uppercase">{r.status}</span>
                        </p>
                        <p className="text-slate-700">Reason: {r.reason}</p>
                        {linkedDispute && (
                          <p className="text-slate-500">SUG Case: {linkedDispute.status}</p>
                        )}
                        {r.failureReason && (
                          <p className="text-rose-700 font-semibold">{r.failureReason}</p>
                        )}
                      </div>
                      {r.status !== 'processed' && (
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => processApprovedRefund(r.bookingId, 'processed')}
                            className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-xl"
                          >
                            Execute / Retry Paystack Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => processApprovedRefund(r.bookingId, 'failed')}
                            className="px-3 py-2 bg-rose-50 text-rose-800 border border-rose-200 font-semibold rounded-xl"
                          >
                            Simulate Failed Refund
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SYSTEM DIAGNOSTICS, WEBHOOKS, BACKUPS & AUDIT LOGS */}
        {tab === 'diagnostics' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Supabase (jjidjcnyknoavmefrrpi)</p>
                <p className="text-lg font-display font-bold text-[#111827] mt-1">
                  {supabaseConnected
                    ? 'Connected'
                    : supabaseConfigured
                    ? 'Configured'
                    : 'Awaiting Secrets'}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Realtime Channel</p>
                <p className="text-lg font-display font-bold text-[#16A34A] mt-1">
                  {realtimeConnected ? 'Subscribed' : 'Standby'}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Paystack Mode</p>
                <p className="text-lg font-mono font-bold text-amber-800 mt-1">
                  {settings.paymentMode}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs text-slate-500">Database Backups</p>
                <p className="text-lg font-mono font-bold text-[#16A34A] mt-1">
                  {backups.length}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-display font-bold text-[#111827] flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-[#16A34A]" />
                  <span>Paystack Webhook Idempotency Monitor</span>
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => simulateWebhookCheck(false)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-[#16A34A] rounded-xl"
                  >
                    Test Signed Webhook
                  </button>
                  <button
                    type="button"
                    onClick={() => simulateWebhookCheck(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl"
                  >
                    Test Duplicate Guard
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Webhook ID</th>
                      <th className="py-2 pr-3">Booking</th>
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentEvents.map((evt) => (
                      <tr key={evt.eventId}>
                        <td className="py-2 pr-3">{evt.webhookId}</td>
                        <td className="py-2 pr-3">{evt.bookingReference}</td>
                        <td className="py-2 pr-3">{evt.eventType}</td>
                        <td className="py-2 pr-3 text-right">{formatNairaFromKobo(evt.amountKobo)}</td>
                        <td className="py-2">{evt.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-display font-bold text-[#111827] flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#16A34A]" />
                    <span>Backups &amp; Snapshots</span>
                  </h2>
                  <button
                    type="button"
                    onClick={createBackupSnapshot}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#16A34A] rounded-xl"
                  >
                    Create Snapshot
                  </button>
                </div>
                {backups.map((b) => (
                  <div key={b.backupId} className="border border-slate-200 rounded-xl p-3 text-xs flex justify-between">
                    <div>
                      <p className="font-semibold">{b.label}</p>
                      <p className="font-mono text-slate-500">
                        {b.tablesCount} tables · {b.recordsCount} records
                      </p>
                    </div>
                    <span className="font-bold text-[#15803D]">{b.status}</span>
                  </div>
                ))}
                <div className="pt-2 space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Secrets Status (Masked Server-Side)</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>PAYSTACK_SECRET_KEY / SERVICE_ROLE_KEY: Server-Side Only</span>
                  </p>
                  {appErrorLogs.map((err) => (
                    <div key={err.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                      <p className="font-mono font-bold text-amber-900">[{err.level}]</p>
                      <p className="text-amber-950">{err.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <h2 className="text-base font-display font-bold text-[#111827] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#16A34A]" />
                  <span>Immutable Audit Logs</span>
                </h2>
                <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.logId} className="py-2.5">
                      <p className="font-mono font-bold text-[#111827]">{log.action}</p>
                      <p className="text-slate-600">{log.summary}</p>
                      <p className="font-mono text-slate-400">
                        {log.actorName} ({log.actorRole}) · {log.createdAt.slice(0, 16).replace('T', ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
