import React from 'react';
import {
  LayoutDashboard,
  Inbox,
  Users,
  Map,
  FileText,
  CalendarCheck,
  Building2,
  CarFront,
  Wallet,
  CheckSquare,
  BarChart3,
  MessageSquare,
  Bell,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { ModuleKey } from '../../types/crm';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface NavGroup {
  label: string;
  items: { key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Sales Pipeline',
    items: [
      { key: 'enquiries', label: 'Enquiries', icon: Inbox },
      { key: 'followups', label: 'Follow-ups & Tasks', icon: CheckSquare },
      { key: 'quotations', label: 'Quotations', icon: FileText },
      { key: 'customers', label: 'Customers', icon: Users },
    ],
  },
  {
    label: 'Trip Operations',
    items: [
      { key: 'bookings', label: 'Bookings', icon: CalendarCheck },
      { key: 'packages', label: 'Tour Packages', icon: Map },
      { key: 'hotels', label: 'Hotels', icon: Building2 },
      { key: 'vehicles', label: 'Vehicles & Fleet', icon: CarFront },
    ],
  },
  {
    label: 'Finance & Growth',
    items: [
      { key: 'payments', label: 'Payments & Accounts', icon: Wallet },
      { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      { key: 'whatsapp', label: 'WhatsApp Hub', icon: MessageSquare },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'employees', label: 'Team & RBAC', icon: UserCog },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    can,
    notifications,
    followUps,
    settings,
  } = useCRM();

  const unreadNotifs = notifications.filter((n) => !n.isRead).length;
  const pendingFollowUps = followUps.filter((f) => f.status === 'Pending').length;

  const handleSelect = (mod: ModuleKey) => {
    setActiveModule(mod);
    setMobileMenuOpen(false);
  };

  const renderNav = (collapsed: boolean) => (
    <div className="flex flex-col h-full bg-[#0F2744] text-slate-100 select-none">
      {/* Brand header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-black shrink-0 p-0.5 border border-slate-700/60">
            <ImageWithFallback
              src={settings?.logoUrl || '/assets/aistudio/Screenshot_2026-11-23_132939_51fcd266.png'}
              alt="Little Monk Travels"
              className="w-full h-full object-contain"
            />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight text-white truncate whitespace-nowrap">
              {settings?.companyName || 'Little Monk Travels'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:inline-flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => can(item.key, 'view'));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {!collapsed && (
                <div className="px-2.5 mb-1.5 text-[11px] font-medium text-slate-400 tracking-wide">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.key;
                  const countBadge =
                    item.key === 'notifications' && unreadNotifs > 0
                      ? unreadNotifs
                      : item.key === 'followups' && pendingFollowUps > 0
                      ? pendingFollowUps
                      : 0;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelect(item.key)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-300 hover:bg-white/8 hover:text-white'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate whitespace-nowrap">{item.label}</span>
                          {countBadge > 0 && (
                            <span
                              className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                                active ? 'bg-teal-700 text-white' : 'bg-slate-800 text-teal-300'
                              }`}
                            >
                              {countBadge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block shrink-0 border-r border-slate-800 transition-all duration-200 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {renderNav(sidebarCollapsed)}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
            {renderNav(false)}
          </aside>
        </div>
      )}
    </>
  );
};
