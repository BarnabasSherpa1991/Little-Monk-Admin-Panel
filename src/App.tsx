import React from 'react';
import { Lock } from 'lucide-react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginScreen } from './components/auth/LoginScreen';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { DashboardView } from './components/modules/DashboardView';
import { EnquiriesView } from './components/modules/EnquiriesView';
import { CustomersView } from './components/modules/CustomersView';
import { PackagesView } from './components/modules/PackagesView';
import { QuotationsView } from './components/modules/QuotationsView';
import { BookingsView } from './components/modules/BookingsView';
import { HotelsView } from './components/modules/HotelsView';
import { VehiclesView } from './components/modules/VehiclesView';
import { PaymentsView } from './components/modules/PaymentsView';
import { FollowUpsView } from './components/modules/FollowUpsView';
import { EmployeesView } from './components/modules/EmployeesView';
import { ReportsView } from './components/modules/ReportsView';
import { WhatsAppView } from './components/modules/WhatsAppView';
import { NotificationsView } from './components/modules/NotificationsView';
import { SettingsView } from './components/modules/SettingsView';

const WorkspaceShell: React.FC = () => {
  const {
    firebaseUser,
    authLoading,
    currentEmployee,
    activeModule,
    setActiveModule,
    can,
  } = useCRM();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
            Loading Azure Travel CRM workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !currentEmployee) {
    return <LoginScreen />;
  }

  const renderModule = () => {
    if (!can(activeModule, 'view')) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center max-w-md mx-auto mt-10">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Access Restricted for Role
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Your current role ({currentEmployee.role}) does not have permission to view this module. Contact your Super Admin to update permissions.
          </p>
          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className="mt-4 px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    switch (activeModule) {
      case 'dashboard':
        return <DashboardView />;
      case 'enquiries':
        return <EnquiriesView />;
      case 'customers':
        return <CustomersView />;
      case 'packages':
        return <PackagesView />;
      case 'quotations':
        return <QuotationsView />;
      case 'bookings':
        return <BookingsView />;
      case 'hotels':
        return <HotelsView />;
      case 'vehicles':
        return <VehiclesView />;
      case 'payments':
        return <PaymentsView />;
      case 'followups':
        return <FollowUpsView />;
      case 'employees':
        return <EmployeesView />;
      case 'reports':
        return <ReportsView />;
      case 'whatsapp':
        return <WhatsAppView />;
      case 'notifications':
        return <NotificationsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {renderModule()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <CRMProvider>
        <WorkspaceShell />
      </CRMProvider>
    </ErrorBoundary>
  );
}
