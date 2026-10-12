/** Settings are private to a platform Developer account, never a tenant workspace. */
export const STUDIO_TABS=['overview','companies','notebook','crm','playground','settings'] as const;
export type StudioTab=(typeof STUDIO_TABS)[number];

export const STUDIO_DENSITIES=['comfortable','compact'] as const;
export type StudioDensity=(typeof STUDIO_DENSITIES)[number];

export const STUDIO_ACCENTS=['gold','teal','blue'] as const;
export type StudioAccent=(typeof STUDIO_ACCENTS)[number];

export interface StudioSettingsDocument {
  schemaVersion:1;
  startTab:StudioTab;
  density:StudioDensity;
  accent:StudioAccent;
  showFollowUps:boolean;
}

export const blankStudioSettings=():StudioSettingsDocument=>({
  schemaVersion:1,
  startTab:'overview',
  density:'comfortable',
  accent:'gold',
  showFollowUps:true,
});

export function cleanStudioSettings(raw:unknown):StudioSettingsDocument {
  const defaults=blankStudioSettings();
  if(!raw || typeof raw!=='object')return defaults;
  const candidate=raw as Partial<StudioSettingsDocument>;
  if(candidate.schemaVersion!==1)return defaults;
  return {
    schemaVersion:1,
    startTab:STUDIO_TABS.includes(candidate.startTab as StudioTab)?candidate.startTab!:defaults.startTab,
    density:STUDIO_DENSITIES.includes(candidate.density as StudioDensity)?candidate.density!:defaults.density,
    accent:STUDIO_ACCENTS.includes(candidate.accent as StudioAccent)?candidate.accent!:defaults.accent,
    showFollowUps:typeof candidate.showFollowUps==='boolean'?candidate.showFollowUps:defaults.showFollowUps,
  };
}

export const STUDIO_TAB_LABELS:Record<StudioTab,string>={
  overview:'Overview',companies:'Companies',notebook:'Notebook',crm:'SalesShop CRM',
  playground:'Developer Playground',settings:'Settings',
};
