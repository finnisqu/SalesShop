import type {TaskAssociation,TaskChanges} from '../store/personalTaskStore';
import {localCalendarDay} from './personFollowUpIntelligence';

export interface QuickContactFollowUpOptions{
 activityId:string;
 personName:string;
 method:'call'|'text'|'email';
 dueDate:string;
 associations:TaskAssociation[];
 today?:string;
}
export function personQuickFollowUp({
 activityId,personName,method,dueDate,associations,
 today=localCalendarDay(new Date()),
}:QuickContactFollowUpOptions):{title:string;changes:TaskChanges}{
 if(!activityId||!associations.some(link=>link.type==='contact')){
  throw new Error('This follow-up needs a recorded Activity linked to a Person.');
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||dueDate<today||
  !Number.isFinite(Date.parse(dueDate+'T12:00:00'))){
  throw new Error('Choose today or a future date for the follow-up.');
 }
 const contact=personName.trim()||'contact';
 const kind=method==='call'?'call':method==='text'?'text':'email';
 return {
  title:'Follow up · '+contact,
  changes:{
   type:'follow-up',dueDate,priority:'normal',status:'open',
   queue:'Follow-ups',associations,
   sourceObjectId:'activity-followup:'+activityId,
   notes:'Follow-up after '+kind+' on '+today,
  },
 };
}
