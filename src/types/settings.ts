import type { PricingMaterialType } from './quote';

export type StockMaterialUnit = 'sf' | 'slab' | 'each';
export type MaterialFormatKind = 'slab' | 'sheet' | 'half-slab' | 'half-sheet' | 'other';
export type MaterialPurchaseUnit = 'sf' | 'slab' | 'sheet' | 'half-slab' | 'half-sheet' | 'each';
export type MaterialAvailability = 'stock' | 'high' | 'medium' | 'low' | 'eta' | 'special-order' | 'discontinued' | 'unknown';

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
  materialType: PricingMaterialType;
  stockProgram: boolean;
  internalCost?: number;
  unit: StockMaterialUnit;
  builderLevelId?: string;
  features?: string[];
  variants?: MaterialVariant[];
  notes?: string;
  active: boolean;
}

export interface ResolvedMaterialCostReference {
  variant?: MaterialVariant;
  purchaseOption?: MaterialPurchaseOption;
  costPerSf?: number;
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
    if (costPerSf !== undefined) return { variant, purchaseOption, costPerSf, basis: 'variant' };
    if (material.unit === 'sf' && material.internalCost !== undefined) return { variant, purchaseOption, costPerSf: material.internalCost, basis: 'legacy' };
    return { variant, purchaseOption, basis: 'none' };
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
