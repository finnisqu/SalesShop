import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  EMPTY_COMPANY_SETTINGS,
  type CompanySettingsData,
  type MaterialPurchaseOption,
  type MaterialVariant,
  type StockMaterial,
} from '../types/settings';
import { useAuthStore } from './authStore';

interface CompanySettingsState {
  settings: CompanySettingsData;
  hydrated: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  update: (patch: Partial<CompanySettingsData>) => void;
  addStockMaterial: () => string;
  updateStockMaterial: (id: string, patch: Partial<StockMaterial>) => void;
  deleteStockMaterial: (id: string) => void;
  addMaterialVariant: (materialId: string) => string;
  updateMaterialVariant: (materialId: string, variantId: string, patch: Partial<MaterialVariant>) => void;
  deleteMaterialVariant: (materialId: string, variantId: string) => void;
  addMaterialPurchaseOption: (materialId: string, variantId: string) => string;
  updateMaterialPurchaseOption: (materialId: string, variantId: string, optionId: string, patch: Partial<MaterialPurchaseOption>) => void;
  deleteMaterialPurchaseOption: (materialId: string, variantId: string, optionId: string) => void;
  acceptPublishedStockMaterials: (materials: StockMaterial[]) => void;
}

const LOCAL_KEY = 'salesshop-company-settings-v1';
let saveTimer: number | undefined;
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function normalizePurchaseOption(raw: Partial<MaterialPurchaseOption>, index: number): MaterialPurchaseOption {
  const pricingBasis = ['sf', 'slab', 'sheet', 'half-slab', 'half-sheet', 'each'].includes(String(raw.pricingBasis))
    ? raw.pricingBasis as MaterialPurchaseOption['pricingBasis']
    : 'sf';
  return {
    id: raw.id || uid('material_price'),
    label: raw.label || (index === 0 ? 'Standard' : `Price ${index + 1}`),
    active: raw.active ?? true,
    default: raw.default ?? index === 0,
    minQuantity: typeof raw.minQuantity === 'number' ? raw.minQuantity : undefined,
    pricingBasis,
    costPerSf: typeof raw.costPerSf === 'number' ? raw.costPerSf : undefined,
    costPerUnit: typeof raw.costPerUnit === 'number' ? raw.costPerUnit : undefined,
    notes: raw.notes,
    supplierNotes: raw.supplierNotes,
    source: raw.source && typeof raw.source === 'object' ? raw.source : undefined,
    priceHistory: Array.isArray(raw.priceHistory) ? raw.priceHistory : [],
  };
}

function normalizeVariant(raw: Partial<MaterialVariant>, index: number): MaterialVariant {
  const options = Array.isArray(raw.purchaseOptions)
    ? raw.purchaseOptions.map((option, optionIndex) => normalizePurchaseOption(option, optionIndex))
    : [];
  if (options.length && !options.some((option) => option.default)) options[0] = { ...options[0], default: true };
  return {
    id: raw.id || uid('material_variant'),
    active: raw.active ?? true,
    default: raw.default ?? index === 0,
    sku: raw.sku,
    thickness: raw.thickness,
    finish: raw.finish,
    formatName: raw.formatName,
    formatKind: raw.formatKind,
    lengthIn: typeof raw.lengthIn === 'number' ? raw.lengthIn : undefined,
    widthIn: typeof raw.widthIn === 'number' ? raw.widthIn : undefined,
    areaSf: typeof raw.areaSf === 'number' ? raw.areaSf : undefined,
    availability: raw.availability,
    availabilityNote: raw.availabilityNote,
    features: Array.isArray(raw.features) ? raw.features.filter((feature): feature is string => typeof feature === 'string') : [],
    purchaseOptions: options,
    notes: raw.notes,
  };
}

function normalizeStockMaterial(raw: Partial<StockMaterial>, index: number): StockMaterial {
  const variants = Array.isArray(raw.variants)
    ? raw.variants.map((variant, variantIndex) => normalizeVariant(variant, variantIndex))
    : undefined;
  if (variants?.length && !variants.some((variant) => variant.default)) variants[0] = { ...variants[0], default: true };
  return {
    id: raw.id || uid('stock'),
    name: raw.name || `Material ${index + 1}`,
    supplier: raw.supplier,
    brand: raw.brand,
    collection: raw.collection,
    supplierGroup: raw.supplierGroup,
    sku: raw.sku,
    materialType: raw.materialType ?? 'Granite',
    stockProgram: raw.stockProgram ?? true,
    internalCost: typeof raw.internalCost === 'number' ? raw.internalCost : undefined,
    unit: raw.unit ?? 'sf',
    builderLevelId: raw.builderLevelId,
    slabImageUrl: raw.slabImageUrl,
    closeUpImageUrl: raw.closeUpImageUrl,
    productUrl: raw.productUrl,
    features: Array.isArray(raw.features) ? raw.features.filter((feature): feature is string => typeof feature === 'string') : [],
    variants,
    notes: raw.notes,
    active: raw.active ?? true,
  };
}

function normalizeMaterials(value: unknown): StockMaterial[] {
  if (!Array.isArray(value)) return [];
  return value.map((material, index) => normalizeStockMaterial(material as Partial<StockMaterial>, index));
}

function readLocal(): CompanySettingsData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { ...EMPTY_COMPANY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CompanySettingsData>;
    return { ...EMPTY_COMPANY_SETTINGS, ...parsed, stockMaterials: normalizeMaterials(parsed.stockMaterials) };
  } catch {
    return { ...EMPTY_COMPANY_SETTINGS };
  }
}

function writeLocal(settings: CompanySettingsData) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
}

function dbPayload(settings: CompanySettingsData) {
  return {
    name: settings.organizationName.trim() || 'My Shop',
    address: settings.address.trim() || null,
    phone: settings.phone.trim() || null,
    email: settings.email.trim() || null,
    website: settings.website.trim() || null,
    logo_url: settings.logoUrl.trim() || null,
    quote_contact_name: settings.quoteContactName.trim() || null,
    quote_contact_phone: settings.quoteContactPhone.trim() || null,
    stock_materials: settings.stockMaterials,
    updated_at: new Date().toISOString(),
  };
}

async function persistCloud(settings: CompanySettingsData) {
  const auth = useAuthStore.getState();
  if (!supabase || auth.mode !== 'cloud' || !auth.organizationId) return;
  useCompanySettingsStore.setState({ saving: true, error: null });
  const { error } = await supabase.from('organizations').update(dbPayload(settings)).eq('id', auth.organizationId);
  useCompanySettingsStore.setState({ saving: false, error: error?.message ?? null });
}

function schedulePersist(settings: CompanySettingsData) {
  writeLocal(settings);
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void persistCloud(settings); }, 550);
}

function persistMaterialUpdate(
  set: (patch: Partial<CompanySettingsState>) => void,
  get: () => CompanySettingsState,
  updater: (materials: StockMaterial[]) => StockMaterial[],
) {
  const settings = { ...get().settings, stockMaterials: updater(get().settings.stockMaterials) };
  set({ settings });
  schedulePersist(settings);
}

export const useCompanySettingsStore = create<CompanySettingsState>((set, get) => ({
  settings: { ...EMPTY_COMPANY_SETTINGS },
  hydrated: false,
  saving: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const local = readLocal();
    const auth = useAuthStore.getState();
    if (!supabase || auth.mode !== 'cloud' || !auth.organizationId) {
      set({ settings: local, hydrated: true });
      return;
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('name,address,phone,email,website,logo_url,quote_contact_name,quote_contact_phone,stock_materials')
      .eq('id', auth.organizationId)
      .single();
    if (error || !data) {
      set({ settings: local, hydrated: true, error: error?.message ?? null });
      return;
    }
    const settings: CompanySettingsData = {
      organizationName: String(data.name ?? ''),
      address: String(data.address ?? ''),
      phone: String(data.phone ?? ''),
      email: String(data.email ?? ''),
      website: String(data.website ?? ''),
      logoUrl: String(data.logo_url ?? ''),
      quoteContactName: String(data.quote_contact_name ?? ''),
      quoteContactPhone: String(data.quote_contact_phone ?? ''),
      stockMaterials: normalizeMaterials(data.stock_materials),
    };
    writeLocal(settings);
    set({ settings, hydrated: true, error: null });
  },

  update: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    schedulePersist(settings);
  },

  addStockMaterial: () => {
    const id = uid('stock');
    const variantId = uid('material_variant');
    const optionId = uid('material_price');
    const material: StockMaterial = {
      id,
      name: 'New material color',
      materialType: 'Quartz',
      stockProgram: false,
      unit: 'sf',
      active: true,
      features: [],
      variants: [{
        id: variantId,
        active: true,
        default: true,
        finish: 'Polished',
        formatKind: 'slab',
        features: [],
        purchaseOptions: [{ id: optionId, label: 'Standard', active: true, default: true, pricingBasis: 'sf' }],
      }],
    };
    const settings = { ...get().settings, stockMaterials: [...get().settings.stockMaterials, material] };
    set({ settings });
    schedulePersist(settings);
    return id;
  },

  updateStockMaterial: (id, patch) => {
    persistMaterialUpdate(set, get, (materials) => materials.map((material) => material.id === id ? { ...material, ...patch } : material));
  },

  deleteStockMaterial: (id) => {
    persistMaterialUpdate(set, get, (materials) => materials.filter((material) => material.id !== id));
  },

  addMaterialVariant: (materialId) => {
    const id = uid('material_variant');
    const optionId = uid('material_price');
    persistMaterialUpdate(set, get, (materials) => materials.map((material) => {
      if (material.id !== materialId) return material;
      const existing = material.variants ?? [];
      const variant: MaterialVariant = {
        id,
        active: true,
        default: existing.length === 0,
        finish: 'Polished',
        features: [],
        purchaseOptions: [{ id: optionId, label: 'Standard', active: true, default: true, pricingBasis: 'sf' }],
      };
      return { ...material, variants: [...existing, variant] };
    }));
    return id;
  },

  updateMaterialVariant: (materialId, variantId, patch) => {
    persistMaterialUpdate(set, get, (materials) => materials.map((material) => {
      if (material.id !== materialId) return material;
      const variants = (material.variants ?? []).map((variant) => {
        if (patch.default && variant.id !== variantId) return { ...variant, default: false };
        return variant.id === variantId ? { ...variant, ...patch } : variant;
      });
      return { ...material, variants };
    }));
  },

  deleteMaterialVariant: (materialId, variantId) => {
    persistMaterialUpdate(set, get, (materials) => materials.map((material) => {
      if (material.id !== materialId) return material;
      let variants = (material.variants ?? []).filter((variant) => variant.id !== variantId);
      if (variants.length && !variants.some((variant) => variant.default)) variants = variants.map((variant, index) => index === 0 ? { ...variant, default: true } : variant);
      return { ...material, variants };
    }));
  },

  addMaterialPurchaseOption: (materialId, variantId) => {
    const id = uid('material_price');
    persistMaterialUpdate(set, get, (materials) => materials.map((material) => {
      if (material.id !== materialId) return material;
      const variants = (material.variants ?? []).map((variant) => {
        if (variant.id !== variantId) return variant;
        const existing = variant.purchaseOptions ?? [];
        const option: MaterialPurchaseOption = { id, label: existing.length ? `Price ${existing.length + 1}` : 'Standard', active: true, default: existing.length === 0, pricingBasis: 'sf' };
        return { ...variant, purchaseOptions: [...existing, option] };
      });
      return { ...material, variants };
    }));
    return id;
  },

  updateMaterialPurchaseOption: (materialId, variantId, optionId, patch) => {
    persistMaterialUpdate(set, get, (materials) => materials.map((material) => {
      if (material.id !== materialId) return material;
      const variants = (material.variants ?? []).map((variant) => {
        if (variant.id !== variantId) return variant;
        const purchaseOptions = (variant.purchaseOptions ?? []).map((option) => {
          if (patch.default && option.id !== optionId) return { ...option, default: false };
          return option.id === optionId ? { ...option, ...patch } : option;
        });
        return { ...variant, purchaseOptions };
      });
      return { ...material, variants };
    }));
  },

  deleteMaterialPurchaseOption: (materialId, variantId, optionId) => {
    persistMaterialUpdate(set, get, (materials) => materials.map((material) => {
      if (material.id !== materialId) return material;
      const variants: MaterialVariant[] = (material.variants ?? []).map((variant): MaterialVariant => {
        if (variant.id !== variantId) return variant;
        let purchaseOptions = (variant.purchaseOptions ?? []).filter((option) => option.id !== optionId);
        if (purchaseOptions.length && !purchaseOptions.some((option) => option.default)) purchaseOptions = purchaseOptions.map((option, index) => index === 0 ? { ...option, default: true } : option);
        return { ...variant, purchaseOptions };
      });
      return { ...material, variants };
    }));
  },

  acceptPublishedStockMaterials: (materials) => {
    const settings = { ...get().settings, stockMaterials: normalizeMaterials(materials) };
    writeLocal(settings);
    set({ settings, saving: false, error: null });
  },
}));