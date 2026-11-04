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
function stableHash(value:string,seed:number):string{
 let hash=seed>>>0;
 for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619)>>>0;
 return hash.toString(36);
}
export function completedTaskActivityId(taskId:string,taskScope:string):string{
  // Two salespeople may have identically keyed Deal tasks, but shared CRM
  // identifiers should not reveal their private Task IDs or account scopes.
  const key=taskScope+'|'+taskId;
  return 'activity_task_complete_'+stableHash(key,2166136261)+'_'+stableHash(key,2246822519);
}
