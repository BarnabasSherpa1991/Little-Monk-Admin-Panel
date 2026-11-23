import { VehicleCategory } from '../types/crm';

export const NON_LUXURY_VEHICLE_CATEGORIES: VehicleCategory[] = [
  'Hatchback',
  'Sedan',
  'SUV',
  'Innova',
  'Crysta',
  'Tempo Traveller',
  'Sumo',
  'Mahindra Bolero Maxx',
];

export const LUXURY_VEHICLE_CATEGORIES: VehicleCategory[] = ['Luxury Vehicles'];

export const ALL_VEHICLE_CATEGORIES: VehicleCategory[] = [
  ...NON_LUXURY_VEHICLE_CATEGORIES,
  ...LUXURY_VEHICLE_CATEGORIES,
];

export type VehicleClassification = 'Non-Luxury' | 'Luxury';

export function getVehicleClassification(category?: string): VehicleClassification {
  return category === 'Luxury Vehicles' ? 'Luxury' : 'Non-Luxury';
}

export const VEHICLE_CATEGORY_DEFAULTS: Record<
  VehicleCategory,
  { seatingCapacity: number; suggestedModel: string; perDayRate: number; perKmRate: number }
> = {
  Hatchback: {
    seatingCapacity: 4,
    suggestedModel: 'Maruti WagonR / Swift',
    perDayRate: 2600,
    perKmRate: 14,
  },
  Sedan: {
    seatingCapacity: 4,
    suggestedModel: 'Maruti Dzire / Hyundai Aura',
    perDayRate: 3000,
    perKmRate: 16,
  },
  SUV: {
    seatingCapacity: 7,
    suggestedModel: 'Mahindra Xylo / Scorpio Hill Edition',
    perDayRate: 4000,
    perKmRate: 21,
  },
  Innova: {
    seatingCapacity: 6,
    suggestedModel: 'Toyota Innova',
    perDayRate: 4200,
    perKmRate: 22,
  },
  Crysta: {
    seatingCapacity: 6,
    suggestedModel: 'Toyota Innova Crysta (Hill Permit)',
    perDayRate: 4800,
    perKmRate: 24,
  },
  'Tempo Traveller': {
    seatingCapacity: 12,
    suggestedModel: 'Force Tempo Traveller 12-Seater',
    perDayRate: 6800,
    perKmRate: 32,
  },
  Sumo: {
    seatingCapacity: 9,
    suggestedModel: 'Tata Sumo Gold (Hill Permit)',
    perDayRate: 3200,
    perKmRate: 18,
  },
  'Mahindra Bolero Maxx': {
    seatingCapacity: 9,
    suggestedModel: 'Mahindra Bolero Maxx (Mountain Utility)',
    perDayRate: 3000,
    perKmRate: 17,
  },
  'Luxury Vehicles': {
    seatingCapacity: 5,
    suggestedModel: 'Toyota Fortuner / Prado Luxury SUV',
    perDayRate: 8500,
    perKmRate: 40,
  },
};
