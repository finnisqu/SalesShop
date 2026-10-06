import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { EMPTY_COMPANY_SETTINGS, type CompanySettingsData, type StockMaterial } from '../types/settings';
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
}

const LOCAL_KEY = 'salesshop-company-settings-v1';
let saveTimer: number | undefined;

function readLocal(): CompanySettingsData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { ...EMPTY_COMPANY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CompanySettingsData>;
    return { ...EMPTY_COMPANY_SETTINGS, ...parsed, stockMaterials: Array.isArray(parsed.stockMaterials) ? parsed.stockMaterials : [] };
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
      stockMaterials: Array.isArray(data.stock_materials) ? data.stock_materials as StockMaterial[] : [],
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
    const id = `stock_${crypto.randomUUID()}`;
    const material: StockMaterial = { id, name: 'New stock color', materialType: 'Granite', unit: 'sf', active: true };
    const settings = { ...get().settings, stockMaterials: [...get().settings.stockMaterials, material] };
    set({ settings });
    schedulePersist(settings);
    return id;
  },

  updateStockMaterial: (id, patch) => {
    const settings = {
      ...get().settings,
      stockMaterials: get().settings.stockMaterials.map((material) => material.id === id ? { ...material, ...patch } : material),
    };
    set({ settings });
    schedulePersist(settings);
  },

  deleteStockMaterial: (id) => {
    const settings = { ...get().settings, stockMaterials: get().settings.stockMaterials.filter((material) => material.id !== id) };
    set({ settings });
    schedulePersist(settings);
  },
}));
