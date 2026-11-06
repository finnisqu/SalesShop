import type {Activity,Company,Contact,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import type {NotebookEntry} from '../types/notebook';
import type {PersonalTask} from '../store/personalTaskStore';
import {isoLocalDay,type SalesCalendarEvent} from './salesCalendar';
import {notebookCalendarDates} from './notebookDaily';

export type HomeDayRecordKind=
 'task'|'deal'|'quote'|'activity'|'company'|'person'|'note'|'calendar-date';
export interface HomeDayRecord{
 key:string;
 kind:HomeDayRecordKind;
 id:string;
 /** Calendar entries live inside a Notebook page. */
 itemId?:string;
 title:string;
 detail:string;
}
export interface HomeDayGroup{
 key:string;
 label:string;
 entries:HomeDayRecord[];
}
export interface HomeDaySources{
 events:readonly SalesCalendarEvent[];
 tasks:readonly PersonalTask[];
 activities:readonly Activity[];
 quotes:readonly Quote[];
 deals:readonly Project[];
 companies:readonly Company[];
 contacts:readonly Contact[];
 notebook:readonly NotebookEntry[];
}

// A date-only value must not shift to the previous day in western time zones.
const onDay=(date:string|undefined,day:string)=>!!date&&
 (/^\d{4}-\d{2}-\d{2}$/.test(date)?date===day:isoLocalDay(date)===day);
const trim=(value:string|undefined,fallback:string)=>value?.trim()||fallback;

/** A dated navigation index, not an Agenda or a second badge-count formula.
 * Due work, historical events and created records are distinct categories.
 * Each row links to the original record, including future-dated work.
 */
export function homeDayOverview(day:string,data:HomeDaySources):HomeDayGroup[]{
 const groups:HomeDayGroup[]=[];
 const append=(key:string,label:string,entries:HomeDayRecord[])=>{
  if(!entries.length)return;
  entries.sort((a,b)=>a.title.localeCompare(b.title));
  groups.push({key,label,entries});
 };
 const taskDueEvents=data.events.filter(event=>event.date===day&&event.kind==='task');
 const taskDueIds=new Set(taskDueEvents.filter(event=>event.recordType==='task')
  .map(event=>event.recordId));
 append('tasks-due','Tasks due',[
  ...taskDueEvents.map(event=>({
   key:event.id,
   kind:event.recordType==='project'?'deal' as const:event.recordType,
   id:event.recordId,
   title:event.title,
   detail:event.detail||'Scheduled for this date',
  })),
  // Preserve the original due date in historical navigation after the task
  // is completed. It must not reappear in the pending-work agenda.
  ...data.tasks.filter(task=>!task.deletedAt&&task.dueDate===day&&
   !taskDueIds.has(task.id)&&task.status!=='canceled')
   .map(task=>({
    key:'historical-task-due:'+task.id,kind:'task' as const,id:task.id,
    title:task.title,
    detail:task.completedAt?'Completed · original due date':'Originally due this day',
   })),
 ]);
 append('bids-due','Bids due',data.events
  .filter(event=>event.date===day&&event.kind==='bid')
  .map(event=>({
   key:event.id,kind:'deal' as const,id:event.recordId,
   title:event.title,detail:event.detail||'Bid deadline',
  })));
 append('tasks-completed','Tasks completed',data.tasks
  .filter(task=>!task.deletedAt&&!!task.completedAt&&onDay(task.completedAt,day))
  .map(task=>({
   key:'task-completed:'+task.id,kind:'task' as const,id:task.id,
   title:task.title,detail:'Completed on this date',
  })));

 const sentActivities=data.activities
  .filter(activity=>activity.type==='quote-sent'&&
   (activity.metadata?.externalQuoteSent&&activity.metadata.bidSentDate
    ?activity.metadata.bidSentDate===day:onDay(activity.occurredAt,day)));
 // A quote's CRM sent event is authoritative. Fall back to sentAt only
 // for legacy quotes with no sent activity anywhere in the accessible history.
 const quotedSentIds=new Set(data.activities
  .filter(activity=>activity.type==='quote-sent'&&!!activity.quoteId)
  .map(activity=>activity.quoteId));
 append('quotes-sent','Quotes sent',[
  ...sentActivities.map(activity=>({
   key:'quote-sent:'+activity.id,
   kind:activity.quoteId?'quote' as const:activity.projectId?'deal' as const:'activity' as const,
   id:activity.quoteId??activity.projectId??activity.id,
   title:trim(activity.summary,'Quote sent'),
   detail:activity.metadata?.externalQuoteSent?'Sent outside SalesShop':'SalesShop quote sent',
  })),
  ...data.quotes.filter(quote=>onDay(quote.sentAt,day)&&!quotedSentIds.has(quote.id))
   .map(quote=>({
    key:'quote-sent-fallback:'+quote.id,kind:'quote' as const,id:quote.id,
    title:trim(quote.title,'Quote sent'),detail:'SalesShop quote sent',
   })),
 ]);
 append('activities','Activities logged',data.activities
  .filter(activity=>(activity.type==='manual-touchpoint'||activity.type==='notebook-touchpoint')&&
   onDay(activity.occurredAt,day))
  .map(activity=>({
   key:'activity:'+activity.id,kind:'activity' as const,id:activity.id,
   title:trim(activity.summary,'Logged interaction'),
   detail:activity.metadata?.interactionMethod
    ?activity.metadata.interactionMethod.replaceAll('-',' ')+' · Logged'
    :'Logged interaction',
  })));

 const companyById=new Map(data.companies.map(company=>[company.id,company]));
 append('people','People created',data.contacts
  .filter(person=>onDay(person.createdAt,day)&&
   (!person.companyId||companyById.get(person.companyId)?.kind!=='non-customer'))
  .map(person=>({
   key:'person:'+person.id,kind:'person' as const,id:person.id,
   title:person.name,detail:companyById.get(person.companyId??'')?.name||'Prospect / contact',
  })));
 append('companies','Companies created',data.companies
  .filter(company=>company.kind==='customer'&&onDay(company.createdAt,day))
  .map(company=>({
   key:'company:'+company.id,kind:'company' as const,id:company.id,
   title:company.name,detail:'Customer / prospect company',
  })));
 append('deals-created','Deals created',data.deals
  .filter(deal=>onDay(deal.createdAt,day))
  .map(deal=>({
   key:'deal-created:'+deal.id,kind:'deal' as const,id:deal.id,
   title:deal.name,detail:deal.stage,
  })));
 append('quotes-created','Quotes created',data.quotes
  .filter(quote=>onDay(quote.createdAt,day))
  .map(quote=>({
   key:'quote-created:'+quote.id,kind:'quote' as const,id:quote.id,
   title:trim(quote.title,'New quote'),detail:quote.quoteNumber||'SalesShop quote',
  })));
 // Tasks created on their due date are already represented under Tasks due.
 append('tasks-created','Tasks created',data.tasks
  .filter(task=>!task.deletedAt&&onDay(task.createdAt,day)&&task.dueDate!==day&&
   !onDay(task.completedAt,day))
  .map(task=>({
   key:'task-created:'+task.id,kind:'task' as const,id:task.id,
   title:task.title,detail:task.dueDate?'Due '+task.dueDate:'Created on this date',
  })));

 append('notebook-dates','Notebook calendar entries',notebookCalendarDates(data.notebook,day)
  .map(({entryId,item})=>({
   key:'calendar-date:'+entryId+':'+item.id,
   kind:'calendar-date' as const,id:entryId,itemId:item.id,
   title:item.title,
   detail:item.time||'All day',
  })));
 append('notebook-pages','Notebook pages',data.notebook
  .filter(page=>page.dailyDate===day&&!page.isPostItInbox)
  .map(page=>({
   key:'note:'+page.id,kind:'note' as const,id:page.id,
   title:trim(page.title,'Daily notebook page'),detail:'Daily notebook page',
  })));
 return groups;
}
