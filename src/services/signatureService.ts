import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useSignatureStore } from '../store/signatureStore';
import { displayQuoteNumber, type Quote } from '../types/quote';
import type { SignatureInput, SignatureRecord } from '../types/signature';

function getQuote(quoteId: string): Quote | undefined {
  const store = useQuoteStore.getState();
  store.hydrate();
  return useQuoteStore.getState().quotes.find((quote) => quote.id === quoteId);
}

export function completeQuoteSignature(quoteId: string, input: SignatureInput): SignatureRecord | null {
  let quote = getQuote(quoteId);
  if (!quote) return null;

  if (quote.status === 'Draft' || quote.status === 'Ready') {
    useQuoteStore.getState().recordSent(quoteId);
    quote = getQuote(quoteId);
    if (!quote) return null;
  }

  useSignatureStore.getState().hydrate();
  const signature = useSignatureStore.getState().createSignature(quote, input);

  if (quote.status !== 'Signed') {
    useQuoteStore.getState().updateQuote(quoteId, { status: 'Signed' });
  }

  const acceptedQuote = getQuote(quoteId) ?? quote;
  const crm = useCrmStore.getState();
  crm.hydrate();
  useCrmStore.getState().recordActivity({
    type: 'quote-signed',
    summary: `Signature received from ${signature.signerName} for ${displayQuoteNumber(acceptedQuote)}`,
    quoteId: acceptedQuote.id,
    projectId: acceptedQuote.projectId,
    companyId: acceptedQuote.companyId,
    contactId: acceptedQuote.contactId,
    metadata: {
      source: 'quote',
      quoteNumber: displayQuoteNumber(acceptedQuote),
      revision: acceptedQuote.revision,
      amount: signature.acceptedSnapshot.acceptedTotal,
    },
  });

  return signature;
}
