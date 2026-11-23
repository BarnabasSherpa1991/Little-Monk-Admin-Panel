import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { Hotel, HotelCategory } from '../../types/crm';
import { formatCurrency } from '../../utils/formatters';
import { Pagination, SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';

const CATEGORIES: HotelCategory[] = ['Standard', 'Deluxe', 'Premium', 'Luxury'];
const PAGE_SIZE = 10;

export const HotelsView: React.FC = () => {
  const { hotels, can, saveHotel, deleteHotel } = useCRM();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [form, setForm] = useState<Partial<Hotel>>({});
  const [roomTypesText, setRoomTypesText] = useState('');
  const [mealPlansText, setMealPlansText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return hotels.filter((h) => {
      if (catFilter !== 'All' && h.category !== catFilter) return false;
      if (term) {
        const hay = `${h.name} ${h.destination} ${h.contactPerson || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [hotels, search, catFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      destination: '',
      address: '',
      contactPerson: '',
      phone: '',
      email: '',
      category: 'Deluxe',
      contractRate: 6500,
      seasonalRate: 9500,
      checkInTime: '14:00',
      checkOutTime: '11:00',
      policies: '',
      notes: '',
    });
    setRoomTypesText('Deluxe Room, Super Deluxe, Suite');
    setMealPlansText('CP, MAP, AP');
    setFormOpen(true);
  };

  const openEdit = (h: Hotel) => {
    setEditing(h);
    setForm({ ...h });
    setRoomTypesText((h.roomTypes || []).join(', '));
    setMealPlansText((h.mealPlans || []).join(', '));
    setFormOpen(true);
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.name?.trim() || !form.destination?.trim()) return;
    await saveHotel(
      {
        ...form,
        roomTypes: roomTypesText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15),
        mealPlans: mealPlansText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10),
      },
      editing?.id
    );
    setFormOpen(false);
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
            placeholder="Search hotel name, destination, contact..."
            className="w-full sm:w-72"
          />
          <select
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {can('hotels', 'create') && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Hotel
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Hotel & Destination</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Rooms & Meal Plans</th>
                <th className="py-3 px-4 text-right">Contract Rate</th>
                <th className="py-3 px-4 text-right">Seasonal Rate</th>
                <th className="py-3 px-4">Check-In / Out</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No partner hotels added yet.
                  </td>
                </tr>
              ) : (
                paged.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{h.name}</div>
                      <div className="text-xs text-slate-500">{h.destination}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-teal-700 dark:text-teal-400">
                      {h.category}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="text-slate-900 dark:text-slate-100">{h.contactPerson || '—'}</div>
                      <div className="text-slate-400 font-mono">{h.phone || h.email || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      <div className="truncate max-w-[180px]">{(h.roomTypes || []).join(', ') || '—'}</div>
                      <div className="text-slate-400">{(h.mealPlans || []).join(' · ')}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                      {formatCurrency(h.contractRate)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                      {formatCurrency(h.seasonalRate)}
                    </td>
                    <td className="py-3 px-4 text-xs tabular-nums text-slate-500">
                      {h.checkInTime || '14:00'} / {h.checkOutTime || '11:00'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {can('hotels', 'edit') && (
                          <button
                            type="button"
                            onClick={() => openEdit(h)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            title="Edit Hotel"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {can('hotels', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setDeleteId(h.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600"
                            title="Delete Hotel"
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

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">{editing ? `Edit ${editing.name}` : 'Add Partner Hotel'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Hotel Name *</label>
                  <input
                    required
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Address</label>
                  <input
                    type="text"
                    value={form.address || ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={form.contactPerson || ''}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={form.phone || ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <select
                    value={form.category || 'Deluxe'}
                    onChange={(e) => setForm({ ...form, category: e.target.value as HotelCategory })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Room Types (comma separated)</label>
                  <input
                    type="text"
                    value={roomTypesText}
                    onChange={(e) => setRoomTypesText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Meal Plans (comma separated)</label>
                  <input
                    type="text"
                    value={mealPlansText}
                    onChange={(e) => setMealPlansText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Contract Rate / Night (INR) *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.contractRate ?? 0}
                    onChange={(e) => setForm({ ...form, contractRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Seasonal Rate / Night (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.seasonalRate ?? 0}
                    onChange={(e) => setForm({ ...form, seasonalRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Check-in Time</label>
                  <input
                    type="text"
                    value={form.checkInTime || '14:00'}
                    onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Check-out Time</label>
                  <input
                    type="text"
                    value={form.checkOutTime || '11:00'}
                    onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Check-in / Cancellation Policies</label>
                <textarea
                  rows={2}
                  value={form.policies || ''}
                  onChange={(e) => setForm({ ...form, policies: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Special Notes</label>
                <textarea
                  rows={2}
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Hotel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Hotel"
        message="Are you sure you want to remove this partner hotel?"
        confirmLabel="Delete Hotel"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteHotel(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
};
