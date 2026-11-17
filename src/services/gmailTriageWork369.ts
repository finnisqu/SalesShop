/** Gmail #369: match already-created personal Tasks and explicit CRM Activities
 * to the latest loaded Gmail message using the existing private SHA-256 key.
 *
 * The caller hashes Gmail message IDs in memory and never persists those IDs.
 */
import type {PersonalTask} from '../store/personalTaskStore';
import type {Activity} from '../types/crm';
import {existingGmailFollowUp} from './gmailFollowUp364';
import {loggedGmailActivity} from './gmailActivity363';

export interface GmailTriageWorkStatus {
 task:PersonalTask|undefined;
 activity:Activity|undefined;
 outstanding:boolean;
 /** A completed follow-up for THIS message also resolves that review suggestion. */
 alreadyHandled:boolean;
}
export const EMPTY_GMAIL_WORK_STATUS:GmailTriageWorkStatus={
 task:undefined,activity:undefined,outstanding:false,alreadyHandled:false,
};
export function gmailTriageWorkStatus(fingerprint:string|null,
 tasks:readonly PersonalTask[],activities:readonly Activity[]):GmailTriageWorkStatus{
 if(!fingerprint)return EMPTY_GMAIL_WORK_STATUS;
 const task=existingGmailFollowUp(tasks,fingerprint);
 const activity=loggedGmailActivity(activities,fingerprint);
 const outstanding=!!task&&task.status!=='completed'&&task.status!=='canceled';
 const alreadyHandled=!!task&&task.status!=='canceled';
 return {task,activity,outstanding,alreadyHandled};
}
export function gmailTriageTaskLabel(task:PersonalTask,localToday?:string):string{
 if(task.status==='completed')return 'Follow-up completed';
 if(task.status==='canceled')return 'Follow-up canceled';
 if(!task.dueDate)return 'Follow-up in Tasks';
 const due=task.dueDate;
 if(localToday&&due<localToday)return 'Follow-up overdue · '+due;
 return 'Follow-up due · '+due;
}
