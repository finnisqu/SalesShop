/** #382 — Presentation-only, per-user record section tabs.
 * The CRM Setup's global panel blueprint is applied only to About, Files and
 * Notebook tabs on the left. Connections and Recents are deliberately kept.
 * An "optional hidden" tab is always recoverable from More sections. */
import type {CrmFieldTarget} from './crmFieldBlueprint352b';
import type {CrmGuidedSetupDraft,CrmSetupPanelId} from './crmGuidedSetup380';

export type PersonalRecordTab={id:string;label:string};
export type PersonalRecordTabs<T extends PersonalRecordTab>={
 shown:T[];hidden:T[];
};
const optionalTabPanels:Readonly<Record<string,CrmSetupPanelId>>={
 about:'details',files:'files',notebook:'notebook',
};
/** Stable order preserves Forecast, Email and other non-configurable tabs in
 * their current slots. The saved setup only reorders corresponding tabs. */
export function personalRecordTabPresentation<T extends PersonalRecordTab>(
 items:readonly T[],target:CrmFieldTarget,setup:CrmGuidedSetupDraft|null,
):PersonalRecordTabs<T>{
 if(!setup)return {shown:[...items],hidden:[]};
 const panels=setup.panels[target];
 if(!panels?.length)return {shown:[...items],hidden:[]};
 const byId=new Map(panels.map((panel,index)=>[panel.id,{...panel,index}] as const));
 const known=items.filter(item=>Object.hasOwn(optionalTabPanels,item.id));
 const ordered=[...known].sort((a,b)=>
  (byId.get(optionalTabPanels[a.id])?.index??99)-
  (byId.get(optionalTabPanels[b.id])?.index??99));
 let cursor=0;
 const slots=items.map(item=>Object.hasOwn(optionalTabPanels,item.id)?
  ordered[cursor++]:item);
 const shown:T[]=[],hidden:T[]=[];
 for(const item of slots){
  const panel=optionalTabPanels[item.id];
  // Details can never be disabled, even with a corrupted profile object.
  if(panel&&panel!=='details'&&byId.get(panel)?.visible===false)hidden.push(item);
  else shown.push(item);
 }
 return {shown,hidden};
}
