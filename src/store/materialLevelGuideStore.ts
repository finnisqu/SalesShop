import { create } from 'zustand';
import type { MaterialLevelGuideDocument, MaterialLevelGuideVersion, MaterialLevelRule } from '../types/materialLevelGuide';

interface MaterialLevelGuideState {
  guide: MaterialLevelGuideDocument;
  hydrated: boolean;
  hydrate: () => void;
  updateGuide: (patch: Partial<Pick<MaterialLevelGuideDocument, 'name' | 'note' | 'slabPricingThresholdCostPerSf' | 'slabPricingMultiplier'>>) => void;
  updateRule: (id: string, patch: Partial<Omit<MaterialLevelRule, 'id'>>) => void;
  addRule: () => string;
  removeRule: (id: string) => void;
  captureVersion: (note?: string) => void;
  restoreVersion: (versionId: string) => void;
}

const LOCAL_KEY = 'salesshop-material-level-guide-v1';
const SEED_TIME = '2026-10-06T15:52:00.000Z';
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const BASELINE_RULES: MaterialLevelRule[] = [
  { id: 'builder_level_1', label: 'Level 1', maxMaterialCost: 9, customerRate: 34, active: true },
  { id: 'builder_level_2', label: 'Level 2', maxMaterialCost: 12, customerRate: 44, active: true },
  { id: 'builder_level_3', label: 'Level 3', maxMaterialCost: 14, customerRate: 54, active: true },
  { id: 'builder_level_4', label: 'Level 4', maxMaterialCost: 16, customerRate: 60, active: true },
  { id: 'builder_level_5', label: 'Level 5', maxMaterialCost: 19, customerRate: 68, active: true },
  { id: 'builder_level_6', label: 'Level 6', maxMaterialCost: 21, customerRate: 75, active: true },
  { id: 'builder_level_7', label: 'Level 7', maxMaterialCost: 23, customerRate: 85, active: true },
];

function baselineGuide(): MaterialLevelGuideDocument {
  const rules = structuredClone(BASELINE_RULES);
  return {
    schemaVersion: 3,
    id: 'standard-builder-level-guide',
    name: 'Standard Builder Pricing Guide',
    note: 'SalesShop suggests the standard Level from effective material cost. Above the normal Level range, review slab-based pricing using actual slabs purchased × the slab multiplier.',
    rules,
    slabPricingThresholdCostPerSf: 23,
    slabPricingMultiplier: 2.2,
    history: [{
      id: 'guide_version_baseline_v3',
      recordedAt: SEED_TIME,
      note: 'Standard builder Level guide with premium slab-review policy.',
      rules: structuredClone(rules),
      slabPricingThresholdCostPerSf: 23,
      slabPricingMultiplier: 2.2,
    }],
    updatedAt: SEED_TIME,
  };
}

function normalizeRule(raw: Record<string, unknown>, index: number): MaterialLevelRule | null {
  const pricingMode = raw.pricingMode;
  const maxMaterialCost = typeof raw.maxMaterialCost === 'number' && Number.isFinite(raw.maxMaterialCost)
    ? raw.maxMaterialCost
    : undefined;
  const customerRate = typeof raw.customerRate === 'number' && Number.isFinite(raw.customerRate)
    ? raw.customerRate
    : undefined;

  // v1/v2 allowed an open-ended multiplier row. That represented the old,
  // incorrect "$/SF × 2.2" behavior and is intentionally not migrated as a Level.
  if (pricingMode === 'multiplier' || maxMaterialCost === undefined || customerRate === undefined) return null;

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid('material_level'),
    label: typeof raw.label === 'string' && raw.label ? raw.label : `Level ${index + 1}`,
    maxMaterialCost,
    customerRate,
    active: typeof raw.active === 'boolean' ? raw.active : true,
  };
}

function normalizeRules(value: unknown) {
  if (!Array.isArray(value)) return structuredClone(BASELINE_RULES);
  const rules = value
    .map((rule, index) => rule && typeof rule === 'object' ? normalizeRule(rule as Record<string, unknown>, index) : null)
    .filter((rule): rule is MaterialLevelRule => Boolean(rule));
  return rules.length ? rules : structuredClone(BASELINE_RULES);
}

function legacyPremiumMultiplier(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const parsed = value as Record<string, unknown>;
  if (Array.isArray(parsed.rules)) {
    const premium = parsed.rules.find((rule) =>
      rule && typeof rule === 'object'
      && (rule as Record<string, unknown>).pricingMode === 'multiplier'
      && typeof (rule as Record<string, unknown>).multiplier === 'number',
    ) as Record<string, unknown> | undefined;
    if (premium && typeof premium.multiplier === 'number') return premium.multiplier;
  }
  if (typeof parsed.nonStockMultiplier === 'number') return parsed.nonStockMultiplier;
  return undefined;
}

function normalizeVersion(raw: unknown, fallbackThreshold: number, fallbackMultiplier: number): MaterialLevelGuideVersion | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Record<string, unknown>;
  const rules = normalizeRules(parsed.rules);
  const maxLevelCost = Math.max(...rules.map((rule) => rule.maxMaterialCost));
  return {
    id: typeof parsed.id === 'string' && parsed.id ? parsed.id : uid('guide_version'),
    recordedAt: typeof parsed.recordedAt === 'string' && parsed.recordedAt ? parsed.recordedAt : new Date().toISOString(),
    note: typeof parsed.note === 'string' ? parsed.note : undefined,
    rules,
    slabPricingThresholdCostPerSf: typeof parsed.slabPricingThresholdCostPerSf === 'number'
      ? parsed.slabPricingThresholdCostPerSf
      : maxLevelCost || fallbackThreshold,
    slabPricingMultiplier: typeof parsed.slabPricingMultiplier === 'number'
      ? parsed.slabPricingMultiplier
      : legacyPremiumMultiplier(parsed) ?? fallbackMultiplier,
  };
}

function readLocal(): MaterialLevelGuideDocument {
  const baseline = baselineGuide();
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return baseline;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rules = normalizeRules(parsed.rules);
    const highestLevelCost = Math.max(...rules.map((rule) => rule.maxMaterialCost));
    const threshold = typeof parsed.slabPricingThresholdCostPerSf === 'number'
      ? parsed.slabPricingThresholdCostPerSf
      : highestLevelCost || baseline.slabPricingThresholdCostPerSf;
    const multiplier = typeof parsed.slabPricingMultiplier === 'number'
      ? parsed.slabPricingMultiplier
      : legacyPremiumMultiplier(parsed) ?? baseline.slabPricingMultiplier;
    const history = Array.isArray(parsed.history)
      ? parsed.history
          .map((version) => normalizeVersion(version, threshold, multiplier))
          .filter((version): version is MaterialLevelGuideVersion => Boolean(version))
      : [];

    return {
      schemaVersion: 3,
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : baseline.id,
      name: typeof parsed.name === 'string' && parsed.name ? parsed.name : baseline.name,
      note: typeof parsed.note === 'string' ? parsed.note : baseline.note,
      rules,
      slabPricingThresholdCostPerSf: threshold,
      slabPricingMultiplier: multiplier,
      history: history.length ? history : baseline.history,
      updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : baseline.updatedAt,
    };
  } catch {
    return baseline;
  }
}

function persist(guide: MaterialLevelGuideDocument) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(guide));
}

export const useMaterialLevelGuideStore = create<MaterialLevelGuideState>((set, get) => ({
  guide: baselineGuide(),
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const guide = readLocal();
    persist(guide);
    set({ guide, hydrated: true });
  },

  updateGuide: (patch) => {
    const guide = { ...get().guide, ...patch, updatedAt: new Date().toISOString() };
    persist(guide);
    set({ guide });
  },

  updateRule: (id, patch) => {
    const guide = {
      ...get().guide,
      rules: get().guide.rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule),
      updatedAt: new Date().toISOString(),
    };
    persist(guide);
    set({ guide });
  },

  addRule: () => {
    const id = uid('material_level');
    const currentRules = [...get().guide.rules].sort((a, b) => a.maxMaterialCost - b.maxMaterialCost);
    const previous = currentRules.at(-1);
    const guide = {
      ...get().guide,
      rules: [...get().guide.rules, {
        id,
        label: `Level ${get().guide.rules.length + 1}`,
        maxMaterialCost: previous ? previous.maxMaterialCost + 2 : 10,
        customerRate: previous ? previous.customerRate + 10 : 40,
        active: true,
      }],
      updatedAt: new Date().toISOString(),
    };
    persist(guide);
    set({ guide });
    return id;
  },

  removeRule: (id) => {
    if (get().guide.rules.length <= 1) return;
    const guide = { ...get().guide, rules: get().guide.rules.filter((rule) => rule.id !== id), updatedAt: new Date().toISOString() };
    persist(guide);
    set({ guide });
  },

  captureVersion: (note) => {
    const version: MaterialLevelGuideVersion = {
      id: uid('guide_version'),
      recordedAt: new Date().toISOString(),
      note: note?.trim() || 'Manual guide checkpoint',
      rules: structuredClone(get().guide.rules),
      slabPricingThresholdCostPerSf: get().guide.slabPricingThresholdCostPerSf,
      slabPricingMultiplier: get().guide.slabPricingMultiplier,
    };
    const guide = { ...get().guide, history: [version, ...get().guide.history], updatedAt: new Date().toISOString() };
    persist(guide);
    set({ guide });
  },

  restoreVersion: (versionId) => {
    const version = get().guide.history.find((candidate) => candidate.id === versionId);
    if (!version) return;
    const current = get().guide;
    const guide: MaterialLevelGuideDocument = {
      ...current,
      rules: structuredClone(version.rules),
      slabPricingThresholdCostPerSf: version.slabPricingThresholdCostPerSf,
      slabPricingMultiplier: version.slabPricingMultiplier,
      updatedAt: new Date().toISOString(),
    };
    persist(guide);
    set({ guide });
  },
}));
