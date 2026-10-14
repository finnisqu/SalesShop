import type {Quote} from '../types/quote';
import {approvedCustomerDraft} from './quoteDeliveryApproval';

/** An approval made before a cloud permission/number request must still
 * describe the quote that is about to be frozen after that request returns.
 * Classic and Pricing Schedule issuance remain unchanged when no key is passed. */
export function assertMatchingApprovedDraft(
  quote:Pick<Quote,'id'|'revision'|'updatedAt'|'status'>|undefined,
  expectedDraftKey?:string,
):void {
  if(expectedDraftKey===undefined)return;
  if(!quote||!approvedCustomerDraft(quote,expectedDraftKey,expectedDraftKey)){
    throw new Error(
      'This quote changed while it was being issued. Open the latest customer preview and approve the updated draft before trying again.',
    );
  }
}
