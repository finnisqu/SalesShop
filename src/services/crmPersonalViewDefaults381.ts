/** #381 — Personal Records directory layouts.
 * Reads reviewed CRM Setup view intentions as per-user UI defaults only.
 * Manual choices are separately scoped overrides; neither mutates CRM data,
 * shared organization settings, saved worktable columns nor pipelines. */
import {scopedStorageKey} from '../lib/developerPlayground';
import {crmBlueprintStorageKey} from './crmFieldBlueprint352b';
import {crmGuidedSetupStorageKey,readCrmGuidedSetup,
 type CrmGuidedSetupDraft,type CrmSetupView} from './crmGuidedSetup380';

export type RecordLayoutKind='companies'|'deals';
export type RecordDirectoryLayouts=Record<RecordLayoutKind,CrmSetupView>;
export type RecordLayoutOverrides=Partial<RecordDirectoryLayouts>;
export type RecordLayoutIdentity={
 mode:'local'|'cloud';organizationId:string|null;userId?:string;
};
const EMPTY_LAYOUT:RecordDirectoryLayouts={companies:'table',deals:'board'};
const layout=(value:unknown):value is CrmSetupView=>
 value==='table'||value==='board';

export function personalRecordLayoutStorageKey(identity:RecordLayoutIdentity):string{
 const {mode,organizationId,userId}=identity;
 return scopedStorageKey('salesshop-record-layout-overrides-v1:'+JSON.stringify([
  mode,mode==='cloud'?organizationId??'signed-out':'local',
  mode==='cloud'?userId??'signed-out':'local',
 ]));
}
export function personalCrmSetupStorageKey(identity:RecordLayoutIdentity):string{
 return crmGuidedSetupStorageKey(crmBlueprintStorageKey(
  identity.mode,identity.organizationId,identity.userId));
}
export function parseRecordLayoutOverrides(raw:string|null):RecordLayoutOverrides{
 if(!raw||raw.length>256)return {};
 try{
  const decoded:unknown=JSON.parse(raw);
  if(!decoded||typeof decoded!=='object'||Array.isArray(decoded))return {};
  const v=decoded as Record<string,unknown>;
  const clean:RecordLayoutOverrides={};
  if(layout(v.companies))clean.companies=v.companies;
  if(layout(v.deals))clean.deals=v.deals;
  return clean;
 }catch{return {};}
}
/** The precedence is explicit: manually selected layout > saved guided
 * setup > existing default. A corrupted setup never changes the fallback. */
export function resolvePersonalRecordLayouts(
 overrides:RecordLayoutOverrides,
 guided:CrmGuidedSetupDraft|null,
):RecordDirectoryLayouts{
 return {
  companies:overrides.companies??guided?.views.companies??EMPTY_LAYOUT.companies,
  deals:overrides.deals??guided?.views.deals??EMPTY_LAYOUT.deals,
 };
}
export function withManualRecordLayout(
 overrides:RecordLayoutOverrides,kind:RecordLayoutKind,next:CrmSetupView,
):RecordLayoutOverrides{
 if(!layout(next))throw new Error('Choose Table or Board.');
 return {...overrides,[kind]:next};
}
export function withoutManualRecordLayout(
 overrides:RecordLayoutOverrides,kind:RecordLayoutKind,
):RecordLayoutOverrides{
 if(overrides[kind]===undefined)return overrides;
 const next={...overrides};delete next[kind];return next;
}
export function readPersonalCrmLayoutDefaults(
 read:(key:string)=>string|null,
 identity:RecordLayoutIdentity,
):CrmGuidedSetupDraft|null{
 try{return readCrmGuidedSetup(read(personalCrmSetupStorageKey(identity)));}
 catch{return null;}
}
