import type {PersonalTask,TaskAssociation} from '../store/personalTaskStore';
import type {ActivityMetadata} from '../types/crm';

export interface ActivityComposerRequest {
  date?:string;
  taskId?:string;
  associations?:TaskAssociation[];
}
/** One global Activity editor services Home, Calendar, Tasks and CRM previews. */
export function openActivityComposer(detail:ActivityComposerRequest={}):void{
  window.dispatchEvent(new CustomEvent<ActivityComposerRequest>('salesshop:open-activity',{detail}));
}
type Method=NonNullable<ActivityMetadata['interactionMethod']>;
export function taskActivityMethod(task:Pick<PersonalTask,'type'>):Method{
  if(task.type==='email')return 'email';
  if(task.type==='meeting')return 'in-person';
  return 'call';
}
/** Stable workflow identity makes a retry after a tab refresh idempotent. */
export function completedTaskActivityId(taskId:string,taskScope:string):string{
  // Two salespeople can have identically keyed auto-bid tasks for one Deal.
  // Include the private task scope to avoid colliding in shared CRM history.
  return 'activity_task_complete_'+taskScope+'_'+taskId;
}
