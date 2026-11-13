import type {Project} from '../types/crm';

/** Reconcile a server-confirmed bid into the latest local CRM, not the stale
 * snapshot captured before the Activity/Deal cloud round trips.
 * Preserve unrelated edits and never roll a Deal's newer stage backward. */
export function reconcileExternalQuoteDealAfterAck(
 projects:readonly Project[],original:Project,confirmed:Project,
):Project[]{
 return projects.map(current=>{
  if(current.id!==original.id)return current;
  if(current.stage!==original.stage&&current.stage!==confirmed.stage)return current;
  const newerTime=Date.parse(current.updatedAt)>Date.parse(confirmed.updatedAt)
   ?current.updatedAt:confirmed.updatedAt;
  const latestTouch=(current.lastTouchpoint??'')>(confirmed.lastTouchpoint??'')
   ?current.lastTouchpoint:confirmed.lastTouchpoint;
  return {...current,
   stage:confirmed.stage,stageChangedAt:confirmed.stageChangedAt,
   amount:confirmed.amount,dueDate:undefined,lastTouchpoint:latestTouch,
   updatedAt:newerTime,
  };
 });
}
