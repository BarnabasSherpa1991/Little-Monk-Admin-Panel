import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightCircle,
  CopyPlus,
  Download,
  Edit2,
  Eye,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import {
  BookingHotelSelection,
  HotelRegion,
  Quotation,
  QuotationHotelItem,
  QuotationStatus,
  QuotationTransportItem,
} from '../../types/crm';
import { buildWhatsAppLink, formatCurrency, formatDate } from '../../utils/formatters';
import {
  getDestinationScopedHotels,
  HOTEL_REGIONS,
  inferRegionsFromDestination,
} from '../../utils/destinations';
import { generateQuotationPDF } from '../../utils/pdfAndExport';
import { Pagination, SearchInput } from '../common/DataTableToolbar';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ConfirmDialog } from '../common/ConfirmDialog';

const QUOTE_STATUSES: QuotationStatus[] = ['Draft', 'Sent', 'Viewed', 'Revised', 'Accepted', 'Rejected'];
const PAGE_SIZE = 10;

export const QuotationsView: React.FC = () => {
  const {
    quotations,
    enquiries,
    hotels,
    vehicles,
    settings,
    can,
    saveQuotation,
    deleteQuotation,
    saveBooking,
    draftQuoteEnquiry,
    setDraftQuoteEnquiry,
    currentEmployee,
    toast,
  } = useCRM();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [page, setPage] = useState(1);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isRevisionMode, setIsRevisionMode] = useState(false);

  const [form, setForm] = useState<Partial<Quotation>>({});
  const [hotelItems, setHotelItems] = useState<QuotationHotelItem[]>([]);
  const [transportItems, setTransportItems] = useState<QuotationTransportItem[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<HotelRegion[]>([]);
  const [rateTier, setRateTier] = useState<'contract' | 'seasonal' | 'peak' | 'offSeason'>('contract');

  // Auto-open builder if handed off from Enquiries module
  useEffect(() => {
    if (draftQuoteEnquiry) {
      setEditing(null);
      setIsRevisionMode(false);
      setForm({
        enquiryId: draftQuoteEnquiry.id,
        customerId: draftQuoteEnquiry.customerId || '',
        customerName: draftQuoteEnquiry.customerName,
        customerEmail: draftQuoteEnquiry.email || '',
        customerPhone: draftQuoteEnquiry.mobile,
        destination: draftQuoteEnquiry.destination,
        startDate: draftQuoteEnquiry.startDate || '',
        endDate: draftQuoteEnquiry.endDate || '',
        paxSummary: `${draftQuoteEnquiry.adults} Adults, ${draftQuoteEnquiry.children || 0} Children`,
        sightseeingCharge: 12000,
        mealsCharge: 6000,
        otherExpenses: 2500,
        markupPercent: 10,
        discountAmount: 0,
        gstPercent: settings?.defaultGstPercent ?? 5,
        inclusions: 'Hotel accommodation, daily breakfast, private sightseeing transfers, taxes.',
        exclusions: 'Airfare, personal expenses, optional activities.',
        termsAndConditions: settings?.quotationTerms || '',
        status: 'Draft',
        version: 1,
      });
      setHotelItems([]);
      setTransportItems([]);
      setSelectedRegions(inferRegionsFromDestination(draftQuoteEnquiry.destination));
      setBuilderOpen(true);
      setDraftQuoteEnquiry(null);
    }
  }, [draftQuoteEnquiry, setDraftQuoteEnquiry, settings]);

  const hotelScope = useMemo(
    () => getDestinationScopedHotels(hotels, form.destination, selectedRegions, true),
    [hotels, form.destination, selectedRegions]
  );

  const totals = useMemo(() => {
    const hotelTotal = hotelItems.reduce((s, h) => s + Number(h.total || 0), 0);
    const transportTotal = transportItems.reduce((s, t) => s + Number(t.total || 0), 0);
    const sightseeing = Number(form.sightseeingCharge || 0);
    const meals = Number(form.mealsCharge || 0);
    const other = Number(form.otherExpenses || 0);
    const subtotal = hotelTotal + transportTotal + sightseeing + meals + other;
    const markupPct = Number(form.markupPercent || 0);
    const markupAmount = Math.round((subtotal * markupPct) / 100);
    const discountAmount = Number(form.discountAmount || 0);
    const taxable = Math.max(0, subtotal + markupAmount - discountAmount);
    const gstPct = Number(form.gstPercent ?? settings?.defaultGstPercent ?? 5);
    const gstAmount = Math.round((taxable * gstPct) / 100);
    const totalCost = taxable + gstAmount;
    return { subtotal, markupAmount, gstAmount, totalCost };
  }, [hotelItems, transportItems, form, settings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotations.filter((q) => {
      if (statusFilter !== 'All' && q.status !== statusFilter) return false;
      if (term) {
        const hay = `${q.quoteCode} ${q.customerName} ${q.destination}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [quotations, search, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const openNewBuilder = () => {
    setEditing(null);
    setIsRevisionMode(false);
    setForm({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      destination: '',
      startDate: '',
      endDate: '',
      paxSummary: '2 Adults',
      sightseeingCharge: 10000,
      mealsCharge: 5000,
      otherExpenses: 0,
      markupPercent: 10,
      discountAmount: 0,
      gstPercent: settings?.defaultGstPercent ?? 5,
      inclusions: 'Accommodation with breakfast, private vehicle transfers, driver allowance.',
      exclusions: 'Airfare, monument entrance tickets, personal tips.',
      termsAndConditions: settings?.quotationTerms || '',
      status: 'Draft',
      version: 1,
    });
    setHotelItems([]);
    setTransportItems([]);
    setSelectedRegions([]);
    setBuilderOpen(true);
  };

  const openEditBuilder = (q: Quotation, revision = false) => {
    setEditing(revision ? null : q);
    setIsRevisionMode(revision);
    setForm({
      ...q,
      version: revision ? Number(q.version || 1) + 1 : q.version,
      status: revision ? 'Revised' : q.status,
    });
    setHotelItems(q.hotelItems || []);
    setTransportItems(q.transportItems || []);
    setSelectedRegions(inferRegionsFromDestination(q.destination));
    setBuilderOpen(true);
  };

  const importFromEnquiry = (enqId: string) => {
    const e = enquiries.find((x) => x.id === enqId);
    if (!e) return;
    setForm((prev) => ({
      ...prev,
      enquiryId: e.id,
      customerId: e.customerId || '',
      customerName: e.customerName,
      customerEmail: e.email || '',
      customerPhone: e.mobile,
      destination: e.destination,
      startDate: e.startDate || '',
      endDate: e.endDate || '',
      paxSummary: `${e.adults} Adults, ${e.children || 0} Children`,
    }));
    setSelectedRegions(inferRegionsFromDestination(e.destination));
  };

  const addHotelRow = (hotelId?: string) => {
    const h = hotels.find((x) => x.id === hotelId);
    let rate = 6500;
    if (h) {
      if (rateTier === 'seasonal') rate = Number(h.seasonalRate || h.contractRate || 0);
      else if (rateTier === 'peak') rate = Number(h.peakSeasonRate || h.seasonalRate || h.contractRate || 0);
      else if (rateTier === 'offSeason') rate = Number(h.offSeasonRate || h.contractRate || 0);
      else rate = Number(h.contractRate || 0);
    }
    setHotelItems([
      ...hotelItems,
      {
        hotelId: h?.id || '',
        hotelName: h?.name || 'Custom Hotel',
        region: h?.region || '',
        city: h?.city || '',
        roomType: h?.roomTypes?.[0] || 'Deluxe Room',
        mealPlan: h?.mealPlans?.[0] || 'CP',
        nights: 3,
        rooms: 1,
        ratePerNight: rate,
        total: rate * 3 * 1,
      },
    ]);
  };

  const addTransportRow = (vehicleId?: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    const rate = v ? v.perDayRate : 3800;
    setTransportItems([
      ...transportItems,
      {
        vehicleId: v?.id || '',
        vehicleCategory: v?.category || 'Sedan',
        vehicleModel: v?.model || 'Private Sedan',
        days: 4,
        ratePerDay: rate,
        total: rate * 4,
      },
    ]);
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.customerName?.trim() || !form.destination?.trim()) return;
    await saveQuotation(
      {
        ...form,
        hotelItems: hotelItems.slice(0, 20),
        transportItems: transportItems.slice(0, 20),
        subtotal: totals.subtotal,
        markupAmount: totals.markupAmount,
        gstAmount: totals.gstAmount,
        totalCost: totals.totalCost,
        assignedToUid: form.assignedToUid || currentEmployee?.uid,
      },
      editing?.id
    );
    setBuilderOpen(false);
  };

  const convertQuoteToBooking = async (q: Quotation) => {
    const selectedHotels: BookingHotelSelection[] = (q.hotelItems || []).map((hi) => ({
      hotelId: hi.hotelId || '',
      hotelName: hi.hotelName,
      region: hi.region || '',
      city: hi.city || '',
    }));
    await saveBooking({
      enquiryId: q.enquiryId || '',
      quotationId: q.id,
      customerId: q.customerId || '',
      customerName: q.customerName,
      customerPhone: q.customerPhone || '',
      customerEmail: q.customerEmail || '',
      destination: q.destination,
      startDate: q.startDate || new Date().toISOString().slice(0, 10),
      endDate: q.endDate || new Date().toISOString().slice(0, 10),
      adults: 2,
      hotelId: selectedHotels[0]?.hotelId || '',
      hotelName: selectedHotels.map((h) => h.hotelName).filter(Boolean).join(', '),
      selectedHotels,
      vehicleDetails: q.transportItems?.[0]?.vehicleModel || '',
      bookingAmount: q.totalCost,
      advanceReceived: 0,
      bookingStatus: 'Confirmed',
    });
    if (q.status !== 'Accepted') {
      await saveQuotation({ status: 'Accepted' }, q.id);
    }
    toast('success', `Booking created from ${q.quoteCode}.`);
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
            placeholder="Search quote code, customer, destination..."
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
            <option value="All">All Statuses</option>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {can('quotations', 'create') && (
          <button
            type="button"
            onClick={openNewBuilder}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Quotation
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Quote ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Destination & Dates</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">GST</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No quotations created yet.
                  </td>
                </tr>
              ) : (
                paged.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{q.quoteCode}</div>
                      <div className="text-slate-400">Version {q.version}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{q.customerName}</div>
                      <div className="text-xs text-slate-500">{q.paxSummary}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{q.destination}</div>
                      <div className="text-xs text-slate-400 tabular-nums">
                        {formatDate(q.startDate)} – {formatDate(q.endDate)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      {formatCurrency(q.subtotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                      {formatCurrency(q.gstAmount)} ({q.gstPercent || 0}%)
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(q.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium">
                      <span
                        className={
                          q.status === 'Accepted'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : q.status === 'Rejected'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-teal-700 dark:text-teal-400'
                        }
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewQuote(q)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Customer Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => generateQuotationPDF(q, settings)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {q.customerPhone && (
                          <a
                            href={buildWhatsAppLink(
                              q.customerPhone,
                              `Hello ${q.customerName}, sharing your ${q.destination} quotation ${q.quoteCode} (v${q.version}) totaling ${formatCurrency(q.totalCost)}.`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-md text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                            title="Share via WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        )}
                        {can('quotations', 'edit') && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditBuilder(q, false)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              title="Edit Quotation"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditBuilder(q, true)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-teal-600"
                              title="Create New Revision"
                            >
                              <CopyPlus className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {can('bookings', 'create') && (
                          <button
                            type="button"
                            onClick={() => convertQuoteToBooking(q)}
                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Convert to Booking"
                          >
                            <ArrowRightCircle className="w-4 h-4" />
                          </button>
                        )}
                        {can('quotations', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setDeleteId(q.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600"
                            title="Delete"
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

      {/* Quotation Builder Modal */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-6">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {isRevisionMode
                  ? `Create Revision v${form.version} (${form.quoteCode})`
                  : editing
                  ? `Edit Quotation (${editing.quoteCode} v${editing.version})`
                  : 'New Quotation Builder'}
              </h3>
              <button type="button" onClick={() => setBuilderOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Import from Enquiry */}
              {!editing && !isRevisionMode && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    Import from Enquiry:
                  </span>
                  <select
                    value={form.enquiryId || ''}
                    onChange={(e) => importFromEnquiry(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="">-- Select an enquiry to pre-fill --</option>
                    {enquiries.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.enquiryCode} · {e.customerName} ({e.destination})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                  <label className="block text-xs font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate || ''}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate || ''}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Pax Summary</label>
                  <input
                    type="text"
                    value={form.paxSummary || ''}
                    onChange={(e) => setForm({ ...form, paxSummary: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Quotation Status</label>
                  <select
                    value={form.status || 'Draft'}
                    onChange={(e) => setForm({ ...form, status: e.target.value as QuotationStatus })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {QUOTE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hotel-wise Pricing */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs font-semibold">Hotel Accommodation Line Items</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-slate-400">Region Filter:</span>
                      {HOTEL_REGIONS.map((reg) => {
                        const active = hotelScope.activeRegions.includes(reg);
                        return (
                          <button
                            key={reg}
                            type="button"
                            onClick={() => {
                              const base = selectedRegions.length > 0 ? selectedRegions : hotelScope.inferredRegions;
                              const next = base.includes(reg)
                                ? base.filter((r) => r !== reg)
                                : [...base, reg];
                              setSelectedRegions(next);
                            }}
                            className={`px-2 py-0.5 text-[11px] rounded border cursor-pointer ${
                              active
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {reg}
                          </button>
                        );
                      })}
                      {selectedRegions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedRegions([])}
                          className="text-[11px] text-slate-400 hover:text-slate-700 underline ml-1 cursor-pointer"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={rateTier}
                      onChange={(e) => setRateTier(e.target.value as any)}
                      className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                      title="Rate tier used when adding partner hotel"
                    >
                      <option value="contract">Contract Rate</option>
                      <option value="seasonal">Seasonal Rate</option>
                      <option value="peak">Peak Season</option>
                      <option value="offSeason">Off-Season</option>
                    </select>
                    <select
                      onChange={(e) => {
                        if (e.target.value) addHotelRow(e.target.value);
                        e.target.value = '';
                      }}
                      className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 max-w-xs"
                    >
                      <option value="">
                        + Add Partner Hotel ({hotelScope.scopedHotels.length} available)...
                      </option>
                      {hotelScope.scopedHotels.map((h) => {
                        const tierVal =
                          rateTier === 'seasonal'
                            ? h.seasonalRate || h.contractRate
                            : rateTier === 'peak'
                            ? h.peakSeasonRate || h.seasonalRate || h.contractRate
                            : rateTier === 'offSeason'
                            ? h.offSeasonRate || h.contractRate
                            : h.contractRate;
                        return (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.city || h.destination}, {h.region} · {formatCurrency(tierVal)}/N)
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => addHotelRow()}
                      className="px-2.5 py-1 text-xs font-medium text-teal-600 border border-teal-200 dark:border-teal-800 rounded-lg"
                    >
                      + Custom Hotel
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {hotelItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                      <input
                        type="text"
                        value={item.hotelName}
                        onChange={(e) => {
                          const c = [...hotelItems];
                          c[idx].hotelName = e.target.value;
                          setHotelItems(c);
                        }}
                        placeholder="Hotel name"
                        className="sm:col-span-3 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="text"
                        value={item.roomType}
                        onChange={(e) => {
                          const c = [...hotelItems];
                          c[idx].roomType = e.target.value;
                          setHotelItems(c);
                        }}
                        placeholder="Room"
                        className="sm:col-span-2 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="text"
                        value={item.mealPlan}
                        onChange={(e) => {
                          const c = [...hotelItems];
                          c[idx].mealPlan = e.target.value;
                          setHotelItems(c);
                        }}
                        placeholder="Plan"
                        className="sm:col-span-1 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.nights}
                        onChange={(e) => {
                          const c = [...hotelItems];
                          c[idx].nights = Number(e.target.value);
                          c[idx].total = c[idx].nights * c[idx].rooms * c[idx].ratePerNight;
                          setHotelItems(c);
                        }}
                        placeholder="Nights"
                        className="sm:col-span-1 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.rooms}
                        onChange={(e) => {
                          const c = [...hotelItems];
                          c[idx].rooms = Number(e.target.value);
                          c[idx].total = c[idx].nights * c[idx].rooms * c[idx].ratePerNight;
                          setHotelItems(c);
                        }}
                        placeholder="Rooms"
                        className="sm:col-span-1 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.ratePerNight}
                        onChange={(e) => {
                          const c = [...hotelItems];
                          c[idx].ratePerNight = Number(e.target.value);
                          c[idx].total = c[idx].nights * c[idx].rooms * c[idx].ratePerNight;
                          setHotelItems(c);
                        }}
                        placeholder="Rate"
                        className="sm:col-span-2 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <div className="sm:col-span-1 flex items-center justify-end font-mono font-semibold tabular-nums">
                        {formatCurrency(item.total)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setHotelItems(hotelItems.filter((_, i) => i !== idx))}
                        className="sm:col-span-1 text-red-500 text-right"
                      >
                        Del
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transport Charges */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold">Transportation Line Items</span>
                  <div className="flex items-center gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) addTransportRow(e.target.value);
                        e.target.value = '';
                      }}
                      className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    >
                      <option value="">+ Add from Fleet Vehicles...</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.category} · {v.model} ({formatCurrency(v.perDayRate)}/day)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addTransportRow()}
                      className="px-2.5 py-1 text-xs font-medium text-teal-600 border border-teal-200 dark:border-teal-800 rounded-lg"
                    >
                      + Custom Vehicle
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {transportItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                      <input
                        type="text"
                        value={item.vehicleCategory}
                        onChange={(e) => {
                          const c = [...transportItems];
                          c[idx].vehicleCategory = e.target.value;
                          setTransportItems(c);
                        }}
                        placeholder="Category"
                        className="sm:col-span-3 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="text"
                        value={item.vehicleModel}
                        onChange={(e) => {
                          const c = [...transportItems];
                          c[idx].vehicleModel = e.target.value;
                          setTransportItems(c);
                        }}
                        placeholder="Model / Route"
                        className="sm:col-span-3 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.days}
                        onChange={(e) => {
                          const c = [...transportItems];
                          c[idx].days = Number(e.target.value);
                          c[idx].total = c[idx].days * c[idx].ratePerDay;
                          setTransportItems(c);
                        }}
                        placeholder="Days"
                        className="sm:col-span-2 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.ratePerDay}
                        onChange={(e) => {
                          const c = [...transportItems];
                          c[idx].ratePerDay = Number(e.target.value);
                          c[idx].total = c[idx].days * c[idx].ratePerDay;
                          setTransportItems(c);
                        }}
                        placeholder="Rate/Day"
                        className="sm:col-span-2 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <div className="sm:col-span-1 flex items-center justify-end font-mono font-semibold tabular-nums">
                        {formatCurrency(item.total)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTransportItems(transportItems.filter((_, i) => i !== idx))}
                        className="sm:col-span-1 text-red-500 text-right"
                      >
                        Del
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Charges, Margin, Discount, GST */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-medium mb-1">Sightseeing (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sightseeingCharge ?? 0}
                    onChange={(e) => setForm({ ...form, sightseeingCharge: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Meals (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.mealsCharge ?? 0}
                    onChange={(e) => setForm({ ...form, mealsCharge: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Other (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.otherExpenses ?? 0}
                    onChange={(e) => setForm({ ...form, otherExpenses: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Markup (%)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.markupPercent ?? 0}
                    onChange={(e) => setForm({ ...form, markupPercent: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Discount (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.discountAmount ?? 0}
                    onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">GST (%)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.gstPercent ?? 5}
                    onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* Live Cost Calculation Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div>
                  <span className="text-slate-400">Base Subtotal</span>
                  <div className="font-mono font-semibold text-sm tabular-nums">{formatCurrency(totals.subtotal)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Markup / Profit</span>
                  <div className="font-mono font-semibold text-sm tabular-nums text-emerald-600">
                    + {formatCurrency(totals.markupAmount)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">GST ({form.gstPercent ?? 5}%)</span>
                  <div className="font-mono font-semibold text-sm tabular-nums">{formatCurrency(totals.gstAmount)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Total Package Cost</span>
                  <div className="font-mono font-bold text-base tabular-nums text-teal-600 dark:text-teal-400">
                    {formatCurrency(totals.totalCost)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Inclusions</label>
                  <textarea
                    rows={2}
                    value={form.inclusions || ''}
                    onChange={(e) => setForm({ ...form, inclusions: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Exclusions</label>
                  <textarea
                    rows={2}
                    value={form.exclusions || ''}
                    onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={form.termsAndConditions || ''}
                  onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  {isRevisionMode ? 'Save Revision' : 'Save Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer-Facing Quotation Preview Modal */}
      {previewQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-6">
            {/* Branded Proposal Header */}
            <div className="bg-[#0F2744] text-white px-8 py-6 flex items-center justify-between border-b-4 border-teal-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0">
                  <ImageWithFallback
                    src={settings?.logoUrl || '/src/assets/images/company_logo_mark_1795419417417.jpg'}
                    alt="Company Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{settings?.companyName || 'Azure Travel'}</h2>
                  <p className="text-xs text-slate-300">
                    {settings?.phone} · {settings?.email}
                  </p>
                  {settings?.gstNumber && <p className="text-[11px] text-slate-400">GSTIN: {settings.gstNumber}</p>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-teal-300 font-semibold">Travel Proposal</div>
                <div className="text-lg font-mono font-bold">
                  {previewQuote.quoteCode} (v{previewQuote.version})
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6 pb-5 border-b border-slate-200 text-sm">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">Prepared For</div>
                  <div className="font-semibold text-base mt-1">{previewQuote.customerName}</div>
                  <div className="text-slate-600 text-xs">{previewQuote.customerPhone} · {previewQuote.customerEmail}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Itinerary Overview</div>
                  <div className="font-semibold text-base mt-1">{previewQuote.destination}</div>
                  <div className="text-slate-600 text-xs tabular-nums">
                    {formatDate(previewQuote.startDate)} – {formatDate(previewQuote.endDate)} · {previewQuote.paxSummary}
                  </div>
                </div>
              </div>

              {(previewQuote.hotelItems || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Accommodation Plan</h4>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="py-2 px-3 text-left">Hotel</th>
                        <th className="py-2 px-3 text-left">Room & Plan</th>
                        <th className="py-2 px-3 text-right">Nights × Rooms</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewQuote.hotelItems!.map((h, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium">{h.hotelName}</td>
                          <td className="py-2 px-3">{h.roomType} ({h.mealPlan})</td>
                          <td className="py-2 px-3 text-right tabular-nums">{h.nights}N × {h.rooms}R</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrency(h.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(previewQuote.transportItems || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Ground Transportation</h4>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="py-2 px-3 text-left">Vehicle</th>
                        <th className="py-2 px-3 text-right">Days</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewQuote.transportItems!.map((t, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium">{t.vehicleModel} ({t.vehicleCategory})</td>
                          <td className="py-2 px-3 text-right tabular-nums">{t.days} days</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrency(t.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Sightseeing, Meals & Other</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(
                      Number(previewQuote.sightseeingCharge || 0) +
                        Number(previewQuote.mealsCharge || 0) +
                        Number(previewQuote.otherExpenses || 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Package Subtotal (incl. service fee)</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(Number(previewQuote.subtotal) + Number(previewQuote.markupAmount || 0))}
                  </span>
                </div>
                {Number(previewQuote.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Special Discount</span>
                    <span className="font-mono tabular-nums">- {formatCurrency(previewQuote.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">GST ({previewQuote.gstPercent || 5}%)</span>
                  <span className="font-mono tabular-nums">{formatCurrency(previewQuote.gstAmount)}</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between text-base font-bold text-[#0F2744]">
                  <span>Total Investment</span>
                  <span className="font-mono tabular-nums">{formatCurrency(previewQuote.totalCost)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
                <div>
                  <div className="font-semibold text-slate-900 mb-1">Inclusions</div>
                  <p className="whitespace-pre-line">{previewQuote.inclusions || '—'}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 mb-1">Exclusions</div>
                  <p className="whitespace-pre-line">{previewQuote.exclusions || '—'}</p>
                </div>
              </div>

              <div className="text-xs text-slate-500 border-t border-slate-200 pt-4">
                <div className="font-semibold text-slate-800 mb-1">Terms & Conditions</div>
                <p className="whitespace-pre-line">{previewQuote.termsAndConditions || settings?.quotationTerms}</p>
              </div>
            </div>

            <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreviewQuote(null)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => generateQuotationPDF(previewQuote, settings)}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Download PDF Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Quotation"
        message="Are you sure you want to delete this quotation?"
        confirmLabel="Delete Quotation"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteQuotation(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
};
