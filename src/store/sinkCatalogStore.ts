import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  type SinkCategory,
  type SinkConfiguration,
  type SinkModel,
  type SinkPriceVersion,
  type SinkVariant,
} from '../types/sink';
import { useAuthStore } from './authStore';

interface SinkCatalogState {
  models: SinkModel[];
  hydrated: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  addModel: (category?: SinkCategory) => string;
  updateModel: (id: string, patch: Partial<SinkModel>) => void;
  addVariant: (modelId: string, seed?: Partial<SinkVariant>) => string;
  updateVariant: (modelId: string, variantId: string, patch: Partial<SinkVariant>) => void;
  duplicateVariant: (modelId: string, variantId: string) => string | null;
  deleteVariant: (modelId: string, variantId: string) => void;
}

const LOCAL_KEY = 'salesshop-sink-catalog-v1';
const SEED_TIME = '2026-10-07T00:00:00.000Z';
const SEED_DATE = '2026-10-07';
let saveTimer: number | undefined;
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function seededHistory(id: string, internalCost?: number, sellPrice?: number): SinkPriceVersion[] {
  if (internalCost === undefined && sellPrice === undefined) return [];
  return [{
    id: `sink_history_${id}`,
    effectiveDate: SEED_DATE,
    internalCost,
    sellPrice,
    note: 'Migrated from the legacy Sink Rate Book',
    recordedAt: SEED_TIME,
  }];
}

function seedVariant(
  id: string,
  label: string,
  configuration: SinkConfiguration,
  options: { code?: string; ada?: boolean; sellPrice?: number; default?: boolean } = {},
): SinkVariant {
  return {
    id,
    label,
    code: options.code,
    configuration,
    ada: options.ada ?? false,
    active: true,
    default: options.default ?? false,
    sellPrice: options.sellPrice,
    effectiveDate: options.sellPrice === undefined ? undefined : SEED_DATE,
    history: seededHistory(id, undefined, options.sellPrice),
  };
}

export const SINK_CATALOG_SEED: SinkModel[] = [
  {
    id: 'sink_model_3218',
    name: 'Kitchen 3218',
    modelCode: '3218',
    category: 'kitchen',
    widthIn: 32,
    depthIn: 18,
    mountType: 'undermount',
    active: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    variants: [
      seedVariant('sink_variant_3218_single', 'Standard Single', 'single', { code: '3218-S', sellPrice: 220, default: true }),
      seedVariant('sink_variant_3218_5050', 'Standard 50/50', '50/50', { code: '3218-5050', sellPrice: 220 }),
      seedVariant('sink_variant_3218_6040', 'Standard 60/40', '60/40', { code: '3218-6040', sellPrice: 220 }),
      seedVariant('sink_variant_3218_4060', 'Standard 40/60', '40/60', { code: '3218-4060' }),
      seedVariant('sink_variant_3218_ada_single', 'ADA Single', 'single', { code: '3218-ADA', ada: true, sellPrice: 245 }),
      seedVariant('sink_variant_3218_ada_5050', 'ADA 50/50', '50/50', { code: '3218-5050-ADA', ada: true }),
      seedVariant('sink_variant_3218_ada_6040', 'ADA 60/40', '60/40', { code: '3218-6040-ADA', ada: true }),
      seedVariant('sink_variant_3218_ada_4060', 'ADA 40/60', '40/60', { code: '3218-4060-ADA', ada: true }),
    ],
  },
  {
    id: 'sink_model_1714_oval',
    name: 'Oval Vanity 1714',
    modelCode: '1714-O',
    category: 'vanity',
    widthIn: 17,
    depthIn: 14,
    mountType: 'undermount',
    active: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    variants: [
      seedVariant('sink_variant_1714_standard', 'Standard', 'oval', { code: '1714-O', sellPrice: 75, default: true }),
      seedVariant('sink_variant_1714_ada', 'ADA', 'oval', { code: '1714-ADA', ada: true, sellPrice: 85 }),
    ],
  },
  {
    id: 'sink_model_1813_rect',
    name: 'Rectangular Vanity 1813',
    modelCode: '1813-R',
    category: 'vanity',
    widthIn: 18,
    depthIn: 13,
    mountType: 'undermount',
    active: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    variants: [
      seedVariant('sink_variant_1813_standard', 'Standard', 'rectangular', { code: '1813-R', sellPrice: 95, default: true }),
      seedVariant('sink_variant_1813_ada', 'ADA', 'rectangular', { code: '1813-ADA', ada: true, sellPrice: 105 }),
    ],
  },
];

function cloneDefaults() {
  return structuredClone(SINK_CATALOG_SEED);
}

function numberOrUndefined(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeHistory(value: unknown): SinkPriceVersion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const raw = entry as Partial<SinkPriceVersion>;
    return [{
      id: raw.id || uid('sink_history'),
      effectiveDate: raw.effectiveDate || SEED_DATE,
      internalCost: numberOrUndefined(raw.internalCost),
      sellPrice: numberOrUndefined(raw.sellPrice),
      note: raw.note,
      recordedAt: raw.recordedAt || SEED_TIME,
    }];
  });
}

function normalizeVariant(raw: Partial<SinkVariant>, index: number): SinkVariant {
  const configuration: SinkConfiguration = ['single', '50/50', '60/40', '40/60', 'oval', 'rectangular', 'other'].includes(String(raw.configuration))
    ? raw.configuration as SinkConfiguration
    : 'other';
  return {
    id: raw.id || uid('sink_variant'),
    label: raw.label || (index === 0 ? 'Standard' : `Variant ${index + 1}`),
    code: raw.code,
    configuration,
    ada: raw.ada ?? false,
    active: raw.active ?? true,
    default: raw.default ?? index === 0,
    internalCost: numberOrUndefined(raw.internalCost),
    sellPrice: numberOrUndefined(raw.sellPrice),
    effectiveDate: raw.effectiveDate,
    notes: raw.notes,
    history: normalizeHistory(raw.history),
  };
}

function normalizeModel(raw: Partial<SinkModel>, index: number): SinkModel {
  let variants = Array.isArray(raw.variants)
    ? raw.variants.map((variant, variantIndex) => normalizeVariant(variant, variantIndex))
    : [];
  if (!variants.length) variants = [normalizeVariant({ label: 'Standard', default: true }, 0)];
  if (!variants.some((variant) => variant.default && variant.active)) {
    const firstActive = variants.findIndex((variant) => variant.active);
    if (firstActive >= 0) variants = variants.map((variant, variantIndex) => ({ ...variant, default: variantIndex === firstActive }));
  }
  const category: SinkCategory = ['kitchen', 'vanity', 'bar-prep', 'laundry', 'other'].includes(String(raw.category))
    ? raw.category as SinkCategory
    : 'other';
  return {
    id: raw.id || uid('sink_model'),
    name: raw.name || `Sink model ${index + 1}`,
    modelCode: raw.modelCode,
    brand: raw.brand,
    supplier: raw.supplier,
    category,
    widthIn: numberOrUndefined(raw.widthIn),
    depthIn: numberOrUndefined(raw.depthIn),
    mountType: raw.mountType,
    material: raw.material,
    notes: raw.notes,
    active: raw.active ?? true,
    variants,
    createdAt: raw.createdAt || SEED_TIME,
    updatedAt: raw.updatedAt || raw.createdAt || SEED_TIME,
  };
}

function normalizeCatalog(value: unknown): SinkModel[] {
  if (!Array.isArray(value)) return [];
  return value.map((model, index) => normalizeModel(model as Partial<SinkModel>, index));
}

function readLocal(): SinkModel[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { models?: unknown[] };
    return Array.isArray(parsed.models) ? normalizeCatalog(parsed.models) : null;
  } catch {
    return null;
  }
}

function writeLocal(models: SinkModel[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ schemaVersion: 1, models }));
  } catch {
    // Best-effort cache; cloud mode remains authoritative.
  }
}

async function persistCloud(models: SinkModel[]) {
  const auth = useAuthStore.getState();
  if (!supabase || auth.mode !== 'cloud' || !auth.organizationId) return;
  useSinkCatalogStore.setState({ saving: true, error: null });
  const { error } = await supabase
    .from('organizations')
    .update({ sink_catalog: models, updated_at: new Date().toISOString() })
    .eq('id', auth.organizationId);
  useSinkCatalogStore.setState({ saving: false, error: error?.message ?? null });
}

function schedulePersist(models: SinkModel[]) {
  writeLocal(models);
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void persistCloud(models); }, 550);
}

function upsertVariantHistory(variant: SinkVariant): SinkVariant {
  const effectiveDate = variant.effectiveDate || new Date().toISOString().slice(0, 10);
  const next: SinkPriceVersion = {
    id: uid('sink_history'),
    effectiveDate,
    internalCost: variant.internalCost,
    sellPrice: variant.sellPrice,
    recordedAt: new Date().toISOString(),
  };
  const current = variant.history.find((version) => version.effectiveDate === effectiveDate);
  return {
    ...variant,
    effectiveDate,
    history: current
      ? variant.history.map((version) => version.effectiveDate === effectiveDate ? { ...next, id: version.id, note: version.note } : version)
      : [...variant.history, next],
  };
}

function updateModels(
  set: (patch: Partial<SinkCatalogState>) => void,
  get: () => SinkCatalogState,
  updater: (models: SinkModel[]) => SinkModel[],
) {
  const models = updater(get().models);
  set({ models });
  schedulePersist(models);
}

export const useSinkCatalogStore = create<SinkCatalogState>((set, get) => ({
  models: [],
  hydrated: false,
  saving: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const local = readLocal();
    const auth = useAuthStore.getState();
    if (!supabase || auth.mode !== 'cloud' || !auth.organizationId) {
      const models = local ?? cloneDefaults();
      writeLocal(models);
      set({ models, hydrated: true });
      return;
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('sink_catalog')
      .eq('id', auth.organizationId)
      .single();
    if (error || !data) {
      const models = local ?? cloneDefaults();
      set({ models, hydrated: true, error: error?.message ?? null });
      return;
    }

    if (data.sink_catalog === null) {
      const models = local ?? cloneDefaults();
      writeLocal(models);
      set({ models, hydrated: true, error: null });
      await persistCloud(models);
      return;
    }

    const models = normalizeCatalog(data.sink_catalog);
    writeLocal(models);
    set({ models, hydrated: true, error: null });
  },

  addModel: (category = 'kitchen') => {
    const id = uid('sink_model');
    const variantId = uid('sink_variant');
    const now = new Date().toISOString();
    const model: SinkModel = {
      id,
      name: 'New sink model',
      category,
      active: true,
      variants: [{
        id: variantId,
        label: 'Standard',
        configuration: category === 'vanity' ? 'rectangular' : 'single',
        ada: false,
        active: true,
        default: true,
        history: [],
      }],
      createdAt: now,
      updatedAt: now,
    };
    updateModels(set, get, (models) => [...models, model]);
    return id;
  },

  updateModel: (id, patch) => {
    updateModels(set, get, (models) => models.map((model) => model.id === id
      ? { ...model, ...patch, updatedAt: new Date().toISOString() }
      : model));
  },

  addVariant: (modelId, seed = {}) => {
    const id = uid('sink_variant');
    updateModels(set, get, (models) => models.map((model) => {
      if (model.id !== modelId) return model;
      const variant: SinkVariant = {
        id,
        label: seed.label || `Variant ${model.variants.length + 1}`,
        code: seed.code,
        configuration: seed.configuration ?? (model.category === 'vanity' ? 'rectangular' : 'single'),
        ada: seed.ada ?? false,
        active: seed.active ?? true,
        default: seed.default ?? model.variants.length === 0,
        internalCost: seed.internalCost,
        sellPrice: seed.sellPrice,
        effectiveDate: seed.effectiveDate,
        notes: seed.notes,
        history: structuredClone(seed.history ?? []),
      };
      return { ...model, variants: [...model.variants, variant], updatedAt: new Date().toISOString() };
    }));
    return id;
  },

  updateVariant: (modelId, variantId, patch) => {
    updateModels(set, get, (models) => models.map((model) => {
      if (model.id !== modelId) return model;
      const pricingChanged = Object.prototype.hasOwnProperty.call(patch, 'internalCost')
        || Object.prototype.hasOwnProperty.call(patch, 'sellPrice')
        || Object.prototype.hasOwnProperty.call(patch, 'effectiveDate');
      let variants = model.variants.map((variant) => {
        if (patch.default && variant.id !== variantId) return { ...variant, default: false };
        if (variant.id !== variantId) return variant;
        const next = { ...variant, ...patch };
        return pricingChanged ? upsertVariantHistory(next) : next;
      });
      const changed = variants.find((variant) => variant.id === variantId);
      if (changed && !changed.active && changed.default) {
        const fallback = variants.find((variant) => variant.id !== variantId && variant.active);
        if (fallback) variants = variants.map((variant) => ({ ...variant, default: variant.id === fallback.id }));
      }
      return { ...model, variants, updatedAt: new Date().toISOString() };
    }));
  },

  duplicateVariant: (modelId, variantId) => {
    const model = get().models.find((candidate) => candidate.id === modelId);
    const source = model?.variants.find((variant) => variant.id === variantId);
    if (!model || !source) return null;
    const id = uid('sink_variant');
    const copy: SinkVariant = {
      ...structuredClone(source),
      id,
      label: `${source.label} copy`,
      default: false,
      history: source.history.map((version) => ({ ...structuredClone(version), id: uid('sink_history') })),
    };
    updateModels(set, get, (models) => models.map((candidate) => candidate.id === modelId
      ? { ...candidate, variants: [...candidate.variants, copy], updatedAt: new Date().toISOString() }
      : candidate));
    return id;
  },

  deleteVariant: (modelId, variantId) => {
    updateModels(set, get, (models) => models.map((model) => {
      if (model.id !== modelId || model.variants.length <= 1) return model;
      let variants = model.variants.filter((variant) => variant.id !== variantId);
      if (!variants.some((variant) => variant.default && variant.active)) {
        const fallback = variants.find((variant) => variant.active);
        if (fallback) variants = variants.map((variant) => ({ ...variant, default: variant.id === fallback.id }));
      }
      return { ...model, variants, updatedAt: new Date().toISOString() };
    }));
  },
}));
