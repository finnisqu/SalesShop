import { create } from 'zustand';
import type { MaterialLevelGuideDocument, MaterialLevelGuideVersion, MaterialLevelRule } from '../types/materialLevelGuide';

interface MaterialLevelGuideState {
  guide: MaterialLevelGuideDocument;
  hydrated: boolean;
  hydrate: () => void;
  updateGuide: (patch: Partial<Pick<MaterialLevelGuideDocument, 'name' | 'note'>>) => void;
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
  { id: 'builder_level_1', label: 'Level 1', maxMaterialCost: 9, pricingMode: 'fixed', customerRate: 34, active: true },
  { id: 'builder_level_2', label: 'Level 2', maxMaterialCost: 12, pricingMode: 'fixed', customerRate: 44, active: true },
  { id: 'builder_level_3', label: 'Level 3', maxMaterialCost: 14, pricingMode: 'fixed', customerRate: 54, active: true },
  { id: 'builder_level_4', label: 'Level 4', maxMaterialCost: 16, pricingMode: 'fixed', customerRate: 60, active: true },
  { id: 'builder_level_5', label: 'Level 5', maxMaterialCost: 19, pricingMode: 'fixed', customerRate: 68, active: true },
  { id: 'builder_level_6', label: 'Level 6', maxMaterialCost: 21, pricingMode: 'fixed', customerRate: 75, active: true },
  { id: 'builder_level_7', label: 'Level 7', maxMaterialCost: 23, pricingMode: 'fixed', customerRate: 85, active: true },
  { id: 'builder_level_premium', label: 'Premium / 23+', pricingMode: 'multiplier', multiplier: 2.2, active: true },
];

function baselineGuide(): MaterialLevelGuideDocument {
  const rules = structuredClone(BASELINE_RULES);
  return {
    schemaVersion: 1,
    id: 'standard-builder-level-guide',
    name: 'Standard Builder Level Guide',
    note: 'Baseline supplied before the most recent quartz tariff increase. Keep material costs current and review the guide as pricing changes.',
    rules,
    history: [{
      id: 'guide_version_baseline',
      recordedAt: SEED_TIME,
      note: 'Pre-tariff builder baseline supplied in SalesShop.',
      rules: structuredClone(rules),
    }],
    updatedAt: SEED_TIME,
  };
}

function normalizeRule(raw: Partial<MaterialLevelRule>, index: number): MaterialLevelRule {
  const pricingMode = raw.pricingMode === 'multiplier' ? 'multiplier' : 'fixed';
  return {
    id: raw.id || uid('material_level'),
    label: raw.label || `Level ${index + 1}`,
    maxMaterialCost: typeof raw.maxMaterialCost === 'number' ? raw.maxMaterialCost : undefined,
    pricingMode,
    customerRate: typeof raw.customerRate === 'number' ? raw.customerRate : undefined,
    multiplier: typeof raw.multiplier === 'number' ? raw.multiplier : undefined,
    active: raw.active ?? true,
  };
}

function normalizeVersion(raw: Partial<MaterialLevelGuideVersion>): MaterialLevelGuideVersion | null {
  if (!Array.isArray(raw.rules)) return null;
  return {
    id: raw.id || uid('guide_version'),
    recordedAt: raw.recordedAt || new Date().toISOString(),
    note: raw.note,
    rules: raw.rules.map((rule, index) => normalizeRule(rule, index)),
  };
}

function readLocal(): MaterialLevelGuideDocument {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return baselineGuide();
    const parsed = JSON.parse(raw) as Partial<MaterialLevelGuideDocument>;
    const baseline = baselineGuide();
    const rules = Array.isArray(parsed.rules) && parsed.rules.length
      ? parsed.rules.map((rule, index) => normalizeRule(rule, index))
      : baseline.rules;
    const history = Array.isArray(parsed.history)
      ? parsed.history.map((version) => normalizeVersion(version)).filter((version): version is MaterialLevelGuideVersion => Boolean(version))
      : baseline.history;
    return {
      schemaVersion: 1,
      id: parsed.id || baseline.id,
      name: parsed.name || baseline.name,
      note: parsed.note ?? baseline.note,
      rules,
      history: history.length ? history : baseline.history,
      updatedAt: parsed.updatedAt || baseline.updatedAt,
    };
  } catch {
    return baselineGuide();
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
    const guide = {
      ...get().guide,
      rules: [...get().guide.rules, { id, label: `Level ${get().guide.rules.length + 1}`, pricingMode: 'fixed' as const, active: true }],
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
    };
    const guide = { ...get().guide, history: [version, ...get().guide.history], updatedAt: new Date().toISOString() };
    persist(guide);
    set({ guide });
  },

  restoreVersion: (versionId) => {
    const version = get().guide.history.find((candidate) => candidate.id === versionId);
    if (!version) return;
    const guide = { ...get().guide, rules: structuredClone(version.rules), updatedAt: new Date().toISOString() };
    persist(guide);
    set({ guide });
  },
}));
