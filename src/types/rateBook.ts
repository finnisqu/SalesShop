export const RATE_BOOK_CATEGORIES = ['material', 'fabrication-install', 'sink', 'add-on'] as const;
export type RateBookCategory = (typeof RATE_BOOK_CATEGORIES)[number];

export const RATE_BOOK_UNITS = ['sf', 'lf', 'each', 'flat', 'slab'] as const;
export type RateBookUnit = (typeof RATE_BOOK_UNITS)[number];

export const RATE_BOOK_PRICING_BEHAVIORS = ['suggested', 'cost-reference', 'manual'] as const;
export type RateBookPricingBehavior = (typeof RATE_BOOK_PRICING_BEHAVIORS)[number];

export const RATE_BOOK_DIVISIONS = ['Retail', 'Residential Builder', 'Commercial', 'Multifamily'] as const;
export type RateBookDivision = (typeof RATE_BOOK_DIVISIONS)[number];

export interface RateBookDivisionOverride {
  division: RateBookDivision;
  internalCost?: number;
  sellRate?: number;
}

export interface RateBookPriceVersion {
  id: string;
  effectiveDate: string;
  internalCost?: number;
  sellRate?: number;
  pricingBehavior: RateBookPricingBehavior;
  divisionOverrides: RateBookDivisionOverride[];
  note?: string;
  recordedAt: string;
}

export interface RateBookItem {
  id: string;
  category: RateBookCategory;
  name: string;
  code?: string;
  unit: RateBookUnit;
  internalCost?: number;
  sellRate?: number;
  pricingBehavior: RateBookPricingBehavior;
  divisionOverrides: RateBookDivisionOverride[];
  history: RateBookPriceVersion[];
  stockMaterialId?: string;
  effectiveDate?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RateBookDocument {
  schemaVersion: 2;
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

export const RATE_BOOK_PRICING_BEHAVIOR_LABELS: Record<RateBookPricingBehavior, string> = {
  suggested: 'Suggest sell price',
  'cost-reference': 'Cost reference only',
  manual: 'Manual pricing',
};

export function resolveRateBookValues(item: RateBookItem, division?: RateBookDivision) {
  const override = division ? item.divisionOverrides.find((candidate) => candidate.division === division) : undefined;
  return {
    internalCost: override?.internalCost ?? item.internalCost,
    sellRate: override?.sellRate ?? item.sellRate,
  };
}
