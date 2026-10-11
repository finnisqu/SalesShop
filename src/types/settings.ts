import type { PricingMaterialType } from './quote';

export const MATERIAL_FAMILIES = ['Natural Stone', 'Engineered Surfaces', 'Other'] as const;
export type MaterialFamily = (typeof MATERIAL_FAMILIES)[number];

export const MATERIAL_TYPES_BY_FAMILY: Record<MaterialFamily, readonly PricingMaterialType[]> = {
  'Natural Stone': ['Granite', 'Quartzite', 'Marble', 'Dolomite', 'Soapstone', 'Onyx', 'Travertine', 'Limestone', 'Natural Stone'],
  'Engineered Surfaces': ['Quartz', 'Sintered Stone', 'Porcelain', 'Solid Surface', 'Terrazzo'],
  Other: ['Other'],
};

export function materialFamilyForType(materialType: PricingMaterialType): MaterialFamily {
  if (MATERIAL_TYPES_BY_FAMILY['Natural Stone'].includes(materialType)) return 'Natural Stone';
  if (MATERIAL_TYPES_BY_FAMILY['Engineered Surfaces'].includes(materialType)) return 'Engineered Surfaces';
  return 'Other';
}

export type StockMaterialUnit = 'sf' | 'slab' | 'each';
export type MaterialFormatKind = 'slab' | 'sheet' | 'half-slab' | 'half-sheet' | 'other';
export type MaterialPurchaseUnit = 'sf' | 'slab' | 'sheet' | 'half-slab' | 'half-sheet' | 'each';
export type MaterialAvailability = 'stock' | 'high' | 'medium' | 'low' | 'eta' | 'special-order' | 'discontinued' | 'unknown';
export type MaterialPriceProvenance = 'supplier-listed' | 'derived-from-listed-unit' | 'manual';

export interface MaterialPriceSource {
  kind: 'supplier-import' | 'manual';
  publicationId?: string;
  supplier?: string;
  brand?: string;
  sourceFileName?: string;
  sourcePageSheet?: string;
  sourceReference?: string;
  priceListLabel?: string;
  effectiveDate?: string;
  recordedAt: string;
  provenance?: MaterialPriceProvenance;
  parserId?: string;
  parserVersion?: number;
}

export interface MaterialPriceVersion {
  id: string;
  costPerSf?: number;
  costPerUnit?: number;
  recordedAt: string;
  effectiveDate?: string;
  source?: MaterialPriceSource;
}

export interface MaterialPurchaseOption {
  id: string;
  label: string;
  active: boolean;
  default: boolean;
  minQuantity?: number;
  pricingBasis: MaterialPurchaseUnit;
  costPerSf?: number;
  costPerUnit?: number;
  notes?: string;
  supplierNotes?: string;
  source?: MaterialPriceSource;
  priceHistory?: MaterialPriceVersion[];
}

export interface MaterialVariant {
  id: string;
  active: boolean;
  default: boolean;
  sku?: string;
  thickness?: string;
  finish?: string;
  formatName?: string;
  formatKind?: MaterialFormatKind;
  lengthIn?: number;
  widthIn?: number;
  areaSf?: number;
  availability?: MaterialAvailability;
  availabilityNote?: string;
  features?: string[];
  purchaseOptions: MaterialPurchaseOption[];
  notes?: string;
}

export interface StockMaterial {
  id: string;
  name: string;
  supplier?: string;
  brand?: string;
  collection?: string;
  supplierGroup?: string;
  sku?: string;
  materialFamily?: MaterialFamily;
  materialType: PricingMaterialType;
  stockProgram: boolean;
  internalCost?: number;
  unit: StockMaterialUnit;
  builderLevelId?: string;
  slabImageUrl?: string;
  closeUpImageUrl?: string;
  productUrl?: string;
  features?: string[];
  variants?: MaterialVariant[];
  notes?: string;
  active: boolean;
}

export function resolvedMaterialFamily(material: Pick<StockMaterial, 'materialFamily' | 'materialType'>): MaterialFamily {
  return material.materialFamily ?? materialFamilyForType(material.materialType);
}

export interface ResolvedMaterialCostReference {
  variant?: MaterialVariant;
  purchaseOption?: MaterialPurchaseOption;
  costPerSf?: number;
  slabCost?: number;
  basis: 'variant' | 'legacy' | 'none';
}

export function materialVariantAreaSf(variant?: MaterialVariant): number | undefined {
  if (!variant) return undefined;
  if (typeof variant.areaSf === 'number' && Number.isFinite(variant.areaSf) && variant.areaSf > 0) return variant.areaSf;
  if (typeof variant.lengthIn === 'number' && typeof variant.widthIn === 'number' && variant.lengthIn > 0 && variant.widthIn > 0) {
    return (variant.lengthIn * variant.widthIn) / 144;
  }
  return undefined;
}

export function defaultMaterialVariant(material: StockMaterial): MaterialVariant | undefined {
  const variants = (material.variants ?? []).filter((variant) => variant.active !== false);
  return variants.find((variant) => variant.default) ?? variants[0];
}

export function defaultMaterialPurchaseOption(variant?: MaterialVariant): MaterialPurchaseOption | undefined {
  if (!variant) return undefined;
  const options = (variant.purchaseOptions ?? []).filter((option) => option.active !== false);
  return options.find((option) => option.default) ?? options[0];
}

export function materialPurchaseCostPerSf(variant?: MaterialVariant, option?: MaterialPurchaseOption): number | undefined {
  if (!variant || !option) return undefined;
  if (typeof option.costPerSf === 'number' && Number.isFinite(option.costPerSf)) return option.costPerSf;
  if (typeof option.costPerUnit !== 'number' || !Number.isFinite(option.costPerUnit)) return undefined;
  if (!['slab', 'sheet', 'half-slab', 'half-sheet'].includes(option.pricingBasis)) return undefined;
  const area = materialVariantAreaSf(variant);
  if (!area) return undefined;
  return option.costPerUnit / area;
}

export function materialPurchaseSlabCost(variant?: MaterialVariant, option?: MaterialPurchaseOption): number | undefined {
  if (!variant || !option || variant.formatKind !== 'slab') return undefined;
  if (option.pricingBasis === 'slab' && typeof option.costPerUnit === 'number' && Number.isFinite(option.costPerUnit) && option.costPerUnit > 0) {
    return option.costPerUnit;
  }
  const area = materialVariantAreaSf(variant);
  if (!area || typeof option.costPerSf !== 'number' || !Number.isFinite(option.costPerSf) || option.costPerSf <= 0) return undefined;
  return option.costPerSf * area;
}

export function resolveStockMaterialCostReference(material: StockMaterial, variantId?: string, purchaseOptionId?: string): ResolvedMaterialCostReference {
  const activeVariants = (material.variants ?? []).filter((variant) => variant.active !== false);
  const variant = (variantId ? activeVariants.find((candidate) => candidate.id === variantId) : undefined)
    ?? activeVariants.find((candidate) => candidate.default)
    ?? activeVariants[0];
  if (variant) {
    const activeOptions = (variant.purchaseOptions ?? []).filter((option) => option.active !== false);
    const purchaseOption = (purchaseOptionId ? activeOptions.find((candidate) => candidate.id === purchaseOptionId) : undefined)
      ?? activeOptions.find((candidate) => candidate.default)
      ?? activeOptions[0];
    const costPerSf = materialPurchaseCostPerSf(variant, purchaseOption);
    const slabCost = materialPurchaseSlabCost(variant, purchaseOption);
    if (costPerSf !== undefined) return { variant, purchaseOption, costPerSf, slabCost, basis: 'variant' };
    if (material.unit === 'sf' && material.internalCost !== undefined) return { variant, purchaseOption, costPerSf: material.internalCost, basis: 'legacy' };
    return { variant, purchaseOption, slabCost, basis: 'none' };
  }
  if (material.unit === 'sf' && material.internalCost !== undefined) return { costPerSf: material.internalCost, basis: 'legacy' };
  return { basis: 'none' };
}

export interface CompanySettingsData {
  organizationName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  quoteContactName: string;
  quoteContactPhone: string;
  stockMaterials: StockMaterial[];
}

export const EMPTY_COMPANY_SETTINGS: CompanySettingsData = {
  organizationName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
  quoteContactName: '',
  quoteContactPhone: '',
  stockMaterials: [],
};
