import { Employee, ModuleKey, ModulePermission, PermissionMap, UserRole } from '../types/crm';

export const ALL_MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'customers', label: 'Customers' },
  { key: 'packages', label: 'Tour Packages' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'vehicles', label: 'Vehicles & Transport' },
  { key: 'payments', label: 'Payments & Accounts' },
  { key: 'followups', label: 'Follow-ups & Tasks' },
  { key: 'reports', label: 'Reports & Analytics' },
  { key: 'whatsapp', label: 'WhatsApp Hub' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'employees', label: 'Team & RBAC' },
  { key: 'settings', label: 'Settings' },
];

const full = (): ModulePermission => ({ view: true, create: true, edit: true, delete: true });
const viewCreateEdit = (): ModulePermission => ({ view: true, create: true, edit: true, delete: false });
const viewOnly = (): ModulePermission => ({ view: true, create: false, edit: false, delete: false });
const none = (): ModulePermission => ({ view: false, create: false, edit: false, delete: false });

export function getDefaultPermissionsForRole(role: UserRole): PermissionMap {
  switch (role) {
    case 'Super Admin':
    case 'Admin':
      return {
        dashboard: full(),
        enquiries: full(),
        customers: full(),
        packages: full(),
        quotations: full(),
        bookings: full(),
        hotels: full(),
        vehicles: full(),
        payments: full(),
        followups: full(),
        reports: full(),
        employees: role === 'Super Admin' ? full() : viewCreateEdit(),
        whatsapp: full(),
        notifications: full(),
        settings: role === 'Super Admin' ? full() : viewCreateEdit(),
      };
    case 'Sales Manager':
      return {
        dashboard: viewOnly(),
        enquiries: full(),
        customers: full(),
        packages: viewCreateEdit(),
        quotations: full(),
        bookings: viewCreateEdit(),
        hotels: viewOnly(),
        vehicles: viewOnly(),
        payments: viewOnly(),
        followups: full(),
        reports: viewOnly(),
        employees: viewOnly(),
        whatsapp: viewCreateEdit(),
        notifications: viewCreateEdit(),
        settings: none(),
      };
    case 'Sales Executive':
      return {
        dashboard: viewOnly(),
        enquiries: viewCreateEdit(),
        customers: viewCreateEdit(),
        packages: viewOnly(),
        quotations: viewCreateEdit(),
        bookings: viewCreateEdit(),
        hotels: viewOnly(),
        vehicles: viewOnly(),
        payments: viewOnly(),
        followups: viewCreateEdit(),
        reports: none(),
        employees: none(),
        whatsapp: viewCreateEdit(),
        notifications: viewCreateEdit(),
        settings: none(),
      };
    case 'Operations Manager':
      return {
        dashboard: viewOnly(),
        enquiries: viewOnly(),
        customers: viewOnly(),
        packages: full(),
        quotations: viewOnly(),
        bookings: full(),
        hotels: full(),
        vehicles: full(),
        payments: viewOnly(),
        followups: viewCreateEdit(),
        reports: viewOnly(),
        employees: none(),
        whatsapp: viewCreateEdit(),
        notifications: viewCreateEdit(),
        settings: none(),
      };
    case 'Accounts Manager':
      return {
        dashboard: viewOnly(),
        enquiries: none(),
        customers: viewOnly(),
        packages: viewOnly(),
        quotations: viewOnly(),
        bookings: viewCreateEdit(),
        hotels: viewOnly(),
        vehicles: viewOnly(),
        payments: full(),
        followups: viewCreateEdit(),
        reports: full(),
        employees: none(),
        whatsapp: viewCreateEdit(),
        notifications: viewCreateEdit(),
        settings: none(),
      };
    case 'Customer Support':
      return {
        dashboard: viewOnly(),
        enquiries: viewCreateEdit(),
        customers: viewCreateEdit(),
        packages: viewOnly(),
        quotations: viewOnly(),
        bookings: viewOnly(),
        hotels: viewOnly(),
        vehicles: viewOnly(),
        payments: none(),
        followups: viewCreateEdit(),
        reports: none(),
        employees: none(),
        whatsapp: viewCreateEdit(),
        notifications: viewCreateEdit(),
        settings: none(),
      };
  }
}

export function canAccess(
  employee: Employee | null,
  module: ModuleKey,
  action: keyof ModulePermission = 'view'
): boolean {
  if (!employee || employee.status !== 'Active') return false;
  if (employee.role === 'Super Admin') return true;
  const modPerm = employee.permissions?.[module];
  if (!modPerm) return false;
  return Boolean(modPerm[action]);
}
