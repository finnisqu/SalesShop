import type {Activity,CrmDocument} from '../types/crm';
import {scopedStorageKey} from '../lib/developerPlayground';

/** Identity-scoped, durable outbox for completed interactions. A CRM cloud
 * reload must never erase an unacknowledged salesperson entry. */
export interface ActivitySyncScope {organizationId:string;userId:string;}
const BASE=scopedStorageKey('salesshop-crm-activity-outbox-v1:');
const key=(scope:ActivitySyncScope)=>BASE+scope.organizationId+':'+scope.userId;
const isActivity=(value:unknown):value is Activity=>{
 if(!value||typeof value!=='object')return false;
 const a=value as Partial<Activity>;
 return typeof a.id==='string'&&typeof a.type==='string'&&
  typeof a.summary==='string'&&typeof a.occurredAt==='string';
};
export function readPendingActivities(scope:ActivitySyncScope):Activity[] {
 try {
  const value=JSON.parse(localStorage.getItem(key(scope))||'[]') as unknown;
  return Array.isArray(value)?value.filter(isActivity).slice(-500):[];
 }catch{return [];}
}
/** Record the exact snapshot BEFORE mutating CRM; false indicates storage
 * failure, so the app must not imply a durable save. */
export function stagePendingActivity(scope:ActivitySyncScope,activity:Activity):boolean {
 try{
  const previous=readPendingActivities(scope);
  const next=[...previous.filter(a=>a.id!==activity.id),activity];
  if(next.length>500)return false;
  localStorage.setItem(key(scope),JSON.stringify(next));
  return true;
 }catch{return false;}
}
/** Remove only snapshots confirmed on the server. Never acknowledge a newer
 * local correction because an older in-flight save completed. */
export function acknowledgePendingActivities(scope:ActivitySyncScope,saved:readonly Activity[]) {
 try{
  const acknowledged=new Map(saved.map(a=>[a.id,JSON.stringify(a)]));
  const remaining=readPendingActivities(scope).filter(a=>
   acknowledged.get(a.id)!==JSON.stringify(a));
  if(remaining.length)localStorage.setItem(key(scope),JSON.stringify(remaining));
  else localStorage.removeItem(key(scope));
 }catch{/* Retaining pending changes is safer than losing them. */}
}
export function mergePendingActivities(cloud:CrmDocument|null,pending:readonly Activity[]):CrmDocument|null{
 if(!pending.length)return cloud;
 const base:CrmDocument=cloud??{schemaVersion:3,companies:[],contacts:[],projects:[],activities:[]};
 const byId=new Map(base.activities.map(a=>[a.id,a]));
 for(const a of pending)byId.set(a.id,a);
 return {...base,activities:[...byId.values()]};
}
export function pendingSnapshotContained(document:CrmDocument,pending:readonly Activity[]):Activity[]{
 const written=new Map(document.activities.map(a=>[a.id,JSON.stringify(a)]));
 return pending.filter(a=>written.get(a.id)===JSON.stringify(a));
}
