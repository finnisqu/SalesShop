import { useQuoteStore } from '../store/quoteStore';
import { useSignatureStore } from '../store/signatureStore';
import type { Quote } from '../types/quote';
import type { SignatureInput, SignatureRecord } from '../types/signature';

function getQuote(quoteId: string): Quote | undefined {
  const store = useQuoteStore.getState();
  store.hydrate();
  return useQuoteStore.getState().quotes.find((quote) => quote.id === quoteId);
}

export async function completeQuoteSignature(quoteId: string, input: SignatureInput): Promise<SignatureRecord | null> {
  let quote = getQuote(quoteId);
  if (!quote) return null;

  if (quote.status === 'Draft' || quote.status === 'Ready') {
    await useQuoteStore.getState().recordSent(quoteId);
    quote = getQuote(quoteId);
    if (!quote || quote.status === 'Draft' || quote.status === 'Ready') return null;
  }

  useSignatureStore.getState().hydrate();
  const signature = useSignatureStore.getState().createSignature(quote, input);

  if (quote.status !== 'Signed') {
    useQuoteStore.getState().updateQuote(quoteId, { status: 'Signed' });
  }

  return signature;
}
