import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import type {Project} from '../types/crm';
import {localCrmRepository} from '../data/crmRepository';
import {useAuthStore} from './authStore';
import {useCrmStore} from './crmStore';

type Row=Record<string,unknown>;
const cloud=vi.hoisted(()=>({
 activity:null as Row|null,
 project:{id:'deal-cloud',stage:'Bid Development',amount:700,
  due_date:'2026-11-20',updated_at:'2026-11-01T12:00:00.000Z'} as Row,
 insertCount:0,projectUpdates:0,
 failProject:false,lostAck:false,
}));
vi.mock('../lib/supabase',()=>({
 supabaseConfigured:true,developerPlaygroundActive:false,
 playgroundIdentityClient:null,
 supabase:{
  from(table:string){
   if(table==='activities')return {
    async insert(row:Row){
     cloud.insertCount++;
     if(cloud.activity)return {error:{code:'23505',message:'already recorded'}};
     cloud.activity={
      id:row.id,type:row.type,project_id:row.project_id,metadata:row.metadata,
     };
     return {error:null};
    },
    select(_columns:string){
     const q={eq(_key:string,_value:unknown){return q;},
      async maybeSingle(){return {data:cloud.activity,error:null};}};
     return q;
    },
   };
   if(table==='projects')return {
    update(patch:Row){
     let stageGuard=true;
     const q={
      eq(key:string,value:unknown){
       if(key==='stage')stageGuard=cloud.project.stage===value;
       return q;
      },
      async select(_columns:string){
       cloud.projectUpdates++;
       if(cloud.failProject)
        return {data:null,error:{message:'Simulated Deal write rejection'}};
       if(!stageGuard)return {data:[],error:null};
       cloud.project={...cloud.project,...patch};
       return {data:cloud.lostAck?[]:[{...cloud.project}],error:null};
      },
     };
     return q;
    },
    select(_columns:string){
     const q={eq(_key:string,_value:unknown){return q;},
      async maybeSingle(){return {data:{...cloud.project},error:null};}};
     return q;
    },
   };
   throw new Error('Unexpected table '+table);
  },
 },
}));
const deal:Project={
 id:'deal-cloud',name:'Example builder job',stage:'Bid Development',
 amount:700,dueDate:'2026-11-20',companyId:'co-1',
 createdAt:'2026-11-01T12:00:00.000Z',updatedAt:'2026-11-01T12:00:00.000Z',
};
const submit=()=>useCrmStore.getState().recordExternalQuoteSent(
 'deal-cloud',12000,'2026-11-12','Builder portal',
 'submission-stable-id','2026-11-13T13:00:00.000Z',
);

describe('Batch 330: external submission remote Deal acknowledgement',()=>{
 beforeEach(()=>{
  cloud.activity=null;cloud.insertCount=0;cloud.projectUpdates=0;
  cloud.failProject=false;cloud.lostAck=false;
  cloud.project={id:'deal-cloud',stage:'Bid Development',amount:700,
   due_date:'2026-11-20',updated_at:'2026-11-01T12:00:00.000Z'};
  vi.spyOn(localCrmRepository,'save').mockImplementation(()=>{});
  useAuthStore.setState({mode:'cloud',organizationId:'org-cloud',
   user:{id:'rep-1'} as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
   teamRole:'owner',teamDepartment:'general'});
  useCrmStore.setState({companies:[],contacts:[],projects:[{...deal}],
   activities:[],hydrated:true});
 });
 afterEach(()=>{
  vi.restoreAllMocks();
  useAuthStore.setState({mode:'local',organizationId:null,user:null,teamRole:null});
 });
 it('waits for both Activity and Deal acknowledgement before reporting success',async()=>{
  expect(await submit()).toBe(true);
  expect(cloud.insertCount).toBe(1);
  expect(cloud.projectUpdates).toBe(1);
  expect(cloud.activity?.metadata).toMatchObject({
   externalQuoteSent:true,amount:12000,bidSentDate:'2026-11-12'});
  expect(cloud.project).toMatchObject({
   stage:'Bid Sent',amount:12000,due_date:null});
  expect(useCrmStore.getState().projects[0]).toMatchObject({
   stage:'Bid Sent',amount:12000,dueDate:undefined});
  expect(useCrmStore.getState().activities).toHaveLength(1);
 });
 it('does not overwrite a second Deal edited while cloud confirmation is in flight',async()=>{
  const unrelated={...deal,id:'deal-two',name:'Other GC job',
   updatedAt:'2026-11-13T13:10:00Z'};
  useCrmStore.setState({projects:[{...deal},unrelated]});
  expect(await submit()).toBe(true);
  expect(useCrmStore.getState().projects.find(d=>d.id==='deal-two')).toEqual(unrelated);
 });
 it('does not claim success or change local records when the Deal write fails',async()=>{
  cloud.failProject=true;
  await expect(submit()).rejects.toThrow('Deal update failed');
  expect(cloud.activity?.id).toBe('submission-stable-id');
  expect(useCrmStore.getState().projects[0]).toEqual(deal);
  expect(useCrmStore.getState().activities).toEqual([]);
  cloud.failProject=false;
  expect(await submit()).toBe(true);
  expect(cloud.insertCount).toBe(2);
  expect(useCrmStore.getState().activities.map(a=>a.id))
   .toEqual(['submission-stable-id']);
 });
 it('recovers from a lost Deal write response by confirming its saved state',async()=>{
  cloud.lostAck=true;
  expect(await submit()).toBe(true);
  expect(cloud.project).toMatchObject({stage:'Bid Sent',due_date:null});
  expect(useCrmStore.getState().activities).toHaveLength(1);
 });
 it('does not overwrite another user\'s changed Deal stage',async()=>{
  cloud.project.stage='Negotiation';
  await expect(submit()).rejects.toThrow('Deal changed or did not save');
  expect(cloud.project.stage).toBe('Negotiation');
  expect(useCrmStore.getState().activities).toHaveLength(0);
 });
});
