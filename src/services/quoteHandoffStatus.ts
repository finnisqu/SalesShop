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
  headline:string;
  detail:string;
}

/** UI-only milestones. A shared link or an opened native share sheet NEVER
 * proves actual delivery; only a revision-matched manual CRM confirmation does.
 * A viewed link also does not silently backfill that manual confirmation. */
export function quoteHandoffStatus(
  quote:Pick<Quote,'revision'|'status'>,
  share:Pick<QuoteShare,'revision'|'status'|'viewCount'|'signedAt'>|null,
  deliveryConfirmed:boolean,
):QuoteHandoffStatus{
  const issued=quoteIssued(quote);
  const validShare=share&&shareMatchesQuoteRevision(quote,share)?share:null;
  const linkCreated=Boolean(validShare);
  const linkRevoked=validShare?.status==='revoked';
  const viewed=quote.status==='Viewed'||quote.status==='Signed'||Boolean(validShare&&validShare.viewCount>0);
  const signed=quote.status==='Signed'||validShare?.status==='signed'||Boolean(validShare?.signedAt);
  let headline='Draft · not issued';
  let detail='Review and approve the current customer document before issuing.';
  if(issued){
    headline='Issued · not yet delivered';
    detail='Issuing freezes the revision. It does not create a link, send a message or confirm delivery.';
  }
  if(linkCreated){
    headline=linkRevoked?'Customer link revoked':'Customer link created';
    detail=linkRevoked
      ?'This link is revoked. Create a new link before sharing.'
      :'A link exists for this revision, but delivery has not been confirmed.';
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
  return {issued,linkCreated,deliveryConfirmed,viewed,signed:Boolean(signed),
    linkRevoked:Boolean(linkRevoked),headline,detail};
}
