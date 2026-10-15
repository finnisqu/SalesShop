import type {Quote} from '../types/quote';
import type {QuoteShare} from './quoteShareService';
import {shareMatchesQuoteRevision} from './quoteDeliveryApproval';
import {quoteIssued} from './quoteDeliveryLifecycle';

export type QuoteHandoffStep='issued'|'link'|'delivery'|'viewed'|'signed';
export interface QuoteHandoffStatus {
  issued:boolean;
  linkCreated:boolean;
  deliveryConfirmed:boolean;
  viewed:boolean;
  signed:boolean;
  linkRevoked:boolean;
  linkExpired:boolean;
  linkUsable:boolean;
  headline:string;
  detail:string;
}

/** UI-only milestones. A shared link or an opened native share sheet NEVER
 * proves actual delivery; only a revision-matched manual CRM confirmation does.
 * A viewed link also does not silently backfill that manual confirmation. */
export function quoteHandoffStatus(
  quote:Pick<Quote,'id'|'revision'|'status'>,
  share:Pick<QuoteShare,'quoteId'|'revision'|'status'|'viewCount'|'signedAt'|'expiresAt'>|null,
  deliveryConfirmed:boolean,
):QuoteHandoffStatus{
  const issued=quoteIssued(quote);
  // Never expose the URL for a different quote, even when revision numbers match.
  const validShare=share&&share.quoteId===quote.id&&shareMatchesQuoteRevision(quote,share)?share:null;
  const linkCreated=Boolean(validShare);
  const linkRevoked=validShare?.status==='revoked';
  // Public quote links stop working after expiry unless the document was signed.
  // Mirror the customer endpoint so we never offer an unusable link to a seller.
  const expiry=validShare?.expiresAt?new Date(validShare.expiresAt).getTime():null;
  const linkExpired=validShare?.status==='active'&&expiry!==null&&Number.isFinite(expiry)&&expiry<Date.now();
  const linkUsable=Boolean(validShare&&(validShare.status==='signed'||(validShare.status==='active'&&!linkExpired)));
  const viewed=quote.status==='Viewed'||quote.status==='Signed'||Boolean(validShare&&validShare.viewCount>0);
  const signed=quote.status==='Signed'||validShare?.status==='signed'||Boolean(validShare?.signedAt);
  let headline='Draft · not issued';
  let detail='Review and approve the current customer document before issuing.';
  if(issued){
    headline='Issued · not yet delivered';
    detail='Issuing freezes the revision. It does not create a link, send a message or confirm delivery.';
  }
  if(linkCreated){
    headline='Customer link created';
    detail='A link exists for this revision, but delivery has not been confirmed.';
  }
  if(deliveryConfirmed){
    headline='Delivery confirmed';
    detail='A salesperson explicitly recorded customer delivery for this revision.';
  }
  if(viewed){
    headline='Customer viewed';
    detail=deliveryConfirmed
      ?'The customer opened the quote, and delivery was separately confirmed.'
      :'The customer opened the quote. Manual delivery has not been confirmed.';
  }
  if(signed){
    headline='Signed by customer';
    detail=deliveryConfirmed
      ?'The customer signed the issued revision; delivery was also confirmed.'
      :'The customer signed the issued revision. No separate manual delivery confirmation was recorded.';
  }
  // An unusable URL is the seller's current action, even if it was viewed,
  // manually delivered, or signed earlier. Historical milestones are retained.
  if(linkRevoked){
    headline='Customer link revoked';
    detail='This link is revoked. Create a new link before sharing.';
  }else if(linkExpired){
    headline='Customer link expired';
    detail='This customer link has expired and can no longer be opened. Create a new link before sharing.';
  }
  return {issued,linkCreated,deliveryConfirmed,viewed,signed:Boolean(signed),
    linkRevoked:Boolean(linkRevoked),linkExpired:Boolean(linkExpired),linkUsable,headline,detail};
}
