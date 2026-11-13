import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import type {Activity,Project} from '../types/crm';
import {localCrmRepository} from '../data/crmRepository';
import {useCrmStore} from './crmStore';
import {useAuthStore} from './authStore';
import {useRolePerspectiveStore} from './rolePerspectiveStore';

type Row=Record<string,unknown>;
const cloud=vi.hoisted(()=>({
 writes:0,fail:false,mismatch:false,lastPatch:null as Row|null,
}));
vi.mock('../lib/supabase',()=>({
 supabaseConfigured:true,developerPlaygroundActive:false,playgroundIdentityClient:null,
 supabase:{
  from(table:string){
   if(table!=='activities')throw new Error('A correction must not update '+table);
   return {
    update(patch:Row){
     const q={
      eq(_field:string,_value:unknown){return q;},
      async select(_columns:string){
       cloud.writes++;cloud.lastPatch=patch;
       if(cloud.fail)return {data:null,error:{message:'Write denied'}};
       const metadata=patch.metadata as Record<string,unknown>;
       return {data:[{id:'external-correct-1',
         metadata:cloud.mismatch?{...metadata,amount:1}:metadata}],error:null};
      },
     };
     return q;
    },
   };
  },
 },
}));
const timestamp='2026-11-10T12:00:00.000Z';
const deal:Project={
 id:'deal-correct',name:'Builder office',stage:'Bid Sent',amount:4000,
 createdAt:timestamp,updatedAt:timestamp,
};
const activity:Activity={
 id:'external-correct-1',type:'quote-sent',projectId:deal.id,
 summary:'External quote sent',occurredAt:'2025-05-11T12:00:00.000Z',
 metadata:{source:'manual',externalQuoteSent:true,fromStage:'Bid Development',
  toStage:'Bid Sent',recordedAt:timestamp,recordedByUserId:'rep-1',
  bidSentDate:'2025-05-11',amount:4000,externalQuoteFormat:'PDF'},
};
const change={bidSentDate:'2025-05-13',amount:5000,
 format:'Builder portal',notes:'Corrected bid'};
describe('Batch 331: authenticated external Quote correction',()=>{
 beforeEach(()=>{
  cloud.writes=0;cloud.fail=false;cloud.mismatch=false;cloud.lastPatch=null;
  vi.spyOn(localCrmRepository,'save').mockImplementation(()=>{});
  useRolePerspectiveStore.setState({activePerspective:null});
  useAuthStore.setState({mode:'cloud',organizationId:'org-1',
   user:{id:'rep-1'} as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
   teamRole:'owner',teamDepartment:'general'});
  useCrmStore.setState({companies:[],contacts:[],projects:[deal],
   activities:[activity],hydrated:true});
 });
 afterEach(()=>{
  vi.restoreAllMocks();
  useAuthStore.setState({mode:'local',organizationId:null,user:null,teamRole:null});
 });
 it('corrects just one existing Activity and preserves Deal, proof and original recording time',async()=>{
  await useCrmStore.getState().correctExternalQuoteSent(activity.id,change);
  expect(cloud.writes).toBe(1);
  const saved=useCrmStore.getState();
  expect(saved.activities).toHaveLength(1);
  expect(saved.activities[0]).toMatchObject({
   id:activity.id,projectId:deal.id,occurredAt:'2025-05-13T12:00:00.000Z',
   metadata:{externalQuoteSent:true,amount:5000,bidSentDate:'2025-05-13',
    recordedAt:timestamp,recordedByUserId:'rep-1',
    fromStage:'Bid Development',toStage:'Bid Sent',
    externalQuoteFormat:'Builder portal',notes:'Corrected bid'},
  });
  expect(saved.projects).toEqual([deal]);
  expect(cloud.lastPatch?.metadata).toMatchObject({
   editedByUserId:'rep-1',externalQuoteSent:true,
  });
 });
 it('keeps local records unchanged when the server denies the correction',async()=>{
  cloud.fail=true;
  await expect(useCrmStore.getState().correctExternalQuoteSent(activity.id,change))
   .rejects.toThrow('Write denied');
  expect(useCrmStore.getState().activities).toEqual([activity]);
  expect(useCrmStore.getState().projects).toEqual([deal]);
 });
 it('rejects unexpected returned metadata and never silently accepts a partial update',async()=>{
  cloud.mismatch=true;
  await expect(useCrmStore.getState().correctExternalQuoteSent(activity.id,change))
   .rejects.toThrow('expected correction');
  expect(useCrmStore.getState().activities).toEqual([activity]);
  expect(cloud.writes).toBe(1);
 });
 it('refuses role-preview and foreign submitter edits before any cloud write',async()=>{
  useRolePerspectiveStore.setState({activePerspective:'viewer'});
  await expect(useCrmStore.getState().correctExternalQuoteSent(activity.id,change))
   .rejects.toThrow('role preview');
  useRolePerspectiveStore.setState({activePerspective:null});
  useAuthStore.setState({teamRole:'member',
   user:{id:'other-rep'} as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>});
  await expect(useCrmStore.getState().correctExternalQuoteSent(activity.id,change))
   .rejects.toThrow('Only the recorder');
  expect(cloud.writes).toBe(0);
 });
});
