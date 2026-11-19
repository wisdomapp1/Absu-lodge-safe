import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Mail,
  PhoneCall,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatNairaFromKobo } from '../domain/finance';
import { resolveNotificationDetails } from '../domain/notifications';
import { NotificationItem, UserRole } from '../domain/types';

export type NotificationNavigationTarget =
  | { type: 'property'; propertyId: string }
  | { type: 'section'; section: string };

interface NotificationsPanelProps {
  role: UserRole;
  notifications: NotificationItem[];
  onNavigate?: (target: NotificationNavigationTarget) => void;
}

export function NotificationsPanel({
  role,
  notifications,
  onNavigate,
}: NotificationsPanelProps) {
  const {
    bookings,
    properties,
    disputes,
    markNotificationRead,
    markAllNotificationsRead,
  } = useMarketplace();

  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const selectedNotification = useMemo(
    () =>
      selectedNotificationId
        ? notifications.find((n) => n.notificationId === selectedNotificationId) || null
        : null,
    [notifications, selectedNotificationId]
  );

  const resolvedDetails = useMemo(
    () =>
      selectedNotification
        ? resolveNotificationDetails(selectedNotification, {
            bookings,
            properties,
            disputes,
          })
        : null,
    [selectedNotification, bookings, properties, disputes]
  );

  const handleOpenNotification = (notification: NotificationItem) => {
    if (!notification.read) {
      markNotificationRead(notification.notificationId);
    }
    setSelectedNotificationId(notification.notificationId);
  };

  const getQuickActions = () => {
    if (!resolvedDetails || !onNavigate) return [];
    const actions: { label: string; target: NotificationNavigationTarget }[] = [];

    if (role === 'student') {
      if (resolvedDetails.dispute) {
        actions.push({
          label: 'View in Refund Disputes',
          target: { type: 'section', section: 'refunds' },
        });
      }
      if (resolvedDetails.booking) {
        actions.push({
          label: 'View in My Bookings',
          target: { type: 'section', section: 'bookings' },
        });
      }
      if (resolvedDetails.property) {
        actions.push({
          label: 'Open Lodge Listing',
          target: { type: 'property', propertyId: resolvedDetails.property.propertyId },
        });
      }
    } else if (role === 'agent') {
      if (resolvedDetails.booking) {
        actions.push({
          label: 'Open Scheduled Inspections',
          target: { type: 'section', section: 'inspections' },
        });
        actions.push({
          label: 'View Lodge Bookings',
          target: { type: 'section', section: 'bookings' },
        });
      }
      if (resolvedDetails.property) {
        actions.push({
          label: 'Manage in My Lodges',
          target: { type: 'section', section: 'lodges' },
        });
      }
    } else if (role === 'sug_president' || role === 'sug_admin') {
      if (resolvedDetails.dispute) {
        actions.push({
          label: 'Open Dispute Centre',
          target: { type: 'section', section: 'disputes' },
        });
      }
      if (
        resolvedDetails.categoryLabel === 'SUG Verification' ||
        /kyc|agent/i.test(resolvedDetails.notification.message)
      ) {
        actions.push({
          label: 'Review in Agent Management',
          target: { type: 'section', section: 'agents' },
        });
      }
      if (
        resolvedDetails.property ||
        resolvedDetails.categoryLabel === 'SUG Verification'
      ) {
        actions.push({
          label: 'Review in Lodge Verification',
          target: { type: 'section', section: 'lodges' },
        });
      }
      if (resolvedDetails.booking && !resolvedDetails.dispute) {
        actions.push({
          label: 'View Financial Ledger',
          target: { type: 'section', section: 'financials' },
        });
      }
    }

    return actions;
  };

  const quickActions = getQuickActions();

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900">
              Notifications
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any notification to view full details and linked booking or verification records.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-600 tabular-nums">
              Unread: <strong className="text-emerald-800">{unreadCount}</strong> / {notifications.length}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                Mark All Read
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Bell className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-500">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n) => (
              <button
                key={n.notificationId}
                type="button"
                onClick={() => handleOpenNotification(n)}
                aria-label={`Open notification: ${n.title}`}
                className={`w-full text-left border rounded-xl p-4 flex items-start justify-between gap-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  n.read
                    ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    : 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-700 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {n.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400 pt-0.5">
                    <span>{n.createdAt.slice(0, 16).replace('T', ' ')}</span>
                    <span>·</span>
                    <span className={n.read ? 'text-slate-400' : 'text-emerald-800 font-semibold'}>
                      {n.read ? 'Read' : 'Unread'}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1 text-xs font-semibold text-emerald-800 pt-0.5">
                  <span className="hidden sm:inline">View Details</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notification Details Dialog */}
      {resolvedDetails && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-detail-title"
        >
          <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                  {resolvedDetails.categoryLabel}
                </p>
                <h3
                  id="notification-detail-title"
                  className="text-lg font-display font-bold text-slate-900 leading-snug"
                >
                  {resolvedDetails.notification.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close notification details"
                onClick={() => setSelectedNotificationId(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Metadata bar */}
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <div>
                  <dt className="text-slate-500">Received</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                    {resolvedDetails.notification.createdAt.slice(0, 16).replace('T', ' ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Delivery Channel</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5 inline-flex items-center gap-1">
                    {resolvedDetails.notification.channel === 'email' ? (
                      <>
                        <Mail className="w-3.5 h-3.5 text-emerald-800" />
                        <span>Email Alert</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5 text-emerald-800" />
                        <span>In-App Alert</span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-semibold text-emerald-800 mt-0.5 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Read</span>
                  </dd>
                </div>
              </dl>

              {/* Full message */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Notification Message
                </p>
                <p className="text-sm text-slate-800 leading-relaxed bg-white border border-slate-200 rounded-lg p-4">
                  {resolvedDetails.notification.message}
                </p>
              </div>

              {/* Linked Booking Details */}
              {resolvedDetails.booking && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/70">
                  <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4 text-emerald-800" />
                    <span>Linked Booking Summary</span>
                  </p>
                  <dl className="grid sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <dt className="text-slate-500">Booking Reference</dt>
                      <dd className="font-mono font-bold text-slate-900 mt-0.5">
                        {resolvedDetails.booking.bookingReference}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Booking Status</dt>
                      <dd className="font-semibold text-emerald-800 mt-0.5">
                        {resolvedDetails.booking.status}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Lodge</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {resolvedDetails.booking.propertyTitle}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Inspection Date</dt>
                      <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                        {resolvedDetails.booking.inspectionDate} ({resolvedDetails.booking.locationArea})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        {role === 'agent' ? 'Student' : 'Verified Agent'}
                      </dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {role === 'agent'
                          ? `${resolvedDetails.booking.studentName} (${resolvedDetails.booking.studentMatric})`
                          : resolvedDetails.booking.agentName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        {role === 'agent' ? 'Your 45% Net Share' : 'Total Protected Payment'}
                      </dt>
                      <dd className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                        {role === 'agent'
                          ? formatNairaFromKobo(resolvedDetails.booking.breakdown.agentEarningsKobo)
                          : formatNairaFromKobo(resolvedDetails.booking.breakdown.totalPayableKobo)}
                      </dd>
                    </div>
                  </dl>

                  {resolvedDetails.booking.inspectionContact && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1 text-xs">
                      <p className="font-semibold text-emerald-950 flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-800" />
                        <span>Inspection Contact Details</span>
                      </p>
                      <p className="text-slate-800">
                        Name: <strong>{resolvedDetails.booking.inspectionContact.fullName}</strong> ·
                        Phone:{' '}
                        <a
                          href={`tel:${resolvedDetails.booking.inspectionContact.phoneNumber}`}
                          className="font-mono font-semibold text-emerald-900 underline"
                        >
                          {resolvedDetails.booking.inspectionContact.phoneNumber}
                        </a>
                      </p>
                      {resolvedDetails.booking.inspectionContact.whatsappOrAltPhone && (
                        <p className="text-slate-800">
                          WhatsApp / Alt:{' '}
                          <span className="font-mono font-semibold">
                            {resolvedDetails.booking.inspectionContact.whatsappOrAltPhone}
                          </span>
                        </p>
                      )}
                      <p className="text-slate-800">
                        Time: <strong>{resolvedDetails.booking.inspectionContact.preferredTimeSlot}</strong> · Meetup:{' '}
                        <strong>{resolvedDetails.booking.inspectionContact.campusMeetupPoint}</strong>
                      </p>
                      {resolvedDetails.booking.inspectionContact.notesForAgent && (
                        <p className="text-slate-700">
                          Note: &quot;{resolvedDetails.booking.inspectionContact.notesForAgent}&quot;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Linked Lodge Details (when no booking matched or standalone lodge notification) */}
              {!resolvedDetails.booking && resolvedDetails.property && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-slate-50/70">
                  <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-800" />
                    <span>Linked Lodge Listing</span>
                  </p>
                  <dl className="grid sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <dt className="text-slate-500">Lodge Name</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {resolvedDetails.property.title}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Verification Status</dt>
                      <dd className="font-semibold text-emerald-800 mt-0.5">
                        {resolvedDetails.property.verificationStatus}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Location &amp; Type</dt>
                      <dd className="text-slate-800 mt-0.5">
                        {resolvedDetails.property.locationArea} · {resolvedDetails.property.category}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Yearly Rent</dt>
                      <dd className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                        {formatNairaFromKobo(resolvedDetails.property.yearlyRentKobo)}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Linked Dispute Details */}
              {resolvedDetails.dispute && (
                <div className="border border-amber-200 rounded-xl p-4 space-y-2 bg-amber-50/60 text-xs">
                  <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                    <Gavel className="w-4 h-4 text-amber-800" />
                    <span>Dispute Case: {resolvedDetails.dispute.disputeId}</span>
                  </p>
                  <p className="text-slate-800">
                    Reason: <strong>{resolvedDetails.dispute.reason}</strong> · Status:{' '}
                    <strong className="text-amber-900">{resolvedDetails.dispute.status}</strong>
                  </p>
                  {resolvedDetails.dispute.resolutionNote && (
                    <p className="text-slate-700">
                      Decision Note: {resolvedDetails.dispute.resolutionNote}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[11px] font-mono text-slate-400">
                Notification ID: {resolvedDetails.notification.notificationId}
              </p>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-end gap-2.5">
              {quickActions.map((act) => (
                <button
                  key={act.label}
                  type="button"
                  onClick={() => {
                    setSelectedNotificationId(null);
                    onNavigate?.(act.target);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors"
                >
                  <span>{act.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedNotificationId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
