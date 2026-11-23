import React, { useMemo, useState } from 'react';
import { Download, Edit2, FileText, Plus, Trash2, Wallet, X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { Booking, BookingHotelSelection, BookingStatus, HotelRegion, Invoice, Payment, VehicleCategory } from '../../types/crm';
import { formatCurrency, formatDate, todayISO } from '../../utils/formatters';
import {
  HOTEL_REGIONS,
  formatHotelLocation,
  getDestinationScopedHotels,
  inferRegionsFromDestination,
} from '../../utils/destinations';
import {
  getVehicleClassification,
  LUXURY_VEHICLE_CATEGORIES,
  NON_LUXURY_VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_DEFAULTS,
} from '../../utils/vehicles';
import { generateBookingVoucherPDF } from '../../utils/pdfAndExport';
import { Pagination, SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { InvoiceModal } from '../common/InvoiceModal';

const BOOKING_STATUSES: BookingStatus[] = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
const PAGE_SIZE = 10;

export const BookingsView: React.FC = () => {
  const {
    bookings,
    packages,
    hotels,
    vehicles,
    employees,
    invoices,
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
  const [hotelRegionFilter, setHotelRegionFilter] = useState<HotelRegion[]>([]);
  const [selectedHotels, setSelectedHotels] = useState<BookingHotelSelection[]>([]);
  const [hotelPickerId, setHotelPickerId] = useState('');
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
  const [invoiceDialog, setInvoiceDialog] = useState<{
    open: boolean;
    mode: 'edit' | 'preview';
    invoice?: Invoice | null;
    booking?: Booking | null;
  }>({ open: false, mode: 'edit' });

  const scopedHotelsInfo = useMemo(
    () => getDestinationScopedHotels(hotels, form.destination, hotelRegionFilter, true),
    [hotels, form.destination, hotelRegionFilter]
  );

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
    setHotelRegionFilter([]);
    setSelectedHotels([]);
    setHotelPickerId('');
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
      selectedHotels: [],
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

  const openEdit = (b: Booking) => {
    setEditing(b);
    setForm({ ...b });
    const initialRegions = inferRegionsFromDestination(b.destination);
    setHotelRegionFilter(initialRegions);
    if (b.selectedHotels && b.selectedHotels.length > 0) {
      setSelectedHotels(b.selectedHotels);
    } else if (b.hotelId) {
      const matched = hotels.find((h) => h.id === b.hotelId);
      setSelectedHotels(
        matched
          ? [
              {
                hotelId: matched.id,
                hotelName: matched.name,
                region: matched.region,
                city: matched.city || matched.destination,
              },
            ]
          : b.hotelName
          ? [{ hotelId: b.hotelId, hotelName: b.hotelName }]
          : []
      );
    } else {
      setSelectedHotels([]);
    }
    setHotelPickerId('');
    setFormOpen(true);
  };

  const toggleRegionFilter = (region: HotelRegion) => {
    setHotelRegionFilter((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const handleAddHotelToBooking = (hotelId: string) => {
    setHotelPickerId('');
    if (!hotelId) return;
    const h = hotels.find((x) => x.id === hotelId);
    if (!h) return;
    setSelectedHotels((prev) => {
      if (prev.some((item) => item.hotelId === h.id)) return prev;
      const next = [
        ...prev,
        {
          hotelId: h.id,
          hotelName: h.name,
          region: h.region,
          city: h.city || h.destination,
        },
      ];
      setForm((f) => ({
        ...f,
        hotelId: next[0]?.hotelId || '',
        hotelName: next.map((x) => x.hotelName).join(', '),
      }));
      return next;
    });
  };

  const handleRemoveHotelFromBooking = (idx: number) => {
    setSelectedHotels((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setForm((f) => ({
        ...f,
        hotelId: next[0]?.hotelId || '',
        hotelName: next.map((x) => x.hotelName).join(', '),
      }));
      return next;
    });
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.customerName?.trim() || !form.destination?.trim()) return;
    const pkg = packages.find((p) => p.id === form.packageId);
    const veh = vehicles.find((v) => v.id === form.vehicleId);
    const ops = employees.find((e) => e.uid === form.operationsManagerUid);

    const normalizedHotels = selectedHotels.slice(0, 20);
    const primaryHotelId = normalizedHotels[0]?.hotelId || form.hotelId || '';
    const hot = hotels.find((h) => h.id === primaryHotelId);
    const combinedHotelName =
      normalizedHotels.map((h) => h.hotelName).filter(Boolean).join(', ') ||
      hot?.name ||
      form.hotelName ||
      '';

    const amt = Number(form.bookingAmount ?? 0);
    const adv = Number(form.advanceReceived ?? 0);
    const rem = Math.max(0, amt - adv);
    const pStatus: Booking['paymentStatus'] = adv <= 0 ? 'Unpaid' : rem === 0 ? 'Paid' : 'Partial';

    await saveBooking(
      {
        ...form,
        packageName: pkg?.name || form.packageName || '',
        hotelId: primaryHotelId,
        hotelName: combinedHotelName,
        selectedHotels: normalizedHotels,
        vehicleDetails: veh ? `${veh.category} · ${veh.model} (${veh.registrationNumber})` : form.vehicleDetails || '',
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
                        {(() => {
                          const existingInv = invoices.find(
                            (inv) => inv.bookingId === b.id && inv.status !== 'Cancelled'
                          );
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                setInvoiceDialog(
                                  existingInv
                                    ? { open: true, mode: 'preview', invoice: existingInv, booking: b }
                                    : { open: true, mode: 'edit', invoice: null, booking: b }
                                )
                              }
                              className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                existingInv
                                  ? 'text-teal-600 dark:text-teal-400'
                                  : 'text-slate-500 hover:text-teal-600'
                              }`}
                              title={existingInv ? `View Invoice (${existingInv.invoiceCode})` : 'Generate Invoice'}
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          );
                        })()}
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
                            onClick={() => openEdit(b)}
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
                    onChange={(e) => {
                      const pkg = packages.find((p) => p.id === e.target.value);
                      const nextDest = !form.destination && pkg ? pkg.destination : form.destination || '';
                      setForm({
                        ...form,
                        packageId: e.target.value,
                        destination: nextDest,
                      });
                      if (pkg?.selectedHotelIds && pkg.selectedHotelIds.length > 0 && selectedHotels.length === 0) {
                        const mapped = pkg.selectedHotelIds
                          .map((id) => hotels.find((h) => h.id === id))
                          .filter((h): h is NonNullable<typeof h> => Boolean(h))
                          .map((h) => ({
                            hotelId: h.id,
                            hotelName: h.name,
                            region: h.region,
                            city: h.city || h.destination,
                          }));
                        if (mapped.length > 0) {
                          setSelectedHotels(mapped);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="">Custom Package</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Vehicle</label>
                  <select
                    value={form.vehicleId || (form.vehicleDetails?.startsWith('[Category] ') ? `cat:${form.vehicleDetails.replace('[Category] ', '').split(' · ')[0]}` : '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('cat:')) {
                        const cat = val.replace('cat:', '') as VehicleCategory;
                        const tier = getVehicleClassification(cat);
                        const def = VEHICLE_CATEGORY_DEFAULTS[cat];
                        setForm({
                          ...form,
                          vehicleId: '',
                          vehicleDetails: `[Category] ${cat} · ${def?.suggestedModel || cat} (${tier})`,
                        });
                      } else {
                        const veh = vehicles.find((v) => v.id === val);
                        setForm({
                          ...form,
                          vehicleId: val,
                          vehicleDetails: veh ? `${veh.category} · ${veh.model} (${veh.registrationNumber})` : '',
                        });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="">Select Vehicle or Category</option>
                    <optgroup label="Non-Luxury Vehicle Fleet">
                      {vehicles
                        .filter((v) => getVehicleClassification(v.category) === 'Non-Luxury')
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.category} · {v.model} ({v.registrationNumber})
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Luxury Vehicle Fleet">
                      {vehicles
                        .filter((v) => getVehicleClassification(v.category) === 'Luxury')
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.category} · {v.model} ({v.registrationNumber})
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Non-Luxury Vehicle Category (Unassigned Reg #)">
                      {NON_LUXURY_VEHICLE_CATEGORIES.map((c) => (
                        <option key={`cat-${c}`} value={`cat:${c}`}>
                          {c} (Non-Luxury)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Luxury Vehicle Category (Unassigned Reg #)">
                      {LUXURY_VEHICLE_CATEGORIES.map((c) => (
                        <option key={`cat-${c}`} value={`cat:${c}`}>
                          {c} (Luxury)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Booking Amount (₹ INR) *</label>
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
                  <label className="block text-xs font-medium mb-1">Advance Received (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.advanceReceived ?? 0}
                    onChange={(e) => setForm({ ...form, advanceReceived: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        Destination Hotels (Sikkim · Darjeeling · Bhutan)
                      </span>
                      <span className="ml-2 text-[11px] text-slate-500">
                        {scopedHotelsInfo.isRegionScoped
                          ? `Filtered to ${scopedHotelsInfo.activeRegions.join(', ')}`
                          : 'Showing all active target-region hotels'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {HOTEL_REGIONS.map((reg) => {
                        const active = hotelRegionFilter.includes(reg);
                        return (
                          <button
                            key={reg}
                            type="button"
                            onClick={() => toggleRegionFilter(reg)}
                            className={`px-2 py-0.5 text-[11px] font-medium rounded border cursor-pointer ${
                              active
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {reg}
                          </button>
                        );
                      })}
                      {hotelRegionFilter.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setHotelRegionFilter([])}
                          className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-1"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <select
                    value={hotelPickerId}
                    onChange={(e) => handleAddHotelToBooking(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="">+ Add Partner Hotel for this Booking...</option>
                    {scopedHotelsInfo.scopedHotels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} — {formatHotelLocation(h)} ({h.category} · {formatCurrency(h.contractRate)})
                      </option>
                    ))}
                  </select>

                  {selectedHotels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedHotels.map((sh, idx) => (
                        <span
                          key={`${sh.hotelId || sh.hotelName}-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-100">{sh.hotelName}</span>
                          {(sh.city || sh.region) && (
                            <span className="text-[11px] text-slate-400">
                              ({[sh.city, sh.region].filter(Boolean).join(', ')})
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveHotelFromBooking(idx)}
                            className="text-slate-400 hover:text-red-600"
                            title="Remove hotel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : form.hotelName ? (
                    <div className="text-xs text-slate-500">
                      Legacy/Custom hotel reference: <span className="font-medium text-slate-700 dark:text-slate-300">{form.hotelName}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      Select one or more hotels across Sikkim, Darjeeling, or Bhutan for combo or single-destination trips.
                    </div>
                  )}
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
                <label className="block text-xs font-medium mb-1">Amount Received (₹ INR) *</label>
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

      <InvoiceModal
        open={invoiceDialog.open}
        initialMode={invoiceDialog.mode}
        invoice={invoiceDialog.invoice}
        booking={invoiceDialog.booking}
        onClose={() => setInvoiceDialog({ open: false, mode: 'edit' })}
      />
    </div>
  );
};
