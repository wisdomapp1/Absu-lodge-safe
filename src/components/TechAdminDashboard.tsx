import React, { useState } from 'react';
import {
  Activity,
  Database,
  HardDrive,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Server,
  ShieldAlert,
  Users,
  Webhook,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatNairaFromKobo } from '../domain/finance';
import { UserRole } from '../domain/types';

type TechTab = 'health' | 'webhooks' | 'storage' | 'users' | 'backups' | 'logs';

export function TechAdminDashboard() {
  const {
    currentUser,
    supabaseConfigured,
    supabaseConnected,
    properties,
    paymentEvents,
    backups,
    auditLogs,
    appErrorLogs,
    settings,
    bookings,
    setActivePage,
    simulateWebhookCheck,
    createBackupSnapshot,
    processApprovedRefund,
    updateUserRoleAsTech,
    logoutUser,
  } = useMarketplace();

  const [tab, setTab] = useState<TechTab>('health');

  if (!currentUser || currentUser.role !== 'tech_manager') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-slate-900">
          Technical Administration Restricted
        </h1>
        <p className="text-sm text-slate-600">
          Sign in with the Technical Manager administrator account to access system diagnostics, webhooks, backups, and security logs.
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

  const approvedRefunds = bookings.filter((b) => b.status === 'Refund Approved');
  const failedWebhooks = paymentEvents.filter(
    (e) => e.status === 'failed' || e.status === 'rejected_signature'
  );

  const tabs: { id: TechTab; label: string; icon: React.ReactNode }[] = [
    { id: 'health', label: 'System & DB Health', icon: <Activity className="w-4 h-4" /> },
    { id: 'webhooks', label: 'Webhooks & Transactions', icon: <Webhook className="w-4 h-4" /> },
    { id: 'storage', label: 'Storage & Media', icon: <HardDrive className="w-4 h-4" /> },
    { id: 'users', label: 'User & Role Access', icon: <Users className="w-4 h-4" /> },
    { id: 'backups', label: 'Backups & Recovery', icon: <Database className="w-4 h-4" /> },
    { id: 'logs', label: 'Error & Audit Logs', icon: <ShieldAlert className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-slate-900 text-white rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5">
                <Server className="w-4 h-4" />
                <span>Technical Manager Console · Infrastructure &amp; Security</span>
              </p>
              <h1 className="text-2xl font-display font-bold mt-1">
                Technical Administration &amp; Monitoring
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Separation of Duties Active: Technical Manager cannot approve own payouts, alter historical ledger records, or adjudicate disputes.
              </p>
            </div>
            <button
              type="button"
              onClick={logoutUser}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-200 bg-slate-800 border border-rose-500/40 rounded-lg hover:bg-rose-950/60 transition-colors shrink-0 self-start"
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  tab === t.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'health' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Supabase PostgreSQL</p>
                <p className="text-lg font-display font-bold text-slate-900 mt-1">
                  {supabaseConnected
                    ? 'Connected'
                    : supabaseConfigured
                    ? 'Configured'
                    : 'Awaiting Secrets'}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Payment Gateway Mode</p>
                <p className="text-lg font-mono font-bold text-amber-800 mt-1">
                  {settings.paymentMode}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Failed / Rejected Events</p>
                <p className="text-lg font-mono font-bold text-rose-700 tabular-nums mt-1">
                  {failedWebhooks.length}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Verified Backups</p>
                <p className="text-lg font-mono font-bold text-emerald-800 tabular-nums mt-1">
                  {backups.length}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-800" />
                <span>API &amp; Security Configuration (Keys Masked Server-Side)</span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="border border-slate-200 rounded-lg p-3.5 space-y-1">
                  <p className="font-semibold text-slate-900">Paystack Conditional Settlement</p>
                  <p className="text-slate-600">
                    Partner Written Approval: <strong>{settings.paystackPartnerApproved ? 'Approved' : 'Pending Written Confirmation'}</strong>
                  </p>
                  <p className="font-mono text-slate-500">PAYSTACK_SECRET_KEY: •••••••• (Server-only)</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3.5 space-y-1">
                  <p className="font-semibold text-slate-900">Webhook &amp; Rate-Limit Protection</p>
                  <p className="text-slate-600">HMAC Signature Verification: Enabled</p>
                  <p className="text-slate-600">Duplicate Webhook Idempotency Guard: Active</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'webhooks' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-display font-bold text-slate-900">
                    Payment Webhook &amp; Failed Transaction Monitor
                  </h2>
                  <p className="text-xs text-slate-500">
                    Verify idempotent webhook handling and execute SUG-approved test refunds.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => simulateWebhookCheck(false)}
                    className="px-3 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg"
                  >
                    Test New Signed Webhook
                  </button>
                  <button
                    type="button"
                    onClick={() => simulateWebhookCheck(true)}
                    className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Simulate Duplicate Webhook
                  </button>
                </div>
              </div>

              {approvedRefunds.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-950">
                    SUG-Approved Refunds Ready for Payment Gateway Execution ({approvedRefunds.length})
                  </p>
                  {approvedRefunds.map((b) => (
                    <div key={b.bookingId} className="flex items-center justify-between text-xs bg-white p-2.5 rounded border border-amber-200">
                      <span className="font-mono">
                        {b.bookingReference} · {formatNairaFromKobo(b.breakdown.totalPayableKobo)}
                      </span>
                      <button
                        type="button"
                        onClick={() => processApprovedRefund(b.bookingId)}
                        className="px-3 py-1 bg-slate-900 text-white font-semibold rounded"
                      >
                        Process Approved Refund
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Webhook ID</th>
                      <th className="py-2 pr-3">Booking Ref</th>
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                      <th className="py-2 pr-3">Signature</th>
                      <th className="py-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {paymentEvents.map((evt) => (
                      <tr key={evt.eventId}>
                        <td className="py-2.5 pr-3">{evt.webhookId}</td>
                        <td className="py-2.5 pr-3">{evt.bookingReference}</td>
                        <td className="py-2.5 pr-3">{evt.eventType}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatNairaFromKobo(evt.amountKobo)}
                        </td>
                        <td className="py-2.5 pr-3">{evt.signatureValid ? 'Valid' : 'Invalid'}</td>
                        <td className="py-2.5">{evt.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'storage' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-slate-900">
              Media Storage &amp; Upload Policy Monitor
            </h2>
            <p className="text-xs text-slate-600">
              Allowed media types: JPG, JPEG, PNG, WebP (≤ 5MB) and MP4 videos (≤ 25MB).
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {properties.flatMap((p) => p.media).map((m) => (
                <div key={m.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <p className="font-mono font-semibold text-slate-900 truncate">{m.fileName}</p>
                    <p className="text-slate-500">{m.type.toUpperCase()} · {Math.round(m.sizeBytes / 1024)} KB</p>
                  </div>
                  <span className="text-emerald-800 font-semibold shrink-0">Valid</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-slate-900">
              Role &amp; Access Governance
            </h2>
            <p className="text-xs text-slate-600">
              Note: Technical Manager cannot grant financial dispute decision rights or self-payout approval.
            </p>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
              {[
                { uid: 'demo_stu_chinedu', name: 'Chinedu Okafor', role: 'student' as UserRole },
                { uid: 'demo_agt_emeka', name: 'Emeka Nwosu', role: 'agent' as UserRole },
                { uid: 'demo_sug_president', name: 'Comr. Kelechi Uchechukwu', role: 'sug_president' as UserRole },
                { uid: 'demo_tech_manager', name: 'Engr. Somtochukwu Eze', role: 'tech_manager' as UserRole },
              ].map((u) => (
                <div key={u.uid} className="p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{u.name}</p>
                    <p className="font-mono text-slate-500">{u.uid}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-700">{u.role}</span>
                    <button
                      type="button"
                      onClick={() => updateUserRoleAsTech(u.uid, u.role)}
                      className="px-2.5 py-1 border border-slate-200 rounded text-slate-700 hover:bg-slate-50"
                    >
                      Verify Access Audit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'backups' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Database Backup &amp; Recovery Snapshots
              </h2>
              <button
                type="button"
                onClick={createBackupSnapshot}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Create Backup Snapshot</span>
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {backups.map((b) => (
                <div key={b.backupId} className="border border-slate-200 rounded-lg p-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{b.label}</p>
                    <p className="font-mono text-slate-500">
                      {b.backupId} · {b.tablesCount} tables · {b.recordsCount} records · {b.sizeKb} KB
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-800">{b.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-display font-bold text-slate-900">
                Application Error &amp; Security Alerts
              </h2>
              <div className="space-y-2 text-xs">
                {appErrorLogs.map((e) => (
                  <div key={e.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                    <p className="font-mono font-bold text-amber-900">
                      [{e.level}] {e.timestamp.slice(0, 19).replace('T', ' ')}
                    </p>
                    <p className="text-amber-950 mt-1">{e.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-800" />
                <span>Immutable Technical &amp; Financial Audit Logs</span>
              </h2>
              <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.logId} className="py-2.5 space-y-0.5">
                    <p className="font-mono font-semibold text-slate-900">{log.action}</p>
                    <p className="text-slate-600">{log.summary}</p>
                    <p className="font-mono text-slate-400">
                      {log.actorName} ({log.actorRole}) · {log.createdAt.slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
