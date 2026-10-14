import type {Quote} from '../types/quote';

/** Ephemeral approval of what was actually previewed. Any saved edit, new
 * document, or revision makes the earlier approval ineligible for issue. */
export function quoteDeliveryApprovalKey(
  quote: Pick<Quote,'id'|'revision'|'updatedAt'>,
): string {
  return JSON.stringify([quote.id,quote.revision,quote.updatedAt]);
}

export function approvedCustomerDraft(
  quote: Pick<Quote,'id'|'revision'|'updatedAt'|'status'>,
  previewedKey:string|null,approvedKey:string|null,
): boolean {
  if(quote.status!=='Draft'&&quote.status!=='Ready')return false;
  const key=quoteDeliveryApprovalKey(quote);
  return previewedKey===key&&approvedKey===key;
}

/** A shared link is authorized for the exact stored revision, not whatever
 * revision the salesperson happens to be viewing now. */
export function shareMatchesQuoteRevision(
  quote:Pick<Quote,'revision'>,share:{revision:number},
):boolean {
  return quote.revision===share.revision;
}
