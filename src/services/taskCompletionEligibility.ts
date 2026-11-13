import {isProtectedBidTask,subtaskProgress,type PersonalTask} from '../store/personalTaskStore';

export type TaskCompletionBlocker='bid-submission'|'incomplete-checklist'|null;

/** The Task action and bulk-completion workflow share the same eligibility
 * rules. The store still independently enforces these rules when saving. */
export function taskCompletionBlocker(
 task:Pick<PersonalTask,'sourceObjectId'|'submissionConfirmedAt'|'subtasks'>,
):TaskCompletionBlocker{
 if(isProtectedBidTask(task)&&!task.submissionConfirmedAt)return 'bid-submission';
 if(subtaskProgress(task).remaining>0)return 'incomplete-checklist';
 return null;
}

/** Group blockers before starting a bulk update; never claim every selected
 * task completed when the protected bid or checklist guards kept some open. */
export function taskBulkCompletionPlan<T extends Pick<PersonalTask,
 'id'|'status'|'completedAt'|'sourceObjectId'|'submissionConfirmedAt'|'subtasks'>>(
 tasks:readonly T[],
){
 const eligible:T[]=[];
 let bidBlocked=0,checklistBlocked=0;
 for(const task of tasks){
  if(task.status==='completed'||task.status==='canceled'||task.completedAt)continue;
  const reason=taskCompletionBlocker(task);
  if(reason==='bid-submission')bidBlocked++;
  else if(reason==='incomplete-checklist')checklistBlocked++;
  else eligible.push(task);
 }
 return {eligible,bidBlocked,checklistBlocked};
}
