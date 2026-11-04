import type {CrmDeletionReferences} from './crmDeletionBlockers';
import {normalizedTaskAssociations} from '../store/personalTaskStore';

/** Dependency references for in-place record-management drill-downs.
 * The deletion guard remains authoritative; this only exposes the actual
 * underlying records instead of requiring users to switch tabs and search. */
export type ManagedKind='company'|'person'|'deal'|'quote'|'activity'|'task';
export interface ManagedDependency {kind:ManagedKind;id:string;reason:string}
export function recordManagementDependencies(
 kind:ManagedKind,id:string,data:CrmDeletionReferences,
):ManagedDependency[]{
 const result:ManagedDependency[]=[];
 const seen=new Set<string>();
 const add=(type:ManagedKind,key:string,reason:string)=>{
  if(!key||seen.has(type+':'+key))return;
  seen.add(type+':'+key);result.push({kind:type,id:key,reason});
 };
 const linkedActivity=(activity:CrmDeletionReferences['activities'][number],
  type:'contact'|'company'|'project'|'quote')=>
  activity.metadata?.relatedRecords?.some(link=>link.type===type&&link.id===id)??false;
 const tasks=(type:'contact'|'company'|'project'|'quote')=>{
  for(const task of data.tasks){
   if(task.deletedAt)continue;
   if(kind==='deal'&&task.sourceObjectId==='deal-submit:'+id)continue;
   if(normalizedTaskAssociations(task).some(link=>link.type===type&&link.id===id))
    add('task',task.id,'Linked personal task');
  }
 };
 if(kind==='company'){
  for(const person of data.contacts)if(person.companyId===id)
   add('person',person.id,'Person at this company');
  for(const deal of data.projects)if(deal.companyId===id)
   add('deal',deal.id,'Deal associated with this company');
  const name=data.companies.find(c=>c.id===id)?.name.trim().toLocaleLowerCase();
  for(const quote of data.quotes){
   if(quote.companyId===id||(!quote.companyId&&!!name&&quote.companyName?.trim().toLocaleLowerCase()===name))
    add('quote',quote.id,'Quote associated with this company');
  }
  for(const activity of data.activities)if(activity.companyId===id||linkedActivity(activity,'company'))
   add('activity',activity.id,'Company activity');
  tasks('company');
 }
 if(kind==='person'){
  for(const quote of data.quotes)if(quote.contactId===id)
   add('quote',quote.id,'Quote with this contact');
  for(const activity of data.activities)if(activity.type!=='contact-created'&&
   (activity.contactId===id||linkedActivity(activity,'contact')))
   add('activity',activity.id,'Contact activity');
  tasks('contact');
 }
 if(kind==='deal'){
  for(const quote of data.quotes)if(quote.projectId===id)
   add('quote',quote.id,'Quote linked to this Deal');
  for(const activity of data.activities)if(
   activity.type!=='project-created'&&activity.type!=='project-stage-changed'&&
   (activity.projectId===id||linkedActivity(activity,'project')))
   add('activity',activity.id,'Deal activity');
  tasks('project');
 }
 if(kind==='quote'){
  for(const quote of data.quotes)if(quote.parentQuoteId===id)
   add('quote',quote.id,'Dependent change order or revision');
  // Other quote associations are contextual, not grounds for deleting customer
  // audit history. Restrict this panel to the dependencies relevant to deletion.
 }
 if(kind==='activity'){
  for(const task of data.tasks)if(!task.deletedAt&&
   task.sourceObjectId==='activity-followup:'+id)
   add('task',task.id,'Follow-up task created from this activity');
 }
 return result;
}
