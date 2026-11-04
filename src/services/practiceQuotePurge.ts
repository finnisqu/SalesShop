import type {Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import {normalizedTaskAssociations,taskScope,usePersonalTaskStore,type PersonalTask} from '../store/personalTaskStore';
import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useSignatureStore} from '../store/signatureStore';

/** Quote-owned lifecycle breadcrumbs, including signed test-only activity.
 * General CRM interactions are never classified as practice quote history. */
export const PRACTICE_QUOTE_ACTIVITY_TYPES:readonly Activity['type'][]=[
 'quote-created','quote-linked','quote-sent','quote-follow-up',
 'quote-revision-created','quote-viewed','quote-signed','quote-declined','quote-expired',
 'change-order-created','change-order-sent','change-order-revision-created',
 'change-order-viewed','change-order-signed','change-order-declined','change-order-expired',
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
 signed:boolean;
}

/** Archived practice documents only, with no cascading CRM deletion.
 * A live customer agreement is NEVER automatically identified as a test. */
export function planPracticeQuotePurge(
 quote:Quote,allQuotes:readonly Quote[],activities:readonly Activity[],
 tasks:readonly PersonalTask[],
):PracticeQuotePurgePlan {
 const blockers:string[]=[];
 if(!quote.archivedAt)blockers.push('Archive this document before permanent deletion');
 // A test-only signature requires an explicit stronger confirmation, not an
 // automatic blanket prohibition. The server also checks stored signatures.
 const signed=quote.status==='Signed'||!!quote.signedAt||
  quote.history.some(revision=>revision.status==='Signed')||
  activities.some(activity=>activity.quoteId===quote.id&&
   ['quote-signed','change-order-signed'].includes(activity.type));
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
 return {blockers,activityIds:direct.filter(isPracticeQuoteActivity).map(a=>a.id),signed};
}

/** Deliberate Settings-only action. All cloud deletes run as a single
 * transactional Owner/Admin RPC; if the migration is absent, fail closed. */
export async function purgeArchivedPracticeQuote(quoteId:string,confirmation:string):Promise<number> {
 const auth=useAuthStore.getState();
 if(useRolePerspectiveStore.getState().activePerspective||
  (auth.mode!=='local'&&auth.teamRole!=='owner'&&auth.teamRole!=='admin'))
  throw new Error('Only an Owner or Admin may permanently purge archived practice quotes.');
 const quote=useQuoteStore.getState().quotes.find(item=>item.id===quoteId);
 if(!quote)throw new Error('This quote is no longer available.');
 if(auth.mode==='cloud'&&quote.ownerUserId!==auth.user?.id&&
  !(quote.ownerUserId==null&&
   (auth.teamRole==='owner'||auth.teamRole==='admin')))
  throw new Error('You cannot purge another salesperson\'s quote.');
 const crm=useCrmStore.getState();
 const saved=usePersonalTaskStore.getState();
 const scope=taskScope(auth.mode,auth.organizationId,auth.user?.id);
 const tasks=scope&&scope===saved.scope?saved.tasks.filter(task=>!task.deletedAt):[];
 useSignatureStore.getState().hydrate();
 const signatures=useSignatureStore.getState().signatures.filter(s=>s.quoteId===quoteId);
 const plan=planPracticeQuotePurge(quote,useQuoteStore.getState().quotes,crm.activities,tasks);
 if(plan.blockers.length)throw new Error(plan.blockers.join('; '));
 const signed=plan.signed||signatures.length>0;
 const expected='PURGE '+(signed?'SIGNED ':'')+quote.quoteNumber;
 if(confirmation!==expected)throw new Error('Enter '+expected+' to confirm this test-only purge.');
 let removedCount=plan.activityIds.length;
 if(auth.mode==='cloud'){
  if(!supabase||!auth.organizationId)
   throw new Error('Cloud storage is unavailable. Nothing was deleted.');
  const {data,error}=await supabase.rpc('purge_archived_practice_quote',{
   p_organization_id:auth.organizationId,
   p_quote_id:quoteId,
   p_confirmation:confirmation,
  });
  if(error){
   if(error.code==='PGRST202'||error.message?.includes('purge_archived_practice_quote'))
    throw new Error('Signed-practice-quote cleanup is awaiting its database security migration. No records were deleted.');
   throw new Error('Practice quote purge failed: '+error.message);
  }
  if(!data||typeof data!=='object'||data.quote_id!==quoteId)
   throw new Error('Database purge did not return confirmation. Refresh before retrying.');
  if(typeof data.deleted_activities==='number')removedCount=data.deleted_activities;
 }
 // Only after the database confirms a complete transaction do local caches
 // update. This prevents cloud refresh from resurrecting test signatures.
 useQuoteStore.getState().discardPurgedQuote(quoteId);
 useCrmStore.getState().discardPurgedQuoteActivities(quoteId,plan.activityIds);
 useSignatureStore.getState().discardPurgedQuoteSignatures(quoteId);
 return removedCount;
}
