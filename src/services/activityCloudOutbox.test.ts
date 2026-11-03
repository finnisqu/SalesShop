import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {Activity,CrmDocument} from '../types/crm';
import {stagePendingActivity,readPendingActivities,acknowledgePendingActivities,
 mergePendingActivities,pendingSnapshotContained} from './activityCloudOutbox';
const scope={organizationId:'org-test',userId:'user-test'};
const other={organizationId:'org-other',userId:'user-test'};
const event=(id:string,summary='Called builder'):Activity=>({
 id,type:'manual-touchpoint',summary,occurredAt:'2026-11-03T12:00:00Z'
});
describe('durable CRM activity outbox',()=>{
 const storage=new Map<string,string>();
 beforeEach(()=>{
  storage.clear();
  vi.stubGlobal('localStorage',{
   getItem:(k:string)=>storage.get(k)??null,
   setItem:(k:string,v:string)=>{storage.set(k,v);},
   removeItem:(k:string)=>{storage.delete(k);}
  });
 });
 it('separates organization/user scopes and survives reload',()=>{
  expect(stagePendingActivity(scope,event('a'))).toBe(true);
  expect(readPendingActivities(scope)).toEqual([event('a')]);
  expect(readPendingActivities(other)).toEqual([]);
 });
 it('does not clear a newer local edit when an old save finishes',()=>{
  const older=event('a'),newer=event('a','Corrected');
  stagePendingActivity(scope,older);
  stagePendingActivity(scope,newer);
  acknowledgePendingActivities(scope,[older]);
  expect(readPendingActivities(scope)).toEqual([newer]);
  acknowledgePendingActivities(scope,[newer]);
  expect(readPendingActivities(scope)).toEqual([]);
 });
 it('merges unsynced activity into authoritative remote without replacing unrelated CRM rows',()=>{
  const cloud={schemaVersion:3,companies:[],contacts:[],projects:[],
   activities:[event('cloud')]} as CrmDocument;
  const merged=mergePendingActivities(cloud,[event('new')])!;
  expect(merged.activities.map(a=>a.id)).toEqual(['cloud','new']);
  expect(cloud.activities.map(a=>a.id)).toEqual(['cloud']);
  expect(pendingSnapshotContained(merged,[event('new'),event('missing')])).toEqual([event('new')]);
 });
 it('signals storage failures instead of claiming a durable save',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>null,
   setItem:()=>{throw new Error('Quota exceeded');},removeItem:()=>{}});
  expect(stagePendingActivity(scope,event('fail'))).toBe(false);
 });
});
