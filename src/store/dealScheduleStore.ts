import {create} from 'zustand';
import {createMultifamilyStarterSchedule,type DealScheduleDraft} from '../services/dealScheduleTemplates';
import {
  appendSchedulePhase,assignBuildingImports,assertValidSchedule,removeSchedulePhase,
  updateScheduleRow,type SchedulePhase,type ScheduleRowChanges,
} from '../services/dealScheduleEditing';

/** Device-only until the tenant-isolated schedule migration is deployed.
 * Scope includes organization AND user: never display another login's draft cache.
 */
const PREFIX='salesshop:deal-schedules:device-v1:';
function key(scope:string):string{return PREFIX+scope;}
function read(scope:string):Record<string,DealScheduleDraft>{
  try{
    const raw=window.localStorage.getItem(key(scope));
    if(!raw)return {};
    const data:unknown=JSON.parse(raw);
    if(!data||typeof data!=='object'||Array.isArray(data))return {};
    const schedules:Record<string,DealScheduleDraft>={};
    for(const [id,value] of Object.entries(data)){
      if(!value||typeof value!=='object')continue;
      const draft=value as DealScheduleDraft;
      if(draft.dealId!==id||draft.templateId!=='multifamily-starter-v1'||!Array.isArray(draft.rows))continue;
      try{assertValidSchedule(draft);schedules[id]=draft;}catch{/* skip corrupt entry */}
    }
    return schedules;
  }catch{return {};}
}
interface ScheduleState {
  scope:string;
  loaded:boolean;
  schedules:Record<string,DealScheduleDraft>;
  error:string|null;
  load:(scope:string)=>void;
  begin:(dealId:string)=>void;
  edit:(dealId:string,rowId:string,changes:ScheduleRowChanges)=>void;
  addPhase:(dealId:string,phase:SchedulePhase)=>void;
  removePhase:(dealId:string,groupId:string)=>void;
  assignImports:(dealId:string,buildingId:string,importIds:string[])=>void;
  removeSchedule:(dealId:string)=>void;
}
export const useDealScheduleStore=create<ScheduleState>((set,get)=>{
  function persist(schedules:Record<string,DealScheduleDraft>){
    const scope=get().scope;
    try{
      window.localStorage.setItem(key(scope),JSON.stringify(schedules));
      set({schedules,error:null});
    }catch{
      set({error:'Could not save this schedule on this device. Check browser storage.'});
    }
  }
  function change(dealId:string,apply:(draft:DealScheduleDraft)=>DealScheduleDraft){
    if(!get().loaded)return;
    const previous=get().schedules[dealId];
    if(!previous)return;
    try{
      const next=apply(previous);
      assertValidSchedule(next);
      persist({...get().schedules,[dealId]:next});
    }catch(error){
      set({error:error instanceof Error?error.message:'Unable to update schedule.'});
    }
  }
  return {
    scope:'',loaded:false,schedules:{},error:null,
    load:(scope)=>{
      if(scope===get().scope&&get().loaded)return;
      set({scope,loaded:true,schedules:read(scope),error:null});
    },
    begin:(dealId)=>{
      if(!get().loaded||get().schedules[dealId])return;
      const draft=createMultifamilyStarterSchedule({dealId});
      persist({...get().schedules,[dealId]:draft});
    },
    edit:(dealId,rowId,changes)=>change(dealId,draft=>updateScheduleRow(draft,rowId,changes)),
    addPhase:(dealId,phase)=>change(dealId,draft=>appendSchedulePhase(draft,phase)),
    removePhase:(dealId,groupId)=>change(dealId,draft=>removeSchedulePhase(draft,groupId)),
    assignImports:(dealId,buildingId,importIds)=>change(dealId,draft=>assignBuildingImports(draft,buildingId,importIds)),
    removeSchedule:(dealId)=>{
      if(!get().loaded||!get().schedules[dealId])return;
      const next={...get().schedules};
      delete next[dealId];
      persist(next);
    },
  };
});
