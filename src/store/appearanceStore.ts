import { create } from 'zustand';

export type SettingsTextSize = 'standard' | 'large';
export type SettingsMotion = 'system' | 'reduced';
export interface AppearancePreferences {
  textSize: SettingsTextSize;
  motion: SettingsMotion;
  highContrast: boolean;
  largerControls: boolean;
}
export const DEFAULT_APPEARANCE: AppearancePreferences = {
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

export function applyAppearance(preferences: AppearancePreferences) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.salesText = preferences.textSize;
  root.dataset.salesMotion = preferences.motion;
  root.dataset.salesContrast = preferences.highContrast ? 'high' : 'normal';
  root.dataset.salesControls = preferences.largerControls ? 'large' : 'standard';
}

interface AppearanceState {
  preferences: AppearancePreferences;
  update: (patch: Partial<AppearancePreferences>) => void;
  reset: () => void;
}
const initial = readPreferences();
export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  preferences: initial,
  update: (patch) => {
    const preferences = normalizeAppearance({ ...get().preferences, ...patch });
    set({ preferences });
    applyAppearance(preferences);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* browser storage optional */ }
  },
  reset: () => {
    set({ preferences: { ...DEFAULT_APPEARANCE } });
    applyAppearance(DEFAULT_APPEARANCE);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* browser storage optional */ }
  },
}));
applyAppearance(initial);
