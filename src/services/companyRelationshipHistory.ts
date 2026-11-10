import type {Activity,Company,Contact,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import type {PersonalTask} from '../store/personalTaskStore';
import {normalizedTaskAssociations} from '../store/personalTaskStore';
import {activityRelations} from './activityRelations';
import {quotesForCompany} from './quoteCrmLinks';
import {completedTaskActivityId} from './taskActivityWorkflow';

export type CompanyHistoryCategory='interaction'|'quote'|'deal'|'task'|'people'|'system';
export type CompanyHistoryFilter='all'|'interactions'|'quotes'|'deals'|'tasks';
export type CompanyHistoryTarget={kind:'person'|'deal'|'quote'|'task';id:string};
export interface CompanyHistoryItem{
 id:string;at:string;category:CompanyHistoryCategory;title:string;
 detail:string;target?:CompanyHistoryTarget;method?:string;pending?:boolean;
}
export interface CompanyHistoryInput{
 company:Company;contacts:readonly Contact[];projects:readonly Project[];
 activities:readonly Activity[];quotes:readonly Quote[];
 /** Only pass the signed-in user's personal Tasks with a verified scope. */
 tasks?:readonly PersonalTask[];personalTaskScope?:string|null;
}
const isActivityInteraction=(activity:Activity)=>
 activity.type==='manual-touchpoint'||activity.type==='notebook-touchpoint';
const validDate=(date:string|undefined):date is string=>
 Boolean(date&&Number.isFinite(Date.parse(date)));
const normalizeSort=(items:CompanyHistoryItem[])=>items.sort((a,b)=>
 Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
const categoryOf=(type:Activity['type']):CompanyHistoryCategory=>
 type.startsWith('quote-')||type.startsWith('change-order-')?'quote':
 type.startsWith('project-')?'deal':isInteractionType(type)?'interaction':
 type==='contact-created'?'people':'system';
const isInteractionType=(type:Activity['type'])=>
 type==='manual-touchpoint'||type==='notebook-touchpoint';

/** One ID-based relationship timeline. Names never confer membership. Activities
 * linked through a Person/Deal/Quote count once, even with multiple associations.
 * Personal tasks are excluded unless the caller supplies a verified personal scope. */
export function companyRelationshipHistory({
 company,contacts,projects,activities,quotes,tasks=[],personalTaskScope=null,
}:CompanyHistoryInput):CompanyHistoryItem[]{
 const members=contacts.filter(person=>person.companyId===company.id);
 const deals=projects.filter(deal=>deal.companyId===company.id);
 const documents=quotesForCompany(company,projects,quotes).filter(quote=>!quote.archivedAt);
 const memberIds=new Set(members.map(person=>person.id));
 const dealIds=new Set(deals.map(deal=>deal.id));
 const quoteIds=new Set(documents.map(quote=>quote.id));
 const peopleById=new Map(members.map(person=>[person.id,person]));
 const dealsById=new Map(deals.map(deal=>[deal.id,deal]));
 const docsById=new Map(documents.map(document=>[document.id,document]));
 const result:CompanyHistoryItem[]=[];
 const includedActivities:Activity[]=[];
 for(const activity of activities){
  if(!validDate(activity.occurredAt))continue;
  // A quote's own privacy and archived state takes precedence over a Deal link.
  if(activity.quoteId&&!quoteIds.has(activity.quoteId)&&
   (activity.type.startsWith('quote-')||activity.type.startsWith('change-order-')))continue;
  const links=activityRelations(activity);
  const belongs=activity.companyId===company.id||
   Boolean(activity.contactId&&memberIds.has(activity.contactId))||
   Boolean(activity.projectId&&dealIds.has(activity.projectId))||
   Boolean(activity.quoteId&&quoteIds.has(activity.quoteId))||
   links.some(link=>(link.type==='company'&&link.id===company.id)||
    (link.type==='contact'&&memberIds.has(link.id))||
    (link.type==='project'&&dealIds.has(link.id))||
    (link.type==='quote'&&quoteIds.has(link.id)));
  if(!belongs)continue;
  includedActivities.push(activity);
  const personId=memberIds.has(activity.contactId??'')?activity.contactId:
   links.find(link=>link.type==='contact'&&memberIds.has(link.id))?.id;
  const quoteId=quoteIds.has(activity.quoteId??'')?activity.quoteId:
   links.find(link=>link.type==='quote'&&quoteIds.has(link.id))?.id;
  const dealId=dealIds.has(activity.projectId??'')?activity.projectId:
   links.find(link=>link.type==='project'&&dealIds.has(link.id))?.id;
  const category=categoryOf(activity.type);
  const person=personId?peopleById.get(personId):undefined;
  const document=quoteId?docsById.get(quoteId):undefined;
  const deal=dealId?dealsById.get(dealId):undefined;
  const method=activity.metadata?.interactionMethod;
  const detail=[
   method?method.replaceAll('-',' '):undefined,
   person?.name,deal?.name,
   activity.metadata?.externalQuoteSent?'Outside SalesShop':undefined,
   category==='quote'&&document?document.title:undefined,
  ].filter(Boolean).join(' · ')||
   (activity.type==='quote-sent'?'Quote sent':activity.type.replaceAll('-',' '));
  const target:CompanyHistoryTarget|undefined=category==='quote'&&document
   ?{kind:'quote',id:document.id}:category==='deal'&&deal
   ?{kind:'deal',id:deal.id}:person
   ?{kind:'person',id:person.id}:deal
   ?{kind:'deal',id:deal.id}:document
   ?{kind:'quote',id:document.id}:undefined;
  result.push({id:'activity:'+activity.id,at:activity.occurredAt,category,
   title:activity.metadata?.externalQuoteSent&&activity.type==='quote-sent'
    ?'External quote sent':activity.summary,
   detail,target,method});
 }
 // Legacy/imported Deals and Quotes might not have creation Activities. Represent
 // those milestones only if an equivalent CRM Activity was never recorded.
 for(const deal of deals){
  if(!validDate(deal.createdAt))continue;
  if(includedActivities.some(event=>event.type==='project-created'&&
   (event.projectId===deal.id||activityRelations(event).some(link=>
    link.type==='project'&&link.id===deal.id))))continue;
  result.push({id:'deal-created:'+deal.id,at:deal.createdAt,category:'deal',
   title:'Deal created · '+deal.name,detail:deal.stage||'Deal',
   target:{kind:'deal',id:deal.id}});
 }
 for(const doc of documents){
  if(validDate(doc.createdAt)&&!includedActivities.some(event=>
   event.type==='quote-created'&&(event.quoteId===doc.id||
    activityRelations(event).some(link=>link.type==='quote'&&link.id===doc.id)))){
   result.push({id:'quote-created:'+doc.id,at:doc.createdAt,category:'quote',
    title:'Quote created · '+(doc.title||doc.quoteNumber||'Quote'),
    detail:doc.status,target:{kind:'quote',id:doc.id}});
  }
  // Use stored sentAt only as a fallback, never as a second sent event.
  if(validDate(doc.sentAt)&&!includedActivities.some(event=>
   event.type==='quote-sent'&&(event.quoteId===doc.id||
    activityRelations(event).some(link=>link.type==='quote'&&link.id===doc.id)))){
   result.push({id:'quote-sent:'+doc.id,at:doc.sentAt,category:'quote',
    title:'Quote sent · '+(doc.title||doc.quoteNumber||'Quote'),
    detail:'Sent through SalesShop',target:{kind:'quote',id:doc.id}});
  }
 }
 if(personalTaskScope){
  const completedActivityIds=new Set(includedActivities.map(event=>event.id));
  for(const task of tasks){
   if(task.deletedAt||task.workspaceScope!==personalTaskScope)continue;
   const associations=normalizedTaskAssociations(task);
   if(!associations.some(link=>(link.type==='company'&&link.id===company.id)||
    (link.type==='contact'&&memberIds.has(link.id))||
    (link.type==='project'&&dealIds.has(link.id))||
    (link.type==='quote'&&quoteIds.has(link.id))))continue;
   const completed=task.status==='completed'||Boolean(task.completedAt);
   if(completed&&completedActivityIds.has(completedTaskActivityId(task.id,personalTaskScope)))
    continue;
   const at=completed?task.completedAt??task.updatedAt:task.createdAt;
   if(!validDate(at))continue;
   const personId=associations.find(link=>link.type==='contact'&&memberIds.has(link.id))?.id;
   const person=personId?peopleById.get(personId):undefined;
   result.push({id:'task:'+task.id,at,category:'task',
    title:(completed?'Completed':'Task')+' · '+task.title,
    detail:[person?.name,task.dueDate?'Due '+task.dueDate:undefined,
     completed?'Completed':task.status==='canceled'?'Canceled':'Open'].filter(Boolean).join(' · '),
    pending:!completed&&task.status!=='canceled',
    target:{kind:'task',id:task.id}});
  }
 }
 return normalizeSort(result);
}
export const companyHistoryByFilter=(items:readonly CompanyHistoryItem[],filter:CompanyHistoryFilter)=>
 filter==='all'?items:
 items.filter(item=>filter==='interactions'?item.category==='interaction':
  filter==='quotes'?item.category==='quote':filter==='deals'?item.category==='deal':
  item.category==='task');
