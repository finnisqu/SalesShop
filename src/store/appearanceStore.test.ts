import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, normalizeAppearance } from './appearanceStore';
import {
  THEME_OPTIONS, isAppearanceTheme, normalizeThemeChoice,
  resolveSeasonalTheme, resolveAppearanceTheme,
} from '../services/appearanceThemes';

describe('Settings appearance preferences', () => {
  it('defaults to company palette while preserving familiar SalesShop warm appearance', () => {
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({})).toEqual(DEFAULT_APPEARANCE);
    expect(DEFAULT_APPEARANCE.themeChoice).toBe('company');
    expect(resolveAppearanceTheme('company','warm')).toBe('warm');
  });
  it('recognizes explicitly selected accessible settings', () => {
    expect(normalizeAppearance({
      themeChoice:'dark',
      textSize: 'large',
      motion: 'reduced',
      highContrast: true,
      largerControls: true,
    })).toEqual({
      themeChoice:'dark',
      textSize: 'large',
      motion: 'reduced',
      highContrast: true,
      largerControls: true,
    });
  });
  it('supports older stored settings and ignores unrecognized values', () => {
    expect(normalizeAppearance({ textSize:'large' })).toEqual({
      ...DEFAULT_APPEARANCE,textSize:'large',
    });
    expect(normalizeAppearance({ themeChoice:'custom css',textSize:'extra-large',
      motion:'spin',highContrast:'yes',largerControls:3 }))
      .toEqual(DEFAULT_APPEARANCE);
    expect(normalizeThemeChoice('__proto__')).toBe('company');
  });
  it('gives a personal selection priority over company default', () => {
    expect(resolveAppearanceTheme('dark','warm')).toBe('dark');
    expect(resolveAppearanceTheme('company','sage')).toBe('sage');
    expect(resolveAppearanceTheme('company','dark')).toBe('dark');
    expect(resolveAppearanceTheme('light','dark')).toBe('light');
  });
  it('has unique curated modes and known company palette choices', () => {
    expect(new Set(THEME_OPTIONS.map(t=>t.id)).size).toBe(THEME_OPTIONS.length);
    expect(THEME_OPTIONS.map(t=>t.id)).toEqual(expect.arrayContaining([
      'light','warm','contrast','dark','seasonal','holiday','rainy',
    ]));
    expect(THEME_OPTIONS.every(t=>t.swatches.length === 3 && t.description.length > 10)).toBe(true);
    expect(isAppearanceTheme('holiday')).toBe(true);
    expect(isAppearanceTheme('untrusted')).toBe(false);
  });
  it('moves seasonal theme at each quarterly boundary without weather or location requests', () => {
    expect(resolveSeasonalTheme(new Date(2026,1,15))).toBe('winter');
    expect(resolveSeasonalTheme(new Date(2026,3,15))).toBe('sage');
    expect(resolveSeasonalTheme(new Date(2026,6,15))).toBe('coastal');
    expect(resolveSeasonalTheme(new Date(2026,9,15))).toBe('autumn');
    expect(resolveAppearanceTheme('seasonal','dark',new Date(2026,9,15))).toBe('autumn');
    expect(resolveAppearanceTheme('company','seasonal',new Date(2026,1,15))).toBe('winter');
  });
});
