import {usePersonalTaskStore} from '../store/personalTaskStore';
import {useAutomationStore} from '../store/automationStore';
import type {AutomationCandidate} from './automationRules358b';

export interface AutomationResult {created:number;errors:string[]}
/** Uses existing private Task persistence and sourceObjectId idempotency.
 * Per-device prototype, not a transactionally unique cloud background queue.
 * Does not edit Deals, send email, issue Quotes or invoke provider APIs. */
export function executeAutomationCandidates(scope:string,candidates:readonly AutomationCandidate[]):AutomationResult{
 const errors:string[]=[];let created=0;
 for(const item of candidates.slice(0,20)){
  const tasks=usePersonalTaskStore.getState();
  const settings=useAutomationStore.getState();
  if(tasks.scope!==scope||settings.scope!==scope){errors.push('Workspace changed; stop and reopen Automations.');break;}
  if(!settings.rules[item.rule].enabled)continue;
  if(tasks.tasks.some(task=>task.sourceObjectId===item.sourceObjectId))continue;
  try{
   const taskId=tasks.createTask(item.title,item.changes);
   if(!taskId){errors.push('Could not create '+item.title);continue;}
   created++;
   try{useAutomationStore.getState().log({
    id:item.sourceObjectId,rule:item.rule,sourceObjectId:item.sourceObjectId,
    taskId,title:item.title,at:new Date().toISOString(),
   });}catch{errors.push('Task created, but local audit history could not be saved for '+item.title);}
  }catch(e){errors.push(e instanceof Error?e.message:'Task creation failed.');}
 }
 return {created,errors};
}
