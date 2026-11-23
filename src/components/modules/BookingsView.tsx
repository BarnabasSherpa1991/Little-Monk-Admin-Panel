import React, { useMemo, useState } from 'react';
import { Download, Edit2, Plus, Trash2, Wallet, X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { Booking, BookingStatus, Payment } from '../../types/crm';
import { formatCurrency, formatDate, todayISO } from '../../utils/formatters';
import { generateBookingVoucherPDF } from '../../utils/pdfAndExport';
import { Pagination, SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';

const BOOKING_STATUSES: BookingStatus[] = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
const PAGE_SIZE = 10;

export const BookingsView: React.FC = () => {
  const {
    bookings,
    packages,
    hotels,
    vehicles,
    employees,
    settings,
    can,
    saveBooking,
    deleteBooking,
    recordPayment,
    currentEmployee,
  } = useCRM();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState<Partial<Booking>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  const [payTarget, setPayTarget] = useState<Booking | null>(null);
  const [payForm, setPayForm] = useState({
    amount: 0,
    mode: 'UPI' as Payment['mode'],
    referenceNumber: '',
    paymentDate: todayISO(),
    notes: '',
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'All' && b.bookingStatus !== statusFilter) return false;
      if (term) {
        const hay = `${b.bookingCode} ${b.customerName} ${b.destination} ${b.packageName || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [bookings, search, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      destination: '',
      startDate: todayISO(),
      endDate: todayISO(),
      adults: 2,
      children: 0,
      infants: 0,
      packageId: '',
      packageName: '',
      hotelId: '',
      hotelName: '',
      vehicleId: '',
      vehicleDetails: '',
      bookingAmount: 50000,
      advanceReceived: 0,
      bookingStatus: 'Confirmed',
      operationsManagerUid: currentEmployee?.uid || '',
      operationsManagerName: currentEmployee?.name || '',
      specialNotes: '',
    });
    setFormOpen(true);
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.customerName?.trim() || !form.destination?.trim()) return;
    const pkg = packages.find((p) => p.id === form.packageId);
    const hot = hotels.find((h) => h.id === form.hotelId);
    const veh = vehicles.find((v) => v.id === form.vehicleId);
    const ops = employees.find((e) => e.uid === form.operationsManagerUid);

    const amt = Number(form.bookingAmount ?? 0);
    const adv = Number(form.advanceReceived ?? 0);
    const rem = Math.max(0, amt - adv);
    const pStatus: Booking['paymentStatus'] = adv <= 0 ? 'Unpaid' : rem === 0 ? 'Paid' : 'Partial';

    await saveBooking(
      {
        ...form,
        packageName: pkg?.name || form.packageName || '',
        hotelName: hot?.name || form.hotelName || '',
        vehicleDetails: veh ? `${veh.model} (${veh.registrationNumber})` : form.vehicleDetails || '',
        operationsManagerName: ops?.name || form.operationsManagerName || '',
        bookingAmount: amt,
        advanceReceived: adv,
        remainingAmount: rem,
        paymentStatus: pStatus,
      },
      editing?.id
    );
    setFormOpen(false);
  };

  const handleRecordPayment = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!payTarget || payForm.amount <= 0) return;
    const gstPct = settings?.defaultGstPercent ?? 5;
    await recordPayment({
      type: 'Customer Collection',
      booking: payTarget,
      amount: Number(payForm.amount),
      gstComponent: Math.round((Number(payForm.amount) * gstPct) / (100 + gstPct)),
      mode: payForm.mode,
      referenceNumber: payForm.referenceNumber,
      paymentDate: payForm.paymentDate,
      notes: payForm.notes,
    });
    setPayTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search booking code, customer, destination..."
            className="w-full sm:w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="All">All Booking Statuses</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {can('bookings', 'create') && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Booking
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Booking ID</th>
                <th className="py-3 px-4">Customer & Pax</th>
                <th className="py-3 px-4">Destination & Dates</th>
                <th className="py-3 px-4">Hotel & Vehicle</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Received / Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                paged.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{b.bookingCode}</div>
                      <div className="text-slate-400">{b.operationsManagerName || 'Ops'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{b.customerName}</div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {b.adults}A · {b.children || 0}C · {b.customerPhone || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{b.destination}</div>
                      <div className="text-xs text-slate-400 tabular-nums">
                        {formatDate(b.startDate)} – {formatDate(b.endDate)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      <div className="truncate max-w-[180px]">{b.hotelName || b.packageName || '—'}</div>
                      <div className="text-slate-400 truncate max-w-[180px]">{b.vehicleDetails || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                      {formatCurrency(b.bookingAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      <div className="text-emerald-600 dark:text-emerald-400">
                        Paid: {formatCurrency(b.advanceReceived)}
                      </div>
                      <div className="text-amber-600 dark:text-amber-400">
                        Due: {formatCurrency(b.remainingAmount)} ({b.paymentStatus})
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium">
                      <span
                        className={
                          b.bookingStatus === 'Cancelled'
                            ? 'text-red-600 dark:text-red-400'
                            : b.bookingStatus === 'Completed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-teal-700 dark:text-teal-400'
                        }
                      >
                        {b.bookingStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => generateBookingVoucherPDF(b, settings)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Download Booking Voucher PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {can('payments', 'create') && b.remainingAmount > 0 && b.bookingStatus !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayTarget(b);
                              setPayForm({
                                amount: b.remainingAmount,
                                mode: 'UPI',
                                referenceNumber: '',
                                paymentDate: todayISO(),
                                notes: '',
                              });
                            }}
                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Record Payment"
                          >
                            <Wallet className="w-4 h-4" />
                          </button>
                        )}
                        {can('bookings', 'edit') && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(b);
                              setForm({ ...b });
                              setFormOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            title="Edit Booking"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {can('bookings', 'edit') && b.bookingStatus !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(b)}
                            className="px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                          >
                            Cancel
                          </button>
                        )}
                        {can('bookings', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setDeleteId(b.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600"
                            title="Delete Booking"
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
        </div>
        <Pagination currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Add / Edit Booking Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {editing ? `Edit Booking (${editing.bookingCode})` : 'New Tour Booking'}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Customer Name *</label>
                  <input
                    required
                    type="text"
                    value={form.customerName || ''}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.customerPhone || ''}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={form.customerEmail || ''}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Destination *</label>
                  <input
                    required
                    type="text"
                    value={form.destination || ''}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Start Date *</label>
                  <input
                    required
                    type="date"
                    value={form.startDate || ''}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">End Date *</label>
                  <input
                    required
                    type="date"
                    value={form.endDate || ''}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Package</label>
                  <select
                    value={form.packageId || ''}
                    onChange={(e) => setForm({ ...form, packageId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="">Custom Package</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Hotel</label>
                  <select
                    value={form.hotelId || ''}
                    onChange={(e) => setForm({ ...form, hotelId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="">Select Hotel</option>
                    {hotels.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Vehicle</label>
                  <select
                    value={form.vehicleId || ''}
                    onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="">Select Vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.model} ({v.registrationNumber})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Booking Amount (INR) *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.bookingAmount ?? 0}
                    onChange={(e) => setForm({ ...form, bookingAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Advance Received (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.advanceReceived ?? 0}
                    onChange={(e) => setForm({ ...form, advanceReceived: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Booking Status</label>
                  <select
                    value={form.bookingStatus || 'Confirmed'}
                    onChange={(e) => setForm({ ...form, bookingStatus: e.target.value as BookingStatus })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {BOOKING_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Operations Manager</label>
                  <select
                    value={form.operationsManagerUid || ''}
                    onChange={(e) => setForm({ ...form, operationsManagerUid: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {employees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Special Notes</label>
                <textarea
                  rows={2}
                  value={form.specialNotes || ''}
                  onChange={(e) => setForm({ ...form, specialNotes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Record Payment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">Record Payment — {payTarget.bookingCode}</h3>
              <button type="button" onClick={() => setPayTarget(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="text-xs text-slate-500">
                Remaining balance: <strong className="font-mono text-amber-600">{formatCurrency(payTarget.remainingAmount)}</strong>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Amount Received (INR) *</label>
                <input
                  required
                  type="number"
                  min={1}
                  max={payTarget.remainingAmount}
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Mode</label>
                  <select
                    value={payForm.mode}
                    onChange={(e) => setPayForm({ ...payForm, mode: e.target.value as Payment['mode'] })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit/Debit Card">Credit/Debit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Payment Gateway">Payment Gateway</option>
                  </select>
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
                <label className="block text-xs font-medium mb-1">Reference / UTR Number</label>
                <input
                  type="text"
                  value={payForm.referenceNumber}
                  onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setPayTarget(null)} className="px-4 py-2 text-sm border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Booking"
        message={`Are you sure you want to mark booking ${cancelTarget?.bookingCode} as Cancelled?`}
        confirmLabel="Cancel Booking"
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (cancelTarget) {
            await saveBooking(
              { bookingStatus: 'Cancelled', bookingCode: cancelTarget.bookingCode, customerName: cancelTarget.customerName },
              cancelTarget.id
            );
          }
          setCancelTarget(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Booking"
        message="Are you sure you want to permanently delete this booking record?"
        confirmLabel="Delete Booking"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteBooking(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
};
