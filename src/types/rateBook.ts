export const RATE_BOOK_CATEGORIES = ['material', 'fabrication-install', 'sink', 'add-on'] as const;
export type RateBookCategory = (typeof RATE_BOOK_CATEGORIES)[number];

export const RATE_BOOK_UNITS = ['sf', 'lf', 'each', 'flat', 'slab'] as const;
export type RateBookUnit = (typeof RATE_BOOK_UNITS)[number];

export interface RateBookItem {
  id: string;
  category: RateBookCategory;
  name: string;
  code?: string;
  unit: RateBookUnit;
  internalCost?: number;
  sellRate?: number;
  stockMaterialId?: string;
  effectiveDate?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RateBookDocument {
  schemaVersion: 1;
  items: RateBookItem[];
}

export const RATE_BOOK_CATEGORY_LABELS: Record<RateBookCategory, string> = {
  material: 'Materials',
  'fabrication-install': 'Fabrication & Install',
  sink: 'Sinks',
  'add-on': 'Add-ons',
};

export const RATE_BOOK_UNIT_LABELS: Record<RateBookUnit, string> = {
  sf: 'SF',
  lf: 'LF',
  each: 'Each',
  flat: 'Flat',
  slab: 'Slab',
};
