import {useEffect} from 'react';
import {useAuthStore} from '../store/authStore';
import {useDealScheduleStore} from '../store/dealScheduleStore';
import {useSharedDealScheduleStore} from '../store/sharedDealScheduleStore';
import {sharedSchedulesEnabled} from './dealScheduleCloud';
import type {DealScheduleDraft} from './dealScheduleTemplates';
import type {ScheduleRowChanges,SchedulePhase} from './dealScheduleEditing';

/** The opt-in cloud path never silently uploads an older device draft. */
export function useDealExecutionSchedules(){
  const mode=useAuthStore(s=>s.mode);
  const org=useAuthStore(s=>s.organizationId);
  const user=useAuthStore(s=>s.user?.id);
  const cloud=mode==='cloud'&&sharedSchedulesEnabled;
  const scope=mode==='local'?'offline':org&&user?'org:'+org+':user:'+user:null;

  const localScope=useDealScheduleStore(s=>s.scope);
  const localLoaded=useDealScheduleStore(s=>s.loaded);
  const localSchedules=useDealScheduleStore(s=>s.schedules);
  const localError=useDealScheduleStore(s=>s.error);
  const loadLocal=useDealScheduleStore(s=>s.load);
  const localBegin=useDealScheduleStore(s=>s.begin);
  const localEdit=useDealScheduleStore(s=>s.edit);
  const localAdd=useDealScheduleStore(s=>s.addPhase);
  const localRemove=useDealScheduleStore(s=>s.removePhase);
  const localAssign=useDealScheduleStore(s=>s.assignImports);

  const sharedScope=useSharedDealScheduleStore(s=>s.scope);
  const sharedSchedules=useSharedDealScheduleStore(s=>s.schedules);
  const sharedStatus=useSharedDealScheduleStore(s=>s.status);
  const sharedError=useSharedDealScheduleStore(s=>s.error);
  const loadShared=useSharedDealScheduleStore(s=>s.load);
  const refreshShared=useSharedDealScheduleStore(s=>s.refresh);
  const sharedBegin=useSharedDealScheduleStore(s=>s.begin);
  const sharedEdit=useSharedDealScheduleStore(s=>s.edit);
  const sharedAdd=useSharedDealScheduleStore(s=>s.addPhase);
  const sharedRemove=useSharedDealScheduleStore(s=>s.removePhase);
  const sharedAssign=useSharedDealScheduleStore(s=>s.assignImports);

  useEffect(()=>{
    if(scope)loadLocal(scope);
    if(cloud&&org&&user)void loadShared(org,user);
  },[scope,cloud,org,user,loadLocal,loadShared]);

  const ready=!!scope&&(cloud
    ?sharedScope===scope&&(sharedStatus==='ready'||sharedStatus==='saving'||sharedStatus==='conflict')
    :localLoaded&&localScope===scope);
  const busy=cloud&&sharedStatus==='saving';
  const error=cloud?sharedScope===scope?sharedError:null
    :localScope===scope?localError:null;
  const schedules:Record<string,DealScheduleDraft>=ready
    ?cloud?sharedSchedules:localSchedules:{};
  const deviceDrafts=localLoaded&&localScope===scope?localSchedules:{};

  return {
    cloud,scope,ready,busy,error,schedules,deviceDrafts,
    storageLabel:cloud?'Shared schedule · organization CRM access':'Device-only draft · not yet synced to teammates.',
    begin:(dealId:string)=>cloud?void sharedBegin(dealId):localBegin(dealId),
    publish:(dealId:string)=>cloud&&deviceDrafts[dealId]
      ?void sharedBegin(dealId,deviceDrafts[dealId]):undefined,
    edit:(dealId:string,rowId:string,change:ScheduleRowChanges)=>cloud
      ?void sharedEdit(dealId,rowId,change):localEdit(dealId,rowId,change),
    addPhase:(dealId:string,phase:SchedulePhase)=>cloud
      ?void sharedAdd(dealId,phase):localAdd(dealId,phase),
    removePhase:(dealId:string,id:string)=>cloud
      ?void sharedRemove(dealId,id):localRemove(dealId,id),
    assignImports:(dealId:string,buildingId:string,ids:string[])=>cloud
      ?void sharedAssign(dealId,buildingId,ids):localAssign(dealId,buildingId,ids),
    refresh:()=>cloud?void refreshShared():undefined,
  };
}
