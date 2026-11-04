import type {Activity} from '../types/crm';
import type {Quote} from '../types/quote';

/** A record-management action only. This never runs as background cleanup.
 * Signed acceptance audit history is reserved for the explicit practice purge.
 * Live quote history must first be archived or retained. */
const protectedSignatureEvents=new Set<Activity['type']>([
 'quote-signed','change-order-signed',
]);
export function canDeleteAutomaticCrmHistory(
 activity:Activity,quotes:readonly Quote[],
):boolean {
 if(activity.type==='manual-touchpoint'||activity.type==='notebook-touchpoint')return false;
 if(protectedSignatureEvents.has(activity.type))return false;
 const quote=activity.quoteId?quotes.find(item=>item.id===activity.quoteId):undefined;
 if(quote&&!quote.archivedAt)return false;
 return true;
}
