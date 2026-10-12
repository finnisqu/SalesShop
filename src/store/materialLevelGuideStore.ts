import { create } from 'zustand';
import { scopedStorageKey } from '../lib/developerPlayground';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import type { MaterialLevelGuideDocument, MaterialLevelGuideVersion, MaterialLevelRule } from '../types/materialLevelGuide';

interface MaterialLevelGuideState {
  guide: MaterialLevelGuideDocument;
  hydrated: boolean;
  syncError?: string;
  hydrate: () => void;
  updateGuide: (patch: Partial<Pick<MaterialLevelGuideDocument, 'name' | 'note' | 'slabPricingThresholdCostPerSf' | 'slabPricingMultiplier'>>) => void;
  updateRule: (id: string, patch: Partial<Omit<MaterialLevelRule, 'id'>>) => void;
  addRule: () => string;
  removeRule: (id: string) => void;
  captureVersion: (note?: string) => void;
  restoreVersion: (versionId: string) => void;
}

const LEGACY_LOCAL_KEY = scopedStorageKey('salesshop-material-level-guide-v1');
const localKey=()=>{
  const auth=useAuthStore.getState();
  return auth.mode==='cloud'&&auth.organizationId
    ?LEGACY_LOCAL_KEY+':org:'+auth.organizationId:LEGACY_LOCAL_KEY;
};
let cloudSaveTimer: ReturnType<typeof setTimeout>|undefined;
let hydrationStarted=false;
const SEED_TIME = '2026-10-06T15:52:00.000Z';
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

/** Previous built-in schedule, retained only for safe migration detection. */
const LEGACY_BASELINE_RULES: MaterialLevelRule[] = [
  { id: 'builder_level_1', label: 'Level 1', maxMaterialCost: 9, customerRate: 34, active: true },
  { id: 'builder_level_2', label: 'Level 2', maxMaterialCost: 12, customerRate: 44, active: true },
  { id: 'builder_level_3', label: 'Level 3', maxMaterialCost: 14, customerRate: 54, active: true },
  { id: 'builder_level_4', label: 'Level 4', maxMaterialCost: 16, customerRate: 60, active: true },
  { id: 'builder_level_5', label: 'Level 5', maxMaterialCost: 19, customerRate: 68, active: true },
  { id: 'builder_level_6', label: 'Level 6', maxMaterialCost: 21, customerRate: 75, active: true },
  { id: 'builder_level_7', label: 'Level 7', maxMaterialCost: 23, customerRate: 85, active: true },
];

/** Approved historical material cost bands and selling price reference. */
export const DEFAULT_BUILDER_LEVEL_RATES = [34,44,54,60,68,75,85,115,125] as const;
const BASELINE_RULES: MaterialLevelRule[] = [
  { id: 'builder_level_0', label: 'Level 0', maxMaterialCost: 9, customerRate: 34, active: true, graniteOnly: true },
  { id: 'builder_level_1', label: 'Level 1', maxMaterialCost: 12, customerRate: 44, active: true },
  { id: 'builder_level_2', label: 'Level 2', maxMaterialCost: 14, customerRate: 54, active: true },
  { id: 'builder_level_3', label: 'Level 3', maxMaterialCost: 16, customerRate: 60, active: true },
  { id: 'builder_level_4', label: 'Level 4', maxMaterialCost: 19, customerRate: 68, active: true },
  { id: 'builder_level_5', label: 'Level 5', maxMaterialCost: 21, customerRate: 75, active: true },
  { id: 'builder_level_6', label: 'Level 6', maxMaterialCost: 23, customerRate: 85, active: true },
  // Last week's extra 7/8 sell-rate presets are retained for quote convenience.
  // No cost bands were supplied for these, so they MUST NOT auto-price materials.
  { id: 'builder_level_7', label: 'Level 7', maxMaterialCost: 23, customerRate: 115, active: true, costBandConfirmed: false },
  { id: 'builder_level_8', label: 'Level 8', maxMaterialCost: 26, customerRate: 125, active: true, costBandConfirmed: false },
];
const PREVIOUS_0_8_RULES:MaterialLevelRule[]=[
  { id: 'builder_level_0', label: 'Level 0', maxMaterialCost: 7, customerRate: 34, active: true },
  { id: 'builder_level_1', label: 'Level 1', maxMaterialCost: 9, customerRate: 54, active: true },
  { id: 'builder_level_2', label: 'Level 2', maxMaterialCost: 12, customerRate: 65, active: true },
  { id: 'builder_level_3', label: 'Level 3', maxMaterialCost: 14, customerRate: 75, active: true },
  { id: 'builder_level_4', label: 'Level 4', maxMaterialCost: 16, customerRate: 85, active: true },
  { id: 'builder_level_5', label: 'Level 5', maxMaterialCost: 19, customerRate: 95, active: true },
  { id: 'builder_level_6', label: 'Level 6', maxMaterialCost: 21, customerRate: 105, active: true },
  { id: 'builder_level_7', label: 'Level 7', maxMaterialCost: 23, customerRate: 115, active: true },
  { id: 'builder_level_8', label: 'Level 8', maxMaterialCost: 26, customerRate: 125, active: true },
];
function matchesDefault(actual:MaterialLevelRule, baseline:MaterialLevelRule){
  return actual.id===baseline.id&&actual.label===baseline.label
    && actual.maxMaterialCost===baseline.maxMaterialCost
    && actual.customerRate===baseline.customerRate&&actual.active===baseline.active;
}
/** Upgrade only unchanged seeded records. Preserve every user-customized
 * sell rate / cost ceiling and keep a recoverable guide version.
 * Never rewrite an already migrated guide on subsequent openings.
 */
export function upgradeBuilderLevelGuide(guide: MaterialLevelGuideDocument): MaterialLevelGuideDocument {
  // A completed migration is not repeated: this is particularly important for
  // manager-customized old guides that have since received the missing levels.
  if(guide.history.some(v=>v.id==='guide_version_before_cost_band_restore'))return guide;
  const current=guide.rules;
  const exactOldSeven=current.length===LEGACY_BASELINE_RULES.length
    &&LEGACY_BASELINE_RULES.every(old=>current.some(rule=>matchesDefault(rule,old)));
  const exactOldNine=current.length===PREVIOUS_0_8_RULES.length
    &&PREVIOUS_0_8_RULES.every(old=>current.some(rule=>matchesDefault(rule,old)));
  if(exactOldSeven||exactOldNine){
    const recordedAt=new Date().toISOString();
    const previous:MaterialLevelGuideVersion={
      id:'guide_version_before_cost_band_restore',recordedAt,
      note:'Before historical granite/quartz cost bands were restored',
      rules:structuredClone(current),
      slabPricingThresholdCostPerSf:guide.slabPricingThresholdCostPerSf,
      slabPricingMultiplier:guide.slabPricingMultiplier,
    };
    return {...guide,rules:structuredClone(BASELINE_RULES),
      slabPricingThresholdCostPerSf:23,
      history:[previous,...guide.history.filter(v=>v.id!==previous.id)],updatedAt:recordedAt};
  }
  // For edited versions of the temporary 0–8 preset, adjust only unchanged
  // individual starter values and preserve all customized fields. New cost
  // ranges for levels 7/8 remain explicitly unapproved.
  // Do not reinterpret company-edited pre-Level-0 guides as the temporary 0–8 preset.
  const corrected=current.some(rule=>rule.id==='builder_level_0')?current.map(rule=>{
    const prior=PREVIOUS_0_8_RULES.find(old=>old.id===rule.id);
    const reference=BASELINE_RULES.find(seed=>seed.id===rule.id);
    if(!prior||!reference)return rule;
    const wasPreviousCeiling=rule.maxMaterialCost===prior.maxMaterialCost;
    const wasPreviousPrice=rule.customerRate===prior.customerRate;
    const needsMetadata=(rule.id==='builder_level_0'&&!rule.graniteOnly)
      ||((rule.id==='builder_level_7'||rule.id==='builder_level_8')
        &&rule.costBandConfirmed===undefined && wasPreviousCeiling);
    if(!wasPreviousCeiling&&!wasPreviousPrice&&!needsMetadata)return rule;
    const updated:MaterialLevelRule={...rule,
      maxMaterialCost:wasPreviousCeiling?reference.maxMaterialCost:rule.maxMaterialCost,
      customerRate:wasPreviousPrice?reference.customerRate:rule.customerRate,
      ...(rule.id==='builder_level_0'?{graniteOnly:true}:{}),
      ...(rule.id==='builder_level_7'||rule.id==='builder_level_8'
        ?{costBandConfirmed:rule.costBandConfirmed??(wasPreviousCeiling?false:true)}:{}),
    };
    return updated.maxMaterialCost===rule.maxMaterialCost
      &&updated.customerRate===rule.customerRate
      &&updated.graniteOnly===rule.graniteOnly
      &&updated.costBandConfirmed===rule.costBandConfirmed?rule:updated;
  }):current;
  const additions=BASELINE_RULES.filter(seed=>
    !corrected.some(rule=>rule.id===seed.id||rule.label.trim().toLowerCase()===seed.label.toLowerCase()));
  if(!additions.length&&corrected.every((rule,i)=>rule===current[i]))return guide;
  const changed=[...corrected,...structuredClone(additions)];
  const recordedAt=new Date().toISOString();
  const previous:MaterialLevelGuideVersion={
    id:'guide_version_before_cost_band_restore',recordedAt,
    note:'Before historical granite/quartz cost bands were restored',
    rules:structuredClone(current),slabPricingThresholdCostPerSf:guide.slabPricingThresholdCostPerSf,
    slabPricingMultiplier:guide.slabPricingMultiplier,
  };
  const needsThresholdRestore=guide.slabPricingThresholdCostPerSf===26
    &&current.length>=9&&PREVIOUS_0_8_RULES.some(r=>current.some(c=>c.id===r.id));
  return {...guide,rules:changed,
    slabPricingThresholdCostPerSf:needsThresholdRestore?23:guide.slabPricingThresholdCostPerSf,
    history:guide.history.some(v=>v.id===previous.id)?guide.history:[previous,...guide.history],
    updatedAt:recordedAt};
}

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
      note: 'Historical stock granite and quartz cost bands through Level 6; Levels 7/8 require company cost-band confirmation.',
      rules: structuredClone(rules),
      slabPricingThresholdCostPerSf: 26,
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
    graniteOnly: raw.graniteOnly===true,
    costBandConfirmed:typeof raw.costBandConfirmed==='boolean'?raw.costBandConfirmed:undefined,
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
    const raw = localStorage.getItem(localKey());
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

function persist(guide: MaterialLevelGuideDocument,share=true) {
  localStorage.setItem(localKey(), JSON.stringify(guide));
  if(!share)return;
  const auth=useAuthStore.getState();
  const orgId=auth.mode==='cloud'?auth.organizationId:undefined;
  if(!supabase||!orgId)return;
  if(cloudSaveTimer)clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(()=>{
    void supabase.from('organizations').update({material_level_guide:guide})
      .eq('id',orgId).then(({error})=>{
        useMaterialLevelGuideStore.setState({syncError:error?.message});
      });
  },650);
}

export const useMaterialLevelGuideStore = create<MaterialLevelGuideState>((set, get) => ({
  guide: baselineGuide(),
  hydrated: false,

  hydrate: () => {
    if (get().hydrated||hydrationStarted) return;
    hydrationStarted=true;
    const local=upgradeBuilderLevelGuide(readLocal());
    const auth=useAuthStore.getState();
    if(!supabase||auth.mode!=='cloud'||!auth.organizationId){
      persist(local,false);set({guide:local,hydrated:true});hydrationStarted=false;return;
    }
    // Cloud is authoritative. Never expose browser-local prices as current
    // company rates while waiting for the org-scoped guide to load.
    void supabase.from('organizations').select('material_level_guide')
      .eq('id',auth.organizationId).single().then(({data,error})=>{
        const stored=data?.material_level_guide as MaterialLevelGuideDocument|undefined;
        const valid=stored&&stored.schemaVersion===3&&Array.isArray(stored.rules);
        const guide=valid?upgradeBuilderLevelGuide(stored):local;
        persist(guide,false);
        set({guide,hydrated:true,syncError:error?.message});
        // For a new organization, publish the seed exactly once if allowed.
        if(!error&&!valid)persist(guide,true);
      }).catch((error:unknown)=>{
        set({guide:local,hydrated:true,syncError:
          error instanceof Error?error.message:'Could not load shared Builder Levels'});
      }).finally(()=>{hydrationStarted=false;});
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
