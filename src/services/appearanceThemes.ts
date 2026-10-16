/** Internal workspace themes only. Customer-facing documents retain their own branding. */
export const THEME_OPTIONS = [
  { id:'light', name:'Light', category:'essentials', description:'Clean, airy, bright and focused.', swatches:['#f7f8f8','#ffffff','#607988'] },
  { id:'warm', name:'Warm Paper', category:'essentials', description:'The classic SalesShop paper-and-ink look.', swatches:['#eae4d9','#fffaf0','#a2874c'] },
  { id:'contrast', name:'High Contrast', category:'essentials', description:'Strong outlines and extra-legible text.', swatches:['#ffffff','#f1f1eb','#141b1a'] },
  { id:'dark', name:'After Hours', category:'essentials', description:'A calm, dark workspace for evening work.', swatches:['#20272b','#2d373b','#c3a970'] },
  { id:'sage', name:'Sage Studio', category:'creative', description:'Soft olive greens and natural stone.', swatches:['#e6ebe0','#f7f7ed','#6a7d59'] },
  { id:'coastal', name:'Coastal', category:'creative', description:'Cool blues, sea glass, and daylight.', swatches:['#e0edf0','#f7fbfc','#457f8e'] },
  { id:'autumn', name:'Autumn', category:'creative', description:'Terracotta, golden light, and warm wood.', swatches:['#eee3d5','#fff6e9','#b46b43'] },
  { id:'winter', name:'Winter', category:'creative', description:'Quiet blue-grey and crisp frost.', swatches:['#e2eaf0','#f8fbff','#718ca8'] },
  { id:'holiday', name:'Holiday', category:'playful', description:'A restrained evergreen and cranberry celebration.', swatches:['#e7e7df','#fffaf4','#477461'] },
  { id:'rainy', name:'Rainy Day', category:'playful', description:'Slate skies and a cozy workspace. No location needed.', swatches:['#dce3e7','#f1f5f5','#586f83'] },
  { id:'seasonal', name:'Seasonal', category:'playful', description:'Changes gently with the season, no setup required.', swatches:['#a2b78b','#d5bb8a','#b77b54'] },
] as const;
export type AppearanceThemeId = typeof THEME_OPTIONS[number]['id'];
export type AppearanceThemeChoice = 'company' | AppearanceThemeId;

const supported = new Set<string>(THEME_OPTIONS.map((option) => option.id));
export function isAppearanceTheme(value: unknown): value is AppearanceThemeId {
  return typeof value === 'string' && supported.has(value);
}
export function normalizeThemeChoice(value: unknown): AppearanceThemeChoice {
  return value === 'company' || isAppearanceTheme(value) ? value : 'company';
}
export function resolveSeasonalTheme(date = new Date()): Exclude<AppearanceThemeId, 'seasonal'> {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'sage';
  if (month >= 5 && month <= 7) return 'coastal';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}
export function resolveAppearanceTheme(choice: AppearanceThemeChoice, companyPalette: AppearanceThemeId, date = new Date()): Exclude<AppearanceThemeId, 'seasonal'> {
  const requested = choice === 'company' ? companyPalette : choice;
  return requested === 'seasonal' ? resolveSeasonalTheme(date) : requested;
}
export function themeName(value: AppearanceThemeId): string {
  return THEME_OPTIONS.find((theme) => theme.id === value)?.name ?? 'Warm Paper';
}
