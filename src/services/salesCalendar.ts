import type {Activity,Project} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {Quote} from '../types/quote';
import {buildQuoteFollowUpQueue} from './quoteFollowUps';

export type SalesCalendarKind='task'|'bid'|'activity'|'follow-up';
export interface SalesCalendarEvent {
 id:string;date:string;kind:SalesCalendarKind;title:string;detail:string;
 recordType:'task'|'project'|'quote'|'company'|'contact'|'activity';recordId:string;
 time?:string;
}
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function localDateKey(value:Date):string {
 return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),
  String(value.getDate()).padStart(2,'0')].join('-');
}
export function isoLocalDay(timestamp:string):string|null {
 const date=new Date(timestamp);
 return Number.isFinite(date.getTime())?localDateKey(date):null;
}
export function calendarMonthDays(year:number,month:number):string[]{
 const first=new Date(year,month,1,12);
 const start=new Date(year,month,1-first.getDay(),12);
 return Array.from({length:42},(_,i)=>{
  const date=new Date(start);date.setDate(start.getDate()+i);return localDateKey(date);
 });
}
/** No synthetic reminders: only explicit task deadlines, deal bid due dates,
 * scheduled quote follow-ups and completed CRM touchpoints. */
export function buildSalesCalendarEvents(
 tasks:readonly PersonalTask[],deals:readonly Project[],activities:readonly Activity[],
 visibleQuotes:readonly Quote[],
):SalesCalendarEvent[] {
 const events:SalesCalendarEvent[]=[];
 const quoteIds=new Set(visibleQuotes.map(q=>q.id));
 for(const task of tasks){
  if(task.deletedAt||!task.dueDate||!datePattern.test(task.dueDate)||task.status==='canceled')continue;
  events.push({id:'task:'+task.id,date:task.dueDate,kind:'task',title:task.title,
   detail:(task.status==='completed'||task.completedAt?'Completed task':'To-do')+
    (task.dueTime?' · '+task.dueTime:''),
   time:task.dueTime,recordType:'task',recordId:task.id});
 }
 for(const deal of deals){
  if(!deal.bidDueDate||!datePattern.test(deal.bidDueDate))continue;
  events.push({id:'bid:'+deal.id,date:deal.bidDueDate,kind:'bid',title:deal.name,
   detail:'Bid due'+(deal.bidDueTime?' at '+deal.bidDueTime:'')+' · '+deal.stage,
   time:deal.bidDueTime,recordType:'project',recordId:deal.id});
 }
 for(const activity of activities){
  if((activity.type==='notebook-touchpoint'||activity.type==='manual-touchpoint')&&!activity.metadata?.voidedAt){
   if(activity.quoteId&&!quoteIds.has(activity.quoteId))continue;
   const date=isoLocalDay(activity.occurredAt);if(!date)continue;
   const destination='activity' as const,destinationId=activity.id;
   const method=activity.metadata?.interactionMethod;
   events.push({id:'activity:'+activity.id,date,kind:'activity',title:activity.summary,
    detail:(method?method.charAt(0).toUpperCase()+method.slice(1).replaceAll('-',' '):'Touchpoint')+
      (activity.metadata?.notes?' · '+activity.metadata.notes.slice(0,90):''),
    recordType:destination,recordId:destinationId});
  }
 }
 // Reuse the same revision, delivery and closed-quote gate as Pricing Review.
 // An older quote revision or a cleared reminder never appears as due.
 for(const item of buildQuoteFollowUpQueue(visibleQuotes,activities)){
  if(!item.dueDate||!datePattern.test(item.dueDate))continue;
  events.push({id:'follow-up:'+item.quote.id,date:item.dueDate,kind:'follow-up',
   title:item.quote.title||'Quote follow-up',detail:'Scheduled quote follow-up',
   recordType:'quote',recordId:item.quote.id});
 }
 return events.sort((a,b)=>a.date.localeCompare(b.date)||
  (a.time??'99:99').localeCompare(b.time??'99:99')||
  a.kind.localeCompare(b.kind)||a.title.localeCompare(b.title));
}
export const calendarDayCounts=(events:readonly SalesCalendarEvent[],date:string)=>{
 const matches=events.filter(e=>e.date===date);
 return {task:matches.filter(e=>e.kind==='task').length,
  bid:matches.filter(e=>e.kind==='bid').length,
  activity:matches.filter(e=>e.kind==='activity').length,
  followUp:matches.filter(e=>e.kind==='follow-up').length,
  total:matches.length};
};
