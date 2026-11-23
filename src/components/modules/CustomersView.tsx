import React, { useMemo, useState } from 'react';
import { Edit2, Eye, FileUp, Plus, Trash2, Upload, X } from 'lucide-react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebase';
import { useCRM } from '../../context/CRMContext';
import { Customer, CustomerDocument } from '../../types/crm';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Pagination, SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';

const PAGE_SIZE = 10;

export const CustomersView: React.FC = () => {
  const {
    customers,
    enquiries,
    quotations,
    bookings,
    payments,
    can,
    saveCustomer,
    deleteCustomer,
    currentEmployee,
    toast,
  } = useCRM();

  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'due'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [selected, setSelected] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (balanceFilter === 'due' && Number(c.outstandingBalance || 0) <= 0) return false;
      if (term) {
        const hay = `${c.customerCode} ${c.name} ${c.mobile} ${c.email || ''} ${c.city || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [customers, search, balanceFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Complete Activity Timeline for selected customer
  const timeline = useMemo(() => {
    if (!selected) return [];
    const list: { id: string; kind: string; title: string; detail: string; date: string }[] = [];

    enquiries
      .filter((e) => e.customerId === selected.id || e.mobile === selected.mobile)
      .forEach((e) =>
        list.push({
          id: 'enq-' + e.id,
          kind: 'Enquiry',
          title: `${e.enquiryCode} · ${e.destination}`,
          detail: `Status: ${e.status} · Budget ${formatCurrency(e.budget)}`,
          date: e.enquiryDate || '',
        })
      );

    quotations
      .filter((q) => q.customerId === selected.id || q.customerName === selected.name)
      .forEach((q) =>
        list.push({
          id: 'qt-' + q.id,
          kind: 'Quotation',
          title: `${q.quoteCode} v${q.version} · ${q.destination}`,
          detail: `${q.status} · Total ${formatCurrency(q.totalCost)}`,
          date: q.startDate || '',
        })
      );

    bookings
      .filter((b) => b.customerId === selected.id || b.customerName === selected.name)
      .forEach((b) =>
        list.push({
          id: 'bk-' + b.id,
          kind: 'Booking',
          title: `${b.bookingCode} · ${b.destination}`,
          detail: `${b.bookingStatus} · Paid ${formatCurrency(b.advanceReceived)} / ${formatCurrency(b.bookingAmount)}`,
          date: b.startDate || '',
        })
      );

    payments
      .filter((p) => p.customerId === selected.id || p.customerName === selected.name)
      .forEach((p) =>
        list.push({
          id: 'pay-' + p.id,
          kind: p.type,
          title: `${p.receiptCode} · ${formatCurrency(p.amount)}`,
          detail: `${p.mode} · Ref: ${p.referenceNumber || '—'}`,
          date: p.paymentDate || '',
        })
      );

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [selected, enquiries, quotations, bookings, payments]);

  const customerBookings = useMemo(() => {
    if (!selected) return [];
    return bookings.filter((b) => b.customerId === selected.id || b.customerName === selected.name);
  }, [selected, bookings]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      mobile: '',
      whatsapp: '',
      email: '',
      address: '',
      city: '',
      preferences: '',
      specialRequests: '',
      internalRemarks: '',
      assignedToUid: currentEmployee?.uid || '',
    });
    setFormOpen(true);
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.name?.trim() || !form.mobile?.trim()) return;
    await saveCustomer(form, editing?.id);
    setFormOpen(false);
  };

  const handleFileUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `customer-docs/${selected.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const nextDocs: CustomerDocument[] = [
        ...(selected.documents || []),
        { name: file.name, type: file.type || 'Document', url, uploadedAt: new Date().toISOString().slice(0, 10) },
      ];
      await saveCustomer({ documents: nextDocs }, selected.id);
      setSelected({ ...selected, documents: nextDocs });
    } catch {
      toast('error', 'Firebase Storage upload unavailable. You can attach a document URL below.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddManualDoc = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selected || !docName.trim() || !docUrl.trim()) return;
    const nextDocs: CustomerDocument[] = [
      ...(selected.documents || []),
      { name: docName.trim(), type: 'External Link', url: docUrl.trim(), uploadedAt: new Date().toISOString().slice(0, 10) },
    ];
    await saveCustomer({ documents: nextDocs }, selected.id);
    setSelected({ ...selected, documents: nextDocs });
    setDocName('');
    setDocUrl('');
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
            placeholder="Search customer name, phone, city, code..."
            className="w-full sm:w-72"
          />
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setBalanceFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                balanceFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Customers
            </button>
            <button
              type="button"
              onClick={() => setBalanceFilter('due')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                balanceFilter === 'due'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              With Outstanding Balance
            </button>
          </div>
        </div>
        {can('customers', 'create') && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">City & Address</th>
                <th className="py-3 px-4 text-right">Bookings</th>
                <th className="py-3 px-4 text-right">Total Spent</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No customer profiles found.
                  </td>
                </tr>
              ) : (
                paged.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      {c.customerCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{c.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {c.mobile} {c.email ? `· ${c.email}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      <div>{c.city || '—'}</div>
                      <div className="text-slate-400 truncate max-w-[220px]">{c.address || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{c.totalBookings || 0}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(c.totalSpent)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-amber-600 dark:text-amber-400">
                      {formatCurrency(c.outstandingBalance)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelected(c)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="View Profile & Timeline"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {can('customers', 'edit') && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(c);
                              setForm({ ...c });
                              setFormOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {can('customers', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setDeleteId(c.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Delete Customer"
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

      {/* Add/Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {editing ? `Edit Customer (${editing.customerCode})` : 'Add Customer Profile'}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Mobile *</label>
                  <input
                    required
                    type="text"
                    value={form.mobile || ''}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={form.whatsapp || ''}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">City</label>
                  <input
                    type="text"
                    value={form.city || ''}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Address</label>
                  <input
                    type="text"
                    value={form.address || ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Travel Preferences</label>
                <input
                  type="text"
                  value={form.preferences || ''}
                  onChange={(e) => setForm({ ...form, preferences: e.target.value })}
                  placeholder="Meals, room floor, airline seats..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Special Requests</label>
                <input
                  type="text"
                  value={form.specialRequests || ''}
                  onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Internal Remarks</label>
                <textarea
                  rows={2}
                  value={form.internalRemarks || ''}
                  onChange={(e) => setForm({ ...form, internalRemarks: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile & Activity Timeline Drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-teal-600 dark:text-teal-400">{selected.customerCode}</div>
                <h3 className="text-lg font-semibold">{selected.name}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Stats Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400">Total Bookings</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-0.5">{selected.totalBookings || customerBookings.length}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400">Total Amount Spent</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selected.totalSpent)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400">Outstanding Balance</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-0.5 text-amber-600 dark:text-amber-400">
                    {formatCurrency(selected.outstandingBalance)}
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="grid grid-cols-2 gap-3 text-xs border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div>
                  <span className="text-slate-400">Phone / WhatsApp</span>
                  <div className="font-medium mt-0.5">{selected.mobile} / {selected.whatsapp || '—'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Email</span>
                  <div className="font-medium mt-0.5">{selected.email || '—'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Address</span>
                  <div className="font-medium mt-0.5">{selected.address || '—'} {selected.city ? `, ${selected.city}` : ''}</div>
                </div>
                <div>
                  <span className="text-slate-400">Preferences</span>
                  <div className="mt-0.5">{selected.preferences || '—'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Special Requests</span>
                  <div className="mt-0.5">{selected.specialRequests || '—'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Internal Remarks</span>
                  <div className="mt-0.5">{selected.internalRemarks || '—'}</div>
                </div>
              </div>

              {/* Documents & Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Documents & Attachments</h4>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? 'Uploading...' : 'Upload File'}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
                <form onSubmit={handleAddManualDoc} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Doc label (e.g. Passport Copy)"
                    className="w-40 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                  <input
                    type="url"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="Document URL..."
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    Attach
                  </button>
                </form>
                <div className="space-y-1.5">
                  {(selected.documents || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No documents attached yet.</p>
                  ) : (
                    (selected.documents || []).map((docItem, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                        <div>
                          <span className="font-medium">{docItem.name}</span>
                          <span className="text-slate-400 ml-2">· {docItem.uploadedAt}</span>
                        </div>
                        <a href={docItem.url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                          Open
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Activity Timeline */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Complete Activity & Travel Timeline</h4>
                <div className="space-y-2.5">
                  {timeline.length === 0 ? (
                    <p className="text-xs text-slate-500">No historical records linked yet.</p>
                  ) : (
                    timeline.map((t) => (
                      <div key={t.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {t.kind} — {t.title}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">{t.detail}</div>
                        </div>
                        <span className="text-slate-400 tabular-nums shrink-0">{formatDate(t.date)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Customer"
        message="Are you sure you want to delete this customer profile?"
        confirmLabel="Delete Customer"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteCustomer(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
};
