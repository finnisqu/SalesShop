import { create } from 'zustand';
import type { RateBookCategory, RateBookDocument, RateBookItem } from '../types/rateBook';

interface RateBookState {
  items: RateBookItem[];
  hydrated: boolean;
  hydrate: () => void;
  addItem: (category: RateBookCategory, seed?: Partial<RateBookItem>) => string;
  updateItem: (id: string, patch: Partial<RateBookItem>) => void;
  duplicateItem: (id: string) => string | null;
  deleteItem: (id: string) => void;
}

const LOCAL_KEY = 'salesshop-rate-book-v1';
const SEED_TIME = '2026-10-06T00:00:00.000Z';

const DEFAULT_ITEMS: RateBookItem[] = [
  { id: 'rate_fabrication', category: 'fabrication-install', name: 'Fabrication', code: 'FAB', unit: 'sf', sellRate: 14.5, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_install', category: 'fabrication-install', name: 'Installation', code: 'INSTALL', unit: 'sf', sellRate: 5, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_sink_3218_single', category: 'sink', name: 'Kitchen 3218 Single', code: '3218-S', unit: 'each', sellRate: 220, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_sink_3218_5050', category: 'sink', name: 'Kitchen 3218 50/50', code: '3218-5050', unit: 'each', sellRate: 220, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_sink_3218_6040', category: 'sink', name: 'Kitchen 3218 60/40', code: '3218-6040', unit: 'each', sellRate: 220, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_sink_1714_oval', category: 'sink', name: 'Oval Vanity 1714', code: '1714-O', unit: 'each', sellRate: 75, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_sink_1813_rect', category: 'sink', name: 'Rectangular Vanity 1813', code: '1813-R', unit: 'each', sellRate: 95, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_sink_1714_ada', category: 'sink', name: 'ADA Oval 1714', code: '1714-ADA', unit: 'each', sellRate: 85, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_sink_1813_ada', category: 'sink', name: 'ADA Rectangular 1813', code: '1813-ADA', unit: 'each', sellRate: 105, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_sink_3218_ada', category: 'sink', name: 'ADA Kitchen 3218 Single', code: '3218-ADA', unit: 'each', sellRate: 245, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_trip', category: 'add-on', name: 'Trip Fee', code: 'TRIP', unit: 'flat', sellRate: 150, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_full_splash', category: 'add-on', name: 'Full Height Splash', code: 'FHS', unit: 'sf', sellRate: 35, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'rate_miter', category: 'add-on', name: 'Miter', code: 'MITER', unit: 'sf', sellRate: 50, active: true, createdAt: SEED_TIME, updatedAt: SEED_TIME },
];

function cloneDefaults() {
  return DEFAULT_ITEMS.map((item) => ({ ...item }));
}

function readLocal(): RateBookItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as Partial<RateBookDocument>;
    return Array.isArray(parsed.items) ? parsed.items : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

function persist(items: RateBookItem[]) {
  const document: RateBookDocument = { schemaVersion: 1, items };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(document));
}

export const useRateBookStore = create<RateBookState>((set, get) => ({
  items: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ items: readLocal(), hydrated: true });
  },

  addItem: (category, seed = {}) => {
    const id = `rate_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const item: RateBookItem = {
      id,
      category,
      name: seed.name ?? (category === 'material' ? 'New material' : category === 'sink' ? 'New sink' : category === 'fabrication-install' ? 'New service' : 'New add-on'),
      code: seed.code,
      unit: seed.unit ?? (category === 'sink' ? 'each' : category === 'add-on' ? 'flat' : 'sf'),
      internalCost: seed.internalCost,
      sellRate: seed.sellRate,
      stockMaterialId: seed.stockMaterialId,
      effectiveDate: seed.effectiveDate,
      notes: seed.notes,
      active: seed.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
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

  duplicateItem: (id) => {
    const source = get().items.find((item) => item.id === id);
    if (!source) return null;
    const nextId = `rate_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const copy: RateBookItem = { ...source, id: nextId, name: `${source.name} copy`, createdAt: now, updatedAt: now };
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
