import type {PersonalTask} from '../store/personalTaskStore';
import {normalizedTaskAssociations} from '../store/personalTaskStore';
import type {PersonLastContact} from './personLastContact';

export type PeopleAttentionFilter='all'|'never'|'stale'|'overdue';
export interface PersonFollowUp{
 taskId:string;
 dueDate?:string;
 overdue:boolean;
}

export const localCalendarDay=(date:Date):string=>
 [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
  String(date.getDate()).padStart(2,'0')].join('-');

const isPendingFollowUp=(task:PersonalTask):boolean=>
 !task.deletedAt&&!task.completedAt&&task.status!=='completed'&&task.status!=='canceled'&&
 (task.type==='follow-up'||task.queue==='Follow-ups'||
  Boolean(task.sourceObjectId?.startsWith('activity-followup:')));

export function personFollowUpIndex(
 tasks:readonly PersonalTask[],today=localCalendarDay(new Date()),
):Map<string,PersonFollowUp>{
 const result=new Map<string,PersonFollowUp>();
 for(const task of tasks){
  if(!isPendingFollowUp(task))continue;
  const candidate:PersonFollowUp={
   taskId:task.id,dueDate:task.dueDate,overdue:Boolean(task.dueDate&&task.dueDate<today),
  };
  for(const link of normalizedTaskAssociations(task)){
   if(link.type!=='contact')continue;
   const prior=result.get(link.id);
   if(!prior||
    (candidate.dueDate??'9999-12-31')<(prior.dueDate??'9999-12-31')||
    (candidate.dueDate===prior.dueDate&&candidate.taskId<prior.taskId)){
    result.set(link.id,candidate);
   }
  }
 }
 return result;
}

/** 30 calendar days of inactivity is distinct from never contacted. */
export function matchesPersonAttentionFilter(
 personId:string,filter:PeopleAttentionFilter,
 lastContact:ReadonlyMap<string,PersonLastContact>,
 followUps:ReadonlyMap<string,PersonFollowUp>,
 today=localCalendarDay(new Date()),
):boolean{
 if(filter==='all')return true;
 const last=lastContact.get(personId);
 if(filter==='never')return !last;
 if(filter==='overdue')return Boolean(followUps.get(personId)?.overdue);
 if(!last)return false;
 const date=new Date(last.occurredAt);
 if(!Number.isFinite(date.getTime()))return false;
 const cutoff=new Date(today+'T12:00:00');
 cutoff.setDate(cutoff.getDate()-30);
 return localCalendarDay(date)<=localCalendarDay(cutoff);
}
