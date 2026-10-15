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

  // Signing is acceptance of an ALREADY issued customer revision. Do not
  // silently issue a Draft/Ready quote as a side effect of a signature.
  if (quote.archivedAt || (quote.status !== 'Sent' && quote.status !== 'Viewed' && quote.status !== 'Signed')) {
    throw new Error('Preview and explicitly issue this quote before collecting a signature.');
  }
  if (!quote.history.some(item=>item.revision===quote.revision)) {
    throw new Error('The issued customer revision is not frozen. Reopen Review before collecting a signature.');
  }
  useSignatureStore.getState().hydrate();
  const stored=useSignatureStore.getState().signatures.find(
    record=>record.quoteId===quote.id&&record.revision===quote.revision,
  );
  if(stored)return stored;
  if(quote.status==='Signed')throw new Error('This quote is already signed but its receipt was not found. Restore the signed receipt before continuing.');
  const signature = useSignatureStore.getState().createSignature(quote, input);

  useQuoteStore.getState().updateQuote(quoteId, { status: 'Signed' });

  return signature;
}
