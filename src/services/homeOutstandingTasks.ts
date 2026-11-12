import type {PersonalTask} from '../store/personalTaskStore';

/** Current, incomplete work ordered by the next actual deadline.
 * Overdue items sort first; undated work is last. Do not use originalDueDate
 * for scheduling because that is an accountability baseline, not the next due. */
export function homeOutstandingTasks(tasks:readonly PersonalTask[]):PersonalTask[]{
 return tasks.filter(task=>!task.deletedAt&&!task.completedAt
  &&task.status!=='completed'&&task.status!=='canceled')
  .slice().sort((a,b)=>{
   const ad=a.dueDate||'9999-12-31',bd=b.dueDate||'9999-12-31';
   return ad.localeCompare(bd)||(a.dueTime||'').localeCompare(b.dueTime||'')
    ||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id);
  });
}

export function outstandingDueLabel(task:Pick<PersonalTask,'dueDate'>,today:string):string{
 const date=task.dueDate;
 if(!date)return 'No due date';
 const display=new Date(date+'T12:00:00').toLocaleDateString(undefined,{
  month:'short',day:'numeric',year:'numeric',
 });
 if(date<today)return 'Overdue · '+display;
 if(date===today)return 'Due today';
 return 'Due '+display;
}
