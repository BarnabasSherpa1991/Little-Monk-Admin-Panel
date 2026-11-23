import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Eye,
  FilterX,
  ImagePlus,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebase';
import { useCRM } from '../../context/CRMContext';
import {
  Hotel,
  HotelAvailability,
  HotelCategory,
  HotelRegion,
} from '../../types/crm';
import { formatCurrency } from '../../utils/formatters';
import {
  COMMON_ROOM_TYPES,
  formatHotelLocation,
  HOTEL_FACILITIES,
  HOTEL_REGIONS,
  inferHotelRegionFromRecord,
  isTargetDestinationHotel,
  isValidHotelRegion,
  MEAL_PLAN_OPTIONS,
  REGION_CITIES_MAP,
  REGION_COUNTRY_MAP,
} from '../../utils/destinations';
import { Pagination, SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ImageWithFallback } from '../common/ImageWithFallback';

const CATEGORIES: HotelCategory[] = ['Standard', 'Deluxe', 'Premium', 'Luxury'];
const AVAILABILITIES: HotelAvailability[] = ['Available', 'Limited', 'Sold Out'];
const PAGE_SIZE = 10;

export const HotelsView: React.FC = () => {
  const { hotels, can, saveHotel, deleteHotel, toast } = useCRM();

  // Search & Filter states
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<'All' | HotelRegion>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [mealFilter, setMealFilter] = useState<string>('All');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [page, setPage] = useState(1);

  // Form Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [form, setForm] = useState<Partial<Hotel>>({});
  const [selectedCityChoice, setSelectedCityChoice] = useState<string>('Gangtok');
  const [customCity, setCustomCity] = useState<string>('');
  const [customRoomType, setCustomRoomType] = useState<string>('');
  const [customFacility, setCustomFacility] = useState<string>('');
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // View Details & Delete confirmation
  const [viewing, setViewing] = useState<Hotel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const legacyHotels = useMemo(
    () => hotels.filter((h) => !isTargetDestinationHotel(h)),
    [hotels]
  );

  const regionCounts = useMemo(() => {
    const counts: Record<HotelRegion, number> = { Sikkim: 0, Darjeeling: 0, Bhutan: 0 };
    hotels.forEach((h) => {
      if (isValidHotelRegion(h.region)) counts[h.region] += 1;
    });
    return counts;
  }, [hotels]);

  const availableCityOptions = useMemo(() => {
    const base =
      regionFilter === 'All'
        ? HOTEL_REGIONS.flatMap((r) => REGION_CITIES_MAP[r].filter((c) => c !== 'Other'))
        : REGION_CITIES_MAP[regionFilter].filter((c) => c !== 'Other');
    const customPresent = hotels
      .filter((h) => (regionFilter === 'All' ? true : h.region === regionFilter))
      .map((h) => h.city || '')
      .filter((c) => c && !base.includes(c));
    return Array.from(new Set([...base, ...customPresent]));
  }, [regionFilter, hotels]);

  const availableRoomTypeOptions = useMemo(() => {
    const fromData = hotels.flatMap((h) => h.roomTypes || []);
    return Array.from(new Set([...COMMON_ROOM_TYPES, ...fromData])).filter(Boolean);
  }, [hotels]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;

    return hotels.filter((h) => {
      if (regionFilter !== 'All' && h.region !== regionFilter) return false;
      if (cityFilter !== 'All' && (h.city || '').toLowerCase() !== cityFilter.toLowerCase()) {
        return false;
      }
      if (catFilter !== 'All' && h.category !== catFilter) return false;
      if (mealFilter !== 'All' && !(h.mealPlans || []).includes(mealFilter)) return false;
      if (
        roomTypeFilter !== 'All' &&
        !(h.roomTypes || []).some((r) => r.toLowerCase().includes(roomTypeFilter.toLowerCase()))
      ) {
        return false;
      }
      if (availabilityFilter !== 'All' && (h.availability || 'Available') !== availabilityFilter) {
        return false;
      }
      const active = h.isActive !== false;
      if (statusFilter === 'Active' && !active) return false;
      if (statusFilter === 'Inactive' && active) return false;

      const rate = Number(h.contractRate || 0);
      if (min !== null && !Number.isNaN(min) && rate < min) return false;
      if (max !== null && !Number.isNaN(max) && rate > max) return false;

      if (term) {
        const hay = `${h.name} ${h.region || ''} ${h.city || ''} ${h.country || ''} ${h.destination} ${h.address || ''} ${h.contactPerson || ''} ${(h.facilities || []).join(' ')}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [
    hotels,
    search,
    regionFilter,
    cityFilter,
    catFilter,
    mealFilter,
    roomTypeFilter,
    availabilityFilter,
    statusFilter,
    minPrice,
    maxPrice,
  ]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    regionFilter !== 'All' ||
    cityFilter !== 'All' ||
    catFilter !== 'All' ||
    mealFilter !== 'All' ||
    roomTypeFilter !== 'All' ||
    availabilityFilter !== 'All' ||
    statusFilter !== 'All' ||
    Boolean(minPrice) ||
    Boolean(maxPrice);

  const clearFilters = () => {
    setSearch('');
    setRegionFilter('All');
    setCityFilter('All');
    setCatFilter('All');
    setMealFilter('All');
    setRoomTypeFilter('All');
    setAvailabilityFilter('All');
    setStatusFilter('All');
    setMinPrice('');
    setMaxPrice('');
    setPage(1);
  };

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const openCreate = () => {
    const defaultRegion: HotelRegion = regionFilter !== 'All' ? regionFilter : 'Sikkim';
    const defaultCity = REGION_CITIES_MAP[defaultRegion][0];
    setEditing(null);
    setForm({
      name: '',
      region: defaultRegion,
      country: REGION_COUNTRY_MAP[defaultRegion],
      city: defaultCity,
      destination: `${defaultCity}, ${defaultRegion}`,
      address: '',
      contactPerson: '',
      phone: '',
      whatsapp: '',
      email: '',
      category: 'Deluxe',
      roomTypes: ['Deluxe Room', 'Super Deluxe Room'],
      totalRooms: 24,
      mealPlans: ['CP', 'MAP'],
      contractRate: 6500,
      seasonalRate: 8500,
      peakSeasonRate: 10500,
      offSeasonRate: 5500,
      checkInTime: '14:00',
      checkOutTime: '11:00',
      facilities: ['Wi-Fi', 'Mountain View', 'Parking', 'Restaurant', 'Room Heater', '24x7 Hot Water'],
      mapLocationUrl: '',
      images: [],
      policies: '',
      notes: '',
      availability: 'Available',
      isActive: true,
    });
    setSelectedCityChoice(defaultCity);
    setCustomCity('');
    setCustomRoomType('');
    setCustomFacility('');
    setImageUrlInput('');
    setFormOpen(true);
  };

  const openEdit = (h: Hotel) => {
    const region: HotelRegion =
      inferHotelRegionFromRecord(h) || 'Sikkim';
    const presetCities = REGION_CITIES_MAP[region].filter((c) => c !== 'Other');
    const existingCity = (h.city || '').trim();
    const isPreset = presetCities.includes(existingCity);

    setEditing(h);
    setForm({
      ...h,
      region,
      country: REGION_COUNTRY_MAP[region],
      city: existingCity || presetCities[0],
      roomTypes: h.roomTypes || ['Deluxe Room'],
      mealPlans: h.mealPlans || ['CP'],
      facilities: h.facilities || [],
      images: h.images || [],
      totalRooms: h.totalRooms ?? 20,
      peakSeasonRate: h.peakSeasonRate ?? h.seasonalRate ?? h.contractRate,
      offSeasonRate: h.offSeasonRate ?? h.contractRate,
      availability: h.availability || 'Available',
      isActive: h.isActive !== false,
    });

    if (!existingCity) {
      setSelectedCityChoice(presetCities[0]);
      setCustomCity('');
    } else if (isPreset) {
      setSelectedCityChoice(existingCity);
      setCustomCity('');
    } else {
      setSelectedCityChoice('Other');
      setCustomCity(existingCity);
    }
    setCustomRoomType('');
    setCustomFacility('');
    setImageUrlInput('');
    setFormOpen(true);
  };

  const handleRegionChange = (nextRegion: HotelRegion) => {
    const defaultCity = REGION_CITIES_MAP[nextRegion][0];
    setForm((prev) => ({
      ...prev,
      region: nextRegion,
      country: REGION_COUNTRY_MAP[nextRegion],
      city: defaultCity,
      destination: `${defaultCity}, ${nextRegion}`,
    }));
    setSelectedCityChoice(defaultCity);
    setCustomCity('');
  };

  const handleCityChoiceChange = (choice: string) => {
    setSelectedCityChoice(choice);
    const region = form.region || 'Sikkim';
    if (choice === 'Other') {
      setForm((prev) => ({
        ...prev,
        city: customCity,
        destination: customCity ? `${customCity}, ${region}` : region,
      }));
    } else {
      setCustomCity('');
      setForm((prev) => ({
        ...prev,
        city: choice,
        destination: `${choice}, ${region}`,
      }));
    }
  };

  const toggleArrayItem = (field: 'roomTypes' | 'mealPlans' | 'facilities', value: string) => {
    const current = (form[field] || []) as string[];
    const exists = current.includes(value);
    const next = exists ? current.filter((x) => x !== value) : [...current, value];
    setForm((prev) => ({ ...prev, [field]: next }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if ((form.images || []).length >= 10) {
      toast('error', 'Maximum 10 hotel images allowed.');
      return;
    }
    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `hotels/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((prev) => ({
        ...prev,
        images: [...(prev.images || []), url].slice(0, 10),
      }));
      toast('success', 'Hotel image uploaded.');
    } catch (err: any) {
      toast('error', err?.message || 'Image upload failed. You can also paste an image URL.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    if ((form.images || []).length >= 10) {
      toast('error', 'Maximum 10 hotel images allowed.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      images: [...(prev.images || []), url].slice(0, 10),
    }));
    setImageUrlInput('');
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const region = form.region;
    if (!isValidHotelRegion(region)) {
      toast('error', 'Please select Sikkim, Darjeeling, or Bhutan.');
      return;
    }
    const finalCity =
      selectedCityChoice === 'Other' ? customCity.trim() : selectedCityChoice.trim();
    if (!form.name?.trim() || !finalCity) {
      toast('error', 'Hotel Name and City / Destination are required.');
      return;
    }

    setSaving(true);
    try {
      await saveHotel(
        {
          ...form,
          name: form.name.trim(),
          region,
          country: REGION_COUNTRY_MAP[region],
          city: finalCity,
          destination: `${finalCity}, ${region}`,
          roomTypes: (form.roomTypes || ['Deluxe Room']).slice(0, 15),
          mealPlans: (form.mealPlans || ['CP']).slice(0, 10),
          facilities: (form.facilities || []).slice(0, 30),
          images: (form.images || []).slice(0, 10),
        },
        editing?.id
      );
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Target Destination Scope Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setRegionFilter('All');
            setCityFilter('All');
            setPage(1);
          }}
          className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
            regionFilter === 'All'
              ? 'bg-[#0F2744] text-white border-[#0F2744]'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-400'
          }`}
        >
          <div className="text-xs opacity-80">All Target Regions</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {regionCounts.Sikkim + regionCounts.Darjeeling + regionCounts.Bhutan} Hotels
          </div>
          <div className="text-[11px] opacity-75 mt-0.5">Sikkim · Darjeeling · Bhutan</div>
        </button>

        {HOTEL_REGIONS.map((reg) => (
          <button
            key={reg}
            type="button"
            onClick={() => {
              setRegionFilter(reg);
              setCityFilter('All');
              setPage(1);
            }}
            className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
              regionFilter === reg
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs opacity-80">
              <span>{reg}</span>
              <span>{REGION_COUNTRY_MAP[reg]}</span>
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{regionCounts[reg]} Hotels</div>
            <div className="text-[11px] opacity-75 mt-0.5 truncate">
              {REGION_CITIES_MAP[reg].filter((c) => c !== 'Other').slice(0, 4).join(', ')}
            </div>
          </button>
        ))}
      </div>

      {/* Legacy non-target notice (non-destructive) */}
      {legacyHotels.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <span className="font-semibold">{legacyHotels.length} legacy hotel record(s)</span> do
              not yet have a Sikkim, Darjeeling, or Bhutan region assigned. They are preserved for
              existing booking references; edit them to assign a target region or mark them inactive.
            </div>
          </div>
        </div>
      )}

      {/* Search & Multi-Faceted Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search hotel name, city, facility, contact..."
              className="w-full sm:w-72"
            />
            <select
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value as 'All' | HotelRegion);
                setCityFilter('All');
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="All">All Regions</option>
              {HOTEL_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r} ({REGION_COUNTRY_MAP[r]})
                </option>
              ))}
            </select>

            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="All">All Cities</option>
              {availableCityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={catFilter}
              onChange={(e) => {
                setCatFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <FilterX className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
            {can('hotels', 'create') && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Hotel
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <select
            value={mealFilter}
            onChange={(e) => {
              setMealFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="All">All Meal Plans</option>
            {MEAL_PLAN_OPTIONS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={roomTypeFilter}
            onChange={(e) => {
              setRoomTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="All">All Room Types</option>
            {availableRoomTypeOptions.map((rt) => (
              <option key={rt} value={rt}>
                {rt}
              </option>
            ))}
          </select>

          <select
            value={availabilityFilter}
            onChange={(e) => {
              setAvailabilityFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="All">All Availability</option>
            {AVAILABILITIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive');
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="All">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Rate (₹):</span>
            <input
              type="number"
              min={0}
              placeholder="Min ₹"
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                setPage(1);
              }}
              className="w-24 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              min={0}
              placeholder="Max ₹"
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setPage(1);
              }}
              className="w-24 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Hotels Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Hotel & Location</th>
                <th className="py-3 px-4">Category & Status</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Rooms & Meal Plans</th>
                <th className="py-3 px-4 text-right">Contract Rate</th>
                <th className="py-3 px-4 text-right">Seasonal / Peak</th>
                <th className="py-3 px-4">Check-In / Out</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No partner hotels match your current filters.
                  </td>
                </tr>
              ) : (
                paged.map((h) => {
                  const isTarget = isTargetDestinationHotel(h);
                  const active = h.isActive !== false;
                  const avail = h.availability || 'Available';
                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        !active ? 'opacity-65' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setViewing(h)}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-600 text-left cursor-pointer"
                        >
                          {h.name}
                        </button>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                          <span>{formatHotelLocation(h)}</span>
                          {!isTarget && (
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              · Needs Target Region
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-teal-700 dark:text-teal-400">
                          {h.category}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className={
                              avail === 'Available'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : avail === 'Limited'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {avail}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className={active ? 'text-slate-500' : 'text-red-500'}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-900 dark:text-slate-100">
                          {h.contactPerson || '—'}
                        </div>
                        <div className="text-slate-500 font-mono">{h.phone || h.email || ''}</div>
                        {h.whatsapp && (
                          <div className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">
                            WA: {h.whatsapp}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        <div className="truncate max-w-[190px]">
                          {h.totalRooms ? `${h.totalRooms} rooms · ` : ''}
                          {(h.roomTypes || []).join(', ') || '—'}
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {(h.mealPlans || []).join(' · ')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap">
                        {formatCurrency(h.contractRate)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                        <div className="text-slate-700 dark:text-slate-300">
                          {formatCurrency(h.seasonalRate)}
                        </div>
                        {Number(h.peakSeasonRate || 0) > 0 && (
                          <div className="text-[11px] text-slate-400">
                            Peak: {formatCurrency(h.peakSeasonRate)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs tabular-nums text-slate-500 whitespace-nowrap">
                        <div>
                          {h.checkInTime || '14:00'} / {h.checkOutTime || '11:00'}
                        </div>
                        {h.mapLocationUrl && (
                          <a
                            href={h.mapLocationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline mt-0.5"
                          >
                            Map <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewing(h)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-teal-600 cursor-pointer"
                            title="View Hotel Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {can('hotels', 'edit') && (
                            <button
                              type="button"
                              onClick={() => openEdit(h)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                              title="Edit Hotel"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {can('hotels', 'delete') && (
                            <button
                              type="button"
                              onClick={() => setDeleteId(h.id)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Delete Hotel"
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

      {/* Hotel Details Drawer / Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {viewing.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatHotelLocation(viewing)} · {viewing.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto text-sm">
              {viewing.images && viewing.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {viewing.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800"
                    >
                      <ImageWithFallback
                        src={img}
                        alt={`${viewing.name} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-[11px] text-slate-500">Contract Rate</div>
                  <div className="font-mono font-semibold mt-0.5">
                    {formatCurrency(viewing.contractRate)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-[11px] text-slate-500">Seasonal Rate</div>
                  <div className="font-mono font-semibold mt-0.5">
                    {formatCurrency(viewing.seasonalRate)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-[11px] text-slate-500">Peak Season</div>
                  <div className="font-mono font-semibold mt-0.5">
                    {formatCurrency(viewing.peakSeasonRate ?? viewing.seasonalRate)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-[11px] text-slate-500">Off-Season</div>
                  <div className="font-mono font-semibold mt-0.5">
                    {formatCurrency(viewing.offSeasonRate ?? viewing.contractRate)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Address & Contact
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    {viewing.address || 'Address not entered'}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-teal-600" />
                    <span>
                      {viewing.contactPerson || 'Reservations'} · {viewing.phone || '—'}
                    </span>
                  </div>
                  {viewing.whatsapp && (
                    <div className="text-emerald-700 dark:text-emerald-400">
                      WhatsApp: {viewing.whatsapp}
                    </div>
                  )}
                  {viewing.email && <div className="text-slate-500">{viewing.email}</div>}
                  {viewing.mapLocationUrl && (
                    <a
                      href={viewing.mapLocationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-teal-600 hover:underline font-medium"
                    >
                      Open Google Maps Location <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Rooms, Meal Plans & Timings
                  </div>
                  <div>
                    Total Rooms: <span className="font-medium">{viewing.totalRooms || '—'}</span> ·
                    Availability:{' '}
                    <span className="font-medium">{viewing.availability || 'Available'}</span>
                  </div>
                  <div>Room Types: {(viewing.roomTypes || []).join(', ') || '—'}</div>
                  <div>Meal Plans: {(viewing.mealPlans || []).join(', ') || '—'}</div>
                  <div>
                    Check-in {viewing.checkInTime || '14:00'} · Check-out{' '}
                    {viewing.checkOutTime || '11:00'}
                  </div>
                </div>
              </div>

              {viewing.facilities && viewing.facilities.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Facilities & Amenities
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {viewing.facilities.map((fac) => (
                      <span
                        key={fac}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                        {fac}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(viewing.policies || viewing.notes) && (
                <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                  {viewing.policies && (
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Policies:{' '}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">{viewing.policies}</span>
                    </div>
                  )}
                  {viewing.notes && (
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Internal Notes:{' '}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">{viewing.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Hotel Form Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  {editing ? `Edit ${editing.name}` : 'Add Target-Destination Partner Hotel'}
                </h3>
                <p className="text-xs text-slate-500">
                  Restricted strictly to Sikkim, Darjeeling, and Bhutan · All rates in INR (₹)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
              {/* Location & Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium mb-1">Hotel Name *</label>
                  <input
                    required
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Mayfair Spa Resort & Casino"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">State / Region *</label>
                  <select
                    required
                    value={form.region || 'Sikkim'}
                    onChange={(e) => handleRegionChange(e.target.value as HotelRegion)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {HOTEL_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Country (Auto)</label>
                  <input
                    readOnly
                    type="text"
                    value={form.country || REGION_COUNTRY_MAP[form.region || 'Sikkim']}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">City / Destination *</label>
                  <select
                    required
                    value={selectedCityChoice}
                    onChange={(e) => handleCityChoiceChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {REGION_CITIES_MAP[form.region || 'Sikkim'].map((c) => (
                      <option key={c} value={c}>
                        {c === 'Other' ? `Other (${form.region || 'Sikkim'})` : c}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCityChoice === 'Other' && (
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium mb-1">
                      Specify Location within {form.region || 'Region'} *
                    </label>
                    <input
                      required
                      type="text"
                      value={customCity}
                      onChange={(e) => {
                        setCustomCity(e.target.value);
                        setForm((prev) => ({
                          ...prev,
                          city: e.target.value,
                          destination: `${e.target.value}, ${prev.region || 'Sikkim'}`,
                        }));
                      }}
                      placeholder={`Enter location inside ${form.region || 'target region'}...`}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Full Address</label>
                  <input
                    type="text"
                    value={form.address || ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Hotel Category *</label>
                  <select
                    value={form.category || 'Deluxe'}
                    onChange={(e) => setForm({ ...form, category: e.target.value as HotelCategory })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <label className="block text-xs font-medium mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={form.whatsapp || ''}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* INR Pricing & Rooms */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Contract Rate (₹) *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.contractRate ?? 0}
                    onChange={(e) => setForm({ ...form, contractRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Seasonal Rate (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.seasonalRate ?? 0}
                    onChange={(e) => setForm({ ...form, seasonalRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Peak Season (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.peakSeasonRate ?? 0}
                    onChange={(e) => setForm({ ...form, peakSeasonRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Off-Season (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.offSeasonRate ?? 0}
                    onChange={(e) => setForm({ ...form, offSeasonRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Total Rooms</label>
                  <input
                    type="number"
                    min={1}
                    value={form.totalRooms ?? 20}
                    onChange={(e) => setForm({ ...form, totalRooms: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
              </div>

              {/* Availability, Status, Timings & Map */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Availability</label>
                  <select
                    value={form.availability || 'Available'}
                    onChange={(e) =>
                      setForm({ ...form, availability: e.target.value as HotelAvailability })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {AVAILABILITIES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
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
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive !== false}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4 accent-teal-600 rounded"
                    />
                    Active Partner Property
                  </label>
                </div>
              </div>

              {/* Room Types */}
              <div className="space-y-2">
                <label className="block text-xs font-medium">Room Types</label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(new Set([...COMMON_ROOM_TYPES, ...(form.roomTypes || [])])).map((rt) => {
                    const selected = (form.roomTypes || []).includes(rt);
                    return (
                      <button
                        key={rt}
                        type="button"
                        onClick={() => toggleArrayItem('roomTypes', rt)}
                        className={`px-2.5 py-1 text-xs rounded-lg border cursor-pointer ${
                          selected
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {rt}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customRoomType}
                    onChange={(e) => setCustomRoomType(e.target.value)}
                    placeholder="Add custom room type (e.g. Honeymoon Cottage)..."
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = customRoomType.trim();
                      if (!v) return;
                      if (!(form.roomTypes || []).includes(v)) {
                        setForm((prev) => ({
                          ...prev,
                          roomTypes: [...(prev.roomTypes || []), v].slice(0, 15),
                        }));
                      }
                      setCustomRoomType('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    + Add Room Type
                  </button>
                </div>
              </div>

              {/* Meal Plans */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium">Available Meal Plans</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MEAL_PLAN_OPTIONS.map((mp) => (
                    <label
                      key={mp.code}
                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(form.mealPlans || []).includes(mp.code)}
                        onChange={() => toggleArrayItem('mealPlans', mp.code)}
                        className="w-3.5 h-3.5 accent-teal-600 rounded"
                      />
                      <span>{mp.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Facilities */}
              <div className="space-y-2">
                <label className="block text-xs font-medium">Hotel Facilities</label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(new Set([...HOTEL_FACILITIES, ...(form.facilities || [])])).map((fac) => {
                    const selected = (form.facilities || []).includes(fac);
                    return (
                      <button
                        key={fac}
                        type="button"
                        onClick={() => toggleArrayItem('facilities', fac)}
                        className={`px-2.5 py-1 text-xs rounded-lg border cursor-pointer ${
                          selected
                            ? 'bg-[#0F2744] text-white border-[#0F2744]'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {fac}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFacility}
                    onChange={(e) => setCustomFacility(e.target.value)}
                    placeholder="Add custom facility..."
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = customFacility.trim();
                      if (!v) return;
                      if (!(form.facilities || []).includes(v)) {
                        setForm((prev) => ({
                          ...prev,
                          facilities: [...(prev.facilities || []), v].slice(0, 30),
                        }));
                      }
                      setCustomFacility('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    + Add Facility
                  </button>
                </div>
              </div>

              {/* Google Maps & Images */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Google Maps Location URL</label>
                  <input
                    type="url"
                    value={form.mapLocationUrl || ''}
                    onChange={(e) => setForm({ ...form, mapLocationUrl: e.target.value })}
                    placeholder="https://maps.google.com/?q=..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium">Hotel Images</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Or paste image URL / path..."
                      className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  {(form.images || []).length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {(form.images || []).map((img, i) => (
                        <div
                          key={i}
                          className="relative group aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800"
                        >
                          <ImageWithFallback
                            src={img}
                            alt={`Hotel ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                images: (prev.images || []).filter((_, idx) => idx !== i),
                              }))
                            }
                            className="absolute top-1 right-1 p-0.5 rounded bg-slate-950/75 text-white cursor-pointer"
                            title="Remove image"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Policies & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Check-in / Cancellation Policies
                  </label>
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
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Hotel'}
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
