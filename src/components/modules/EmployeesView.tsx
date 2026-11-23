import React, { useMemo, useState } from 'react';
import {
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import {
  Employee,
  ModuleKey,
  ModulePermission,
  PermissionMap,
  UserRole,
} from '../../types/crm';
import { ALL_MODULES, getDefaultPermissionsForRole } from '../../utils/permissions';
import { formatCurrency, formatTimestamp } from '../../utils/formatters';
import { SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';

const ROLES: UserRole[] = [
  'Super Admin',
  'Admin',
  'Sales Manager',
  'Sales Executive',
  'Operations Manager',
  'Accounts Manager',
  'Customer Support',
];

const ACTIONS: { key: keyof ModulePermission; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

export const EmployeesView: React.FC = () => {
  const {
    employees,
    invites,
    enquiries,
    quotations,
    bookings,
    currentEmployee,
    can,
    saveEmployee,
    deleteEmployee,
    inviteEmployee,
    deleteInvite,
    toast,
  } = useCRM();

  const [tab, setTab] = useState<'team' | 'performance' | 'invites'>('team');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // Edit Employee Modal
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<{
    name: string;
    phone: string;
    department: string;
    role: UserRole;
    status: 'Active' | 'Inactive';
    permissions: PermissionMap;
  } | null>(null);

  // Invite Employee Modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{
    name: string;
    email: string;
    phone: string;
    department: string;
    role: UserRole;
    permissions: PermissionMap;
  }>({
    name: '',
    email: '',
    phone: '',
    department: 'Sales',
    role: 'Sales Executive',
    permissions: getDefaultPermissionsForRole('Sales Executive'),
  });

  const [saving, setSaving] = useState(false);
  const [confirmDeleteEmp, setConfirmDeleteEmp] = useState<Employee | null>(null);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState<string | null>(null);

  const isAdmin =
    currentEmployee?.role === 'Super Admin' || currentEmployee?.role === 'Admin';

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (roleFilter !== 'All' && e.role !== roleFilter) return false;
      if (term) {
        const hay = `${e.name} ${e.email} ${e.role} ${e.department || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [employees, search, roleFilter]);

  // Employee Performance Metrics computed live from Firestore collections
  const performanceRows = useMemo(() => {
    return employees.map((emp) => {
      const empEnquiries = enquiries.filter((e) => e.assignedToUid === emp.uid);
      const empQuotes = quotations.filter((q) => q.assignedToUid === emp.uid);
      const empBookings = bookings.filter((b) => b.assignedToUid === emp.uid);
      const confirmedBookings = empBookings.filter((b) => b.bookingStatus !== 'Cancelled');
      const convertedEnquiries = empEnquiries.filter(
        (e) => e.status === 'Booking Confirmed'
      ).length;
      const conversionRate =
        empEnquiries.length > 0
          ? Math.round((convertedEnquiries / empEnquiries.length) * 100)
          : 0;
      const totalRevenue = confirmedBookings.reduce(
        (sum, b) => sum + Number(b.bookingAmount || 0),
        0
      );
      const collectedRevenue = confirmedBookings.reduce(
        (sum, b) => sum + Number(b.advanceReceived || 0),
        0
      );
      return {
        emp,
        enquiriesCount: empEnquiries.length,
        quotesCount: empQuotes.length,
        bookingsCount: confirmedBookings.length,
        conversionRate,
        totalRevenue,
        collectedRevenue,
      };
    });
  }, [employees, enquiries, quotations, bookings]);

  const openEditEmployee = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpForm({
      name: emp.name,
      phone: emp.phone || '',
      department: emp.department || 'Sales',
      role: emp.role,
      status: emp.status,
      permissions: emp.permissions || getDefaultPermissionsForRole(emp.role),
    });
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !empForm) return;
    setSaving(true);
    try {
      await saveEmployee(
        {
          name: empForm.name.trim(),
          phone: empForm.phone.trim(),
          department: empForm.department.trim(),
          role: empForm.role,
          status: empForm.status,
          permissions: empForm.permissions,
        },
        editingEmp.id
      );
      setEditingEmp(null);
      setEmpForm(null);
    } finally {
      setSaving(false);
    }
  };

  const openInviteModal = () => {
    setInviteForm({
      name: '',
      email: '',
      phone: '',
      department: 'Sales',
      role: 'Sales Executive',
      permissions: getDefaultPermissionsForRole('Sales Executive'),
    });
    setInviteOpen(true);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLower = inviteForm.email.trim().toLowerCase();
    if (!emailLower || !inviteForm.name.trim()) return;

    if (employees.some((emp) => emp.email.toLowerCase() === emailLower)) {
      toast('error', 'An employee with this email already has an active profile.');
      return;
    }

    setSaving(true);
    try {
      await inviteEmployee({
        email: emailLower,
        name: inviteForm.name.trim(),
        phone: inviteForm.phone.trim(),
        department: inviteForm.department.trim(),
        role: inviteForm.role,
        permissions: inviteForm.permissions,
      });
      setInviteOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const togglePerm = (
    perms: PermissionMap,
    mod: ModuleKey,
    action: keyof ModulePermission
  ): PermissionMap => {
    const current = perms[mod] || { view: false, create: false, edit: false, delete: false };
    const nextMod = { ...current, [action]: !current[action] };
    if (action !== 'view' && nextMod[action]) {
      nextMod.view = true;
    }
    if (action === 'view' && !nextMod.view) {
      nextMod.create = false;
      nextMod.edit = false;
      nextMod.delete = false;
    }
    return { ...perms, [mod]: nextMod };
  };

  const renderPermissionMatrix = (
    permissions: PermissionMap,
    onChange: (next: PermissionMap) => void,
    disabledRole?: boolean
  ) => (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center justify-between">
        <span>Module Access Matrix</span>
        {disabledRole && (
          <span className="text-[11px] text-teal-700 dark:text-teal-400">
            Super Admin retains full access
          </span>
        )}
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900">
          <div className="col-span-1">Module</div>
          {ACTIONS.map((a) => (
            <div key={a.key} className="text-center">
              {a.label}
            </div>
          ))}
        </div>
        {ALL_MODULES.map((m) => {
          const mp = permissions[m.key] || { view: false, create: false, edit: false, delete: false };
          return (
            <div
              key={m.key}
              className="grid grid-cols-5 gap-2 px-3 py-2 items-center text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
            >
              <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                {m.label}
              </div>
              {ACTIONS.map((a) => (
                <div key={a.key} className="flex justify-center">
                  <input
                    type="checkbox"
                    disabled={disabledRole}
                    checked={Boolean(mp[a.key])}
                    onChange={() => onChange(togglePerm(permissions, m.key, a.key))}
                    className="w-4 h-4 accent-teal-600 rounded cursor-pointer disabled:opacity-50"
                    aria-label={`${m.label} ${a.label}`}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('team')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                tab === 'team'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Team Directory ({employees.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('performance')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                tab === 'performance'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Performance Metrics
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setTab('invites')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                  tab === 'invites'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Pending Invites ({invites.length})
              </button>
            )}
          </div>

          {tab === 'team' && (
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search name, email, department..."
                className="w-60"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="All">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {isAdmin && can('employees', 'create') && (
          <button
            type="button"
            onClick={openInviteModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Invite Employee
          </button>
        )}
      </div>

      {/* Team Directory Tab */}
      {tab === 'team' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role & Department</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Access Scope</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                      No employees match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const enabledModules = ALL_MODULES.filter(
                      (m) => emp.role === 'Super Admin' || emp.permissions?.[m.key]?.view
                    ).length;
                    const isSelf = emp.uid === currentEmployee?.uid;

                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {emp.name}{' '}
                            {isSelf && (
                              <span className="text-xs font-normal text-teal-700 dark:text-teal-400">
                                (You)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{emp.email}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                            {emp.role}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {emp.department || 'General'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                          {emp.phone || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                          {enabledModules} / {ALL_MODULES.length} modules
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-xs font-medium ${
                              emp.status === 'Active'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {isAdmin && can('employees', 'edit') && (
                              <button
                                type="button"
                                onClick={() => openEditEmployee(emp)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit RBAC
                              </button>
                            )}
                            {isAdmin && can('employees', 'delete') && !isSelf && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteEmp(emp)}
                                className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                                title="Revoke employee access"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {tab === 'performance' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sales & Operations Performance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live conversion and booking volume calculated from assigned enquiries, quotations, and bookings.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">Executive</th>
                  <th className="px-4 py-3 text-right">Assigned Enquiries</th>
                  <th className="px-4 py-3 text-right">Quotations</th>
                  <th className="px-4 py-3 text-right">Confirmed Bookings</th>
                  <th className="px-4 py-3 text-right">Conversion Rate</th>
                  <th className="px-4 py-3 text-right">Booking Value</th>
                  <th className="px-4 py-3 text-right">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm tabular-nums">
                {performanceRows.map((row) => (
                  <tr
                    key={row.emp.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {row.emp.name}
                      </div>
                      <div className="text-xs text-slate-500">{row.emp.role}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right">{row.enquiriesCount}</td>
                    <td className="px-4 py-3.5 text-right">{row.quotesCount}</td>
                    <td className="px-4 py-3.5 text-right font-medium">{row.bookingsCount}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={
                          row.conversionRate >= 25
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-slate-600 dark:text-slate-300'
                        }
                      >
                        {row.conversionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(row.totalRevenue)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-teal-700 dark:text-teal-400">
                      {formatCurrency(row.collectedRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Invites Tab */}
      {tab === 'invites' && isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Pending Employee Invitations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Invited staff automatically receive their pre-configured role and permissions when they sign in with Google using the invited email address.
            </p>
          </div>
          {invites.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No pending invitations. Click "Invite Employee" to onboard a team member.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {inv.name} · <span className="text-xs text-teal-700 dark:text-teal-400">{inv.role}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {inv.email} {inv.department ? `· ${inv.department}` : ''} · Invited{' '}
                        {formatTimestamp(inv.createdAt)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmCancelInvite(inv.email)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer self-start sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Cancel Invite
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Employee Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-semibold">Invite Team Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendInvite} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    placeholder="e.g. Rohan Mehta"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Google Email Address *</label>
                  <input
                    required
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="rohan@littlemonktravels.in"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    placeholder="+91 98..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                    placeholder="Sales / Operations / Accounts"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Role *</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setInviteForm({
                        ...inviteForm,
                        role: nextRole,
                        permissions: getDefaultPermissionsForRole(nextRole),
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {ROLES.filter(
                      (r) => currentEmployee?.role === 'Super Admin' || r !== 'Super Admin'
                    ).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {renderPermissionMatrix(
                inviteForm.permissions,
                (next) => setInviteForm({ ...inviteForm, permissions: next }),
                inviteForm.role === 'Super Admin'
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {saving ? 'Sending...' : 'Create Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee RBAC Modal */}
      {editingEmp && empForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="text-base font-semibold">Edit Employee Role & Permissions</h3>
                  <p className="text-xs text-slate-500">{editingEmp.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingEmp(null);
                  setEmpForm(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={empForm.name}
                    onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={empForm.department}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Account Status</label>
                  <select
                    value={empForm.status}
                    disabled={editingEmp.uid === currentEmployee?.uid}
                    onChange={(e) =>
                      setEmpForm({ ...empForm, status: e.target.value as 'Active' | 'Inactive' })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 disabled:opacity-60"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Assigned Role</label>
                  <select
                    value={empForm.role}
                    disabled={editingEmp.uid === currentEmployee?.uid}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setEmpForm({
                        ...empForm,
                        role: nextRole,
                        permissions: getDefaultPermissionsForRole(nextRole),
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 disabled:opacity-60"
                  >
                    {ROLES.filter(
                      (r) => currentEmployee?.role === 'Super Admin' || r !== 'Super Admin'
                    ).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {renderPermissionMatrix(
                empForm.permissions,
                (next) => setEmpForm({ ...empForm, permissions: next }),
                empForm.role === 'Super Admin'
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmp(null);
                    setEmpForm(null);
                  }}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Employee */}
      <ConfirmDialog
        open={Boolean(confirmDeleteEmp)}
        title="Revoke Employee Access"
        message={`Remove ${confirmDeleteEmp?.name} (${confirmDeleteEmp?.email}) from Little Monk Travels CRM? They will immediately lose access.`}
        confirmLabel="Revoke Access"
        onCancel={() => setConfirmDeleteEmp(null)}
        onConfirm={async () => {
          if (confirmDeleteEmp) await deleteEmployee(confirmDeleteEmp.id);
          setConfirmDeleteEmp(null);
        }}
      />

      {/* Confirm Cancel Invite */}
      <ConfirmDialog
        open={Boolean(confirmCancelInvite)}
        title="Cancel Invitation"
        message={`Cancel the pending invitation for ${confirmCancelInvite}?`}
        confirmLabel="Cancel Invite"
        onCancel={() => setConfirmCancelInvite(null)}
        onConfirm={async () => {
          if (confirmCancelInvite) await deleteInvite(confirmCancelInvite);
          setConfirmCancelInvite(null);
        }}
      />
    </div>
  );
};
