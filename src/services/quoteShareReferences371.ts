import type {SalesQuoteRecord} from './salesQuoteRegistry';
import type {QuoteShare} from './quoteShareService';

/** Share lookup is read-only, opt-in and always revision-scoped.
 * This helper never exposes/persists the sensitive customer bearer token. */
export function quoteShareLookupCandidate(record:SalesQuoteRecord):boolean{
 return record.source==='salesshop'&&
  ['Sent','Viewed','Signed','Declined','Expired'].includes(record.status);
}
export function quoteShareReferenceSummary(
 expected:{id:string;revision:number},
 share:QuoteShare|null,
 now=Date.now()
):{state:'missing'|'active'|'viewed'|'signed'|'revoked'|'expired'|'mismatch';
 usable:boolean;views:number;revision:number}{
 if(!share)return {state:'missing',usable:false,views:0,revision:expected.revision};
 if(share.quoteId!==expected.id||share.revision!==expected.revision)
  return {state:'mismatch',usable:false,views:0,revision:expected.revision};
 const views=Math.max(0,Number.isFinite(share.viewCount)?share.viewCount:0);
 if(share.status==='revoked')return {state:'revoked',usable:false,views,revision:share.revision};
 const expiry=share.expiresAt?Date.parse(share.expiresAt):NaN;
 if(share.status==='active'&&Number.isFinite(expiry)&&expiry<now)
  return {state:'expired',usable:false,views,revision:share.revision};
 if(share.status==='signed')return {state:'signed',usable:true,views,revision:share.revision};
 if(share.status==='active')return {state:views?'viewed':'active',usable:true,
  views,revision:share.revision};
 return {state:'mismatch',usable:false,views:0,revision:expected.revision};
}
