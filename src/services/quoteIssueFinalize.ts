import type {Quote,QuoteDocument} from '../types/quote';

/** Merge a server-confirmed Sent revision without rolling back other quote
 * edits made while async issuance was waiting for the network.
 *
 * Store updates replace Quote objects, so reference equality detects ANY
 * intervening edit to this draft, even two edits within the same millisecond.
 * A changed draft must be reconciled with the server, never silently overwritten
 * by an older snapshot from the async send operation.
 */
export function mergeConfirmedSentQuote(
  latest:QuoteDocument,expectedDraft:Quote,sent:Quote,
):QuoteDocument {
  if(expectedDraft.id!==sent.id||
    latest.quotes.find(quote=>quote.id===expectedDraft.id)!==expectedDraft)
    throw new Error('Quote changed while sending. Refresh its cloud status before retrying; the earlier version may already have been sent.');
  return {
    ...latest,
    quotes:latest.quotes.map(quote=>quote.id===sent.id?sent:quote),
  };
}
