import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { Vehicle, VehicleCategory } from '../../types/crm';
import { formatCurrency } from '../../utils/formatters';
import {
  getVehicleClassification,
  LUXURY_VEHICLE_CATEGORIES,
  NON_LUXURY_VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_DEFAULTS,
} from '../../utils/vehicles';
import { Pagination, SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';

const PAGE_SIZE = 10;

export const VehiclesView: React.FC = () => {
  const { vehicles, can, saveVehicle, deleteVehicle } = useCRM();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [availFilter, setAvailFilter] = useState('All');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Partial<Vehicle>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (catFilter === 'TIER:Non-Luxury' && getVehicleClassification(v.category) !== 'Non-Luxury') return false;
      if (catFilter === 'TIER:Luxury' && getVehicleClassification(v.category) !== 'Luxury') return false;
      if (catFilter !== 'All' && !catFilter.startsWith('TIER:') && v.category !== catFilter) return false;
      if (availFilter !== 'All' && v.availability !== availFilter) return false;
      if (term) {
        const hay = `${v.registrationNumber} ${v.category} ${v.model} ${v.driverName || ''} ${v.vendorDetails || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [vehicles, search, catFilter, availFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const openCreate = () => {
    setEditing(null);
    const initialCat: VehicleCategory = 'Crysta';
    const def = VEHICLE_CATEGORY_DEFAULTS[initialCat];
    setForm({
      registrationNumber: '',
      category: initialCat,
      model: '',
      seatingCapacity: def.seatingCapacity,
      driverName: '',
      driverPhone: '',
      vendorDetails: '',
      perDayRate: def.perDayRate,
      perKmRate: def.perKmRate,
      availability: 'Available',
      assignedBookingCode: '',
      maintenanceStatus: 'Good',
    });
    setFormOpen(true);
  };

  const handleCategoryChange = (nextCategory: VehicleCategory) => {
    if (editing) {
      setForm({ ...form, category: nextCategory });
      return;
    }
    const nextDef = VEHICLE_CATEGORY_DEFAULTS[nextCategory];
    const prevDef = form.category ? VEHICLE_CATEGORY_DEFAULTS[form.category] : undefined;
    const isDefaultModel =
      !form.model?.trim() || (prevDef && form.model.trim() === prevDef.suggestedModel);
    const isDefaultSeats =
      form.seatingCapacity === undefined || (prevDef && form.seatingCapacity === prevDef.seatingCapacity);
    const isDefaultDayRate =
      form.perDayRate === undefined || (prevDef && form.perDayRate === prevDef.perDayRate);
    const isDefaultKmRate =
      form.perKmRate === undefined || (prevDef && form.perKmRate === prevDef.perKmRate);

    setForm({
      ...form,
      category: nextCategory,
      model: isDefaultModel ? nextDef.suggestedModel : form.model,
      seatingCapacity: isDefaultSeats ? nextDef.seatingCapacity : form.seatingCapacity,
      perDayRate: isDefaultDayRate ? nextDef.perDayRate : form.perDayRate,
      perKmRate: isDefaultKmRate ? nextDef.perKmRate : form.perKmRate,
    });
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.registrationNumber?.trim() || !form.model?.trim()) return;
    await saveVehicle(form, editing?.id);
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
            placeholder="Search reg no, model, driver, vendor..."
            className="w-full sm:w-64"
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
            <option value="TIER:Non-Luxury">All Non-Luxury Vehicles</option>
            <option value="TIER:Luxury">All Luxury Vehicles</option>
            <optgroup label="Non-Luxury Vehicle">
              {NON_LUXURY_VEHICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
            <optgroup label="Luxury Vehicle">
              {LUXURY_VEHICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
          </select>
          <select
            value={availFilter}
            onChange={(e) => {
              setAvailFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="All">All Availability</option>
            <option value="Available">Available</option>
            <option value="On Trip">On Trip</option>
            <option value="Reserved">Reserved</option>
            <option value="Maintenance">Maintenance</option>
          </select>
        </div>

        {can('vehicles', 'create') && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Vehicle
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Registration & Model</th>
                <th className="py-3 px-4">Category / Seats</th>
                <th className="py-3 px-4">Driver & Vendor</th>
                <th className="py-3 px-4 text-right">Per Day / Per Km</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4">Maintenance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No fleet vehicles found.
                  </td>
                </tr>
              ) : (
                paged.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {v.registrationNumber}
                      </div>
                      <div className="text-xs text-slate-500">{v.model}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{v.category}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            getVehicleClassification(v.category) === 'Luxury'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {getVehicleClassification(v.category)}
                        </span>
                      </div>
                      <div className="text-slate-400 tabular-nums mt-0.5">{v.seatingCapacity} Seats</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{v.driverName || '—'}</div>
                      <div className="text-slate-400">
                        {v.driverPhone || ''} {v.vendorDetails ? `· ${v.vendorDetails}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      <div className="font-medium">{formatCurrency(v.perDayRate)} / day</div>
                      <div className="text-slate-400">{formatCurrency(v.perKmRate)} / km</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={`font-medium ${
                          v.availability === 'Available'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : v.availability === 'Maintenance'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {v.availability}
                      </span>
                      {v.assignedBookingCode && (
                        <div className="font-mono text-[11px] text-slate-400">{v.assignedBookingCode}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={
                          v.maintenanceStatus === 'Good'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : v.maintenanceStatus === 'Due Soon'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {v.maintenanceStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {can('vehicles', 'edit') && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(v);
                              setForm({ ...v });
                              setFormOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            title="Edit Vehicle"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {can('vehicles', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setDeleteId(v.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600"
                            title="Delete Vehicle"
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
              <h3 className="text-base font-semibold">{editing ? `Edit ${editing.registrationNumber}` : 'Add Vehicle'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Registration Number *</label>
                  <input
                    required
                    type="text"
                    value={form.registrationNumber || ''}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                    placeholder="e.g. MH-01-TR-4821"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Vehicle Category *</label>
                  <select
                    value={form.category || 'Crysta'}
                    onChange={(e) => handleCategoryChange(e.target.value as VehicleCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <optgroup label="Non-Luxury Vehicle">
                      {NON_LUXURY_VEHICLE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Luxury Vehicle">
                      {LUXURY_VEHICLE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Classification: <span className="font-medium text-slate-700 dark:text-slate-300">{getVehicleClassification(form.category || 'Crysta')} Vehicle</span>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Vehicle Model *</label>
                  <input
                    required
                    type="text"
                    value={form.model || ''}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder={VEHICLE_CATEGORY_DEFAULTS[(form.category || 'Crysta') as VehicleCategory]?.suggestedModel || 'e.g. Tata Sumo Gold'}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={form.seatingCapacity ?? 4}
                    onChange={(e) => setForm({ ...form, seatingCapacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={form.driverName || ''}
                    onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Driver Phone</label>
                  <input
                    type="text"
                    value={form.driverPhone || ''}
                    onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Vendor Details</label>
                  <input
                    type="text"
                    value={form.vendorDetails || ''}
                    onChange={(e) => setForm({ ...form, vendorDetails: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Assigned Booking Code</label>
                  <input
                    type="text"
                    value={form.assignedBookingCode || ''}
                    onChange={(e) => setForm({ ...form, assignedBookingCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Per-Day Rate (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.perDayRate ?? 0}
                    onChange={(e) => setForm({ ...form, perDayRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Per-Km Rate (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.perKmRate ?? 0}
                    onChange={(e) => setForm({ ...form, perKmRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Availability</label>
                  <select
                    value={form.availability || 'Available'}
                    onChange={(e) => setForm({ ...form, availability: e.target.value as Vehicle['availability'] })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="Available">Available</option>
                    <option value="On Trip">On Trip</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Maintenance Status</label>
                  <select
                    value={form.maintenanceStatus || 'Good'}
                    onChange={(e) => setForm({ ...form, maintenanceStatus: e.target.value as Vehicle['maintenanceStatus'] })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="Good">Good</option>
                    <option value="Due Soon">Due Soon</option>
                    <option value="In Service">In Service</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Vehicle"
        message="Are you sure you want to remove this vehicle from the fleet?"
        confirmLabel="Delete Vehicle"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteVehicle(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
};
