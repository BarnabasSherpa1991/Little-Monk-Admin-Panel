import React, { useMemo, useState } from 'react';
import { Download, Edit2, Eye, FileText, Plus, Trash2, X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { Expense, Invoice, Payment, PaymentMode } from '../../types/crm';
import { formatCurrency, formatDate, todayISO } from '../../utils/formatters';
import { generateInvoicePDF, generatePaymentReceiptPDF } from '../../utils/pdfAndExport';
import { SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { InvoiceModal } from '../common/InvoiceModal';

const MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Credit/Debit Card', 'Payment Gateway'];
const EXPENSE_CATS: Expense['category'][] = [
  'Hotel Payment',
  'Transport Payment',
  'Sightseeing/Vendor',
  'Office/Marketing',
  'Other',
];

export const PaymentsView: React.FC = () => {
  const {
    payments,
    invoices,
    expenses,
    bookings,
    settings,
    can,
    recordPayment,
    deletePayment,
    deleteInvoice,
    saveExpense,
    deleteExpense,
  } = useCRM();

  const [tab, setTab] = useState<'collections' | 'invoices' | 'expenses'>('collections');
  const [search, setSearch] = useState('');

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    type: 'Customer Collection' as 'Customer Collection' | 'Refund',
    bookingId: '',
    amount: 0,
    mode: 'UPI' as PaymentMode,
    referenceNumber: '',
    paymentDate: todayISO(),
    notes: '',
  });

  const [expModalOpen, setExpModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [expForm, setExpForm] = useState<Partial<Expense>>({});

  const [deletePayId, setDeletePayId] = useState<string | null>(null);
  const [deleteExpId, setDeleteExpId] = useState<string | null>(null);
  const [deleteInvId, setDeleteInvId] = useState<string | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState<{
    open: boolean;
    mode: 'edit' | 'preview';
    invoice?: Invoice | null;
  }>({ open: false, mode: 'edit' });

  const summary = useMemo(() => {
    const collections = payments
      .filter((p) => p.type === 'Customer Collection')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const refunds = payments
      .filter((p) => p.type === 'Refund')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const gstCollected = payments
      .filter((p) => p.type === 'Customer Collection')
      .reduce((s, p) => s + Number(p.gstComponent || 0), 0);
    const customerOutstanding = bookings
      .filter((b) => b.bookingStatus !== 'Cancelled')
      .reduce((s, b) => s + Number(b.remainingAmount || 0), 0);
    const bookingAdvances = bookings
      .filter((b) => b.bookingStatus !== 'Cancelled')
      .reduce((s, b) => s + Number(b.advanceReceived || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const pendingSupplier = expenses.reduce((s, e) => s + Number(e.pendingAmount || 0), 0);
    const netProfit = collections - refunds - totalExpenses;

    return {
      collections,
      refunds,
      gstCollected,
      customerOutstanding,
      bookingAdvances,
      totalExpenses,
      pendingSupplier,
      netProfit,
    };
  }, [payments, bookings, expenses]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (!term) return true;
      return `${p.receiptCode} ${p.customerName} ${p.bookingCode || ''} ${p.referenceNumber || ''}`
        .toLowerCase()
        .includes(term);
    });
  }, [payments, search]);

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (!term) return true;
      return `${e.expenseCode} ${e.vendorName} ${e.category} ${e.bookingCode || ''}`
        .toLowerCase()
        .includes(term);
    });
  }, [expenses, search]);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (!term) return true;
      return `${inv.invoiceCode} ${inv.customerName} ${inv.bookingCode || ''} ${inv.destination || ''} ${inv.status}`
        .toLowerCase()
        .includes(term);
    });
  }, [invoices, search]);

  const handleSavePayment = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const bk = bookings.find((b) => b.id === payForm.bookingId);
    if (!bk || payForm.amount <= 0) return;
    const gstPct = settings?.defaultGstPercent ?? 5;
    await recordPayment({
      type: payForm.type,
      booking: bk,
      amount: Number(payForm.amount),
      gstComponent:
        payForm.type === 'Refund'
          ? 0
          : Math.round((Number(payForm.amount) * gstPct) / (100 + gstPct)),
      mode: payForm.mode,
      referenceNumber: payForm.referenceNumber,
      paymentDate: payForm.paymentDate,
      notes: payForm.notes,
    });
    setPayModalOpen(false);
  };

  const handleSaveExpense = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!expForm.vendorName?.trim()) return;
    await saveExpense(expForm, editingExp?.id);
    setExpModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Financial KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Received (INR)</div>
          <div className="mt-1 text-base xl:text-lg font-bold font-mono tabular-nums break-words text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.collections)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            Booking Advances: {formatCurrency(summary.bookingAdvances)} · GST: {formatCurrency(summary.gstCollected)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Pending Collection</div>
          <div className="mt-1 text-base xl:text-lg font-bold font-mono tabular-nums break-words text-amber-600 dark:text-amber-400">
            {formatCurrency(summary.customerOutstanding)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Refunds Issued</div>
          <div className="mt-1 text-base xl:text-lg font-bold font-mono tabular-nums break-words text-red-600 dark:text-red-400">
            {formatCurrency(summary.refunds)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Supplier & OpEx</div>
          <div className="mt-1 text-base xl:text-lg font-bold font-mono tabular-nums break-words text-slate-900 dark:text-slate-100">
            {formatCurrency(summary.totalExpenses)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Pending Payables</div>
          <div className="mt-1 text-base xl:text-lg font-bold font-mono tabular-nums break-words text-amber-600 dark:text-amber-400">
            {formatCurrency(summary.pendingSupplier)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500">Net Cash P&L</div>
          <div
            className={`mt-1 text-base xl:text-lg font-bold font-mono tabular-nums break-words ${
              summary.netProfit >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-600'
            }`}
          >
            {formatCurrency(summary.netProfit)}
          </div>
        </div>
      </div>

      {/* Tabs + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('collections')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'collections'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Customer Payments & Refunds ({payments.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('invoices')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'invoices'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Invoices ({invoices.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('expenses')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'expenses'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Supplier Payments & Expenses ({expenses.length})
            </button>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              tab === 'invoices'
                ? 'Search invoice #, customer, booking...'
                : 'Search receipts, vendor, booking...'
            }
            className="w-64"
          />
        </div>

        {can('payments', 'create') && (
          <div className="flex items-center gap-2">
            {tab === 'collections' ? (
              <button
                type="button"
                onClick={() => {
                  setPayForm({
                    type: 'Customer Collection',
                    bookingId: bookings[0]?.id || '',
                    amount: bookings[0]?.remainingAmount || 10000,
                    mode: 'UPI',
                    referenceNumber: '',
                    paymentDate: todayISO(),
                    notes: '',
                  });
                  setPayModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Record Payment / Refund
              </button>
            ) : tab === 'invoices' ? (
              <button
                type="button"
                onClick={() => setInvoiceDialog({ open: true, mode: 'edit', invoice: null })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                Create Invoice
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingExp(null);
                  setExpForm({
                    category: 'Hotel Payment',
                    vendorName: '',
                    bookingCode: '',
                    amount: 0,
                    paidAmount: 0,
                    mode: 'Bank Transfer',
                    dueDate: todayISO(),
                    notes: '',
                  });
                  setExpModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Supplier Expense
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'collections' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">Receipt ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Customer & Booking</th>
                  <th className="py-3 px-4">Mode & Reference</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">GST</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No payment transactions recorded.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const bk = bookings.find((b) => b.id === p.bookingId);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-xs font-medium">{p.receiptCode}</td>
                        <td className="py-3 px-4 text-xs">
                          <span className={p.type === 'Refund' ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                            {p.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{p.customerName}</div>
                          <div className="text-xs font-mono text-slate-400">{p.bookingCode || bk?.bookingCode}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div>{p.mode}</div>
                          <div className="font-mono text-slate-400">{p.referenceNumber || '—'}</div>
                        </td>
                        <td className="py-3 px-4 text-xs tabular-nums">{formatDate(p.paymentDate)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          {p.type === 'Refund' ? `- ${formatCurrency(p.amount)}` : formatCurrency(p.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                          {formatCurrency(p.gstComponent)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generatePaymentReceiptPDF(p, bk, settings)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-teal-600"
                            title="Download Receipt PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {can('payments', 'delete') && (
                            <button
                              type="button"
                              onClick={() => setDeletePayId(p.id)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : tab === 'invoices' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Customer & Booking</th>
                  <th className="py-3 px-4">Issue / Due Date</th>
                  <th className="py-3 px-4 text-right">Total (INR)</th>
                  <th className="py-3 px-4 text-right">Paid / Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No invoices created yet. Click &ldquo;Create Invoice&rdquo; or generate one from any Booking.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{inv.invoiceCode}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{inv.invoiceType}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{inv.customerName}</div>
                        <div className="text-xs text-slate-400">
                          {inv.bookingCode ? `${inv.bookingCode} · ` : ''}
                          {inv.destination || 'Tour Services'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs tabular-nums">
                        <div>{formatDate(inv.issueDate)}</div>
                        <div className="text-slate-400">Due: {formatDate(inv.dueDate)}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        <div>{formatCurrency(inv.totalAmount)}</div>
                        <div className="text-[11px] font-normal text-slate-400">
                          incl. {inv.gstPercent}% GST
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                        <div className="text-emerald-600 dark:text-emerald-400">
                          Paid: {formatCurrency(inv.paidAmount)}
                        </div>
                        <div className="text-amber-600 dark:text-amber-400">
                          Due: {formatCurrency(inv.balanceDue)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        <span
                          className={
                            inv.status === 'Paid'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : inv.status === 'Cancelled'
                              ? 'text-red-600 dark:text-red-400'
                              : inv.status === 'Partial'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-teal-700 dark:text-teal-400'
                          }
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setInvoiceDialog({ open: true, mode: 'preview', invoice: inv })}
                            className="p-1.5 rounded-md text-slate-500 hover:text-teal-600"
                            title="Preview Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void generateInvoicePDF(inv, settings)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-teal-600"
                            title="Download Invoice PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {can('payments', 'edit') && (
                            <button
                              type="button"
                              onClick={() => setInvoiceDialog({ open: true, mode: 'edit', invoice: inv })}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              title="Edit Invoice"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {can('payments', 'delete') && (
                            <button
                              type="button"
                              onClick={() => setDeleteInvId(inv.id)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">Expense ID</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Vendor / Supplier</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total Bill</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Pending</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      No supplier payments or expenses recorded.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs">{e.expenseCode}</td>
                      <td className="py-3 px-4 text-xs">{e.category}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{e.vendorName}</div>
                        <div className="text-xs font-mono text-slate-400">{e.bookingCode || 'General'}</div>
                      </td>
                      <td className="py-3 px-4 text-xs tabular-nums">{formatDate(e.dueDate)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{formatCurrency(e.amount)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600">
                        {formatCurrency(e.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-600">
                        {formatCurrency(e.pendingAmount)}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">{e.status}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {can('payments', 'edit') && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExp(e);
                              setExpForm({ ...e });
                              setExpModalOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {can('payments', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setDeleteExpId(e.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">Record Customer Payment / Refund</h3>
              <button type="button" onClick={() => setPayModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Transaction Type</label>
                <select
                  value={payForm.type}
                  onChange={(e) => setPayForm({ ...payForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="Customer Collection">Customer Collection</option>
                  <option value="Refund">Refund</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Select Booking *</label>
                <select
                  required
                  value={payForm.bookingId}
                  onChange={(e) => {
                    const b = bookings.find((x) => x.id === e.target.value);
                    setPayForm({
                      ...payForm,
                      bookingId: e.target.value,
                      amount: b?.remainingAmount || payForm.amount,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="">-- Choose Booking --</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bookingCode} · {b.customerName} (Due: {formatCurrency(b.remainingAmount)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Amount (₹ INR) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Payment Mode</label>
                  <select
                    value={payForm.mode}
                    onChange={(e) => setPayForm({ ...payForm, mode: e.target.value as PaymentMode })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Reference / UTR</label>
                  <input
                    type="text"
                    value={payForm.referenceNumber}
                    onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={payForm.paymentDate}
                    onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setPayModalOpen(false)} className="px-4 py-2 text-sm border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save & Update Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Expense Modal */}
      {expModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">{editingExp ? 'Edit Supplier Expense' : 'Add Supplier Expense'}</h3>
              <button type="button" onClick={() => setExpModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <select
                  value={expForm.category || 'Hotel Payment'}
                  onChange={(e) => setExpForm({ ...expForm, category: e.target.value as Expense['category'] })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  {EXPENSE_CATS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Vendor / Supplier Name *</label>
                <input
                  required
                  type="text"
                  value={expForm.vendorName || ''}
                  onChange={(e) => setExpForm({ ...expForm, vendorName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Linked Booking Code</label>
                  <input
                    type="text"
                    value={expForm.bookingCode || ''}
                    onChange={(e) => setExpForm({ ...expForm, bookingCode: e.target.value })}
                    placeholder="BK-2026-001"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={expForm.dueDate || todayISO()}
                    onChange={(e) => setExpForm({ ...expForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Total Amount (₹ INR) *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={expForm.amount ?? 0}
                    onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Paid Amount (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={expForm.paidAmount ?? 0}
                    onChange={(e) => setExpForm({ ...expForm, paidAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={expForm.notes || ''}
                  onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setExpModalOpen(false)} className="px-4 py-2 text-sm border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletePayId)}
        title="Delete Payment Record"
        message="Are you sure you want to delete this payment transaction?"
        confirmLabel="Delete"
        onCancel={() => setDeletePayId(null)}
        onConfirm={async () => {
          if (deletePayId) await deletePayment(deletePayId);
          setDeletePayId(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteExpId)}
        title="Delete Expense"
        message="Are you sure you want to delete this supplier expense?"
        confirmLabel="Delete"
        onCancel={() => setDeleteExpId(null)}
        onConfirm={async () => {
          if (deleteExpId) await deleteExpense(deleteExpId);
          setDeleteExpId(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteInvId)}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice record?"
        confirmLabel="Delete Invoice"
        onCancel={() => setDeleteInvId(null)}
        onConfirm={async () => {
          if (deleteInvId) await deleteInvoice(deleteInvId);
          setDeleteInvId(null);
        }}
      />

      <InvoiceModal
        open={invoiceDialog.open}
        initialMode={invoiceDialog.mode}
        invoice={invoiceDialog.invoice}
        onClose={() => setInvoiceDialog({ open: false, mode: 'edit' })}
      />
    </div>
  );
};
