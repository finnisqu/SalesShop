import {supabase} from '../lib/supabase';
import {assertValidSchedule} from './dealScheduleEditing';
import type {DealScheduleDraft} from './dealScheduleTemplates';

/**
 * Strict opt-in. The table is NOT in production; do not enable until isolated
 * staging auth/RLS, conflict, reload and rollback checks have passed.
 */
export const sharedSchedulesEnabled=import.meta.env.VITE_DEAL_SCHEDULE_CLOUD_ENABLED==='true';

export interface SharedScheduleRecord {
  schedule:DealScheduleDraft;
  revision:number;
  updatedAt:string;
}
export class SharedScheduleConflict extends Error {
  constructor(){super('This project timeline changed in another session. The newest copy must be reloaded before editing.');}
}
function client(){
  if(!sharedSchedulesEnabled||!supabase)
    throw new Error('Shared project timelines are not enabled.');
  return supabase;
}
function fromDb(input:Record<string,unknown>):SharedScheduleRecord {
  const schedule=input.schedule as DealScheduleDraft;
  const revision=Number(input.revision);
  if(!schedule||typeof schedule.dealId!=='string'||!Number.isSafeInteger(revision)||revision<1)
    throw new Error('Unrecognized shared schedule record.');
  assertValidSchedule(schedule);
  if(schedule.dealId!==input.deal_id)throw new Error('Shared schedule Deal ID mismatch.');
  return {schedule,revision,updatedAt:String(input.updated_at??'')};
}
/** Load only records the authenticated organization member may see. */
export async function fetchSharedSchedules(organizationId:string):Promise<Record<string,SharedScheduleRecord>>{
  const result:Record<string,SharedScheduleRecord>={};
  let page=0;
  while(true){
    const {data,error}=await client().from('deal_execution_schedules')
      .select('deal_id,schedule,revision,updated_at')
      .eq('organization_id',organizationId).order('deal_id',{ascending:true})
      .range(page*500,(page+1)*500-1);
    if(error)throw error;
    for(const raw of data??[]){
      const entry=fromDb(raw as Record<string,unknown>);
      result[entry.schedule.dealId!]=entry;
    }
    if((data??[]).length<500)break;
    page++;
    if(page>100)throw new Error('Timeline result exceeds safe page limit.');
  }
  return result;
}
/** A second creator gets a unique-key conflict, never a blind upsert. */
export async function createSharedSchedule(
  organizationId:string,userId:string,schedule:DealScheduleDraft,
):Promise<SharedScheduleRecord>{
  assertValidSchedule(schedule);
  if(!schedule.dealId)throw new Error('Schedule has no Deal.');
  const {data,error}=await client().from('deal_execution_schedules')
    .insert({organization_id:organizationId,deal_id:schedule.dealId,schedule,
      revision:1,updated_by:userId})
    .select('deal_id,schedule,revision,updated_at').single();
  if(error){
    if(error.code==='23505')throw new SharedScheduleConflict();
    throw error;
  }
  return fromDb(data as Record<string,unknown>);
}
/** Atomic revision guard. A stale editor cannot overwrite another tab or teammate. */
export async function saveSharedSchedule(
  organizationId:string,userId:string,dealId:string,expectedRevision:number,
  schedule:DealScheduleDraft,
):Promise<SharedScheduleRecord>{
  assertValidSchedule(schedule);
  if(schedule.dealId!==dealId)throw new Error('Schedule Deal cannot be changed.');
  const {data,error}=await client().from('deal_execution_schedules')
    .update({schedule,revision:expectedRevision+1,updated_by:userId,
      updated_at:new Date().toISOString()})
    .eq('organization_id',organizationId).eq('deal_id',dealId)
    .eq('revision',expectedRevision)
    .select('deal_id,schedule,revision,updated_at').maybeSingle();
  if(error)throw error;
  if(!data)throw new SharedScheduleConflict();
  return fromDb(data as Record<string,unknown>);
}
