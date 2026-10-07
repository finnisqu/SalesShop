import { create } from 'zustand';
import {
  RATE_BOOK_DIVISIONS,
  RATE_BOOK_PRICING_BEHAVIORS,
  type RateBookCategory,
  type RateBookDivision,
  type RateBookDivisionOverride,
  type RateBookDocument,
  type RateBookItem,
  type RateBookPriceVersion,
  type RateBookPricingBehavior,
} from '../types/rateBook';

interface RateBookState {
  items: RateBookItem[];
  hydrated: boolean;
  hydrate: () => void;
  addItem: (category: RateBookCategory, seed?: Partial<RateBookItem>) => string;
  updateItem: (id: string, patch: Partial<RateBookItem>) => void;
  updatePricing: (id: string, patch: Partial<Pick<RateBookItem, 'internalCost' | 'sellRate' | 'pricingBehavior' | 'effectiveDate' | 'divisionOverrides'>>) => void;
  setDivisionOverride: (id: string, division: RateBookDivision, patch: Partial<Omit<RateBookDivisionOverride, 'division'>>) => void;
  setCurrentHistoryNote: (id: string, note: string) => void;
  duplicateItem: (id: string) => string | null;
  deleteItem: (id: string) => void;
}

const LOCAL_KEY = 'salesshop-rate-book-v1';
const SEED_TIME = '2026-10-06T00:00:00.000Z';
const SEED_DATE = '2026-10-06';
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function seedHistory(
  id: string,
  internalCost: number | undefined,
  sellRate: number | undefined,
  pricingBehavior: RateBookPricingBehavior,
  divisionOverrides: RateBookDivisionOverride[] = [],
): RateBookPriceVersion[] {
  return [{
    id: `history_${id}`,
    effectiveDate: SEED_DATE,
    internalCost,
    sellRate,
    pricingBehavior,
    divisionOverrides: structuredClone(divisionOverrides),
    note: 'Initial company rate',
    recordedAt: SEED_TIME,
  }];
}

function makeDefault(item: Omit<RateBookItem, 'pricingBehavior' | 'divisionOverrides' | 'history'> & {
  pricingBehavior?: RateBookPricingBehavior;
  divisionOverrides?: RateBookDivisionOverride[];
}): RateBookItem {
  const pricingBehavior = item.pricingBehavior ?? 'suggested';
  const divisionOverrides = item.divisionOverrides ?? [];
  return {
    ...item,
    pricingBehavior,
    divisionOverrides,
    history: seedHistory(item.id, item.internalCost, item.sellRate, pricingBehavior, divisionOverrides),
  };
}

const DEFAULT_ITEMS: RateBookItem[] = [
  makeDefault({ id: 'rate_fabrication', category: 'fabrication-install', name: 'Fabrication', code: 'FAB', unit: 'sf', sellRate: 14.5, active: true, effectiveDate: SEED_DATE, createdAt: SEED_TIME, updatedAt: SEED_TIME }),
  makeDefault({ id: 'rate_install', category: 'fabrication-install', name: 'Installation', code: 'INSTALL', unit: 'sf', internalCost: 5, pricingBehavior: 'cost-reference', divisionOverrides: [{ division: 'Multifamily', internalCost: 4 }], active: true, effectiveDate: SEED_DATE, createdAt: SEED_TIME, updatedAt: SEED_TIME }),
  makeDefault({ id: 'rate_sink_cutout', category: 'sink', name: 'Sink Cutout', code: 'SINK-CUT', unit: 'each', pricingBehavior: 'manual', active: true, effectiveDate: SEED_DATE, notes: 'Service rate only. Sink products are managed in the Sinks catalog.', createdAt: SEED_TIME, updatedAt: SEED_TIME }),
  makeDefault({ id: 'rate_sink_customer_install', category: 'sink', name: 'Install Customer-Provided Sink', code: 'SINK-INSTALL-CUST', unit: 'each', pricingBehavior: 'manual', active: true, effectiveDate: SEED_DATE, notes: 'Installation labor/service for a sink supplied by the customer.', createdAt: SEED_TIME, updatedAt: SEED_TIME }),
  makeDefault({ id: 'rate_trip', category: 'add-on', name: 'Trip Fee', code: 'TRIP', unit: 'flat', sellRate: 150, active: true, effectiveDate: SEED_DATE, createdAt: SEED_TIME, updatedAt: SEED_TIME }),
  makeDefault({ id: 'rate_full_splash', category: 'add-on', name: 'Full Height Splash', code: 'FHS', unit: 'sf', sellRate: 35, active: true, effectiveDate: SEED_DATE, createdAt: SEED_TIME, updatedAt: SEED_TIME }),
  makeDefault({ id: 'rate_miter', category: 'add-on', name: 'Miter', code: 'MITER', unit: 'sf', sellRate: 50, active: true, effectiveDate: SEED_DATE, createdAt: SEED_TIME, updatedAt: SEED_TIME }),
];

function cloneDefaults() {
  return structuredClone(DEFAULT_ITEMS);
}

function validBehavior(value: unknown): value is RateBookPricingBehavior {
  return typeof value === 'string' && RATE_BOOK_PRICING_BEHAVIORS.includes(value as RateBookPricingBehavior);
}

function validDivision(value: unknown): value is RateBookDivision {
  return typeof value === 'string' && RATE_BOOK_DIVISIONS.includes(value as RateBookDivision);
}

function normalizeOverrides(value: unknown): RateBookDivisionOverride[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Partial<RateBookDivisionOverride>;
    if (!validDivision(candidate.division)) return [];
    return [{
      division: candidate.division,
      internalCost: typeof candidate.internalCost === 'number' ? candidate.internalCost : undefined,
      sellRate: typeof candidate.sellRate === 'number' ? candidate.sellRate : undefined,
    }];
  });
}

function priceVersionFor(item: Pick<RateBookItem, 'id' | 'effectiveDate' | 'internalCost' | 'sellRate' | 'pricingBehavior' | 'divisionOverrides' | 'updatedAt'>, note?: string): RateBookPriceVersion {
  return {
    id: uid('history'),
    effectiveDate: item.effectiveDate || item.updatedAt.slice(0, 10) || SEED_DATE,
    internalCost: item.internalCost,
    sellRate: item.sellRate,
    pricingBehavior: item.pricingBehavior,
    divisionOverrides: structuredClone(item.divisionOverrides),
    note,
    recordedAt: new Date().toISOString(),
  };
}

function normalizeHistory(value: unknown, item: RateBookItem): RateBookPriceVersion[] {
  if (!Array.isArray(value) || !value.length) return [priceVersionFor(item, 'Imported baseline')];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Partial<RateBookPriceVersion>;
    const behavior = validBehavior(candidate.pricingBehavior) ? candidate.pricingBehavior : item.pricingBehavior;
    return [{
      id: candidate.id || uid('history'),
      effectiveDate: candidate.effectiveDate || item.effectiveDate || SEED_DATE,
      internalCost: typeof candidate.internalCost === 'number' ? candidate.internalCost : undefined,
      sellRate: typeof candidate.sellRate === 'number' ? candidate.sellRate : undefined,
      pricingBehavior: behavior,
      divisionOverrides: normalizeOverrides(candidate.divisionOverrides),
      note: candidate.note,
      recordedAt: candidate.recordedAt || item.updatedAt,
    }];
  });
}

function normalizeItem(raw: Partial<RateBookItem>): RateBookItem {
  const createdAt = raw.createdAt || SEED_TIME;
  const updatedAt = raw.updatedAt || createdAt;
  let internalCost = typeof raw.internalCost === 'number' ? raw.internalCost : undefined;
  let sellRate = typeof raw.sellRate === 'number' ? raw.sellRate : undefined;
  let pricingBehavior: RateBookPricingBehavior = validBehavior(raw.pricingBehavior)
    ? raw.pricingBehavior
    : sellRate !== undefined ? 'suggested' : 'cost-reference';
  let divisionOverrides = normalizeOverrides(raw.divisionOverrides);

  // v1 treated the install subcontractor cost as a sell rate. Preserve the user's data,
  // but migrate this known seed into the more accurate cost-reference model.
  if (raw.id === 'rate_install' && raw.pricingBehavior === undefined) {
    internalCost = internalCost ?? sellRate ?? 5;
    sellRate = undefined;
    pricingBehavior = 'cost-reference';
    if (!divisionOverrides.some((override) => override.division === 'Multifamily')) {
      divisionOverrides = [...divisionOverrides, { division: 'Multifamily', internalCost: 4 }];
    }
  }

  const item: RateBookItem = {
    id: raw.id || uid('rate'),
    category: raw.category ?? 'material',
    name: raw.name ?? 'Rate item',
    code: raw.code,
    unit: raw.unit ?? 'sf',
    internalCost,
    sellRate,
    pricingBehavior,
    divisionOverrides,
    history: [],
    stockMaterialId: raw.stockMaterialId,
    effectiveDate: raw.effectiveDate || updatedAt.slice(0, 10) || SEED_DATE,
    notes: raw.notes,
    active: raw.active ?? true,
    createdAt,
    updatedAt,
  };
  item.history = normalizeHistory(raw.history, item);
  return item;
}

const LEGACY_SINK_PRODUCT_IDS = new Set([
  'rate_sink_3218_single',
  'rate_sink_3218_5050',
  'rate_sink_3218_6040',
  'rate_sink_1714_oval',
  'rate_sink_1813_rect',
  'rate_sink_1714_ada',
  'rate_sink_1813_ada',
  'rate_sink_3218_ada',
]);

function migrateLegacySinkProducts(items: RateBookItem[]) {
  const legacyNote = 'Legacy sink product migrated to the Sinks catalog. Kept inactive so historical Rate Book references remain readable.';
  let next = items.map((item) => {
    if (!LEGACY_SINK_PRODUCT_IDS.has(item.id)) return item;
    const notes = item.notes?.includes('Legacy sink product migrated')
      ? item.notes
      : [item.notes, legacyNote].filter(Boolean).join(' ');
    return { ...item, active: false, notes };
  });
  DEFAULT_ITEMS.filter((item) => item.category === 'sink').forEach((service) => {
    if (!next.some((item) => item.id === service.id)) next = [...next, structuredClone(service)];
  });
  return next;
}

function readLocal(): RateBookItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as { items?: unknown[] };
    return Array.isArray(parsed.items)
      ? migrateLegacySinkProducts(parsed.items.map((item) => normalizeItem(item as Partial<RateBookItem>)))
      : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

function persist(items: RateBookItem[]) {
  const document: RateBookDocument = { schemaVersion: 2, items };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(document));
}

function upsertCurrentVersion(item: RateBookItem, note?: string) {
  const nextVersion = priceVersionFor(item, note);
  const index = item.history.findIndex((version) => version.effectiveDate === nextVersion.effectiveDate);
  if (index < 0) return [...item.history, nextVersion];
  return item.history.map((version, position) => position === index
    ? { ...nextVersion, id: version.id, note: note ?? version.note }
    : version);
}

export const useRateBookStore = create<RateBookState>((set, get) => ({
  items: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const items = readLocal();
    persist(items);
    set({ items, hydrated: true });
  },

  addItem: (category, seed = {}) => {
    const id = `rate_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const item: RateBookItem = {
      id,
      category,
      name: seed.name ?? (category === 'material' ? 'New material' : category === 'sink' ? 'New sink service' : category === 'fabrication-install' ? 'New service' : 'New add-on'),
      code: seed.code,
      unit: seed.unit ?? (category === 'sink' ? 'each' : category === 'add-on' ? 'flat' : 'sf'),
      internalCost: seed.internalCost,
      sellRate: seed.sellRate,
      pricingBehavior: seed.pricingBehavior ?? (seed.sellRate !== undefined ? 'suggested' : 'cost-reference'),
      divisionOverrides: structuredClone(seed.divisionOverrides ?? []),
      history: [],
      stockMaterialId: seed.stockMaterialId,
      effectiveDate: seed.effectiveDate ?? now.slice(0, 10),
      notes: seed.notes,
      active: seed.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    item.history = [priceVersionFor(item, 'Initial rate')];
    const items = [...get().items, item];
    persist(items);
    set({ items });
    return id;
  },

  updateItem: (id, patch) => {
    const items = get().items.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item);
    persist(items);
    set({ items });
  },

  updatePricing: (id, patch) => {
    const items = get().items.map((item) => {
      if (item.id !== id) return item;
      const updatedAt = new Date().toISOString();
      const next: RateBookItem = {
        ...item,
        ...patch,
        effectiveDate: patch.effectiveDate ?? item.effectiveDate ?? updatedAt.slice(0, 10),
        divisionOverrides: patch.divisionOverrides ? structuredClone(patch.divisionOverrides) : item.divisionOverrides,
        updatedAt,
      };
      next.history = upsertCurrentVersion(next);
      return next;
    });
    persist(items);
    set({ items });
  },

  setDivisionOverride: (id, division, patch) => {
    const item = get().items.find((candidate) => candidate.id === id);
    if (!item) return;
    const current = item.divisionOverrides.find((candidate) => candidate.division === division);
    const merged: RateBookDivisionOverride = { division, ...current, ...patch };
    const hasValues = merged.internalCost !== undefined || merged.sellRate !== undefined;
    const divisionOverrides = hasValues
      ? [...item.divisionOverrides.filter((candidate) => candidate.division !== division), merged]
      : item.divisionOverrides.filter((candidate) => candidate.division !== division);
    get().updatePricing(id, { divisionOverrides });
  },

  setCurrentHistoryNote: (id, note) => {
    const items = get().items.map((item) => {
      if (item.id !== id) return item;
      const date = item.effectiveDate ?? item.updatedAt.slice(0, 10);
      return {
        ...item,
        history: item.history.map((version) => version.effectiveDate === date ? { ...version, note } : version),
      };
    });
    persist(items);
    set({ items });
  },

  duplicateItem: (id) => {
    const source = get().items.find((item) => item.id === id);
    if (!source) return null;
    const nextId = `rate_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const copy: RateBookItem = {
      ...structuredClone(source),
      id: nextId,
      name: `${source.name} copy`,
      history: source.history.map((version) => ({ ...structuredClone(version), id: uid('history') })),
      createdAt: now,
      updatedAt: now,
    };
    const items = [...get().items, copy];
    persist(items);
    set({ items });
    return nextId;
  },

  deleteItem: (id) => {
    const items = get().items.filter((item) => item.id !== id);
    persist(items);
    set({ items });
  },
}));
