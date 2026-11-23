import React, { useMemo, useState } from 'react';
import { Copy, Edit2, Plus, Power, Trash2, X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { ItineraryDay, TourPackage } from '../../types/crm';
import { formatCurrency } from '../../utils/formatters';
import { SearchInput } from '../common/DataTableToolbar';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ConfirmDialog } from '../common/ConfirmDialog';

const PRESET_IMAGES = [
  { label: 'Swiss Alps', url: '/src/assets/images/package_swiss_alps_1795419417673.jpg' },
  { label: 'Kerala Backwaters', url: '/src/assets/images/package_kerala_backwaters_1795419417816.jpg' },
  { label: 'Kyoto Heritage', url: '/src/assets/images/package_kyoto_heritage_1795419417572.jpg' },
  { label: 'Rajasthan Palace', url: '/src/assets/images/package_rajasthan_palace_1795419418580.jpg' },
];

export const PackagesView: React.FC = () => {
  const { packages, can, savePackage, deletePackage } = useCRM();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TourPackage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<TourPackage>>({});
  const [highlightsText, setHighlightsText] = useState('');
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return packages.filter((p) => {
      if (statusFilter === 'active' && !p.isActive) return false;
      if (statusFilter === 'inactive' && p.isActive) return false;
      if (term) {
        const hay = `${p.packageCode} ${p.name} ${p.destination}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [packages, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      destination: '',
      days: 5,
      nights: 4,
      description: '',
      hotelDetails: '',
      vehicleDetails: '',
      inclusions: '',
      exclusions: '',
      price: 45000,
      childPrice: 25000,
      seasonalPrice: 58000,
      imageUrl: PRESET_IMAGES[0].url,
      termsAndConditions: '',
      isActive: true,
    });
    setHighlightsText('');
    setItinerary([{ day: 1, title: 'Arrival & Transfer', description: '', meals: 'Dinner', stay: '' }]);
    setFormOpen(true);
  };

  const openEdit = (p: TourPackage) => {
    setEditing(p);
    setForm({ ...p });
    setHighlightsText((p.highlights || []).join('\n'));
    setItinerary(p.itinerary || []);
    setFormOpen(true);
  };

  const handleDuplicate = async (p: TourPackage) => {
    await savePackage({
      ...p,
      id: undefined,
      packageCode: `${p.packageCode}-COPY`,
      name: `${p.name} (Copy)`,
      isActive: false,
    });
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.name?.trim() || !form.destination?.trim()) return;
    const highlights = highlightsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    await savePackage(
      {
        ...form,
        highlights,
        itinerary: itinerary.slice(0, 30),
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
            onChange={setSearch}
            placeholder="Search package name, code, destination..."
            className="w-full sm:w-72"
          />
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'active', 'inactive'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
        {can('packages', 'create') && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Package
          </button>
        )}
      </div>

      {/* Packages Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-sm text-slate-500">
          No tour packages match your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                <ImageWithFallback
                  src={p.imageUrl}
                  alt={p.name}
                  fallbackTitle={p.destination}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="font-mono">{p.packageCode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{p.destination}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {p.days}D / {p.nights}N
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={p.isActive ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {p.name}
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400">Standard</div>
                    <div className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(p.price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Child</div>
                    <div className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(p.childPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Seasonal</div>
                    <div className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(p.seasonalPrice)}
                    </div>
                  </div>
                </div>

                {can('packages', 'edit') && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Duplicate package"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicate
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => savePackage({ isActive: !p.isActive }, p.id)}
                        className={`p-1.5 rounded-lg border ${
                          p.isActive
                            ? 'border-emerald-200 text-emerald-600 dark:border-emerald-900'
                            : 'border-slate-200 text-slate-400 dark:border-slate-700'
                        }`}
                        title={p.isActive ? 'Deactivate Package' : 'Activate Package'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      {can('packages', 'delete') && (
                        <button
                          type="button"
                          onClick={() => setDeleteId(p.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                          title="Delete Package"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {editing ? `Edit Package (${editing.packageCode})` : 'Create Tour Package'}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Package Name *</label>
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Days</label>
                    <input
                      type="number"
                      min={1}
                      value={form.days ?? 5}
                      onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Nights</label>
                    <input
                      type="number"
                      min={0}
                      value={form.nights ?? 4}
                      onChange={(e) => setForm({ ...form, nights: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Adult Price (INR) *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.price ?? 0}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Child Price (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.childPrice ?? 0}
                    onChange={(e) => setForm({ ...form, childPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Seasonal Price (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.seasonalPrice ?? 0}
                    onChange={(e) => setForm({ ...form, seasonalPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Cover Image Preset</label>
                  <select
                    value={form.imageUrl || PRESET_IMAGES[0].url}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {PRESET_IMAGES.map((img) => (
                      <option key={img.url} value={img.url}>{img.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Highlights (one per line)</label>
                  <textarea
                    rows={3}
                    value={highlightsText}
                    onChange={(e) => setHighlightsText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Hotel Details</label>
                  <input
                    type="text"
                    value={form.hotelDetails || ''}
                    onChange={(e) => setForm({ ...form, hotelDetails: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Vehicle Details</label>
                  <input
                    type="text"
                    value={form.vehicleDetails || ''}
                    onChange={(e) => setForm({ ...form, vehicleDetails: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
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

              {/* Day-wise Itinerary Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold">Day-wise Itinerary</label>
                  <button
                    type="button"
                    onClick={() =>
                      setItinerary([
                        ...itinerary,
                        { day: itinerary.length + 1, title: '', description: '', meals: 'Breakfast', stay: '' },
                      ])
                    }
                    className="text-xs font-medium text-teal-600 hover:underline"
                  >
                    + Add Day
                  </button>
                </div>
                <div className="space-y-2">
                  {itinerary.map((d, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <input
                        type="text"
                        value={d.title}
                        onChange={(e) => {
                          const copy = [...itinerary];
                          copy[idx] = { ...copy[idx], title: e.target.value };
                          setItinerary(copy);
                        }}
                        placeholder={`Day ${d.day} Title`}
                        className="sm:col-span-4 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="text"
                        value={d.description}
                        onChange={(e) => {
                          const copy = [...itinerary];
                          copy[idx] = { ...copy[idx], description: e.target.value };
                          setItinerary(copy);
                        }}
                        placeholder="Day description..."
                        className="sm:col-span-5 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <input
                        type="text"
                        value={d.meals}
                        onChange={(e) => {
                          const copy = [...itinerary];
                          copy[idx] = { ...copy[idx], meals: e.target.value };
                          setItinerary(copy);
                        }}
                        placeholder="Meals"
                        className="sm:col-span-2 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => setItinerary(itinerary.filter((_, i) => i !== idx))}
                        className="sm:col-span-1 text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
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
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Tour Package"
        message="Are you sure you want to delete this tour package?"
        confirmLabel="Delete Package"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deletePackage(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
};
