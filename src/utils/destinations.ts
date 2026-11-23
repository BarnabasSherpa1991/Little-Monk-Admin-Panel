import { Hotel, HotelRegion } from '../types/crm';

export const HOTEL_REGIONS: readonly HotelRegion[] = ['Sikkim', 'Darjeeling', 'Bhutan'] as const;

export const REGION_COUNTRY_MAP: Record<HotelRegion, 'India' | 'Bhutan'> = {
  Sikkim: 'India',
  Darjeeling: 'India',
  Bhutan: 'Bhutan',
};

export const REGION_CITIES_MAP: Record<HotelRegion, readonly string[]> = {
  Sikkim: [
    'Gangtok',
    'Pelling',
    'Lachung',
    'Lachen',
    'Namchi',
    'Ravangla',
    'Yuksom',
    'Zuluk',
    'Kaluk',
    'Other',
  ],
  Darjeeling: [
    'Darjeeling',
    'Kalimpong',
    'Mirik',
    'Kurseong',
    'Siliguri',
    'Other',
  ],
  Bhutan: [
    'Thimphu',
    'Paro',
    'Punakha',
    'Phuentsholing',
    'Wangdue Phodrang',
    'Bumthang',
    'Haa Valley',
    'Other',
  ],
};

export const MEAL_PLAN_OPTIONS: readonly { code: 'EP' | 'CP' | 'MAP' | 'AP'; label: string }[] = [
  { code: 'EP', label: 'EP (Room Only)' },
  { code: 'CP', label: 'CP (Room + Breakfast)' },
  { code: 'MAP', label: 'MAP (Breakfast + Dinner)' },
  { code: 'AP', label: 'AP (All Meals)' },
];

export const COMMON_ROOM_TYPES: readonly string[] = [
  'Standard Room',
  'Deluxe Room',
  'Super Deluxe Room',
  'Valley / Mountain View',
  'Executive Suite',
  'Family Suite',
  'Cottage / Villa',
];

export const HOTEL_FACILITIES: readonly string[] = [
  'Wi-Fi',
  'Mountain View',
  'Parking',
  'Restaurant',
  'Room Heater',
  '24x7 Hot Water',
  'Spa & Wellness',
  'Airport / Station Transfer',
  'Bonfire / Lawn',
  'Elevator',
  'Conference Hall',
];

const REGION_KEYWORDS: Record<HotelRegion, string[]> = {
  Sikkim: [
    'sikkim',
    'gangtok',
    'pelling',
    'lachung',
    'lachen',
    'namchi',
    'ravangla',
    'yuksom',
    'zuluk',
    'kaluk',
    'nathula',
    'tsomgo',
    'changu',
    'gurudongmar',
    'yumthang',
  ],
  Darjeeling: [
    'darjeeling',
    'kalimpong',
    'mirik',
    'kurseong',
    'siliguri',
    'bagdogra',
    'tiger hill',
    'lava',
    'loleygaon',
    'rishop',
  ],
  Bhutan: [
    'bhutan',
    'thimphu',
    'paro',
    'punakha',
    'phuentsholing',
    'phuntsholing',
    'wangdue',
    'bumthang',
    'haa',
    'dochula',
    'phobjikha',
    'taktsang',
  ],
};

export function isValidHotelRegion(val: unknown): val is HotelRegion {
  return val === 'Sikkim' || val === 'Darjeeling' || val === 'Bhutan';
}

export function inferRegionsFromDestination(destinationText?: string): HotelRegion[] {
  const lower = (destinationText || '').toLowerCase();
  if (!lower.trim()) return [];
  const matched: HotelRegion[] = [];
  for (const region of HOTEL_REGIONS) {
    if (REGION_KEYWORDS[region].some((kw) => lower.includes(kw))) {
      matched.push(region);
    }
  }
  return matched;
}

export function inferHotelRegionFromRecord(hotel: Partial<Hotel>): HotelRegion | null {
  if (isValidHotelRegion(hotel.region)) return hotel.region;
  const inferred = inferRegionsFromDestination(`${hotel.city || ''} ${hotel.destination || ''} ${hotel.address || ''}`);
  return inferred.length === 1 ? inferred[0] : inferred[0] || null;
}

export function isTargetDestinationHotel(hotel: Partial<Hotel>): boolean {
  return isValidHotelRegion(hotel.region);
}

export function formatHotelLocation(hotel: Partial<Hotel>): string {
  if (hotel.city && hotel.region) {
    const country = hotel.country || REGION_COUNTRY_MAP[hotel.region];
    return `${hotel.city}, ${hotel.region}${country ? ` (${country})` : ''}`;
  }
  return hotel.destination || 'Unspecified Location';
}

export function getDestinationScopedHotels(
  hotels: Hotel[],
  destinationText?: string,
  explicitRegions?: HotelRegion[],
  onlyActive = true
): {
  scopedHotels: Hotel[];
  activeRegions: HotelRegion[];
  inferredRegions: HotelRegion[];
  isRegionScoped: boolean;
} {
  const inferredRegions = inferRegionsFromDestination(destinationText);
  const activeRegions =
    explicitRegions && explicitRegions.length > 0 ? explicitRegions : inferredRegions;

  const targetHotels = hotels.filter((h) => {
    if (onlyActive && h.isActive === false) return false;
    return isTargetDestinationHotel(h);
  });

  if (activeRegions.length === 0) {
    return {
      scopedHotels: targetHotels.length > 0 ? targetHotels : hotels.filter((h) => !onlyActive || h.isActive !== false),
      activeRegions: [],
      inferredRegions,
      isRegionScoped: false,
    };
  }

  const matched = targetHotels.filter((h) => h.region && activeRegions.includes(h.region));
  return {
    scopedHotels: matched,
    activeRegions,
    inferredRegions,
    isRegionScoped: true,
  };
}
