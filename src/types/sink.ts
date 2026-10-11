export const SINK_CATEGORIES = ['kitchen', 'vanity', 'bar-prep', 'laundry', 'other'] as const;
export type SinkCategory = (typeof SINK_CATEGORIES)[number];

export const SINK_CATEGORY_LABELS: Record<SinkCategory, string> = {
  kitchen: 'Kitchen',
  vanity: 'Vanity',
  'bar-prep': 'Bar / Prep',
  laundry: 'Laundry',
  other: 'Other',
};

export const SINK_CONFIGURATIONS = ['single', '50/50', '60/40', '40/60', 'oval', 'rectangular', 'other'] as const;
export type SinkConfiguration = (typeof SINK_CONFIGURATIONS)[number];

export const SINK_CONFIGURATION_LABELS: Record<SinkConfiguration, string> = {
  single: 'Single bowl',
  '50/50': '50/50',
  '60/40': '60/40',
  '40/60': '40/60',
  oval: 'Oval',
  rectangular: 'Rectangular',
  other: 'Other',
};

export type SinkMountType = 'undermount' | 'drop-in' | 'apron-front' | 'vessel' | 'other';

export interface SinkPriceVersion {
  id: string;
  effectiveDate: string;
  internalCost?: number;
  sellPrice?: number;
  note?: string;
  recordedAt: string;
}

export interface SinkVariant {
  id: string;
  label: string;
  code?: string;
  configuration: SinkConfiguration;
  ada: boolean;
  active: boolean;
  default: boolean;
  internalCost?: number;
  sellPrice?: number;
  effectiveDate?: string;
  notes?: string;
  history: SinkPriceVersion[];
}

export interface SinkModel {
  id: string;
  name: string;
  modelCode?: string;
  brand?: string;
  supplier?: string;
  category: SinkCategory;
  widthIn?: number;
  depthIn?: number;
  mountType?: SinkMountType;
  material?: string;
  notes?: string;
  active: boolean;
  variants: SinkVariant[];
  createdAt: string;
  updatedAt: string;
}

export function defaultSinkVariant(model: SinkModel): SinkVariant | undefined {
  const active = model.variants.filter((variant) => variant.active);
  return active.find((variant) => variant.default) ?? active[0];
}

export function sinkVariantDisplayName(model: SinkModel, variant: SinkVariant) {
  if (model.variants.length <= 1 && variant.label.toLowerCase() === 'standard') return model.name;
  return `${model.name} · ${variant.label}`;
}
