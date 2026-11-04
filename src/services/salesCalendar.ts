import type {Activity,Company,Contact,Project} from '../types/crm';
import {dealNeedsSubmission,type PersonalTask,type TaskAssociation,normalizedTaskAssociations} from '../store/personalTaskStore';
import {completedTaskActivityId} from './taskActivityWorkflow';
import type {Quote} from '../types/quote';

/** A calendar count represents unfinished obligations, not CRM history. */
export type SalesCalendarKind='task'|'bid';
export interface SalesCalendarEvent {
 id:string;date:string;kind:SalesCalendarKind;title:string;detail:string;urgent?:boolean;
 recordType:'task'|'project'|'quote';recordId:string;
}
/** References already available to the active user's CRM workspace. */
export interface SalesCalendarRelatedRecords {
 companies:readonly Company[];
 contacts:readonly Contact[];
}
export interface HomeRecentItem{
 id:string;timestamp:string;kind:'activity'|'completed-task';
 title:string;detail:string;recordId:string;
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
/** A compact month drops only the entirely unused padding week(s). */
export function calendarCompactMonthDays(year:number,month:number):string[]{
 const firstDay=new Date(year,month,1,12).getDay();
 const daysInMonth=new Date(year,month+1,0,12).getDate();
 const visibleWeeks=Math.ceil((firstDay+daysInMonth)/7);
 return calendarMonthDays(year,month).slice(0,visibleWeeks*7);
}
/** One mobile calendar week, anchored at local noon across DST changes. */
export function calendarWeekDays(selected:string):string[]{
 const chosen=new Date(selected+'T12:00:00');
 if(!Number.isFinite(chosen.getTime()))return[];
 chosen.setDate(chosen.getDate()-chosen.getDay());
 return Array.from({length:7},(_,i)=>{
  const date=new Date(chosen);date.setDate(chosen.getDate()+i);return localDateKey(date);
 });
}

/** Keep Home personal. CRM Activity remains available in the Recent history
 * surface but never contributes to the pending-work calendar badges. */
export function personalCalendarSources(
 mode:'local'|'cloud',userId:string|undefined,
 ownQuotes:readonly Quote[],ownTasks:readonly PersonalTask[],
 deals:readonly Project[],activities:readonly Activity[],
):{deals:Project[];activities:Activity[]}{
 if(mode==='local')return {deals:[...deals],activities:[...activities]};
 if(!userId)return {deals:[],activities:[]};
 const quoteIds=new Set(ownQuotes.map(q=>q.id));
 const relatedDealIds=new Set<string>();
 ownQuotes.forEach(q=>{if(q.projectId)relatedDealIds.add(q.projectId);});
 ownTasks.forEach(task=>{
  normalizedTaskAssociations(task).forEach(link=>{
   if(link.type==='project')relatedDealIds.add(link.id);
  });
 });
 return {
  deals:deals.filter(deal=>relatedDealIds.has(deal.id)),
  activities:activities.filter(activity=>
   (!activity.quoteId||quoteIds.has(activity.quoteId))&&
   (activity.metadata?.recordedByUserId===userId||
    !!(activity.quoteId&&quoteIds.has(activity.quoteId))||
    !!(activity.projectId&&relatedDealIds.has(activity.projectId)))
  ),
 };
}
export const outstandingTask=(task:PersonalTask):boolean=>
 !task.deletedAt&&task.status!=='completed'&&task.status!=='canceled'&&!task.completedAt;

/** Only outstanding work gets a numbered badge or agenda row. Follow-ups
 * share the ordinary Task counter. Completed items go to Recents. */
export function buildSalesCalendarEvents(
 tasks:readonly PersonalTask[],deals:readonly Project[],activities:readonly Activity[],
 visibleQuotes:readonly Quote[],relatedRecords:SalesCalendarRelatedRecords={companies:[],contacts:[]},
):SalesCalendarEvent[]{
 const events:SalesCalendarEvent[]=[];
 const quoteIds=new Set(visibleQuotes.map(q=>q.id));
 const quoteById=new Map(visibleQuotes.map(q=>[q.id,q]));
 const dealById=new Map(deals.map(deal=>[deal.id,deal]));
 const companyById=new Map(relatedRecords.companies.map(company=>[company.id,company]));
 const contactById=new Map(relatedRecords.contacts.map(contact=>[contact.id,contact]));
 // Prefer the task's own association order; show at most two distinct, current
 // CRM names. Missing/deleted or inaccessible records are never replaced by
 // potentially stale snapshot labels.
 const relatedLine=(links:readonly TaskAssociation[],title:string)=>{
  const names:string[]=[];
  for(const link of links){
   const name=(link.type==='project'?dealById.get(link.id)?.name:
    link.type==='contact'?contactById.get(link.id)?.name:
    link.type==='company'?companyById.get(link.id)?.name:
    link.type==='quote'?quoteById.get(link.id)?.title:undefined)?.trim();
   if(!name||name.toLocaleLowerCase()===title.trim().toLocaleLowerCase()||
     names.some(value=>value.toLocaleLowerCase()===name.toLocaleLowerCase()))continue;
   names.push(name);
   if(names.length===2)break;
  }
  return names.join(' · ');
 };
 const representedBidIds=new Set<string>();
 for(const task of tasks){
  if(!task.dueDate||!datePattern.test(task.dueDate))continue;
  const autoBidId=task.sourceObjectId?.startsWith('deal-submit:')
   ?task.sourceObjectId.slice('deal-submit:'.length):null;
  const authoredBidId=!autoBidId&&/submit.*quote/i.test(task.title)
   ?normalizedTaskAssociations(task).find(link=>link.type==='project'&&deals.some(deal=>
     deal.id===link.id&&deal.dueDate===task.dueDate))?.id:null;
  const bidId=autoBidId||authoredBidId;
  // Even if the submission Task was completed, canceled, or deleted, keep
  // suppressing the raw Deal fallback. Never resurrect finished work.
  if(bidId&&(autoBidId||!task.deletedAt))representedBidIds.add(bidId);
  if(!outstandingTask(task))continue;
  const kind:SalesCalendarKind=bidId?'bid':'task';
  const associations=normalizedTaskAssociations(task);
  // Legacy automatic submissions may identify their Deal only in sourceObjectId.
  if(bidId&&!associations.some(link=>link.type==='project'&&link.id===bidId))
   associations.unshift({type:'project',id:bidId});
  events.push({id:'task:'+task.id,date:task.dueDate,kind,title:task.title,
   detail:relatedLine(associations,task.title),
   urgent:task.priority==='urgent',recordType:'task',recordId:task.id});
 }
 for(const deal of deals){
  if(!dealNeedsSubmission(deal)||!deal.dueDate||representedBidIds.has(deal.id))continue;
  // The title already names the Deal; the Company is the helpful association.
  const companyName=deal.companyId?companyById.get(deal.companyId)?.name:deal.companyName;
  events.push({id:'bid:'+deal.id,date:deal.dueDate,kind:'bid',
   title:'Submit quote · '+deal.name,detail:companyName?.trim()??'',
   recordType:'project',recordId:deal.id});
 }
 // Legacy quote follow-up scheduling remains actionable until it is cleared.
 // Count it as a Task, not a distinct follow-up badge. If an actual follow-up
 // Task exists on that day, it takes precedence even after completion.
 const latest=new Map<string,Activity>();
 for(const activity of activities){
  if(activity.type!=='quote-follow-up'||!activity.quoteId||!quoteIds.has(activity.quoteId))continue;
  const prior=latest.get(activity.quoteId);
  if(!prior||activity.occurredAt>prior.occurredAt)latest.set(activity.quoteId,activity);
 }
 for(const [quoteId,activity] of latest){
  const date=activity.metadata?.followUpDueDate;
  if(activity.metadata?.followUpAction!=='scheduled'||!date||!datePattern.test(date))continue;
  if(tasks.some(task=>!task.deletedAt&&task.dueDate===date&&task.type==='follow-up'&&
   normalizedTaskAssociations(task).some(link=>link.type==='quote'&&link.id===quoteId)))continue;
  const linkedQuote=quoteById.get(quoteId);
  const title=linkedQuote?.title||'Quote follow-up';
  const related:TaskAssociation[]=[];
  if(linkedQuote?.projectId)related.push({type:'project',id:linkedQuote.projectId});
  if(linkedQuote?.contactId)related.push({type:'contact',id:linkedQuote.contactId});
  if(linkedQuote?.companyId)related.push({type:'company',id:linkedQuote.companyId});
  events.push({id:'quote-followup:'+quoteId,date,kind:'task',
   title,detail:relatedLine(related,title),recordType:'quote',recordId:quoteId});
 }
 return events.sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind)||a.title.localeCompare(b.title));
}
export function calendarDayCounts(events:readonly SalesCalendarEvent[],date:string){
 const today=events.filter(event=>event.date===date);
 return {task:today.filter(event=>event.kind==='task').length,
  bid:today.filter(event=>event.kind==='bid').length,
  urgent:today.filter(event=>event.urgent).length,total:today.length};
}

/** Recent work is separate from the agenda. Combining historical Activities
 * and completed Tasks means the day's pending count can genuinely reach zero.
 * Task-linked Activities replace their source Task in history, avoiding a
 * double entry for the same call/meeting. */
export function recentHomeItems(
 tasks:readonly PersonalTask[],activities:readonly Activity[],
 visibleQuotes:readonly Quote[],personalScope:string|null,limit=8,
):HomeRecentItem[]{
 const quoteIds=new Set(visibleQuotes.map(q=>q.id));
 const logged=activities.filter(activity=>
  (activity.type==='manual-touchpoint'||activity.type==='notebook-touchpoint')&&
  (!activity.quoteId||quoteIds.has(activity.quoteId)));
 const recordedIds=new Set(logged.map(activity=>activity.id));
 const items:HomeRecentItem[]=logged
  .filter(activity=>Number.isFinite(Date.parse(activity.occurredAt)))
  .map(activity=>({
   id:'activity:'+activity.id,timestamp:activity.occurredAt,kind:'activity',
   title:activity.summary,
   detail:(activity.metadata?.interactionMethod??'Interaction').replaceAll('-',' ')+
    (activity.metadata?.notes?' · '+activity.metadata.notes.slice(0,80):''),
   recordId:activity.id,
  }));
 for(const task of tasks){
  if(task.deletedAt||!(task.status==='completed'||!!task.completedAt))continue;
  const timestamp=task.completedAt??task.updatedAt;
  if(!Number.isFinite(Date.parse(timestamp)))continue;
  // One Activity + Task completion is one history item, not two.
  if(personalScope&&recordedIds.has(completedTaskActivityId(task.id,personalScope)))continue;
  items.push({id:'completed-task:'+task.id,timestamp,kind:'completed-task',
   title:task.title,detail:task.type==='follow-up'?'Completed follow-up':'Completed task',
   recordId:task.id});
 }
 return items.sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)||
  a.id.localeCompare(b.id)).slice(0,limit);
}
