import type {Quote} from '../types/quote';

/** A customer bearer link may only be created for a separately issued,
 * frozen revision. No UI, Classic editor, or direct client call may silently
 * turn a draft into an issued customer document. Server edge function checks
 * the same status using authoritative DB records. */
export function customerShareCreationBlocker(
  quote:Pick<Quote,'status'|'archivedAt'>,
):string|null {
  if(quote.archivedAt)return 'Restore this archived document before creating a customer link.';
  if(quote.status==='Draft'||quote.status==='Ready')
    return 'Preview and explicitly issue this customer revision before creating a link. Creating a link never issues a draft.';
  if(quote.status==='Declined'||quote.status==='Expired')
    return 'Create a new revision before sharing this declined or expired document.';
  if(quote.status==='Sent'||quote.status==='Viewed'||quote.status==='Signed')return null;
  return 'This document is not ready for customer sharing.';
}
