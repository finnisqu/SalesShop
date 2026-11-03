import type {Project,Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import type {PersonalTask} from '../store/personalTaskStore';
import type {TeamRole} from './teamAccess';

/** Without an explicit Deal assignee field, only attach private bid obligations
 * to a user's own work. Owners/admins retain the shop-wide deadline queue. */
export function visibleSubmissionDeals(
 mode:'local'|'cloud',role:TeamRole|null,userId:string|undefined,
 deals:readonly Project[],activities:readonly Activity[],quotes:readonly Quote[],
 tasks:readonly PersonalTask[],
):Project[]{
 if(mode==='local'||role==='owner'||role==='admin')return [...deals];
 if(!userId)return [];
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
 return deals.filter(deal=>relevant.has(deal.id));
}
