import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightCircle,
  Calendar,
  Edit2,
  Eye,
  FileText,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useCRM } from '../../context/CRMContext';
import {
  BookingHotelSelection,
  Enquiry,
  EnquiryActivity,
  EnquirySource,
  EnquiryStatus,
  HotelCategory,
  HotelRegion,
} from '../../types/crm';
import {
  buildWhatsAppLink,
  formatCurrency,
  formatDate,
  formatTimestamp,
  isOverdueDate,
  todayISO,
} from '../../utils/formatters';
import {
  HOTEL_REGIONS,
  formatHotelLocation,
  getDestinationScopedHotels,
  inferRegionsFromDestination,
} from '../../utils/destinations';
import { Pagination, SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';

const SOURCES: EnquirySource[] = [
  'Website',
  'Facebook',
  'Instagram',
  'Google',
  'Referral',
  'Justdial',
  'Tour Travel World',
  'Walk-in',
  'Other',
];

const STATUSES: EnquiryStatus[] = [
  'New Enquiry',
  'Contacted',
  'Follow-up Required',
  'Quotation Sent',
  'Negotiation',
  'Booking Confirmed',
  'Lost',
  'Cancelled',
];

const HOTEL_CATS: HotelCategory[] = ['Standard', 'Deluxe', 'Premium', 'Luxury'];

const PAGE_SIZE = 10;

export const EnquiriesView: React.FC = () => {
  const {
    enquiries,
    employees,
    packages,
    hotels,
    vehicles,
    can,
    saveEnquiry,
    deleteEnquiry,
    addEnquiryActivity,
    convertEnquiryToBooking,
    saveFollowUp,
    setDraftQuoteEnquiry,
    setActiveModule,
    currentEmployee,
  } = useCRM();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [destFilter, setDestFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'budget' | 'followup'>('newest');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [activities, setActivities] = useState<EnquiryActivity[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<EnquiryActivity['type']>('Note');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<Enquiry | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<Partial<Enquiry>>({});
  const [convertRegionFilter, setConvertRegionFilter] = useState<HotelRegion[]>([]);
  const [convertSelectedHotels, setConvertSelectedHotels] = useState<BookingHotelSelection[]>([]);
  const [convertHotelPickerId, setConvertHotelPickerId] = useState('');
  const [convertForm, setConvertForm] = useState({
    packageId: '',
    hotelId: '',
    vehicleId: '',
    bookingAmount: 0,
    advanceReceived: 0,
    operationsManagerUid: '',
    specialNotes: '',
  });

  const convertScopedHotels = useMemo(
    () =>
      getDestinationScopedHotels(
        hotels,
        convertTarget?.destination,
        convertRegionFilter,
        true
      ),
    [hotels, convertTarget?.destination, convertRegionFilter]
  );

  // Subscribe to subcollection activities when detail drawer opens
  useEffect(() => {
    if (!selectedEnquiry) {
      setActivities([]);
      return;
    }
    const q = query(
      collection(db, 'enquiries', selectedEnquiry.id, 'activities'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EnquiryActivity));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `enquiries/${selectedEnquiry.id}/activities`)
    );
    return () => unsub();
  }, [selectedEnquiry]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = enquiries.filter((e) => {
      if (term) {
        const hay = `${e.enquiryCode} ${e.customerName} ${e.mobile} ${e.destination}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (statusFilter !== 'All' && e.status !== statusFilter) return false;
      if (sourceFilter !== 'All' && e.source !== sourceFilter) return false;
      if (destFilter && !e.destination.toLowerCase().includes(destFilter.toLowerCase())) return false;
      if (dateFilter && e.enquiryDate !== dateFilter) return false;
      if (
        overdueOnly &&
        (!e.followUpDate ||
          !isOverdueDate(e.followUpDate) ||
          ['Booking Confirmed', 'Lost', 'Cancelled'].includes(e.status))
      ) {
        return false;
      }
      return true;
    });

    if (sortBy === 'budget') {
      return [...list].sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0));
    }
    if (sortBy === 'followup') {
      return [...list].sort((a, b) => (a.followUpDate || '9999').localeCompare(b.followUpDate || '9999'));
    }
    return list;
  }, [enquiries, search, statusFilter, sourceFilter, destFilter, dateFilter, overdueOnly, sortBy]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const overdueCount = useMemo(
    () =>
      enquiries.filter(
        (e) =>
          e.followUpDate &&
          isOverdueDate(e.followUpDate) &&
          !['Booking Confirmed', 'Lost', 'Cancelled'].includes(e.status)
      ).length,
    [enquiries]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      customerName: '',
      mobile: '',
      whatsapp: '',
      email: '',
      source: 'Website',
      destination: '',
      startDate: '',
      endDate: '',
      adults: 2,
      children: 0,
      infants: 0,
      rooms: 1,
      hotelCategory: 'Deluxe',
      budget: 50000,
      preferredVehicle: 'Sedan',
      specialRequirements: '',
      assignedToUid: currentEmployee?.uid || '',
      assignedToName: currentEmployee?.name || '',
      enquiryDate: todayISO(),
      followUpDate: todayISO(),
      status: 'New Enquiry',
    });
    setFormOpen(true);
  };

  const openEdit = (e: Enquiry) => {
    setEditing(e);
    setForm({ ...e });
    setFormOpen(true);
  };

  const handleSaveForm = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.customerName?.trim() || !form.mobile?.trim() || !form.destination?.trim()) return;
    setSaving(true);
    try {
      const emp = employees.find((x) => x.uid === form.assignedToUid);
      await saveEnquiry(
        {
          ...form,
          assignedToName: emp?.name || form.assignedToName || currentEmployee?.name || 'Staff',
        },
        editing?.id
      );
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddActivity = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedEnquiry || !noteText.trim()) return;
    await addEnquiryActivity(selectedEnquiry.id, noteType, noteText.trim());
    setNoteText('');
  };

  const openConvertModal = (e: Enquiry) => {
    setConvertTarget(e);
    setConvertRegionFilter(inferRegionsFromDestination(e.destination));
    setConvertSelectedHotels([]);
    setConvertHotelPickerId('');
    setConvertForm({
      packageId: '',
      hotelId: '',
      vehicleId: '',
      bookingAmount: e.budget || 50000,
      advanceReceived: Math.round((e.budget || 50000) * 0.4),
      operationsManagerUid: currentEmployee?.uid || '',
      specialNotes: e.specialRequirements || '',
    });
  };

  const toggleConvertRegion = (region: HotelRegion) => {
    setConvertRegionFilter((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const handleAddConvertHotel = (hotelId: string) => {
    setConvertHotelPickerId('');
    if (!hotelId) return;
    const h = hotels.find((x) => x.id === hotelId);
    if (!h) return;
    setConvertSelectedHotels((prev) => {
      if (prev.some((item) => item.hotelId === h.id)) return prev;
      return [
        ...prev,
        {
          hotelId: h.id,
          hotelName: h.name,
          region: h.region,
          city: h.city || h.destination,
        },
      ];
    });
  };

  const handleConvertSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!convertTarget) return;
    setSaving(true);
    try {
      const pkg = packages.find((p) => p.id === convertForm.packageId);
      const primaryHotelId = convertSelectedHotels[0]?.hotelId || convertForm.hotelId || '';
      const hot = hotels.find((h) => h.id === primaryHotelId);
      const combinedHotelName =
        convertSelectedHotels.map((h) => h.hotelName).filter(Boolean).join(', ') ||
        hot?.name ||
        '';
      const veh = vehicles.find((v) => v.id === convertForm.vehicleId);
      const ops = employees.find((em) => em.uid === convertForm.operationsManagerUid);
      await convertEnquiryToBooking(convertTarget, {
        packageId: pkg?.id || '',
        packageName: pkg?.name || 'Custom Package',
        hotelId: primaryHotelId,
        hotelName: combinedHotelName,
        selectedHotels: convertSelectedHotels,
        vehicleId: veh?.id || '',
        vehicleDetails: veh ? `${veh.model} (${veh.registrationNumber})` : convertTarget.preferredVehicle || '',
        bookingAmount: Number(convertForm.bookingAmount || 0),
        advanceReceived: Number(convertForm.advanceReceived || 0),
        operationsManagerUid: ops?.uid || currentEmployee?.uid,
        operationsManagerName: ops?.name || currentEmployee?.name,
        specialNotes: convertForm.specialNotes,
      });
      setConvertTarget(null);
      setSelectedEnquiry(null);
    } finally {
      setSaving(false);
    }
  };

  const statusTextClass = (s: EnquiryStatus) => {
    if (s === 'Booking Confirmed') return 'text-emerald-700 dark:text-emerald-400 font-medium';
    if (s === 'Lost' || s === 'Cancelled') return 'text-red-600 dark:text-red-400';
    if (s === 'Follow-up Required' || s === 'Negotiation') return 'text-amber-700 dark:text-amber-400 font-medium';
    return 'text-teal-700 dark:text-teal-400 font-medium';
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, mobile, ENQ ID..."
            className="w-full sm:w-64"
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
          >
            <option value="All">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
          >
            <option value="All">All Sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={destFilter}
            onChange={(e) => {
              setDestFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Destination..."
            className="w-32 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
          />

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
            title="Filter by enquiry date"
          />

          <button
            type="button"
            onClick={() => {
              setOverdueOnly((v) => !v);
              setPage(1);
            }}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              overdueOnly
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Overdue ({overdueCount})
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
          >
            <option value="newest">Sort: Newest</option>
            <option value="budget">Sort: Highest Budget</option>
            <option value="followup">Sort: Follow-up Date</option>
          </select>
        </div>

        {can('enquiries', 'create') && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Enquiry
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Enquiry ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Destination & Dates</th>
                <th className="py-3 px-4">Pax / Category</th>
                <th className="py-3 px-4 text-right">Budget</th>
                <th className="py-3 px-4">Follow-up</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    No enquiries match the current filters.
                  </td>
                </tr>
              ) : (
                paged.map((e) => {
                  const overdue =
                    e.followUpDate &&
                    isOverdueDate(e.followUpDate) &&
                    !['Booking Confirmed', 'Lost', 'Cancelled'].includes(e.status);
                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div>{e.enquiryCode}</div>
                        <div className="text-[11px] text-slate-400">{e.source}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{e.customerName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {e.mobile}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-900 dark:text-slate-100">{e.destination}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatDate(e.startDate)} – {formatDate(e.endDate)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        <div>
                          {e.adults}A · {e.children || 0}C · {e.infants || 0}I
                        </div>
                        <div className="text-slate-400">
                          {e.rooms || 1} Rm · {e.hotelCategory}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(e.budget)}
                      </td>
                      <td className="py-3 px-4 text-xs tabular-nums">
                        <span className={overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                          {e.followUpDate ? formatDate(e.followUpDate) : '—'}
                          {overdue && ' (Overdue)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span className={statusTextClass(e.status)}>{e.status}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {e.assignedToName || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedEnquiry(e)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="View Details & History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <a
                            href={buildWhatsAppLink(
                              e.whatsapp || e.mobile,
                              `Hello ${e.customerName}, regarding your ${e.destination} enquiry (${e.enquiryCode}) with Azure Travel.`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-md text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                            title="WhatsApp Customer"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                          {can('enquiries', 'edit') && (
                            <button
                              type="button"
                              onClick={() => openEdit(e)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Enquiry"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {can('enquiries', 'delete') && (
                            <button
                              type="button"
                              onClick={() => setDeleteId(e.id)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Delete Enquiry"
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
        <Pagination
          currentPage={page}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Add / Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editing ? `Edit Enquiry (${editing.enquiryCode})` : 'New Customer Enquiry'}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveForm} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Customer Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={form.customerName || ''}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    required
                    type="text"
                    value={form.mobile || ''}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={form.whatsapp || ''}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Travel Source *
                  </label>
                  <select
                    value={form.source || 'Website'}
                    onChange={(e) => setForm({ ...form, source: e.target.value as EnquirySource })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Travel Destination *
                  </label>
                  <input
                    required
                    type="text"
                    value={form.destination || ''}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Travel Start Date
                  </label>
                  <input
                    type="date"
                    value={form.startDate || ''}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Travel End Date
                  </label>
                  <input
                    type="date"
                    value={form.endDate || ''}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Enquiry Date
                  </label>
                  <input
                    type="date"
                    value={form.enquiryDate || todayISO()}
                    onChange={(e) => setForm({ ...form, enquiryDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 sm:col-span-2 lg:col-span-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Adults</label>
                    <input
                      type="number"
                      min={1}
                      value={form.adults ?? 2}
                      onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Children</label>
                    <input
                      type="number"
                      min={0}
                      value={form.children ?? 0}
                      onChange={(e) => setForm({ ...form, children: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Infants</label>
                    <input
                      type="number"
                      min={0}
                      value={form.infants ?? 0}
                      onChange={(e) => setForm({ ...form, infants: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Rooms</label>
                    <input
                      type="number"
                      min={1}
                      value={form.rooms ?? 1}
                      onChange={(e) => setForm({ ...form, rooms: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Hotel Category
                  </label>
                  <select
                    value={form.hotelCategory || 'Deluxe'}
                    onChange={(e) => setForm({ ...form, hotelCategory: e.target.value as HotelCategory })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {HOTEL_CATS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Budget (₹ INR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.budget ?? 0}
                    onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Preferred Vehicle
                  </label>
                  <input
                    type="text"
                    value={form.preferredVehicle || ''}
                    onChange={(e) => setForm({ ...form, preferredVehicle: e.target.value })}
                    placeholder="e.g. Innova Crysta"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={form.followUpDate || ''}
                    onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Assigned Sales Executive
                  </label>
                  <select
                    value={form.assignedToUid || currentEmployee?.uid || ''}
                    onChange={(e) => setForm({ ...form, assignedToUid: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {employees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Enquiry Status
                  </label>
                  <select
                    value={form.status || 'New Enquiry'}
                    onChange={(e) => setForm({ ...form, status: e.target.value as EnquiryStatus })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Special Requirements
                </label>
                <textarea
                  rows={3}
                  value={form.specialRequirements || ''}
                  onChange={(e) => setForm({ ...form, specialRequirements: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Enquiry' : 'Save Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Slide-Over Drawer */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-teal-600 dark:text-teal-400">
                  {selectedEnquiry.enquiryCode} · {selectedEnquiry.source}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedEnquiry.customerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnquiry(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {can('quotations', 'create') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftQuoteEnquiry(selectedEnquiry);
                      setActiveModule('quotations');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:opacity-90"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Generate Quotation
                  </button>
                )}
                {can('bookings', 'create') && selectedEnquiry.status !== 'Booking Confirmed' && (
                  <button
                    type="button"
                    onClick={() => openConvertModal(selectedEnquiry)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    Convert to Booking
                  </button>
                )}
                {can('followups', 'create') && (
                  <button
                    type="button"
                    onClick={() =>
                      saveFollowUp({
                        title: `Follow up ${selectedEnquiry.customerName} (${selectedEnquiry.destination})`,
                        type: 'Enquiry Follow-up',
                        relatedEntityType: 'enquiry',
                        relatedEntityId: selectedEnquiry.id,
                        relatedEntityCode: selectedEnquiry.enquiryCode,
                        customerName: selectedEnquiry.customerName,
                        customerPhone: selectedEnquiry.mobile,
                        dueDate: selectedEnquiry.followUpDate || todayISO(),
                        priority: 'High',
                        assignedToUid: selectedEnquiry.assignedToUid,
                        assignedToName: selectedEnquiry.assignedToName,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Add Reminder
                  </button>
                )}
              </div>

              {/* Enquiry Summary Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div>
                  <span className="text-slate-400">Destination</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">{selectedEnquiry.destination}</div>
                </div>
                <div>
                  <span className="text-slate-400">Travel Dates</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                    {formatDate(selectedEnquiry.startDate)} – {formatDate(selectedEnquiry.endDate)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Contact</span>
                  <div className="font-medium font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedEnquiry.mobile}
                  </div>
                  {selectedEnquiry.email && <div className="text-slate-500">{selectedEnquiry.email}</div>}
                </div>
                <div>
                  <span className="text-slate-400">Budget & Category</span>
                  <div className="font-medium font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatCurrency(selectedEnquiry.budget)} · {selectedEnquiry.hotelCategory}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Special Requirements</span>
                  <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {selectedEnquiry.specialRequirements || 'None noted'}
                  </div>
                </div>
              </div>

              {/* Communication History & Notes */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Communication History & Internal Notes
                </h4>
                <form onSubmit={handleAddActivity} className="flex gap-2 mb-4">
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as any)}
                    className="px-2.5 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="Note">Note</option>
                    <option value="Call">Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                  </select>
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Log a call, WhatsApp summary, or internal note..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    aria-label="Add activity note"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-xs text-slate-500">No communication notes recorded yet.</p>
                  ) : (
                    activities.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {a.type} · {a.authorName}
                          </span>
                          <span className="tabular-nums">{formatTimestamp(a.createdAt)}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{a.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Booking Modal */}
      {convertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                Convert {convertTarget.enquiryCode} to Confirmed Booking
              </h3>
              <button type="button" onClick={() => setConvertTarget(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConvertSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Tour Package</label>
                <select
                  value={convertForm.packageId}
                  onChange={(e) => {
                    const pkg = packages.find((p) => p.id === e.target.value);
                    setConvertForm({ ...convertForm, packageId: e.target.value });
                    if (pkg?.selectedHotelIds && pkg.selectedHotelIds.length > 0 && convertSelectedHotels.length === 0) {
                      const mapped = pkg.selectedHotelIds
                        .map((id) => hotels.find((h) => h.id === id))
                        .filter((h): h is NonNullable<typeof h> => Boolean(h))
                        .map((h) => ({
                          hotelId: h.id,
                          hotelName: h.name,
                          region: h.region,
                          city: h.city || h.destination,
                        }));
                      if (mapped.length > 0) setConvertSelectedHotels(mapped);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="">Custom Package</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.price)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                    Partner Hotels ({convertScopedHotels.isRegionScoped ? convertScopedHotels.activeRegions.join(', ') : 'All Target Regions'})
                  </label>
                  <div className="flex items-center gap-1">
                    {HOTEL_REGIONS.map((reg) => {
                      const active = convertRegionFilter.includes(reg);
                      return (
                        <button
                          key={reg}
                          type="button"
                          onClick={() => toggleConvertRegion(reg)}
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
                  </div>
                </div>
                <select
                  value={convertHotelPickerId}
                  onChange={(e) => handleAddConvertHotel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="">+ Add Partner Hotel...</option>
                  {convertScopedHotels.scopedHotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} — {formatHotelLocation(h)} ({h.category})
                    </option>
                  ))}
                </select>
                {convertSelectedHotels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {convertSelectedHotels.map((sh, idx) => (
                      <span
                        key={`${sh.hotelId || sh.hotelName}-${idx}`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                      >
                        <span className="font-medium">{sh.hotelName}</span>
                        {sh.city && <span className="text-[11px] text-slate-400">({sh.city})</span>}
                        <button
                          type="button"
                          onClick={() =>
                            setConvertSelectedHotels((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Assigned Vehicle</label>
                <select
                  value={convertForm.vehicleId}
                  onChange={(e) => setConvertForm({ ...convertForm, vehicleId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.model} ({v.registrationNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Total Booking Amount (₹ INR) *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={convertForm.bookingAmount}
                    onChange={(e) => setConvertForm({ ...convertForm, bookingAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Advance Received (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={convertForm.advanceReceived}
                    onChange={(e) => setConvertForm({ ...convertForm, advanceReceived: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Operations Manager</label>
                <select
                  value={convertForm.operationsManagerUid}
                  onChange={(e) => setConvertForm({ ...convertForm, operationsManagerUid: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  {employees.map((emp) => (
                    <option key={emp.uid} value={emp.uid}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConvertTarget(null)}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
                >
                  {saving ? 'Converting...' : 'Confirm Conversion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Enquiry"
        message="Are you sure you want to permanently delete this enquiry record?"
        confirmLabel="Delete Enquiry"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteEnquiry(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
};
