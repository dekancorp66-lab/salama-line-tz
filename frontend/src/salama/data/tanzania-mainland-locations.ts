import data from "./tanzania-mainland-locations.json";

export interface TanzaniaDistrict {
  /** Stable ID (slug) unique within the dataset. */
  id: string;
  /** District/council display name. */
  name: string;
}

export interface TanzaniaRegion {
  /** Stable ID (slug). */
  id: string;
  /** Region name. */
  name: string;
  districts: TanzaniaDistrict[];
}

export interface TanzaniaLocationsDataset {
  source: string;
  generatedAt: string;
  regions: TanzaniaRegion[];
}

export const TANZANIA_LOCATIONS = data as TanzaniaLocationsDataset;

/**
 * All 31 regions of Tanzania (26 mainland + 5 Zanzibar) in stable display order.
 * Exports keep legacy "MAINLAND" names for compatibility with existing imports.
 */
export const TANZANIA_MAINLAND_REGIONS: TanzaniaRegion[] = TANZANIA_LOCATIONS.regions;
export const TANZANIA_REGIONS: TanzaniaRegion[] = TANZANIA_MAINLAND_REGIONS;

export const TANZANIA_MAINLAND_REGION_NAMES = TANZANIA_MAINLAND_REGIONS.map((r) => r.name);
export const TANZANIA_REGION_NAMES = TANZANIA_MAINLAND_REGION_NAMES;

export function findRegionById(id: string): TanzaniaRegion | undefined {
  return TANZANIA_MAINLAND_REGIONS.find((r) => r.id === id);
}

export function findRegionByName(name: string): TanzaniaRegion | undefined {
  const n = name.trim().toLowerCase();
  return TANZANIA_MAINLAND_REGIONS.find((r) => r.name.toLowerCase() === n);
}

export function findDistrict(regionId: string, districtId: string): TanzaniaDistrict | undefined {
  return findRegionById(regionId)?.districts.find((d) => d.id === districtId);
}

export function isValidRegionDistrict(regionId: string, districtId: string): boolean {
  return Boolean(findDistrict(regionId, districtId));
}
