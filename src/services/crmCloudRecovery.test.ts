import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Activity,Company,Contact,CrmDocument,Project} from '../types/crm';
import {
 markPendingCrmSync,readPendingCrmSync,clearPendingCrmSync,mergePendingCrmChanges,
 type CrmRecoveryScope,type PendingCrmSync
} from './crmCloudRecovery';
import {readFileSync} from 'node:fs';

const old='2026-11-03T16:00:00Z',newer='2026-11-04T17:00:00Z';
const company=(id:string,updatedAt=old,name=id):Company=>({
 id,name,kind:'customer',createdAt:old,updatedAt
});
const person=(id:string,updatedAt=old):Contact=>({
 id,name:id,createdAt:old,updatedAt
});
const deal=(id:string,updatedAt=old,name=id):Project=>({
 id,name,stage:'Discovery',createdAt:old,updatedAt
});
const activity=(id:string,editedAt?:string):Activity=>({
 id,summary:id,type:'manual-touchpoint',occurredAt:old,
 metadata:editedAt?{editedAt,interactionMethod:'call'}:{interactionMethod:'call'}
});
const doc=(companies:Company[]=[],contacts:Contact[]=[],projects:Project[]=[],activities:Activity[]=[]):CrmDocument=>({
 schemaVersion:3,companies,contacts,projects,activities
});
const scope:CrmRecoveryScope={userId:'person-A',organizationId:'shop-1'};
const ids=()=>({companies:[],contacts:[],projects:[],activities:[]});
const marker=(changed:Partial<PendingCrmSync['changed']>,created:Partial<PendingCrmSync['created']>={}):PendingCrmSync=>({
 ...scope,token:'pending-1',
 changed:{...ids(),...changed},
 created:{...ids(),...created}
});
afterEach(()=>vi.unstubAllGlobals());

describe('CRM interrupted-save recovery',()=>{
 it('recovers only explicitly changed records and does not replace unrelated cloud updates',()=>{
  const cloud=doc([company('one',old),company('other',newer,'Latest')],[person('p')],[deal('d')]);
  const local=doc([company('one',newer,'Edited locally'),company('other',old,'Stale')],
   [person('p')],[deal('d',newer,'Edited deal')]);
  const merged=mergePendingCrmChanges(cloud,local,marker({companies:['one'],projects:['d']}));
  expect(merged?.companies.find(c=>c.id==='one')?.name).toBe('Edited locally');
  expect(merged?.companies.find(c=>c.id==='other')?.name).toBe('Latest');
  expect(merged?.projects.find(p=>p.id==='d')?.name).toBe('Edited deal');
  expect(merged?.contacts).toEqual(cloud.contacts);
 });
 it('preserves newer cloud rows and never resurrects an existing remote-deleted record',()=>{
  const cloud=doc([company('one',newer,'Server newer')]);
  const local=doc([company('one',old,'Stale'),company('deleted',newer,'Cache leftover')]);
  const merged=mergePendingCrmChanges(cloud,local,marker({companies:['one','deleted']}));
  expect(merged).toEqual(cloud);
 });
 it('recovers only genuinely new rows marked as created locally',()=>{
  const local=doc([company('new',newer)], [person('new-person',newer)],[deal('new-deal',newer)]);
  const merged=mergePendingCrmChanges(null,local,
   marker({companies:['new'],contacts:['new-person'],projects:['new-deal']},
     {companies:['new'],contacts:['new-person'],projects:['new-deal']}));
  expect(merged?.companies.map(c=>c.id)).toEqual(['new']);
  expect(merged?.contacts.map(c=>c.id)).toEqual(['new-person']);
  expect(merged?.projects.map(c=>c.id)).toEqual(['new-deal']);
  expect(mergePendingCrmChanges(null,local,null)).toBeNull();
 });
 it('does not overwrite immutable activities, except newer explicitly edited corrections',()=>{
  const cloud=doc([],[],[],[activity('existing',newer)]);
  const local=doc([],[],[],[activity('existing',old),activity('fresh')]);
  const merged=mergePendingCrmChanges(cloud,local,
   marker({activities:['existing','fresh']},{activities:['fresh']}));
  expect(merged?.activities.map(a=>a.id)).toEqual(['existing','fresh']);
  expect(merged?.activities[0].metadata?.editedAt).toBe(newer);
  const latest=mergePendingCrmChanges(cloud,
   doc([],[],[],[activity('existing','2026-11-05T12:00:00Z')]),
   marker({activities:['existing']}));
  expect(latest?.activities[0].metadata?.editedAt).toBe('2026-11-05T12:00:00Z');
 });
 it('keeps a lightweight, identity-scoped marker and clears only the acknowledged token',()=>{
  const storage=new Map<string,string>();
  vi.stubGlobal('localStorage',{
   getItem:(key:string)=>storage.get(key)??null,
   setItem:(key:string,value:string)=>{storage.set(key,value);},
   removeItem:(key:string)=>{storage.delete(key);}
  });
  vi.stubGlobal('crypto',{randomUUID:()=> 'first-token'});
  const baseline=doc([company('one')]);
  const changed=doc([company('one',newer,'Edited')],[],[deal('fresh',newer)]);
  const token=markPendingCrmSync(scope,changed,baseline);
  expect(token).toBe('first-token');
  const pending=readPendingCrmSync(scope);
  expect(pending?.changed.companies).toEqual(['one']);
  expect(pending?.changed.projects).toEqual(['fresh']);
  expect(pending?.created.projects).toEqual(['fresh']);
  expect(readPendingCrmSync({...scope,userId:'other-user'})).toBeNull();
  expect(readPendingCrmSync({...scope,organizationId:'another-shop'})).toBeNull();
  expect([...storage.values()][0]).not.toContain('Edited');
  clearPendingCrmSync(scope,'older-token');
  expect(readPendingCrmSync(scope)).not.toBeNull();
  clearPendingCrmSync(scope,token!);
  expect(readPendingCrmSync(scope)).toBeNull();
 });
 it('retains earlier unsynced IDs across successive edits until latest token succeeds',()=>{
  const storage=new Map<string,string>();
  let counter=0;
  vi.stubGlobal('localStorage',{
   getItem:(key:string)=>storage.get(key)??null,
   setItem:(key:string,value:string)=>{storage.set(key,value);},
   removeItem:(key:string)=>{storage.delete(key);}
  });
  vi.stubGlobal('crypto',{randomUUID:()=>String(++counter)});
  const baseline=doc([company('a'),company('b')]);
  const first=markPendingCrmSync(scope,doc([company('a',newer),company('b')]),baseline);
  const second=markPendingCrmSync(scope,doc([company('a',newer),company('b',newer)]),baseline);
  clearPendingCrmSync(scope,first!);
  expect(readPendingCrmSync(scope)?.changed.companies).toEqual(['a','b']);
  clearPendingCrmSync(scope,second!);
  expect(readPendingCrmSync(scope)).toBeNull();
 });
 it('hydrates before replacing local CRM, then retries in writable workspaces only',()=>{
  const cloudSync=readFileSync(new URL('./cloudSync.ts',import.meta.url),'utf8');
  const auth=readFileSync(new URL('../store/authStore.ts',import.meta.url),'utf8');
  expect(cloudSync).toContain('const recoveredCrm=mergePendingCrmChanges(normalizedCrm,localCrm,pendingCrm)');
  expect(cloudSync).toContain('previousScope?.userId===userId&&previousScope.organizationId===orgId');
  expect(cloudSync).toContain('markPendingCrmSync(scope,document,baselineCrm)');
  expect(cloudSync).toContain('clearPendingCrmSync(scope,token)');
  expect(cloudSync).toContain('if(canWriteCrm&&readPendingCrmSync(scope))');
  expect(auth).toContain("allowCrmRecovery: membership.role !== 'viewer'");
 });
 it('serializes cloud writes by document and ignores out-of-order responses',()=>{
  const sync=readFileSync(new URL('./cloudSync.ts',import.meta.url),'utf8');
  expect(sync).toContain('const inFlight=new Map<CloudDocumentKey,Promise<void>>()');
  expect(sync).toContain('const scheduledRevision=new Map<CloudDocumentKey,number>()');
  expect(sync).toContain('const operation=(inFlight.get(key)??Promise.resolve()).catch(()=>{}).then(()=>');
  expect(sync).toContain('inFlight.set(key,operation)');
  expect(sync).toContain('if(scheduledRevision.get(key)!==revision)return');
  expect(sync).toContain('if(disposed)return');
 });
 it('retries only failed, scoped saves when a connection or foreground session returns',()=>{
  const sync=readFileSync(new URL('./cloudSync.ts',import.meta.url),'utf8');
  const auth=readFileSync(new URL('../store/authStore.ts',import.meta.url),'utf8');
  expect(sync).toContain("window.addEventListener('online',retryFailed)");
  expect(sync).toContain("document.addEventListener('visibilitychange',retryWhenVisible)");
  expect(sync).toContain("window.removeEventListener('online',retryFailed)");
  expect(sync).toContain("document.removeEventListener('visibilitychange',retryWhenVisible)");
  expect(sync).toContain('if(!active())return');
  expect(sync).toContain('if(canWriteCrm&&retryableFailures.has(CRM_DOCUMENT_KEY)');
  expect(sync).toContain('if(Date.now()-lastRecoveryRetry<15000)return');
  expect(sync).toContain('retryableFailures.has(CRM_DOCUMENT_KEY)&&readPendingCrmSync(scope)');
  expect(sync).toContain('retryableFailures.has(QUOTES_DOCUMENT_KEY)&&readPendingQuoteSync(scope)');
  expect(auth).toContain('lastCloudSyncError');
  expect(auth).toContain('current.error===lastCloudSyncError');
  expect(auth).toContain('onRecovered:()=>');
 });
});
