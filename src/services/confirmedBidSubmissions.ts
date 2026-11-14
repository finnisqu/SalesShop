import type {Activity} from '../types/crm';
import {dedupeNativeQuoteActivities} from './quoteDeliveryLifecycle';
const HISTORICAL=new Set(['Closed Won','Completed','Closed Lost','Discarded']);
/** A Calendar "Quotes Sent" entry requires customer delivery, not merely
 * internal issuance of a prepared SalesShop document. Historical external
 * submissions still count on their actual sent date. */
export function isCustomerQuoteSubmission(activity:Activity):boolean{
 if(activity.type!=='quote-sent')return false;
 const meta=activity.metadata;
 return (Boolean(activity.quoteId)&&meta?.source==='manual'&&
   meta.deliveryConfirmed===true&&Number.isInteger(meta.revision)&&
   (meta.revision??-1)>=0)||
  (!activity.quoteId&&Boolean(activity.projectId)&&meta?.externalQuoteSent===true);
}

/** Durable CRM delivery evidence; "quote issued" and a Deal stage alone
 * cannot count as submission. Historical backfills do not alter old Tasks. */
export function confirmedBidSubmissionDealIds(activities:readonly Activity[]):Set<string>{
 const found=new Set<string>();
 for(const activity of dedupeNativeQuoteActivities(activities)){
  if(!activity.projectId||!isCustomerQuoteSubmission(activity))continue;
  if(activity.metadata?.externalQuoteSent===true&&
     HISTORICAL.has(activity.metadata.fromStage??''))continue;
  found.add(activity.projectId);
 }
 return found;
}
