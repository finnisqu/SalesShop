import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import {
  isAppearanceTheme, normalizeThemeChoice, resolveAppearanceTheme,
  type AppearanceThemeChoice, type AppearanceThemeId,
} from '../services/appearanceThemes';

export type SettingsTextSize = 'standard' | 'large';
export type SettingsMotion = 'system' | 'reduced';
export interface AppearancePreferences {
  themeChoice: AppearanceThemeChoice;
  textSize: SettingsTextSize;
  motion: SettingsMotion;
  highContrast: boolean;
  largerControls: boolean;
}
export const DEFAULT_APPEARANCE: AppearancePreferences = {
  themeChoice: 'company',
  textSize: 'standard',
  motion: 'system',
  highContrast: false,
  largerControls: false,
};
const STORAGE_KEY = 'salesshop-appearance-v1';

export function normalizeAppearance(value: unknown): AppearancePreferences {
  if (!value || typeof value !== 'object') return { ...DEFAULT_APPEARANCE };
  const data = value as Partial<AppearancePreferences>;
  return {
    themeChoice: normalizeThemeChoice(data.themeChoice),
    textSize: data.textSize === 'large' ? 'large' : 'standard',
    motion: data.motion === 'reduced' ? 'reduced' : 'system',
    highContrast: data.highContrast === true,
    largerControls: data.largerControls === true,
  };
}

function readPreferences(): AppearancePreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? normalizeAppearance(JSON.parse(value)) : { ...DEFAULT_APPEARANCE };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function applyAppearance(preferences: AppearancePreferences, companyPalette: AppearanceThemeId = 'warm') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.salesTheme = resolveAppearanceTheme(preferences.themeChoice, companyPalette);
  root.dataset.salesThemeChoice = preferences.themeChoice;
  root.dataset.salesText = preferences.textSize;
  root.dataset.salesMotion = preferences.motion;
  root.dataset.salesContrast = preferences.highContrast ? 'high' : 'normal';
  root.dataset.salesControls = preferences.largerControls ? 'large' : 'standard';
}

interface AppearanceState {
  preferences: AppearancePreferences;
  companyPalette: AppearanceThemeId;
  companyPaletteOrgId: string | null;
  companyPaletteSaving: boolean;
  companyPaletteError: string | null;
  update: (patch: Partial<AppearancePreferences>) => void;
  reset: () => void;
  loadCompanyPalette: (orgId: string | null) => Promise<void>;
  saveCompanyPalette: (orgId: string, palette: AppearanceThemeId) => Promise<boolean>;
}

const initial = readPreferences();
let paletteRequestSerial = 0;
export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  preferences: initial,
  companyPalette: 'warm',
  companyPaletteOrgId: null,
  companyPaletteSaving: false,
  companyPaletteError: null,
  update: (patch) => {
    const preferences = normalizeAppearance({ ...get().preferences, ...patch });
    set({ preferences });
    applyAppearance(preferences, get().companyPalette);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* storage optional */ }
  },
  reset: () => {
    set({ preferences: { ...DEFAULT_APPEARANCE } });
    applyAppearance(DEFAULT_APPEARANCE, get().companyPalette);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* storage optional */ }
  },
  loadCompanyPalette: async (orgId) => {
    const serial = ++paletteRequestSerial;
    set({ companyPaletteOrgId: orgId, companyPalette: 'warm', companyPaletteError: null, companyPaletteSaving: false });
    applyAppearance(get().preferences, 'warm');
    if (!orgId || !supabase || useAuthStore.getState().mode !== 'cloud') return;
    const { data, error } = await supabase.from('organizations')
      .select('ui_palette').eq('id', orgId).maybeSingle();
    if (serial !== paletteRequestSerial || useAuthStore.getState().organizationId !== orgId) return;
    const palette = isAppearanceTheme(data?.ui_palette) ? data.ui_palette : 'warm';
    set({ companyPalette: palette, companyPaletteError: error?.message ?? null });
    applyAppearance(get().preferences, palette);
  },
  saveCompanyPalette: async (orgId, palette) => {
    if (!isAppearanceTheme(palette)) return false;
    const auth = useAuthStore.getState();
    if (!supabase || auth.mode !== 'cloud' || auth.organizationId !== orgId ||
        (auth.teamRole !== 'owner' && auth.teamRole !== 'admin')) {
      set({ companyPaletteError: 'Only an Owner or Admin can change the company palette.' });
      return false;
    }
    const previous = get().companyPalette;
    const serial = ++paletteRequestSerial;
    set({ companyPaletteOrgId: orgId, companyPalette: palette, companyPaletteSaving: true, companyPaletteError: null });
    applyAppearance(get().preferences, palette);
    const { error } = await supabase.from('organizations')
      .update({ ui_palette: palette }).eq('id', orgId);
    if (serial !== paletteRequestSerial || useAuthStore.getState().organizationId !== orgId) return false;
    if (error) {
      set({ companyPalette: previous, companyPaletteSaving: false, companyPaletteError: error.message });
      applyAppearance(get().preferences, previous);
      return false;
    }
    set({ companyPaletteSaving: false });
    return true;
  },
}));
applyAppearance(initial);
