import type {Activity,Company,Contact} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import {outstandingTask,isoLocalDay,type SalesCalendarEvent} from './salesCalendar';
import type {CalendarBadgeMetric,HomeCalendarSettings} from '../store/homeCalendarSettings';
import {dedupeExternalQuoteActivities} from './salesQuoteRegistry';

export type CalendarBadgeDayCounts=Partial<Record<CalendarBadgeMetric,number>>;
export type CalendarBadgeIndex=Map<string,CalendarBadgeDayCounts>;

function add(index:CalendarBadgeIndex,date:string|null|undefined,metric:CalendarBadgeMetric){
 if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
 const row=index.get(date)??{};
 row[metric]=(row[metric]??0)+1;
 index.set(date,row);
}
/** Build once when CRM/tasks change; the month grid can read any day in O(1).
 * History metrics are independent from the pending-work agenda. */
export function buildCalendarBadgeIndex(
 events:readonly SalesCalendarEvent[],
 tasks:readonly PersonalTask[],
 activities:readonly Activity[],
 companies:readonly Company[],
 contacts:readonly Contact[],
 settings:HomeCalendarSettings,
):CalendarBadgeIndex{
 const index:CalendarBadgeIndex=new Map();
 for(const event of events){
  if(event.kind==='task')add(index,event.date,'tasks');
  if(event.kind==='bid')add(index,event.date,'bid-due');
  add(index,event.date,'due-dates');
 }
 if(!settings.countDownCompletedTasks){
  for(const task of tasks){
   if(task.deletedAt||!task.dueDate||outstandingTask(task)||task.status==='canceled')continue;
   // A finished submission does not reappear as a due bid.
   if(task.sourceObjectId?.startsWith('deal-submit:'))continue;
   add(index,task.dueDate,'tasks');
   add(index,task.dueDate,'due-dates');
  }
 }
 for(const activity of dedupeExternalQuoteActivities(activities)){
  const date=activity.metadata?.externalQuoteSent&&activity.metadata.bidSentDate
   ?activity.metadata.bidSentDate:isoLocalDay(activity.occurredAt);
  if(activity.type==='quote-sent'){
   add(index,date,'quotes-sent');
  }
  if(activity.type!=='manual-touchpoint'&&activity.type!=='notebook-touchpoint')continue;
  add(index,date,'activities');
  const method=activity.metadata?.interactionMethod;
  if(method==='call')add(index,date,'calls');
  if(method==='email')add(index,date,'emails');
  if(method==='text')add(index,date,'texts');
  if(method==='video-call'||method==='in-person')add(index,date,'meetings');
 }
 const companyById=new Map(companies.map(company=>[company.id,company]));
 for(const company of companies){
  if(company.kind==='customer')add(index,isoLocalDay(company.createdAt),'companies-created');
 }
 for(const contact of contacts){
  // Unlinked people are prospects; people belonging to non-customer
  // companies are excluded, avoiding partner/vendor contacts.
  if(contact.companyId&&companyById.get(contact.companyId)?.kind==='non-customer')continue;
  add(index,isoLocalDay(contact.createdAt),'people-created');
 }
 return index;
}
export function metricCount(index:CalendarBadgeIndex,day:string,metric:CalendarBadgeMetric):number{
 return index.get(day)?.[metric]??0;
}
