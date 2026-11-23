import React, { useEffect, useMemo, useState } from 'react';
import { Download, Edit2, Plus, Printer, Trash2, X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { Booking, Invoice, InvoiceItem, InvoiceStatus, InvoiceType } from '../../types/crm';
import { formatCurrency, formatDate, generateCode, todayISO } from '../../utils/formatters';
import { generateInvoicePDF } from '../../utils/pdfAndExport';
import { ImageWithFallback } from './ImageWithFallback';

interface InvoiceModalProps {
  open: boolean;
  initialMode?: 'edit' | 'preview';
  invoice?: Invoice | null;
  booking?: Booking | null;
  onClose: () => void;
}

const INVOICE_TYPES: InvoiceType[] = ['Tax Invoice', 'Proforma Invoice'];
const INVOICE_STATUSES: InvoiceStatus[] = ['Draft', 'Issued', 'Partial', 'Paid', 'Cancelled'];

function buildDefaultDraftFromBooking(
  booking: Booking,
  defaultGstPercent: number,
  invoicePrefix: string,
  existingCount: number,
  customerAddress: string,
  defaultTerms: string
): Partial<Invoice> {
  const total = Math.max(0, Number(booking.bookingAmount || 0));
  const gstPct = Math.max(0, Number(defaultGstPercent ?? 5));
  const taxableBase = gstPct > 0 ? Math.round((total * 100) / (100 + gstPct)) : total;
  const gstAmount = Math.max(0, total - taxableBase);
  const paid = Math.max(0, Number(booking.advanceReceived || 0));
  const balance = Math.max(0, total - paid);
  const descParts = [
    booking.packageName || `${booking.destination} Tour Package`,
    `${booking.adults} Adult${booking.adults === 1 ? '' : 's'}${booking.children ? `, ${booking.children} Child` : ''}`,
    booking.hotelName ? `Hotels: ${booking.hotelName}` : '',
  ].filter(Boolean);

  return {
    invoiceCode: generateCode(invoicePrefix || 'INV', existingCount),
    invoiceType: 'Tax Invoice',
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    customerId: booking.customerId || '',
    customerName: booking.customerName,
    customerPhone: booking.customerPhone || '',
    customerEmail: booking.customerEmail || '',
    customerAddress,
    customerGstin: '',
    destination: booking.destination,
    travelDates: `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`,
    issueDate: todayISO(),
    dueDate: booking.startDate || todayISO(),
    items: [
      {
        description: descParts.join(' · ').slice(0, 280),
        hsnSac: '998551',
        quantity: 1,
        unitPrice: taxableBase,
        amount: taxableBase,
      },
    ],
    subtotal: taxableBase,
    discountAmount: 0,
    gstPercent: gstPct,
    gstAmount,
    totalAmount: total,
    paidAmount: paid,
    balanceDue: balance,
    status: balance === 0 && total > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Issued',
    notes: '',
    termsAndConditions: defaultTerms,
  };
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  open,
  initialMode = 'edit',
  invoice,
  booking,
  onClose,
}) => {
  const { bookings, customers, invoices, settings, can, saveInvoice } = useCRM();

  const [mode, setMode] = useState<'edit' | 'preview'>(initialMode);
  const [editingId, setEditingId] = useState<string | undefined>(invoice?.id);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Partial<Invoice>>({});

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    if (invoice) {
      setEditingId(invoice.id);
      setForm({
        ...invoice,
        items:
          invoice.items && invoice.items.length > 0
            ? invoice.items.map((it) => ({ ...it }))
            : [{ description: 'Tour Services', hsnSac: '998551', quantity: 1, unitPrice: 0, amount: 0 }],
      });
    } else if (booking) {
      setEditingId(undefined);
      const linkedCustomer = customers.find((c) => c.id === booking.customerId);
      const addr = [linkedCustomer?.address, linkedCustomer?.city].filter(Boolean).join(', ');
      setForm(
        buildDefaultDraftFromBooking(
          booking,
          settings?.defaultGstPercent ?? 5,
          settings?.invoicePrefix || 'INV',
          invoices.length,
          addr,
          settings?.invoiceTerms || ''
        )
      );
    } else {
      setEditingId(undefined);
      setForm({
        invoiceCode: generateCode(settings?.invoicePrefix || 'INV', invoices.length),
        invoiceType: 'Tax Invoice',
        bookingId: '',
        bookingCode: '',
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerGstin: '',
        destination: '',
        travelDates: '',
        issueDate: todayISO(),
        dueDate: todayISO(),
        items: [
          {
            description: 'Himalayan Tour Package Services',
            hsnSac: '998551',
            quantity: 1,
            unitPrice: 0,
            amount: 0,
          },
        ],
        discountAmount: 0,
        gstPercent: settings?.defaultGstPercent ?? 5,
        paidAmount: 0,
        status: 'Issued',
        notes: '',
        termsAndConditions: settings?.invoiceTerms || '',
      });
    }
  }, [open, initialMode, invoice, booking, customers, settings, invoices.length]);

  const computed = useMemo(() => {
    const items = (form.items || []).map((it) => {
      const qty = Math.max(1, Number(it.quantity || 1));
      const unit = Math.max(0, Number(it.unitPrice || 0));
      return { ...it, quantity: qty, unitPrice: unit, amount: qty * unit };
    });
    const subtotal = items.reduce((s, it) => s + it.amount, 0);
    const discountAmount = Math.max(0, Number(form.discountAmount ?? 0));
    const taxable = Math.max(0, subtotal - discountAmount);
    const gstPercent = Math.max(0, Number(form.gstPercent ?? settings?.defaultGstPercent ?? 5));
    const gstAmount = Math.round((taxable * gstPercent) / 100);
    const totalAmount = taxable + gstAmount;
    const paidAmount = Math.max(0, Number(form.paidAmount ?? 0));
    const balanceDue = Math.max(0, totalAmount - paidAmount);
    return { items, subtotal, discountAmount, taxable, gstPercent, gstAmount, totalAmount, paidAmount, balanceDue };
  }, [form.items, form.discountAmount, form.gstPercent, form.paidAmount, settings?.defaultGstPercent]);

  if (!open) return null;

  const handleSelectBooking = (bookingId: string) => {
    if (!bookingId) {
      setForm((prev) => ({ ...prev, bookingId: '', bookingCode: '' }));
      return;
    }
    const bk = bookings.find((b) => b.id === bookingId);
    if (!bk) return;
    const linkedCustomer = customers.find((c) => c.id === bk.customerId);
    const addr = [linkedCustomer?.address, linkedCustomer?.city].filter(Boolean).join(', ');
    const draft = buildDefaultDraftFromBooking(
      bk,
      settings?.defaultGstPercent ?? 5,
      settings?.invoicePrefix || 'INV',
      invoices.length,
      addr,
      form.termsAndConditions || settings?.invoiceTerms || ''
    );
    setForm((prev) => ({
      ...draft,
      invoiceCode: prev.invoiceCode || draft.invoiceCode,
      invoiceType: prev.invoiceType || draft.invoiceType,
    }));
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setForm((prev) => {
      const next = [...(prev.items || [])];
      const current = next[idx] || { description: '', hsnSac: '998551', quantity: 1, unitPrice: 0, amount: 0 };
      const merged = { ...current, ...patch };
      merged.amount = Math.max(1, Number(merged.quantity || 1)) * Math.max(0, Number(merged.unitPrice || 0));
      next[idx] = merged;
      return { ...prev, items: next };
    });
  };

  const addItem = () => {
    setForm((prev) => {
      const current = prev.items || [];
      if (current.length >= 20) return prev;
      return {
        ...prev,
        items: [
          ...current,
          { description: '', hsnSac: '998551', quantity: 1, unitPrice: 0, amount: 0 },
        ],
      };
    });
  };

  const removeItem = (idx: number) => {
    setForm((prev) => {
      const current = prev.items || [];
      if (current.length <= 1) return prev;
      return { ...prev, items: current.filter((_, i) => i !== idx) };
    });
  };

  const buildPayload = (): Partial<Invoice> => ({
    ...form,
    items: computed.items,
    subtotal: computed.subtotal,
    discountAmount: computed.discountAmount,
    gstPercent: computed.gstPercent,
    gstAmount: computed.gstAmount,
    totalAmount: computed.totalAmount,
    paidAmount: computed.paidAmount,
    balanceDue: computed.balanceDue,
  });

  const handleSave = async (switchToPreview: boolean) => {
    if (!form.customerName?.trim() || !form.invoiceCode?.trim()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      const savedId = await saveInvoice(payload, editingId);
      setEditingId(savedId);
      setForm({ ...payload, id: savedId });
      if (switchToPreview) {
        setMode('preview');
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const previewInvoice: Invoice = {
    id: editingId || 'preview',
    invoiceCode: form.invoiceCode || 'INV-PREVIEW',
    invoiceType: form.invoiceType || 'Tax Invoice',
    bookingId: form.bookingId,
    bookingCode: form.bookingCode,
    customerId: form.customerId,
    customerName: form.customerName || 'Customer',
    customerPhone: form.customerPhone,
    customerEmail: form.customerEmail,
    customerAddress: form.customerAddress,
    customerGstin: form.customerGstin,
    destination: form.destination,
    travelDates: form.travelDates,
    issueDate: form.issueDate || todayISO(),
    dueDate: form.dueDate,
    items: computed.items,
    subtotal: computed.subtotal,
    discountAmount: computed.discountAmount,
    gstPercent: computed.gstPercent,
    gstAmount: computed.gstAmount,
    totalAmount: computed.totalAmount,
    paidAmount: computed.paidAmount,
    balanceDue: computed.balanceDue,
    status: form.status || 'Issued',
    notes: form.notes,
    termsAndConditions: form.termsAndConditions,
    createdByUid: form.createdByUid || '',
  };

  if (mode === 'preview') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
        <div className="w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-6">
          {/* Branded Header */}
          <div className="bg-[#0F2744] text-white px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-teal-500">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-black shrink-0 p-0.5">
                <ImageWithFallback
                  src={settings?.logoUrl || '/assets/aistudio/Screenshot_2026-11-23_132939_51fcd266.png'}
                  alt="Company Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="text-lg font-bold">{settings?.companyName || 'Little Monk Travels'}</h2>
                <p className="text-xs text-slate-300">
                  {settings?.phone} · {settings?.email}
                </p>
                {settings?.address && <p className="text-[11px] text-slate-400">{settings.address}</p>}
                {settings?.gstNumber && <p className="text-[11px] text-teal-300">GSTIN: {settings.gstNumber}</p>}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs uppercase tracking-wider text-teal-300 font-semibold">
                {previewInvoice.invoiceType}
              </div>
              <div className="text-xl font-mono font-bold">{previewInvoice.invoiceCode}</div>
              <span className="inline-block mt-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-white/10 text-white">
                {previewInvoice.status}
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-5 border-b border-slate-200 text-sm">
              <div>
                <div className="text-xs uppercase text-slate-400 font-semibold mb-1">Bill To</div>
                <div className="font-semibold text-slate-900">{previewInvoice.customerName}</div>
                {previewInvoice.customerPhone && <div className="text-slate-600">{previewInvoice.customerPhone}</div>}
                {previewInvoice.customerEmail && <div className="text-slate-600">{previewInvoice.customerEmail}</div>}
                {previewInvoice.customerAddress && (
                  <div className="text-slate-600 text-xs mt-1">{previewInvoice.customerAddress}</div>
                )}
                {previewInvoice.customerGstin && (
                  <div className="text-xs font-mono text-slate-700 mt-1">GSTIN: {previewInvoice.customerGstin}</div>
                )}
              </div>
              <div className="sm:text-right space-y-0.5">
                <div className="text-xs uppercase text-slate-400 font-semibold mb-1">Invoice Information</div>
                <div className="text-xs text-slate-600">
                  Issue Date: <span className="font-medium text-slate-900">{formatDate(previewInvoice.issueDate)}</span>
                </div>
                {previewInvoice.dueDate && (
                  <div className="text-xs text-slate-600">
                    Due Date: <span className="font-medium text-slate-900">{formatDate(previewInvoice.dueDate)}</span>
                  </div>
                )}
                {previewInvoice.bookingCode && (
                  <div className="text-xs text-slate-600">
                    Booking Ref: <span className="font-mono font-medium text-slate-900">{previewInvoice.bookingCode}</span>
                  </div>
                )}
                {previewInvoice.destination && (
                  <div className="text-xs text-slate-600">
                    Destination: <span className="font-medium text-slate-900">{previewInvoice.destination}</span>
                  </div>
                )}
                {previewInvoice.travelDates && (
                  <div className="text-xs text-slate-600">Travel Dates: {previewInvoice.travelDates}</div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-xs text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 text-left">#</th>
                    <th className="py-2.5 px-3 text-left">Description</th>
                    <th className="py-2.5 px-3 text-left">HSN/SAC</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewInvoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 text-xs text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{item.description}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{item.hsnSac || '998551'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex-1 text-xs text-slate-600 space-y-2">
                {(settings?.bankDetails || settings?.upiId) && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-semibold text-slate-800 mb-1">Bank & UPI Payment Details</div>
                    {settings?.bankDetails && <div>{settings.bankDetails}</div>}
                    {settings?.upiId && <div className="font-mono mt-0.5">UPI: {settings.upiId}</div>}
                  </div>
                )}
                {previewInvoice.notes && (
                  <div>
                    <span className="font-semibold text-slate-800">Notes: </span>
                    {previewInvoice.notes}
                  </div>
                )}
              </div>

              <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Subtotal</span>
                  <span className="font-mono tabular-nums">{formatCurrency(previewInvoice.subtotal)}</span>
                </div>
                {Number(previewInvoice.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span className="font-mono tabular-nums">
                      - {formatCurrency(previewInvoice.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>GST ({previewInvoice.gstPercent}%)</span>
                  <span className="font-mono tabular-nums">{formatCurrency(previewInvoice.gstAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#0F2744] pt-2 border-t border-slate-200">
                  <span>Total (INR)</span>
                  <span className="font-mono tabular-nums">{formatCurrency(previewInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 pt-1">
                  <span>Amount Received</span>
                  <span className="font-mono tabular-nums">{formatCurrency(previewInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-amber-700">
                  <span>Balance Due</span>
                  <span className="font-mono tabular-nums">{formatCurrency(previewInvoice.balanceDue)}</span>
                </div>
              </div>
            </div>

            {(previewInvoice.termsAndConditions || settings?.invoiceTerms) && (
              <div className="text-xs text-slate-500 border-t border-slate-200 pt-4 whitespace-pre-line">
                <div className="font-semibold text-slate-700 mb-1">Terms & Conditions</div>
                {previewInvoice.termsAndConditions || settings?.invoiceTerms}
              </div>
            )}
          </div>

          <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              {can('payments', 'edit') && (
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Invoice
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                type="button"
                onClick={() => void generateInvoicePDF(previewInvoice, settings)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">
              {editingId ? `Edit Invoice (${form.invoiceCode})` : 'Generate New Invoice (INR)'}
            </h3>
            <p className="text-xs text-slate-500">
              Create GST Tax Invoices or Proforma Invoices linked to bookings or custom services.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave(true);
          }}
          className="p-6 space-y-5 max-h-[75vh] overflow-y-auto"
        >
          {/* Booking Auto-Fill + Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Link Booking (Optional Auto-Fill)</label>
              <select
                value={form.bookingId || ''}
                onChange={(e) => handleSelectBooking(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="">Custom / Standalone Invoice</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bookingCode} — {b.customerName} ({b.destination} · {formatCurrency(b.bookingAmount)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Invoice Number *</label>
              <input
                required
                type="text"
                value={form.invoiceCode || ''}
                onChange={(e) => setForm({ ...form, invoiceCode: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Invoice Type</label>
              <select
                value={form.invoiceType || 'Tax Invoice'}
                onChange={(e) => setForm({ ...form, invoiceType: e.target.value as InvoiceType })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              >
                {INVOICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Billing Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Customer / Company Name *</label>
              <input
                required
                type="text"
                value={form.customerName || ''}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Customer Phone</label>
              <input
                type="text"
                value={form.customerPhone || ''}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Customer Email</label>
              <input
                type="email"
                value={form.customerEmail || ''}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Billing Address</label>
              <input
                type="text"
                value={form.customerAddress || ''}
                onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                placeholder="City, State, PIN"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Customer GSTIN (Optional)</label>
              <input
                type="text"
                value={form.customerGstin || ''}
                onChange={(e) => setForm({ ...form, customerGstin: e.target.value })}
                placeholder="e.g. 27AABCU9603R1ZM"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Destination</label>
              <input
                type="text"
                value={form.destination || ''}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                placeholder="Sikkim / Darjeeling / Bhutan"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Issue Date *</label>
              <input
                required
                type="date"
                value={form.issueDate || todayISO()}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={form.dueDate || ''}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Invoice Line Items (INR)
              </label>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/30"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Line Item
              </button>
            </div>
            <div className="space-y-2">
              {(form.items || []).map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                >
                  <div className="sm:col-span-5">
                    <input
                      required
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="Package / Hotel / Transport / Permit description"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={item.hsnSac || '998551'}
                      onChange={(e) => updateItem(idx, { hsnSac: e.target.value })}
                      placeholder="SAC"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950 tabular-nums text-right"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950 font-mono tabular-nums text-right"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between gap-1">
                    <span className="text-xs font-mono font-semibold tabular-nums">
                      {formatCurrency(Math.max(1, item.quantity) * Math.max(0, item.unitPrice))}
                    </span>
                    {(form.items || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax, Payments & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Discount (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.discountAmount ?? 0}
                    onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">GST (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={28}
                    step={0.5}
                    value={form.gstPercent ?? 5}
                    onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Amount Received (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.paidAmount ?? 0}
                    onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Invoice Status</label>
                  <select
                    value={form.status || 'Issued'}
                    onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {INVOICE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional payment instructions or remarks"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Invoice Calculation Summary
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">Subtotal</span>
                <span className="font-mono tabular-nums">{formatCurrency(computed.subtotal)}</span>
              </div>
              {computed.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-mono tabular-nums">- {formatCurrency(computed.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">GST ({computed.gstPercent}%)</span>
                <span className="font-mono tabular-nums">{formatCurrency(computed.gstAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Invoice Total</span>
                <span className="font-mono tabular-nums">{formatCurrency(computed.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-600">
                <span>Paid / Advance</span>
                <span className="font-mono tabular-nums">{formatCurrency(computed.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-amber-600">
                <span>Balance Due</span>
                <span className="font-mono tabular-nums">{formatCurrency(computed.balanceDue)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave(false)}
              className="px-4 py-2 text-sm font-medium border border-teal-600 text-teal-700 dark:text-teal-400 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/30 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save & Close'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save & Preview Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
