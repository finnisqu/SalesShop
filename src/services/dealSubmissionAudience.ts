import type {Project,Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import type {PersonalTask} from '../store/personalTaskStore';
import type {TeamRole} from './teamAccess';

/** Explicit assignments take priority over any prior creator/quote inference.
 * Legacy unassigned Deals retain their original routing during the rollout,
 * avoiding accidental loss of an imminent bid-submission obligation. */
export function visibleSubmissionDeals(
 mode:'local'|'cloud',role:TeamRole|null,userId:string|undefined,
 deals:readonly Project[],activities:readonly Activity[],quotes:readonly Quote[],
 tasks:readonly PersonalTask[],
):Project[]{
 if(mode==='local')return [...deals];
 if(!userId||role==='viewer')return [];
 const relevant=new Set<string>();
 quotes.filter(quote=>!quote.archivedAt&&quote.ownerUserId===userId).forEach(quote=>{
  if(quote.projectId)relevant.add(quote.projectId);
 });
 activities.filter(activity=>activity.type==='project-created'&&
  activity.metadata?.recordedByUserId===userId).forEach(activity=>{
   if(activity.projectId)relevant.add(activity.projectId);
 });
 tasks.filter(task=>!task.deletedAt).forEach(task=>{
  (task.associations??(task.linked?[task.linked]:[])).forEach(link=>{
   if(link.type==='project')relevant.add(link.id);
  });
 });
 return deals.filter(deal=>deal.assignedUserId
   ?deal.assignedUserId===userId
   :role==='owner'||role==='admin'||relevant.has(deal.id));
}
