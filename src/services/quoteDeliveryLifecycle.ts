import type {Activity,ProjectStage} from '../types/crm';
import type {Quote} from '../types/quote';

export type QuoteDeliveryMethod='email'|'text'|'in-person'|'other';
export const QUOTE_DELIVERY_METHOD_LABELS:Record<QuoteDeliveryMethod,string>={
  email:'Email',text:'Text message','in-person':'In person',other:'Other method',
};

/** A revised Activity keeps its ID. Reconcile cloud/cache copies before
 * asking whether that ID still proves delivery. The edited timestamp is
 * authoritative when present, followed by the recording and event times.
 * Equal-version conflicting copies fail closed: unconfirmed evidence wins. */
function nativeActivityVersion(activity:Activity):number {
 for(const value of [activity.metadata?.editedAt,activity.metadata?.recordedAt,
  activity.occurredAt]){
  if(typeof value==='string'){
   const time=Date.parse(value);
   if(Number.isFinite(time))return time;
  }
 }
 return Number.NEGATIVE_INFINITY;
}
const nativeDeliveryProof=(activity:Activity):boolean=>
 activity.type==='quote-sent'&&activity.metadata?.source==='manual'&&
 activity.metadata.deliveryConfirmed===true&&
 Number.isInteger(activity.metadata.revision)&&
 (activity.metadata.revision??-1)>=0;

export function dedupeNativeQuoteActivities<T extends Activity>(
 activities:readonly T[],
):T[]{
 const result:T[]=[];
 const indexById=new Map<string,number>();
 for(const activity of activities){
  if(!activity.quoteId||!activity.id){result.push(activity);continue;}
  const index=indexById.get(activity.id);
  if(index===undefined){
   indexById.set(activity.id,result.length);
   result.push(activity);
   continue;
  }
  const existing=result[index];
  const version=nativeActivityVersion(activity);
  const previousVersion=nativeActivityVersion(existing);
  if(version>previousVersion||
    (version===previousVersion&&nativeDeliveryProof(existing)&&!nativeDeliveryProof(activity))){
   result[index]=activity;
  }
 }
 return result;
}

/** Manual confirmation, not a proof inferred from link creation or copying.
 * A quote-sent activity without this marker is an older issuance event. */
export function confirmedQuoteDeliveries(
  quote:Pick<Quote,'id'|'revision'>,activities:readonly Activity[],
):Activity[]{
  // The same CRM Activity may arrive twice during local/cloud hydration.
  // Deduplicate by immutable Activity ID, not by date or revision: distinct
  // genuine delivery confirmations must remain individually auditable.
  return dedupeNativeQuoteActivities(activities).filter(item=>
    item.quoteId===quote.id&&nativeDeliveryProof(item)&&
    item.metadata?.revision===quote.revision
  ).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
}

export function quoteIssued(quote:Pick<Quote,'status'>):boolean{
  return quote.status!=='Draft'&&quote.status!=='Ready';
}

export function quoteDeliveryLabel(quote:Pick<Quote,'status'>,deliveries:readonly Activity[]):string{
  if(!quoteIssued(quote))return 'Draft — not issued';
  if(quote.status==='Signed')return 'Signed by customer';
  if(quote.status==='Viewed')return 'Customer viewed';
  return deliveries.length?'Customer delivery confirmed':'Issued — delivery not confirmed';
}

/** Issuing a revision is an internal preparation step. Only an explicitly
 * confirmed delivery may advance an opportunity to Bid Sent/Negotiation.
 * Never push an already advanced, won, lost, or closed project backward. */
export function projectStageAfterDelivery(
  stage:ProjectStage,revision:number,
):ProjectStage|null{
  if(stage==='Discovery'||stage==='Intent to Bid'||stage==='Bid Development')return 'Bid Sent';
  if(stage==='Bid Sent'&&revision>0)return 'Negotiation';
  return null;
}

/** A prepared quote means bid development, never customer delivery. */
export function projectStageAfterIssue(stage:ProjectStage):ProjectStage|null{
  return stage==='Discovery'||stage==='Intent to Bid'?'Bid Development':null;
}
