import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  CreditCard,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { NotificationItem } from '../../types/crm';
import {
  formatCurrency,
  formatDate,
  formatTimestamp,
  isOverdueDate,
  isTodayDate,
  isWithinNextDays,
} from '../../utils/formatters';

const CATEGORIES: ('All' | NotificationItem['category'])[] = [
  'All',
  'Enquiry',
  'Follow-up',
  'Booking',
  'Payment',
  'Departure',
  'Cancellation',
  'Task',
];

export const NotificationsView: React.FC = () => {
  const {
    notifications,
    followUps,
    bookings,
    markNotificationRead,
    markAllNotificationsRead,
    setActiveModule,
    can,
  } = useCRM();

  const [categoryFilter, setCategoryFilter] = useState<'All' | NotificationItem['category']>('All');
  const [onlyUnread, setOnlyUnread] = useState(false);

  // Live computed operational alerts from active CRM records
  const liveAlerts = useMemo(() => {
    const overdueFollowUps = followUps.filter(
      (f) => f.status === 'Pending' && isOverdueDate(f.dueDate)
    );
    const todayFollowUps = followUps.filter(
      (f) => f.status === 'Pending' && isTodayDate(f.dueDate)
    );
    const pendingBalances = bookings.filter(
      (b) => b.bookingStatus !== 'Cancelled' && Number(b.remainingAmount || 0) > 0
    );
    const upcomingDepartures = bookings.filter(
      (b) => b.bookingStatus !== 'Cancelled' && isWithinNextDays(b.startDate, 7)
    );
    return {
      overdueFollowUps,
      todayFollowUps,
      pendingBalances,
      upcomingDepartures,
    };
  }, [followUps, bookings]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (categoryFilter !== 'All' && n.category !== categoryFilter) return false;
      if (onlyUnread && n.isRead) return false;
      return true;
    });
  }, [notifications, categoryFilter, onlyUnread]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      {/* Live Operational Alerts Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => can('followups', 'view') && setActiveModule('followups')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Follow-ups Due / Overdue
            </span>
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {liveAlerts.overdueFollowUps.length} overdue · {liveAlerts.todayFollowUps.length} today
          </div>
          <div className="mt-1 text-xs text-teal-600 dark:text-teal-400 inline-flex items-center gap-1">
            Open Follow-ups <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => can('payments', 'view') && setActiveModule('payments')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-amber-300 dark:hover:border-amber-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pending Customer Balances
            </span>
            <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {liveAlerts.pendingBalances.length} bookings
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Total due:{' '}
            {formatCurrency(
              liveAlerts.pendingBalances.reduce((s, b) => s + Number(b.remainingAmount || 0), 0)
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => can('bookings', 'view') && setActiveModule('bookings')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-teal-300 dark:hover:border-teal-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Departures Within 7 Days
            </span>
            <CalendarClock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {liveAlerts.upcomingDepartures.length} tours
          </div>
          <div className="mt-1 text-xs text-teal-600 dark:text-teal-400 inline-flex items-center gap-1">
            Review Bookings <ArrowRight className="w-3 h-3" />
          </div>
        </button>
      </div>

      {/* Upcoming Departures & Overdue Reminders Quick Feed */}
      {(liveAlerts.overdueFollowUps.length > 0 || liveAlerts.upcomingDepartures.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {liveAlerts.overdueFollowUps.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Overdue Follow-up Alerts
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModule('followups')}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Manage All
                </button>
              </div>
              <div className="space-y-2">
                {liveAlerts.overdueFollowUps.slice(0, 4).map((f) => (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {f.title}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {f.customerName || 'Lead'} · Due {formatDate(f.dueDate)}
                      </div>
                    </div>
                    <span className="text-red-600 dark:text-red-400 font-medium shrink-0">
                      {f.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {liveAlerts.upcomingDepartures.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Upcoming Tour Departures (Next 7 Days)
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModule('bookings')}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Open Bookings
                </button>
              </div>
              <div className="space-y-2">
                {liveAlerts.upcomingDepartures.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {b.bookingCode} · {b.customerName}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {b.destination} · Departs {formatDate(b.startDate)}
                      </div>
                    </div>
                    <span className="text-teal-700 dark:text-teal-400 font-medium shrink-0 tabular-nums">
                      {b.remainingAmount > 0
                        ? `Due ${formatCurrency(b.remainingAmount)}`
                        : 'Paid'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Notification Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Bell className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              System Notifications ({unreadCount} unread)
            </span>
            <div className="flex flex-wrap items-center gap-1 ml-0 sm:ml-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
                className="w-3.5 h-3.5 accent-teal-600 rounded"
              />
              Unread only
            </label>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 whitespace-nowrap cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No notifications in this filter view.
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  !n.isRead ? 'bg-teal-50/30 dark:bg-teal-950/15' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-medium ${
                        n.category === 'Cancellation'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-teal-700 dark:text-teal-400'
                      }`}
                    >
                      {n.category}
                    </span>
                    <span className="text-xs text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {formatTimestamp(n.createdAt)}
                    </span>
                    {!n.isRead && (
                      <>
                        <span className="text-xs text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                          Unread
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {n.title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {n.linkModule && can(n.linkModule, 'view') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.isRead) markNotificationRead(n.id);
                        if (n.linkModule) setActiveModule(n.linkModule);
                      }}
                      className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Open Module
                    </button>
                  )}
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className="px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
