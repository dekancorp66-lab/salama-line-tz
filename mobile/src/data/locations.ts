import data from './tanzania-mainland-locations.json';

export interface TanzaniaDistrict {
  id: string;
  name: string;
}

export interface TanzaniaRegion {
  id: string;
  name: string;
  districts: TanzaniaDistrict[];
}

interface LocationsDataset {
  source: string;
  generatedAt: string;
  regions: TanzaniaRegion[];
}

export const TANZANIA_LOCATIONS = data as LocationsDataset;
export const TANZANIA_REGIONS = TANZANIA_LOCATIONS.regions;

export function findRegionById(id: string): TanzaniaRegion | undefined {
  return TANZANIA_REGIONS.find((region) => region.id === id);
}
