import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  enableNetwork,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Hotel, HotelCategory, HotelRegion } from '../types/crm';
import { generateCode } from '../utils/formatters';
import { isValidHotelRegion, REGION_COUNTRY_MAP } from '../utils/destinations';

export const hotelsCollection = collection(db, 'hotels');

const ALLOWED_CATEGORIES: HotelCategory[] = ['Standard', 'Deluxe', 'Premium', 'Luxury'];
const ALLOWED_AVAILABILITIES: NonNullable<Hotel['availability']>[] = [
  'Available',
  'Limited',
  'Sold Out',
];

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = Array.isArray(v) ? v.filter((item) => item !== undefined) : v;
    }
  }
  return out as T;
}

function toNonNegNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function runWithReconnect<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '').toLowerCase();
      const isNetworkErr =
        err?.code === 'unavailable' ||
        msg.includes('client is offline') ||
        msg.includes('unavailable');
      if (!isNetworkErr || attempt === maxAttempts) {
        throw err;
      }
      await enableNetwork(db).catch(() => undefined);
      await new Promise((res) => setTimeout(res, 600 * attempt));
    }
  }
  throw lastError;
}

function formatHotelFirestoreError(err: any): Error {
  const rawMsg = String(err?.message || '');
  if (
    rawMsg.includes('Missing required information') ||
    rawMsg.includes('Invalid destination selection') ||
    rawMsg.includes('Duplicate hotel record') ||
    rawMsg.includes('not signed in')
  ) {
    return err instanceof Error ? err : new Error(rawMsg);
  }
  const code = String(err?.code || '');
  const lower = rawMsg.toLowerCase();
  let friendlyMsg = 'Unable to save hotel to database. Please try again.';
  if (
    code === 'permission-denied' ||
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions')
  ) {
    friendlyMsg =
      'Firebase permission denied: Your account lacks write permission or a field failed security validation.';
  } else if (
    code === 'unavailable' ||
    lower.includes('offline') ||
    lower.includes('network') ||
    lower.includes('unavailable')
  ) {
    friendlyMsg =
      'Database connection error: Unable to reach Firestore. Check your internet connection and try again.';
  } else if (code === 'invalid-argument' || lower.includes('invalid')) {
    friendlyMsg = 'Invalid hotel data: Please review your entered values and try again.';
  } else if (rawMsg) {
    friendlyMsg = `Failed to save hotel: ${rawMsg}`;
  }
  console.error('Hotel Firestore service error:', { code, message: rawMsg, err });
  return new Error(friendlyMsg);
}

function validateAndNormalizeHotelData(
  data: Partial<Hotel>,
  existingHotels: Hotel[],
  editingId?: string
) {
  const region = data.region;
  if (!isValidHotelRegion(region)) {
    throw new Error(
      'Invalid destination selection: Hotels must belong to Sikkim, Darjeeling, or Bhutan.'
    );
  }

  const city = (data.city || '').trim().slice(0, 100);
  if (!city) {
    throw new Error('Missing required information: Please select or enter a valid City / Destination.');
  }

  const cleanName = (data.name || '').trim().slice(0, 150);
  if (!cleanName) {
    throw new Error('Missing required information: Hotel Name is required.');
  }

  const duplicate = existingHotels.find(
    (h) =>
      h.id !== editingId &&
      h.name.trim().toLowerCase() === cleanName.toLowerCase() &&
      h.region === region &&
      (h.city || '').trim().toLowerCase() === city.toLowerCase()
  );
  if (duplicate) {
    throw new Error(
      `Duplicate hotel record: "${cleanName}" already exists in ${city}, ${region}.`
    );
  }

  const category: HotelCategory = ALLOWED_CATEGORIES.includes(data.category as HotelCategory)
    ? (data.category as HotelCategory)
    : 'Deluxe';

  const country = REGION_COUNTRY_MAP[region];
  const destination = `${city}, ${region}`.slice(0, 120);
  const contractRate = toNonNegNumber(data.contractRate, 0);
  const seasonalRate = toNonNegNumber(data.seasonalRate, contractRate);
  const peakSeasonRate = toNonNegNumber(data.peakSeasonRate, seasonalRate);
  const offSeasonRate = toNonNegNumber(data.offSeasonRate, contractRate);
  const totalRooms = Math.max(1, Math.round(toNonNegNumber(data.totalRooms ?? 20, 20)));
  const availability: NonNullable<Hotel['availability']> = ALLOWED_AVAILABILITIES.includes(
    data.availability as NonNullable<Hotel['availability']>
  )
    ? (data.availability as NonNullable<Hotel['availability']>)
    : 'Available';

  const cleanRoomTypes = (data.roomTypes || [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 15);
  const cleanMealPlans = (data.mealPlans || [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 10);
  const cleanFacilities = (data.facilities || [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 30);
  const cleanImages = (data.images || [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 10);

  return {
    region,
    city,
    cleanName,
    fields: {
      name: cleanName,
      country,
      region,
      city,
      destination,
      address: (data.address || '').trim().slice(0, 600),
      contactPerson: (data.contactPerson || '').trim().slice(0, 120),
      phone: (data.phone || '').trim().slice(0, 40),
      whatsapp: (data.whatsapp || '').trim().slice(0, 40),
      email: (data.email || '').trim().slice(0, 160),
      category,
      roomTypes: cleanRoomTypes.length ? cleanRoomTypes : ['Deluxe Room'],
      totalRooms,
      mealPlans: cleanMealPlans.length ? cleanMealPlans : ['CP'],
      contractRate,
      seasonalRate,
      peakSeasonRate,
      offSeasonRate,
      checkInTime: ((data.checkInTime || '14:00').trim() || '14:00').slice(0, 30),
      checkOutTime: ((data.checkOutTime || '11:00').trim() || '11:00').slice(0, 30),
      facilities: cleanFacilities,
      mapLocationUrl: (data.mapLocationUrl || '').trim().slice(0, 2000),
      images: cleanImages,
      policies: (data.policies || '').trim().slice(0, 2000),
      notes: (data.notes || '').trim().slice(0, 1500),
      availability,
      isActive: data.isActive !== false,
    },
  };
}

export async function addHotel(
  data: Partial<Hotel>,
  options: { uid: string; existingHotels: Hotel[] }
): Promise<{ id: string; hotelCode: string; name: string; city: string; region: HotelRegion }> {
  try {
    const { region, city, cleanName, fields } = validateAndNormalizeHotelData(
      data,
      options.existingHotels
    );

    const existingCodes = new Set(options.existingHotels.map((h) => h.hotelCode).filter(Boolean));
    let seq = options.existingHotels.length;
    let hotelCode = generateCode('HTL', seq);
    while (existingCodes.has(hotelCode)) {
      seq += 1;
      hotelCode = generateCode('HTL', seq);
    }

    const payload = stripUndefined({
      hotelCode,
      ...fields,
      createdByUid: options.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const docRef = await runWithReconnect(() => addDoc(hotelsCollection, payload));
    return { id: docRef.id, hotelCode, name: cleanName, city, region };
  } catch (err) {
    throw formatHotelFirestoreError(err);
  }
}

export async function updateHotelRecord(
  id: string,
  data: Partial<Hotel>,
  options: { existingHotels: Hotel[] }
): Promise<{ id: string; name: string; isDeactivateOnly?: boolean }> {
  try {
    const isLegacyDeactivateOnly =
      Object.keys(data).every((k) => k === 'isActive') && data.isActive === false;

    if (isLegacyDeactivateOnly) {
      await runWithReconnect(() =>
        updateDoc(doc(hotelsCollection, id), {
          isActive: false,
          updatedAt: serverTimestamp(),
        })
      );
      return { id, name: '', isDeactivateOnly: true };
    }

    const { cleanName, fields } = validateAndNormalizeHotelData(
      data,
      options.existingHotels,
      id
    );

    const payload = stripUndefined({
      hotelCode: data.hotelCode ? String(data.hotelCode).trim().slice(0, 40) : undefined,
      ...fields,
      updatedAt: serverTimestamp(),
    });

    await runWithReconnect(() => updateDoc(doc(hotelsCollection, id), payload));
    return { id, name: cleanName };
  } catch (err) {
    throw formatHotelFirestoreError(err);
  }
}

export async function deleteHotelRecord(id: string): Promise<void> {
  await runWithReconnect(() => deleteDoc(doc(hotelsCollection, id)));
}
