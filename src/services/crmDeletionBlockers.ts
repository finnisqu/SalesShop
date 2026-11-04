import type {Company,Contact,Project,Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import type {PersonalTask} from '../store/personalTaskStore';

export interface CrmDeletionReferences {
 companies:readonly Company[];contacts:readonly Contact[];projects:readonly Project[];
 activities:readonly Activity[];quotes:readonly Quote[];tasks:readonly PersonalTask[];
}
const count=<T,>(values:readonly T[],predicate:(record:T)=>boolean)=>values.filter(predicate).length;

/** No cascading deletes; explain dependent records before allowing cleanup.
 * Task references are limited to tasks visible to the current user. */
export function crmDeletionBlockers(
 kind:'company'|'person'|'deal',id:string,data:CrmDeletionReferences,
):string[]{
 const blocked:string[]=[];
 const taskType=kind==='person'?'contact':kind==='deal'?'project':'company';
 const linkedTasks=count(data.tasks,task=>!task.deletedAt&&
  (task.associations??(task.linked?[task.linked]:[])).some(link=>
   link.type===taskType&&link.id===id));
 if(kind==='company'){
  const name=data.companies.find(c=>c.id===id)?.name?.trim().toLocaleLowerCase();
  const people=count(data.contacts,contact=>contact.companyId===id);
  const deals=count(data.projects,deal=>deal.companyId===id);
  const quotes=count(data.quotes,quote=>quote.companyId===id||
   (!quote.companyId&&!!name&&quote.companyName?.trim().toLocaleLowerCase()===name));
  const activities=count(data.activities,activity=>activity.companyId===id);
  if(people)blocked.push(people+' linked people');
  if(deals)blocked.push(deals+' linked deals');
  if(quotes)blocked.push(quotes+' linked quotes');
  if(activities)blocked.push(activities+' activities');
 }else if(kind==='person'){
  const quotes=count(data.quotes,quote=>quote.contactId===id);
  const activities=count(data.activities,activity=>activity.contactId===id);
  if(quotes)blocked.push(quotes+' linked quotes');
  if(activities)blocked.push(activities+' activities');
 }else{
  const quotes=count(data.quotes,quote=>quote.projectId===id);
  const activities=count(data.activities,activity=>activity.projectId===id);
  if(quotes)blocked.push(quotes+' linked quotes');
  if(activities)blocked.push(activities+' activities');
 }
 if(linkedTasks)blocked.push(linkedTasks+' linked personal tasks');
 return blocked;
}
