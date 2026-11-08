import {create} from 'zustand';
import type {DealScheduleDraft} from '../services/dealScheduleTemplates';
import {
  createMultifamilyStarterSchedule,
} from '../services/dealScheduleTemplates';
import {
  appendSchedulePhase,assignBuildingImports,removeSchedulePhase,updateScheduleRow,
  assertValidSchedule,type ScheduleRowChanges,type SchedulePhase,
} from '../services/dealScheduleEditing';
import {
  createSharedSchedule,fetchSharedSchedules,saveSharedSchedule,SharedScheduleConflict,
  type SharedScheduleRecord,
} from '../services/dealScheduleCloud';

export type SharedScheduleStatus='idle'|'loading'|'ready'|'saving'|'conflict'|'error';
interface SharedScheduleState {
  scope:string|null;
  schedules:Record<string,DealScheduleDraft>;
  revisions:Record<string,number>;
  status:SharedScheduleStatus;
  error:string|null;
  load:(organizationId:string,userId:string)=>Promise<void>;
  refresh:()=>Promise<void>;
  begin:(dealId:string,deviceDraft?:DealScheduleDraft)=>Promise<void>;
  edit:(dealId:string,rowId:string,changes:ScheduleRowChanges)=>Promise<void>;
  addPhase:(dealId:string,scope:SchedulePhase)=>Promise<void>;
  removePhase:(dealId:string,rowId:string)=>Promise<void>;
  assignImports:(dealId:string,buildingId:string,ids:string[])=>Promise<void>;
}
const key=(org:string,user:string)=>'org:'+org+':user:'+user;
const parts=(scope:string)=>scope.match(/^org:([^:]+):user:([^:]+)$/);
function mapping(rows:Record<string,SharedScheduleRecord>){
  const schedules:Record<string,DealScheduleDraft>={},revisions:Record<string,number>={};
  for(const [id,row] of Object.entries(rows)){schedules[id]=row.schedule;revisions[id]=row.revision;}
  return {schedules,revisions};
}
export const useSharedDealScheduleStore=create<SharedScheduleState>((set,get)=>{
  async function reload(scope:string,showLoading=true){
    const parsed=parts(scope);
    if(!parsed)return;
    if(showLoading)set({status:'loading',error:null});
    try{
      const records=await fetchSharedSchedules(parsed[1]);
      if(get().scope!==scope)return;
      set({...mapping(records),status:'ready',error:null});
    }catch(error){
      if(get().scope!==scope)return;
      set({status:'error',error:error instanceof Error?error.message:'Could not load shared timelines.'});
    }
  }
  async function mutate(dealId:string,change:(draft:DealScheduleDraft)=>DealScheduleDraft){
    const before=get();
    const parsed=before.scope?parts(before.scope):null;
    if(!parsed||before.status!=='ready')return;
    const original=before.schedules[dealId],revision=before.revisions[dealId];
    if(!original||!revision)return;
    let next:DealScheduleDraft;
    try{next=change(original);assertValidSchedule(next);}
    catch(error){
      set({error:error instanceof Error?error.message:'Invalid milestone change.'});return;
    }
    set({status:'saving',error:null});
    try{
      const saved=await saveSharedSchedule(parsed[1],parsed[2],dealId,revision,next);
      if(get().scope!==before.scope)return;
      set({schedules:{...get().schedules,[dealId]:saved.schedule},
        revisions:{...get().revisions,[dealId]:saved.revision},
        status:'ready',error:null});
    }catch(error){
      if(get().scope!==before.scope)return;
      if(error instanceof SharedScheduleConflict){
        await reload(before.scope,false);
        if(get().scope===before.scope)set({status:'conflict',error:error.message});
      }else set({status:'error',error:error instanceof Error?error.message:'Unable to save shared timeline.'});
    }
  }
  return {
    scope:null,schedules:{},revisions:{},status:'idle',error:null,
    load:async(org,user)=>{
      if(!org||!user)return;
      const scope=key(org,user);
      if(get().scope===scope&&get().status!=='idle'&&get().status!=='error')return;
      set({scope,schedules:{},revisions:{},status:'loading',error:null});
      await reload(scope,false);
    },
    refresh:async()=>{const scope=get().scope;if(scope)await reload(scope);},
    begin:async(dealId,deviceDraft)=>{
      const current=get();
      const parsed=current.scope?parts(current.scope):null;
      if(!parsed||current.status!=='ready'||current.schedules[dealId])return;
      const draft=deviceDraft??createMultifamilyStarterSchedule({dealId});
      if(draft.dealId!==dealId){
        set({error:'Device draft belongs to a different Deal.'});return;
      }
      try{assertValidSchedule(draft);}
      catch(error){set({error:error instanceof Error?error.message:'Invalid local draft.'});return;}
      set({status:'saving',error:null});
      try{
        const saved=await createSharedSchedule(parsed[1],parsed[2],draft);
        if(get().scope!==current.scope)return;
        set({schedules:{...get().schedules,[dealId]:saved.schedule},
          revisions:{...get().revisions,[dealId]:saved.revision},status:'ready',error:null});
      }catch(error){
        if(get().scope!==current.scope)return;
        if(error instanceof SharedScheduleConflict){
          await reload(current.scope,false);
          if(get().scope===current.scope)set({status:'conflict',
            error:'A shared schedule already exists. Loaded the server version; your device draft was not overwritten.'});
        }else set({status:'error',error:error instanceof Error?error.message:'Unable to create shared timeline.'});
      }
    },
    edit:async(dealId,rowId,changes)=>mutate(dealId,draft=>updateScheduleRow(draft,rowId,changes)),
    addPhase:async(dealId,scope)=>mutate(dealId,draft=>appendSchedulePhase(draft,scope)),
    removePhase:async(dealId,rowId)=>mutate(dealId,draft=>removeSchedulePhase(draft,rowId)),
    assignImports:async(dealId,buildingId,ids)=>mutate(dealId,draft=>assignBuildingImports(draft,buildingId,ids)),
  };
});
