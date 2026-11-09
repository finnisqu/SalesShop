import type {Activity} from '../types/crm';
const HISTORICAL=new Set(['Closed Won','Completed','Closed Lost','Discarded']);
/** Durable CRM delivery evidence; "quote issued" and a Deal stage alone
 * cannot count as submission. Historical backfills do not alter old Tasks. */
export function confirmedBidSubmissionDealIds(activities:readonly Activity[]):Set<string>{
 const found=new Set<string>();
 for(const activity of activities){
  if(!activity.projectId||activity.type!=='quote-sent')continue;
  const meta=activity.metadata;
  const quoteDelivered=meta?.deliveryConfirmed===true&&Boolean(activity.quoteId);
  const externalSent=meta?.externalQuoteSent===true&&
    !HISTORICAL.has(meta.fromStage??'');
  if(quoteDelivered||externalSent)found.add(activity.projectId);
 }
 return found;
}
