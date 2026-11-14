import type {Activity,ProjectStage} from '../types/crm';
import type {Quote} from '../types/quote';

export type QuoteDeliveryMethod='email'|'text'|'in-person'|'other';
export const QUOTE_DELIVERY_METHOD_LABELS:Record<QuoteDeliveryMethod,string>={
  email:'Email',text:'Text message','in-person':'In person',other:'Other method',
};

/** Manual confirmation, not a proof inferred from link creation or copying.
 * A quote-sent activity without this marker is an older issuance event. */
export function confirmedQuoteDeliveries(
  quote:Pick<Quote,'id'|'revision'>,activities:readonly Activity[],
):Activity[]{
  // The same CRM Activity may arrive twice during local/cloud hydration.
  // Deduplicate by immutable Activity ID, not by date or revision: distinct
  // genuine delivery confirmations must remain individually auditable.
  const byId=new Map<string,Activity>();
  for(const item of activities){
    if(item.quoteId!==quote.id||item.type!=='quote-sent'||
      item.metadata?.source!=='manual'||
      item.metadata?.deliveryConfirmed!==true||
      item.metadata?.revision!==quote.revision)continue;
    const existing=byId.get(item.id);
    if(!existing||item.occurredAt>existing.occurredAt)byId.set(item.id,item);
  }
  return [...byId.values()].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
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
