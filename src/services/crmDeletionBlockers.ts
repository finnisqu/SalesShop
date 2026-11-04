import type {Company,Contact,Project,Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import type {PersonalTask} from '../store/personalTaskStore';

/** All blockers are explicit: no cascading deletion or silent detachment. */
export function crmDeletionBlockers(
 kind:'company'|'person'|'deal',id:string,
 data:{companies:readonly Company[];contacts:readonly Contact[];
  projects:readonly Project[];activities:readonly Activity[];
  quotes:readonly Quote[];tasks:readonly PersonalTask[]},
):string[]{
 const blocked:string[]=[];
 const matched=(items:readonly unknown[],predicate:(item:any)=>boolean)=>
  items.filter(predicate).length;
 const anyTask=matched(data.tasks,t=>!t.deletedAt&&
  ((t.associations??(t.linked?[t.linked]:[])) as {type:string;id:string}[]).some(link=>
   link.type===(kind==='person'?'contact':kind==='deal'?'project':'company')&&link.id===id));
 if(kind==='company'){
  const contacts=matched(data.contacts,c=>c.companyId===id);
  const deals=matched(data.projects,d=>d.companyId===id);
  const quotes=matched(data.quotes,q=>q.companyId===id);
  const events=matched(data.activities,a=>a.companyId===id);
  if(contacts)blocked.push(contacts+' linked people');
  if(deals)blocked.push(deals+' linked deals');
  if(quotes)blocked.push(quotes+' linked quotes');
  if(events)blocked.push(events+' activities');
 }else if(kind==='person'){
  const quotes=matched(data.quotes,q=>q.contactId===id);
  const events=matched(data.activities,a=>a.contactId===id);
  if(quotes)blocked.push(quotes+' linked quotes');
  if(events)blocked.push(events+' activities');
 }else{
  const quotes=matched(data.quotes,q=>q.projectId===id);
  const events=matched(data.activities,a=>a.projectId===id);
  if(quotes)blocked.push(quotes+' linked quotes');
  if(events)blocked.push(events+' activities');
 }
 if(anyTask)blocked.push(anyTask+' linked tasks');
 return blocked;
}
