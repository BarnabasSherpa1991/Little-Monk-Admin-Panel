import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { WhatsAppTemplate } from '../../types/crm';
import {
  buildWhatsAppLink,
  formatCurrency,
  formatDate,
  interpolateTemplate,
} from '../../utils/formatters';
import { ConfirmDialog } from '../common/ConfirmDialog';

const TEMPLATE_CATEGORIES: WhatsAppTemplate['category'][] = [
  'Enquiry Response',
  'Follow-up',
  'Quotation Sharing',
  'Booking Confirmation',
  'Payment Reminder',
  'Tour Reminder',
];

export const WhatsAppView: React.FC = () => {
  const {
    whatsappTemplates,
    customers,
    enquiries,
    bookings,
    quotations,
    settings,
    currentEmployee,
    saveWhatsAppTemplate,
    deleteWhatsAppTemplate,
    saveCompanySettings,
    toast,
  } = useCRM();

  const [tab, setTab] = useState<'composer' | 'templates' | 'api'>('composer');
  const [recipientType, setRecipientType] = useState<'enquiry' | 'booking' | 'customer' | 'custom'>('enquiry');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  // Template Modal
  const [tplOpen, setTplOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<WhatsAppTemplate | null>(null);
  const [tplForm, setTplForm] = useState<{
    name: string;
    category: WhatsAppTemplate['category'];
    body: string;
  }>({ name: '', category: 'Enquiry Response', body: '' });
  const [deleteTplId, setDeleteTplId] = useState<string | null>(null);

  // Cloud API Config form
  const [apiForm, setApiForm] = useState({
    enabled: settings?.whatsappConfig?.enabled || false,
    phoneNumberId: settings?.whatsappConfig?.phoneNumberId || '',
    businessAccountId: settings?.whatsappConfig?.businessAccountId || '',
    webhookVerifyToken: settings?.whatsappConfig?.webhookVerifyToken || '',
    apiVersion: settings?.whatsappConfig?.apiVersion || 'v21.0',
  });

  useEffect(() => {
    if (settings?.whatsappConfig) {
      setApiForm({
        enabled: settings.whatsappConfig.enabled || false,
        phoneNumberId: settings.whatsappConfig.phoneNumberId || '',
        businessAccountId: settings.whatsappConfig.businessAccountId || '',
        webhookVerifyToken: settings.whatsappConfig.webhookVerifyToken || '',
        apiVersion: settings.whatsappConfig.apiVersion || 'v21.0',
      });
    }
  }, [settings]);

  const isAdmin =
    currentEmployee?.role === 'Super Admin' || currentEmployee?.role === 'Admin';

  // Auto-select first template if none selected
  useEffect(() => {
    if (!selectedTemplateId && whatsappTemplates.length > 0) {
      setSelectedTemplateId(whatsappTemplates[0].id);
    }
  }, [whatsappTemplates, selectedTemplateId]);

  const activeVars = useMemo(() => {
    const base: Record<string, string | number | undefined> = {
      companyName: settings?.companyName || 'Little Monk Travels',
      customerName: customerName || 'Traveller',
      executiveName: currentEmployee?.name || 'Travel Desk',
    };

    if (recipientType === 'enquiry') {
      const enq = enquiries.find((e) => e.id === selectedEntityId);
      const quote = quotations.find((q) => q.enquiryId === enq?.id);
      if (enq) {
        return {
          ...base,
          customerName: enq.customerName,
          enquiryCode: enq.enquiryCode,
          destination: enq.destination,
          startDate: formatDate(enq.startDate),
          endDate: formatDate(enq.endDate),
          budget: formatCurrency(enq.budget),
          quoteCode: quote?.quoteCode || 'QT-PENDING',
          amount: quote ? formatCurrency(quote.totalCost) : formatCurrency(enq.budget),
        };
      }
    }

    if (recipientType === 'booking') {
      const bk = bookings.find((b) => b.id === selectedEntityId);
      if (bk) {
        return {
          ...base,
          customerName: bk.customerName,
          bookingCode: bk.bookingCode,
          destination: bk.destination,
          startDate: formatDate(bk.startDate),
          endDate: formatDate(bk.endDate),
          hotelName: bk.hotelName || 'Confirmed Partner Hotel',
          vehicleDetails: bk.vehicleDetails || 'Private Cab',
          amount: formatCurrency(bk.bookingAmount),
          advanceReceived: formatCurrency(bk.advanceReceived),
          remainingAmount: formatCurrency(bk.remainingAmount),
        };
      }
    }

    if (recipientType === 'customer') {
      const cust = customers.find((c) => c.id === selectedEntityId);
      if (cust) {
        return {
          ...base,
          customerName: cust.name,
          destination: 'your upcoming trip',
          remainingAmount: formatCurrency(cust.outstandingBalance),
        };
      }
    }

    return base;
  }, [
    recipientType,
    selectedEntityId,
    enquiries,
    bookings,
    customers,
    quotations,
    settings,
    customerName,
    currentEmployee,
  ]);

  // Populate phone, name, and interpolated message on selection change
  const applyEntityAndTemplate = (
    nextType: typeof recipientType,
    entityId: string,
    tplId: string
  ) => {
    let nextPhone = phone;
    let nextName = customerName;
    if (nextType === 'enquiry') {
      const enq = enquiries.find((e) => e.id === entityId);
      if (enq) {
        nextPhone = enq.whatsapp || enq.mobile || '';
        nextName = enq.customerName;
      }
    } else if (nextType === 'booking') {
      const bk = bookings.find((b) => b.id === entityId);
      if (bk) {
        nextPhone = bk.customerPhone || '';
        nextName = bk.customerName;
      }
    } else if (nextType === 'customer') {
      const c = customers.find((x) => x.id === entityId);
      if (c) {
        nextPhone = c.whatsapp || c.mobile || '';
        nextName = c.name;
      }
    }
    setPhone(nextPhone);
    setCustomerName(nextName);

    const tpl = whatsappTemplates.find((t) => t.id === tplId);
    if (tpl) {
      // Compute inline vars using updated entity
      const vars: Record<string, string | number | undefined> = {
        companyName: settings?.companyName || 'Little Monk Travels',
        customerName: nextName || 'Traveller',
        executiveName: currentEmployee?.name || 'Travel Desk',
      };
      if (nextType === 'enquiry') {
        const enq = enquiries.find((e) => e.id === entityId);
        const quote = quotations.find((q) => q.enquiryId === enq?.id);
        if (enq) {
          vars.enquiryCode = enq.enquiryCode;
          vars.destination = enq.destination;
          vars.startDate = formatDate(enq.startDate);
          vars.endDate = formatDate(enq.endDate);
          vars.quoteCode = quote?.quoteCode || 'QT-PENDING';
          vars.amount = quote ? formatCurrency(quote.totalCost) : formatCurrency(enq.budget);
        }
      } else if (nextType === 'booking') {
        const bk = bookings.find((b) => b.id === entityId);
        if (bk) {
          vars.bookingCode = bk.bookingCode;
          vars.destination = bk.destination;
          vars.startDate = formatDate(bk.startDate);
          vars.endDate = formatDate(bk.endDate);
          vars.hotelName = bk.hotelName || 'Partner Hotel';
          vars.vehicleDetails = bk.vehicleDetails || 'Assigned Vehicle';
          vars.amount = formatCurrency(bk.bookingAmount);
          vars.remainingAmount = formatCurrency(bk.remainingAmount);
        }
      } else if (nextType === 'customer') {
        const c = customers.find((x) => x.id === entityId);
        if (c) {
          vars.remainingAmount = formatCurrency(c.outstandingBalance);
        }
      }
      setMessageBody(interpolateTemplate(tpl.body, vars));
    }
  };

  const handleCloudApiSendClick = () => {
    const cfg = settings?.whatsappConfig;
    if (!cfg?.enabled || !cfg.phoneNumberId.trim() || !cfg.businessAccountId.trim()) {
      setApiNotice(
        'WhatsApp Business Cloud API is not enabled yet. Configure Phone Number ID and Business Account ID in the Cloud API Configuration tab, and provision your server-side WHATSAPP_ACCESS_TOKEN. Meanwhile, use "Open in WhatsApp" to send immediately via wa.me.'
      );
      toast('info', 'WhatsApp Cloud API credentials are not connected.');
      return;
    }

    setApiNotice(
      `Cloud API identifiers (${cfg.phoneNumberId}) are saved, but automated server-side dispatch requires a backend relay endpoint holding your secret WHATSAPP_ACCESS_TOKEN (client browsers cannot securely store Meta permanent access tokens). Use "Open in WhatsApp" below for immediate real-world messaging.`
    );
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplForm.name.trim() || !tplForm.body.trim()) return;
    await saveWhatsAppTemplate(tplForm, editingTpl?.id);
    setTplOpen(false);
    setEditingTpl(null);
  };

  const handleSaveApiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCompanySettings({
      whatsappConfig: {
        enabled: apiForm.enabled,
        phoneNumberId: apiForm.phoneNumberId.trim(),
        businessAccountId: apiForm.businessAccountId.trim(),
        webhookVerifyToken: apiForm.webhookVerifyToken.trim(),
        apiVersion: apiForm.apiVersion.trim() || 'v21.0',
      },
    });
  };

  const waHref = buildWhatsAppLink(phone, messageBody);

  return (
    <div className="space-y-4">
      {/* Header Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('composer')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === 'composer'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Message Composer
          </button>
          <button
            type="button"
            onClick={() => setTab('templates')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === 'templates'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Templates ({whatsappTemplates.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('api')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === 'api'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Cloud API Configuration
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Click-to-WhatsApp: <span className="text-emerald-700 dark:text-emerald-400 font-medium">Ready</span>
          {' · '}
          Cloud API:{' '}
          <span
            className={
              settings?.whatsappConfig?.enabled && settings?.whatsappConfig?.phoneNumberId
                ? 'text-teal-700 dark:text-teal-400 font-medium'
                : 'text-amber-700 dark:text-amber-400 font-medium'
            }
          >
            {settings?.whatsappConfig?.enabled && settings?.whatsappConfig?.phoneNumberId
              ? 'Identifiers Saved (Backend Token Required)'
              : 'Not Connected'}
          </span>
        </div>
      </div>

      {/* Message Composer */}
      {tab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Recipient & Template Selector */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              1. Recipient & Template
            </h3>

            <div>
              <label className="block text-xs font-medium mb-1">Link CRM Record</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['enquiry', 'booking', 'customer', 'custom'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setRecipientType(t);
                      setSelectedEntityId('');
                    }}
                    className={`px-2 py-1.5 text-xs font-medium rounded-lg border capitalize cursor-pointer ${
                      recipientType === t
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {recipientType !== 'custom' && (
              <div>
                <label className="block text-xs font-medium mb-1">
                  Select {recipientType === 'enquiry' ? 'Enquiry' : recipientType === 'booking' ? 'Booking' : 'Customer'}
                </label>
                <select
                  value={selectedEntityId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedEntityId(id);
                    applyEntityAndTemplate(recipientType, id, selectedTemplateId);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="">-- Choose record --</option>
                  {recipientType === 'enquiry' &&
                    enquiries.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.enquiryCode} — {e.customerName} ({e.destination})
                      </option>
                    ))}
                  {recipientType === 'booking' &&
                    bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bookingCode} — {b.customerName} ({b.destination})
                      </option>
                    ))}
                  {recipientType === 'customer' &&
                    customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customerCode} — {c.name} ({c.mobile})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Recipient name"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">WhatsApp Number *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Predefined Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  const tplId = e.target.value;
                  setSelectedTemplateId(tplId);
                  applyEntityAndTemplate(recipientType, selectedEntityId, tplId);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="">-- Blank / Custom message --</option>
                {whatsappTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.category}] {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 space-y-1">
              <div className="font-medium text-slate-700 dark:text-slate-300">
                Available Placeholders
              </div>
              <div className="font-mono text-[11px] leading-relaxed">
                {'{{customerName}}'}, {'{{destination}}'}, {'{{startDate}}'}, {'{{endDate}}'},{' '}
                {'{{bookingCode}}'}, {'{{quoteCode}}'}, {'{{amount}}'}, {'{{remainingAmount}}'},{' '}
                {'{{companyName}}'}
              </div>
            </div>
          </div>

          {/* Live Message Preview & Dispatch */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  2. Review & Send WhatsApp Message
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const tpl = whatsappTemplates.find((t) => t.id === selectedTemplateId);
                    if (tpl) setMessageBody(interpolateTemplate(tpl.body, activeVars));
                  }}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Re-apply template variables
                </button>
              </div>

              <textarea
                rows={10}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Select a template or type your personalized WhatsApp message..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 leading-relaxed"
              />

              {apiNotice && (
                <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="leading-relaxed">{apiNotice}</div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 tabular-nums">
                Target: {phone ? phone : 'Enter WhatsApp number'} · {messageBody.length} chars
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloudApiSendClick}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send via Cloud API
                </button>
                <a
                  href={phone && messageBody ? waHref : '#'}
                  target={phone && messageBody ? '_blank' : undefined}
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!phone.trim() || !messageBody.trim()) {
                      e.preventDefault();
                      toast('info', 'Please enter a valid WhatsApp phone number and message.');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Open in WhatsApp (wa.me)
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Manager */}
      {tab === 'templates' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                WhatsApp Message Templates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Standardized templates for enquiry follow-ups, quotation sharing, booking confirmations, and reminders.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingTpl(null);
                  setTplForm({ name: '', category: 'Enquiry Response', body: '' });
                  setTplOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Template
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {whatsappTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-teal-700 dark:text-teal-400">
                        {tpl.category}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {tpl.name}
                      </h4>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTpl(tpl);
                            setTplForm({
                              name: tpl.name,
                              category: tpl.category,
                              body: tpl.body,
                            });
                            setTplOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTplId(tpl.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {tpl.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplateId(tpl.id);
                    setMessageBody(interpolateTemplate(tpl.body, activeVars));
                    setTab('composer');
                  }}
                  className="self-start text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Use in Composer →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cloud API Configuration */}
      {tab === 'api' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-2xl space-y-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                WhatsApp Business Cloud API Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Store your Meta WhatsApp Business Cloud API identifiers here. For security, private permanent access tokens (WHATSAPP_ACCESS_TOKEN) must only be configured on a secure backend/Cloud Function environment and are never stored in browser-accessible Firestore documents.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveApiConfig} className="space-y-4">
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={apiForm.enabled}
                onChange={(e) => setApiForm({ ...apiForm, enabled: e.target.checked })}
                className="w-4 h-4 accent-teal-600 rounded"
              />
              Enable WhatsApp Cloud API Identifiers
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Phone Number ID</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={apiForm.phoneNumberId}
                  onChange={(e) => setApiForm({ ...apiForm, phoneNumberId: e.target.value })}
                  placeholder="e.g. 104928475829103"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">WhatsApp Business Account ID</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={apiForm.businessAccountId}
                  onChange={(e) => setApiForm({ ...apiForm, businessAccountId: e.target.value })}
                  placeholder="e.g. 109482756192837"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Webhook Verify Token</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={apiForm.webhookVerifyToken}
                  onChange={(e) => setApiForm({ ...apiForm, webhookVerifyToken: e.target.value })}
                  placeholder="little_monk_travels_verify_token"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Graph API Version</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={apiForm.apiVersion}
                  onChange={(e) => setApiForm({ ...apiForm, apiVersion: e.target.value })}
                  placeholder="v21.0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
                />
              </div>
            </div>

            {isAdmin ? (
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer"
              >
                Save Cloud API Settings
              </button>
            ) : (
              <p className="text-xs text-slate-500">Only Admins can update Cloud API settings.</p>
            )}
          </form>
        </div>
      )}

      {/* Template Create/Edit Modal */}
      {tplOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {editingTpl ? 'Edit WhatsApp Template' : 'New WhatsApp Template'}
              </h3>
              <button
                type="button"
                onClick={() => setTplOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Template Name *</label>
                <input
                  required
                  type="text"
                  value={tplForm.name}
                  onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <select
                  value={tplForm.category}
                  onChange={(e) =>
                    setTplForm({
                      ...tplForm,
                      category: e.target.value as WhatsAppTemplate['category'],
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Message Body *</label>
                <textarea
                  required
                  rows={6}
                  value={tplForm.body}
                  onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })}
                  placeholder="Hello {{customerName}}, thank you for contacting {{companyName}}..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTplOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTplId)}
        title="Delete Template"
        message="Are you sure you want to delete this WhatsApp template?"
        confirmLabel="Delete"
        onCancel={() => setDeleteTplId(null)}
        onConfirm={async () => {
          if (deleteTplId) await deleteWhatsAppTemplate(deleteTplId);
          setDeleteTplId(null);
        }}
      />
    </div>
  );
};
