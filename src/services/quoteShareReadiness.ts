import type {Quote} from '../types/quote';
import {auditQuoteDraft} from './quoteDraftAudit';

/** Direct link creation cannot bypass the intentional decision at formal issue.
 * Optional fields do not block a link, and issued revisions are immutable. */
export function reviewItemsBlockingDirectShare(quote:Quote):number {
  if(quote.documentType==='pricing-schedule'||(quote.status!=='Draft'&&quote.status!=='Ready'))return 0;
  return auditQuoteDraft(quote).review.length;
}
