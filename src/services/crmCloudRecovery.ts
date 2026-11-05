import type {Activity,Company,Contact,CrmDocument,Project} from '../types/crm';
import {scopedStorageKey} from '../lib/developerPlayground';

/** A scoped, metadata-only write-ahead marker for CRM edits interrupted before
 * the debounced cloud sync commits. Actual records remain in the existing local
 * CRM document, never duplicated into the marker. */
const KEY=scopedStorageKey('salesshop-cloud-crm-pending-v1');
export interface CrmRecoveryScope {userId:string;organizationId:string;}
export type CrmRecoveryCollection='companies'|'contacts'|'projects'|'activities';
export type PendingCrmRecords=Record<CrmRecoveryCollection,string[]>;
export interface PendingCrmSync extends CrmRecoveryScope {
 token:string;
 changed:PendingCrmRecords;
 created:PendingCrmRecords;
}
const collections:CrmRecoveryCollection[]=['companies','contacts','projects','activities'];
const empty=():PendingCrmRecords=>({companies:[],contacts:[],projects:[],activities:[]});
const validDoc=(value:unknown):value is CrmDocument=>{
 if(!value||typeof value!=='object')return false;
 const doc=value as Partial<CrmDocument>;
 return doc.schemaVersion===3&&collections.every(key=>Array.isArray(doc[key]));
};
const cleanIds=(value:unknown)=>Array.isArray(value)
 ?[...new Set(value.filter((id):id is string=>typeof id==='string'&&id.length>0))]:[];
export function readPendingCrmSync(scope:CrmRecoveryScope):PendingCrmSync|null{
 try{
  const value=JSON.parse(localStorage.getItem(KEY)??'null') as Partial<PendingCrmSync>|null;
  if(!value||value.userId!==scope.userId||value.organizationId!==scope.organizationId
    ||typeof value.token!=='string'||!value.changed||!value.created)return null;
  const changed=empty(),created=empty();
  for(const key of collections){
   changed[key]=cleanIds(value.changed[key]);
   created[key]=cleanIds(value.created[key]).filter(id=>changed[key].includes(id));
  }
  return {...scope,token:value.token,changed,created};
 }catch{return null;}
}
/** Diff against the authorized cloud snapshot captured at session startup.
 * Preserve all earlier unacknowledged IDs until the newest token is confirmed.
 * Deletions are remote-first and intentionally never replayed from a marker.
 */
export function markPendingCrmSync(scope:CrmRecoveryScope,document:unknown,
 baseline:CrmDocument|null):string|null{
 if(!validDoc(document))return null;
 const prior=readPendingCrmSync(scope);
 const changed=empty(),created=empty();
 let hasChanges=false;
 for(const key of collections){
  const previous=new Map((validDoc(baseline)?baseline[key]:[]).map(record=>[record.id,JSON.stringify(record)]));
  const changedIds=new Set(prior?.changed[key]??[]);
  const createdIds=new Set(prior?.created[key]??[]);
  for(const record of document[key]){
   const original=previous.get(record.id);
   if(original===undefined||original!==JSON.stringify(record)){
    changedIds.add(record.id);
    if(original===undefined)createdIds.add(record.id);
   }
  }
  // Do not recover records that have since been deleted locally.
  const present=new Set(document[key].map(item=>item.id));
  changed[key]=[...changedIds].filter(id=>present.has(id));
  created[key]=[...createdIds].filter(id=>present.has(id)&&changedIds.has(id));
  if(changed[key].length)hasChanges=true;
 }
 if(!hasChanges)return null;
 try{
  const token=crypto.randomUUID();
  localStorage.setItem(KEY,JSON.stringify({...scope,token,changed,created} satisfies PendingCrmSync));
  return token;
 }catch{return null;}
}
export function clearPendingCrmSync(scope:CrmRecoveryScope,token:string){
 try{if(readPendingCrmSync(scope)?.token===token)localStorage.removeItem(KEY);}
 catch{/* an acknowledged write should not be blocked by disabled storage */}
}
const newer=(local:string,server:string)=>{
 const a=Date.parse(local),b=Date.parse(server);
 return Number.isFinite(a)&&Number.isFinite(b)?a>b:local>server;
};
function overlay<T extends {id:string;updatedAt:string}>(
 remote:T[],local:T[],changed:string[],created:string[]
):{rows:T[];recovered:boolean}{
 const byId=new Map(remote.map(row=>[row.id,row]));
 const newIds=new Set(created);
 let recovered=false;
 for(const row of local){
  if(!changed.includes(row.id))continue;
  const server=byId.get(row.id);
  if(server&&!newer(row.updatedAt,server.updatedAt))continue;
  // A remotely deleted existing record must not be resurrected by a local cache.
  if(!server&&!newIds.has(row.id))continue;
  byId.set(row.id,row);recovered=true;
 }
 return {rows:[...byId.values()],recovered};
}
function overlayActivities(remote:Activity[],local:Activity[],changed:string[],created:string[]){
 const byId=new Map(remote.map(row=>[row.id,row]));
 const newIds=new Set(created);
 let recovered=false;
 for(const row of local){
  if(!changed.includes(row.id))continue;
  const server=byId.get(row.id);
  if(!server){
   if(!newIds.has(row.id))continue;
  }else{
   const localEdit=row.metadata?.editedAt,remoteEdit=server.metadata?.editedAt;
   if(!localEdit||remoteEdit&&!newer(localEdit,remoteEdit))continue;
  }
  byId.set(row.id,row);recovered=true;
 }
 return {rows:[...byId.values()],recovered};
}
/** The cloud remains authoritative except for explicitly marked, newer edits
 * belonging to the same signed-in user+organization. This runs *before*
 * hydrateCloudDocuments overwrites the local cache with server rows.
 */
export function mergePendingCrmChanges(
 cloud:CrmDocument|null,local:unknown,pending:PendingCrmSync|null
):CrmDocument|null{
 if(!pending||!validDoc(local))return cloud;
 const baseline=cloud??{schemaVersion:3,companies:[],contacts:[],projects:[],activities:[]} satisfies CrmDocument;
 const companies=overlay<Company>(baseline.companies,local.companies,pending.changed.companies,pending.created.companies);
 const contacts=overlay<Contact>(baseline.contacts,local.contacts,pending.changed.contacts,pending.created.contacts);
 const projects=overlay<Project>(baseline.projects,local.projects,pending.changed.projects,pending.created.projects);
 const activities=overlayActivities(baseline.activities,local.activities,pending.changed.activities,pending.created.activities);
 if(![companies,contacts,projects,activities].some(group=>group.recovered))return cloud;
 return {schemaVersion:3,companies:companies.rows,contacts:contacts.rows,projects:projects.rows,activities:activities.rows};
}
