import React, { useEffect, useState } from 'react';
import {
  Building2,
  Database,
  Download,
  RefreshCw,
  Save,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { CompanySettings } from '../../types/crm';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const SettingsView: React.FC = () => {
  const {
    settings,
    currentEmployee,
    enquiries,
    customers,
    packages,
    quotations,
    bookings,
    hotels,
    vehicles,
    payments,
    expenses,
    followUps,
    employees,
    whatsappTemplates,
    saveCompanySettings,
    reseedDemoData,
    setActiveModule,
    toast,
  } = useCRM();

  const isAdmin =
    currentEmployee?.role === 'Super Admin' || currentEmployee?.role === 'Admin';

  const [form, setForm] = useState<CompanySettings>({
    companyName: 'Azure Travel',
    tagline: 'Eastern Himalayas & Bhutan Specialists',
    logoUrl: '/src/assets/images/company_logo_mark_1795419417417.jpg',
    currency: 'INR',
    currencySymbol: '₹',
    gstNumber: '',
    defaultGstPercent: 5,
    email: '',
    phone: '',
    website: '',
    address: '',
    invoicePrefix: 'INV',
    quotePrefix: 'QT',
    bookingPrefix: 'BK',
    bankDetails: '',
    upiId: '',
    quotationTerms: '',
    invoiceTerms: '',
    notificationPrefs: {
      newEnquiry: true,
      followUpReminders: true,
      newBooking: true,
      pendingPayments: true,
      upcomingDepartures: true,
    },
  });

  const [saving, setSaving] = useState(false);
  const [confirmReseed, setConfirmReseed] = useState(false);
  const [reseeding, setReseeding] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName || 'Azure Travel',
        tagline: settings.tagline || '',
        logoUrl:
          settings.logoUrl || '/src/assets/images/company_logo_mark_1795419417417.jpg',
        currency: 'INR',
        currencySymbol: '₹',
        gstNumber: settings.gstNumber || '',
        defaultGstPercent: Number(settings.defaultGstPercent ?? 5),
        email: settings.email || '',
        phone: settings.phone || '',
        website: settings.website || '',
        address: settings.address || '',
        invoicePrefix: settings.invoicePrefix || 'INV',
        quotePrefix: settings.quotePrefix || 'QT',
        bookingPrefix: settings.bookingPrefix || 'BK',
        bankDetails: settings.bankDetails || '',
        upiId: settings.upiId || '',
        quotationTerms: settings.quotationTerms || '',
        invoiceTerms: settings.invoiceTerms || '',
        notificationPrefs: {
          newEnquiry: settings.notificationPrefs?.newEnquiry ?? true,
          followUpReminders: settings.notificationPrefs?.followUpReminders ?? true,
          newBooking: settings.notificationPrefs?.newBooking ?? true,
          pendingPayments: settings.notificationPrefs?.pendingPayments ?? true,
          upcomingDepartures: settings.notificationPrefs?.upcomingDepartures ?? true,
        },
      });
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      await saveCompanySettings(form);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      companySettings: settings,
      counts: {
        enquiries: enquiries.length,
        customers: customers.length,
        packages: packages.length,
        quotations: quotations.length,
        bookings: bookings.length,
        hotels: hotels.length,
        vehicles: vehicles.length,
        payments: payments.length,
        expenses: expenses.length,
        followUps: followUps.length,
        employees: employees.length,
        whatsappTemplates: whatsappTemplates.length,
      },
      data: {
        enquiries,
        customers,
        packages,
        quotations,
        bookings,
        hotels,
        vehicles,
        payments,
        expenses,
        followUps,
        employees,
        whatsappTemplates,
      },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AzureTravel_CRM_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('success', 'Full CRM JSON backup downloaded.');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Profile & Branding */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Company Profile & Branding
              </h3>
            </div>
            {!isAdmin && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                View-only (Admin access required to save)
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white shrink-0">
              <ImageWithFallback
                src={form.logoUrl || '/src/assets/images/company_logo_mark_1795419417417.jpg'}
                alt="Company Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Company Logo Path / URL</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.logoUrl || ''}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Agency Name *</label>
              <input
                required
                type="text"
                disabled={!isAdmin}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tagline</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.tagline || ''}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Support Email</label>
              <input
                type="email"
                disabled={!isAdmin}
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Contact Phone</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Website</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.website || ''}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Office Address</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* GST, Prefixes & Financial Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Wallet className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              GST, Numbering Prefixes & Payment Accounts
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium mb-1">Default Currency</label>
              <input
                readOnly
                type="text"
                value="INR (₹) · en-IN"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 font-medium text-teal-700 dark:text-teal-400"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium mb-1">GSTIN</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.gstNumber || ''}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Default GST (%)</label>
              <input
                type="number"
                min={0}
                max={28}
                step={0.5}
                disabled={!isAdmin}
                value={form.defaultGstPercent}
                onChange={(e) =>
                  setForm({ ...form, defaultGstPercent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Quote Prefix</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.quotePrefix || 'QT'}
                onChange={(e) => setForm({ ...form, quotePrefix: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Booking Prefix</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.bookingPrefix || 'BK'}
                onChange={(e) => setForm({ ...form, bookingPrefix: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Bank Account Details (Displayed on Quotes/Receipts)</label>
              <textarea
                rows={3}
                disabled={!isAdmin}
                value={form.bankDetails || ''}
                onChange={(e) => setForm({ ...form, bankDetails: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Official UPI ID</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.upiId || ''}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
              <label className="block text-xs font-medium mt-3 mb-1">Invoice Prefix</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.invoicePrefix || 'INV'}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Default Quotation Terms & Conditions</label>
              <textarea
                rows={4}
                disabled={!isAdmin}
                value={form.quotationTerms || ''}
                onChange={(e) => setForm({ ...form, quotationTerms: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Default Voucher & Invoice Terms</label>
              <textarea
                rows={4}
                disabled={!isAdmin}
                value={form.invoiceTerms || ''}
                onChange={(e) => setForm({ ...form, invoiceTerms: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            Automated In-App Alert Preferences
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {[
              { key: 'newEnquiry', label: 'New Enquiry Alerts' },
              { key: 'followUpReminders', label: 'Follow-up & Overdue Reminders' },
              { key: 'newBooking', label: 'New Booking Confirmations' },
              { key: 'pendingPayments', label: 'Pending Payment Alerts' },
              { key: 'upcomingDepartures', label: 'Upcoming Departures (7 Days)' },
            ].map((item) => {
              const k = item.key as keyof NonNullable<CompanySettings['notificationPrefs']>;
              const checked = Boolean(form.notificationPrefs?.[k]);
              return (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={checked}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        notificationPrefs: {
                          newEnquiry: form.notificationPrefs?.newEnquiry ?? true,
                          followUpReminders: form.notificationPrefs?.followUpReminders ?? true,
                          newBooking: form.notificationPrefs?.newBooking ?? true,
                          pendingPayments: form.notificationPrefs?.pendingPayments ?? true,
                          upcomingDepartures: form.notificationPrefs?.upcomingDepartures ?? true,
                          [k]: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-teal-600 rounded"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {item.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Settings...' : 'Save System Settings'}
            </button>
          </div>
        )}
      </form>

      {/* RBAC & Backup Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Role-Based Access Control (RBAC)
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Manage employee invitations, active roles (Super Admin, Admin, Sales Manager, Sales Executive, Operations Manager, Accounts Manager, Customer Support), and granular per-module permissions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('employees')}
            className="self-start px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Open Team & RBAC Matrix →
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Database className="w-4 h-4 text-teal-600" />
              Backup & Demo Data
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Download a full JSON snapshot of all enquiries, customers, packages, quotations, bookings, hotels, vehicles, and payment ledgers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0F2744] hover:bg-[#153459] rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download JSON Backup
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setConfirmReseed(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Seed Sample Data
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReseed}
        variant="primary"
        loading={reseeding}
        title="Seed Sample CRM Data"
        message="This will write/restore sample enquiries, customers, tour packages, hotels, vehicles, quotations, bookings, payments, expenses, and follow-ups into Firestore. Continue?"
        confirmLabel="Seed Sample Data"
        onCancel={() => setConfirmReseed(false)}
        onConfirm={async () => {
          setReseeding(true);
          try {
            await reseedDemoData();
            setConfirmReseed(false);
          } finally {
            setReseeding(false);
          }
        }}
      />
    </div>
  );
};
