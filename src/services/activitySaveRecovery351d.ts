import {completedTaskActivityId} from './taskActivityWorkflow';

/** A manual Activity needs a stable attempt ID, just like task-completion
 * Activities. Persist this ID in the same account-scoped form draft BEFORE
 * recording, so retries never append a second CRM interaction. */
export function activityAttemptId(
 workflowTaskId:string|null,privateScope:string|null,pendingActivityId:string|null,
 makeId:()=>string=()=>crypto.randomUUID(),
):string{
 if(workflowTaskId)return completedTaskActivityId(workflowTaskId,privateScope??'local:user');
 if(pendingActivityId)return pendingActivityId;
 return 'activity_manual_'+makeId();
}

/** Reuse a previously logged Activity and finish pending downstream work,
 * instead of recording a second interaction after follow-up creation fails. */
export function recordActivityOnce(
 activityId:string,activities:readonly {id:string}[],record:(id:string)=>string,
):string{
 if(activities.some(activity=>activity.id===activityId))return activityId;
 return record(activityId);
}
