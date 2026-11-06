import type {Activity,Company,Contact} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import {isoLocalDay,outstandingTask,type SalesCalendarEvent} from './salesCalendar';
import type {CalendarBadgeMetric,HomeCalendarSettings} from '../store/homeCalendarSettings';

export type HomeBadgeRecordKind='task'|'deal'|'quote'|'activity'|'company'|'person';
export interface HomeBadgeRecord{
 key:string;kind:HomeBadgeRecordKind;id:string;title:string;detail:string;
}
/** Same inclusion rules as homeCalendarBadges, but retains the actual records.
 * Historical entries never join the pending agenda; they are shown only on
 * explicit desktop badge drilldown (or when enabled on mobile). */
export function homeCalendarBadgeEntries(
 metric:CalendarBadgeMetric,day:string,
 events:readonly SalesCalendarEvent[],
 tasks:readonly PersonalTask[],
 activities:readonly Activity[],
 companies:readonly Company[],
 contacts:readonly Contact[],
 settings:HomeCalendarSettings,
):HomeBadgeRecord[]{
 const entries:HomeBadgeRecord[]=[];
 const include=(entry:HomeBadgeRecord)=>entries.push(entry);
 if(metric==='none')return entries;
 if(metric==='tasks'||metric==='bid-due'||metric==='due-dates'){
  for(const event of events){
   if(event.date!==day)continue;
   if(metric==='tasks'&&event.kind!=='task')continue;
   if(metric==='bid-due'&&event.kind!=='bid')continue;
   include({key:event.id,kind:event.recordType==='project'?'deal':event.recordType,
    id:event.recordId,title:event.title,detail:event.detail||
      (event.kind==='bid'?'Bid due':'Pending task')});
  }
  if(!settings.countDownCompletedTasks&&metric!=='bid-due'){
   for(const task of tasks){
    if(task.deletedAt||task.dueDate!==day||outstandingTask(task)||
       task.status==='canceled'||task.sourceObjectId?.startsWith('deal-submit:'))continue;
    include({key:'completed:'+task.id,kind:'task',id:task.id,
     title:task.title,detail:'Completed task · original due date'});
   }
  }
 }else if(metric==='companies-created'){
  for(const company of companies){
   if(company.kind==='customer'&&isoLocalDay(company.createdAt)===day){
    include({key:'company:'+company.id,kind:'company',id:company.id,
     title:company.name,detail:'Customer / prospect company created'});
   }
  }
 }else if(metric==='people-created'){
  const companyById=new Map(companies.map(company=>[company.id,company]));
  for(const contact of contacts){
   if(isoLocalDay(contact.createdAt)!==day||
      (contact.companyId&&companyById.get(contact.companyId)?.kind==='non-customer'))continue;
   include({key:'person:'+contact.id,kind:'person',id:contact.id,
    title:contact.name,detail:'Customer / prospect person created'});
  }
 }else{
  for(const activity of activities){
   const date=activity.metadata?.externalQuoteSent&&activity.metadata.bidSentDate
    ?activity.metadata.bidSentDate:isoLocalDay(activity.occurredAt);
   if(date!==day)continue;
   if(metric==='quotes-sent'){
    if(activity.type!=='quote-sent')continue;
    const kind:HomeBadgeRecordKind=activity.quoteId?'quote':activity.projectId?'deal':'activity';
    include({key:'quote-sent:'+activity.id,kind,
     id:activity.quoteId??activity.projectId??activity.id,
     title:activity.summary||'Quote sent',detail:activity.metadata?.externalQuoteSent
      ?'External quote sent':'SalesShop quote sent'});
    continue;
   }
   if(activity.type!=='manual-touchpoint'&&activity.type!=='notebook-touchpoint')continue;
   const method=activity.metadata?.interactionMethod;
   if(metric==='calls'&&method!=='call')continue;
   if(metric==='emails'&&method!=='email')continue;
   if(metric==='texts'&&method!=='text')continue;
   if(metric==='meetings'&&method!=='video-call'&&method!=='in-person')continue;
   if(!['calls','emails','texts','meetings','activities'].includes(metric))continue;
   include({key:'activity:'+activity.id,kind:'activity',id:activity.id,
    title:activity.summary||'Logged activity',
    detail:method?method.replaceAll('-',' ')+' · Logged interaction':'Logged interaction'});
  }
 }
 return entries.sort((a,b)=>a.title.localeCompare(b.title));
}
