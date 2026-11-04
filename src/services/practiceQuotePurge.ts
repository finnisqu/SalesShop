import type {Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import {normalizedTaskAssociations,type PersonalTask} from '../store/personalTaskStore';
import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';

/** These are quote-owned lifecycle breadcrumbs, not general CRM interactions.
 * In particular, signed events and unrelated manual activities are excluded. */
export const PRACTICE_QUOTE_ACTIVITY_TYPES:readonly Activity['type'][]=[
 'quote-created','quote-linked','quote-sent','quote-follow-up',
 'quote-revision-created','quote-viewed','quote-declined','quote-expired',
 'change-order-created','change-order-sent','change-order-revision-created',
 'change-order-viewed','change-order-declined','change-order-expired',
];
const purgeTypes=new Set<Activity['type']>(PRACTICE_QUOTE_ACTIVITY_TYPES);
/** Quote-generated setup breadcrumbs may be purged, but their People/Deals
 * records themselves remain for separate deliberate review. */
export function isPracticeQuoteActivity(event:Pick<Activity,'type'|'metadata'>):boolean{
 return purgeTypes.has(event.type)||
  (event.metadata?.source==='quote'&&
   ['contact-created','project-created','project-stage-changed'].includes(event.type));
}

export interface PracticeQuotePurgePlan {
 blockers:string[];
 activityIds:string[];
}

/** Archived/unsigned practice documents only, with no cascading CRM deletion.
 * A live customer agreement is NEVER automatically identified as a test. */
export function planPracticeQuotePurge(
 quote:Quote,allQuotes:readonly Quote[],activities:readonly Activity[],
 tasks:readonly PersonalTask[],
):PracticeQuotePurgePlan {
 const blockers:string[]=[];
 if(!quote.archivedAt)blockers.push('Archive this document before permanent deletion');
 if(quote.status==='Signed'||!!quote.signedAt||
  quote.history.some(revision=>revision.status==='Signed'))
  blockers.push('Signed documents and accepted agreements cannot be purged');
 if(allQuotes.some(other=>other.id!==quote.id&&other.parentQuoteId===quote.id))
  blockers.push('Dependent Change Orders must be reviewed first');
 const linkedTasks=tasks.filter(task=>!task.deletedAt&&(
  normalizedTaskAssociations(task).some(link=>link.type==='quote'&&link.id===quote.id)||
  task.sourceObjectId==='quote-followup:'+quote.id||
  task.sourceObjectId==='quote-follow-up:'+quote.id
 ));
 if(linkedTasks.length)blockers.push(linkedTasks.length+' linked personal tasks');
 const direct=activities.filter(activity=>activity.quoteId===quote.id);
 const protectedEvents=direct.filter(activity=>!isPracticeQuoteActivity(activity));
 const indirect=activities.filter(activity=>activity.quoteId!==quote.id&&
  activity.metadata?.relatedRecords?.some(link=>link.type==='quote'&&link.id===quote.id));
 if(protectedEvents.length||indirect.length)
  blockers.push(protectedEvents.length+indirect.length+' other linked CRM activities need review');
 return {blockers,activityIds:direct.filter(isPracticeQuoteActivity).map(a=>a.id)};
}

function errMessage(error:unknown):string {
 return error instanceof Error?error.message:'Unknown data storage error';
}

/** Deliberate Settings-only action. Never called by archive/delete shortcuts.
 * Each cloud write is checked; we don't hide a failed delete behind a local change. */
export async function purgeArchivedPracticeQuote(quoteId:string):Promise<number> {
 const auth=useAuthStore.getState();
 if(useRolePerspectiveStore.getState().activePerspective||
  (auth.mode!=='local'&&auth.teamRole!=='owner'&&auth.teamRole!=='admin'))
  throw new Error('Only an Owner or Admin may permanently purge archived practice quotes.');
 const quote=useQuoteStore.getState().quotes.find(item=>item.id===quoteId);
 if(!quote)throw new Error('This quote is no longer available.');
 if(auth.mode==='cloud'&&quote.ownerUserId!==auth.user?.id)
  throw new Error('Only your own archived quotes can be purged in this workspace.');
 const crm=useCrmStore.getState();
 const saved=usePersonalTaskStore.getState();
 const scope=taskScope(auth.mode,auth.organizationId,auth.user?.id);
 const tasks=scope&&scope===saved.scope?saved.tasks.filter(task=>!task.deletedAt):[];
 const plan=planPracticeQuotePurge(quote,useQuoteStore.getState().quotes,crm.activities,tasks);
 if(plan.blockers.length)throw new Error(plan.blockers.join('; '));
 let remoteIds:string[]=[];
 if(auth.mode==='cloud'){
  if(!supabase||!auth.organizationId)
   throw new Error('Cloud storage is unavailable. Nothing was deleted.');
  const org=auth.organizationId;
  const {data:stored,error:quoteError}=await supabase.from('quotes')
   .select('id,owner_user_id,archived_at,status,signed_at')
   .eq('organization_id',org).eq('id',quoteId).single();
  if(quoteError||!stored)throw new Error('Unable to verify the archived quote on the server.');
  if(stored.owner_user_id!==auth.user?.id||!stored.archived_at||
   stored.status==='Signed'||!!stored.signed_at)
   throw new Error('The server does not confirm an archived, unsigned quote you own.');
  const {data:signatures,error:signatureError}=await supabase.from('signatures')
   .select('id').eq('organization_id',org).eq('quote_id',quoteId).limit(1);
  if(signatureError)throw new Error('Unable to check accepted signatures. Nothing was deleted.');
  if(signatures?.length)throw new Error('This quote has an accepted signature and cannot be purged.');
  const {data:children,error:childrenError}=await supabase.from('quotes')
   .select('id').eq('organization_id',org).eq('parent_quote_id',quoteId).limit(1);
  if(childrenError)throw new Error('Unable to check dependent Change Orders. Nothing was deleted.');
  if(children?.length)throw new Error('Dependent Change Orders must be reviewed first.');
  const {data:events,error:eventsError}=await supabase.from('activities')
   .select('id,type,metadata').eq('organization_id',org).eq('quote_id',quoteId);
  if(eventsError)throw new Error('Unable to check quote activity history. Nothing was deleted.');
  const remote=events??[];
  if(remote.some(event=>!isPracticeQuoteActivity(event as Pick<Activity,'type'|'metadata'>)))
   throw new Error('This quote has other CRM activity history. Review it before purging.');
  remoteIds=remote.map(event=>event.id);
  if(remoteIds.length){
   // Activity RLS requires the quote to still exist. Delete only this quote's
   // own lifecycle events, while its ownership can still be verified by RLS.
   const {data:removed,error:activityError}=await supabase.from('activities')
    .delete().eq('organization_id',org).eq('quote_id',quoteId)
    .in('id',remoteIds).select('id');
   if(activityError||removed?.length!==remoteIds.length)
    throw new Error('Unable to confirm removal of quote lifecycle activity. The quote was not purged.');
  }
 }
 try{
  // Quote deletion cascades its own revision/share records. The owner-gated
  // store method confirms the server deletion before touching the local cache.
  await useQuoteStore.getState().deleteQuoteFromManagement(quoteId,{purgeArchivedPractice:true});
 }catch(error){
  throw new Error('The quote was not removed. '+errMessage(error)+
   (remoteIds.length?' Some quote activity history may have been removed; retry the archived quote purge.':''));
 }
 const ids=new Set([...plan.activityIds,...remoteIds]);
 useCrmStore.getState().discardPurgedQuoteActivities(quoteId,[...ids]);
 return ids.size;
}
// Imports are deliberately grouped at the end to avoid a store import cycle
// at runtime: both are referenced only inside the user-triggered function.
import {taskScope,usePersonalTaskStore} from '../store/personalTaskStore';
