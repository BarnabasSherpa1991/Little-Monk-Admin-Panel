import React, { useState } from 'react';
import { Bell, LogOut, Menu, Moon, Plus, Sun } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { ModuleKey } from '../../types/crm';

const MODULE_TITLES: Record<ModuleKey, string> = {
  dashboard: 'Executive Overview',
  enquiries: 'Customer Enquiries',
  customers: 'Customer Directory',
  packages: 'Tour Packages',
  quotations: 'Quotations & Proposals',
  bookings: 'Tour Bookings',
  hotels: 'Partner Hotels',
  vehicles: 'Vehicles & Transport',
  payments: 'Payments & Accounts',
  followups: 'Follow-ups & Tasks',
  reports: 'Reports & Analytics',
  employees: 'Team & Permissions',
  whatsapp: 'WhatsApp Business Hub',
  notifications: 'Notifications Center',
  settings: 'System Settings',
};

export const TopHeader: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    setMobileMenuOpen,
    darkMode,
    toggleDarkMode,
    currentEmployee,
    logout,
    notifications,
    markNotificationRead,
    can,
  } = useCRM();

  const [notifOpen, setNotifOpen] = useState(false);
  const unread = notifications.filter((n) => !n.isRead);

  return (
    <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile menu + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
            Workspace
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {MODULE_TITLES[activeModule]}
          </h2>
        </div>
      </div>

      {/* Right: Quick Action, Notifications, Theme, User */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {can('enquiries', 'create') && activeModule !== 'enquiries' && (
          <button
            type="button"
            onClick={() => setActiveModule('enquiries')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Enquiry
          </button>
        )}

        <button
          type="button"
          onClick={toggleDarkMode}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle notifications"
          >
            <Bell className="w-4 h-4" />
            {unread.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-teal-600 text-white text-[10px] font-mono tabular-nums flex items-center justify-center">
                {unread.length > 9 ? '9+' : unread.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Notifications ({unread.length} unread)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      setActiveModule('notifications');
                    }}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center">No notifications yet.</div>
                  ) : (
                    notifications.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.linkModule) setActiveModule(n.linkModule);
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                          !n.isRead ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                        }`}
                      >
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {n.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {n.message}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

        {/* Current User */}
        <div className="flex items-center gap-2.5">
          <div className="hidden md:block text-right">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight whitespace-nowrap">
              {currentEmployee?.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight whitespace-nowrap">
              {currentEmployee?.role}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
