import { create } from 'zustand';
import { localSignatureRepository } from '../data/signatureRepository';
import { buildAcceptedQuoteSnapshot, type SignatureInput, type SignatureRecord } from '../types/signature';
import type { Quote } from '../types/quote';

interface SignatureState {
  signatures: SignatureRecord[];
  hydrated: boolean;
  hydrate: () => void;
  createSignature: (quote: Quote, input: SignatureInput) => SignatureRecord;
}

const id = () => `signature_${crypto.randomUUID()}`;

function persist(signatures: SignatureRecord[]) {
  localSignatureRepository.save({ schemaVersion: 1, signatures });
}

export const useSignatureStore = create<SignatureState>((set, get) => ({
  signatures: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const document = localSignatureRepository.load();
    set({ signatures: document.signatures, hydrated: true });
  },

  createSignature: (quote, input) => {
    const existing = get().signatures.find((record) => record.quoteId === quote.id && record.revision === quote.revision);
    if (existing) return existing;

    const record: SignatureRecord = {
      id: id(),
      quoteId: quote.id,
      projectId: quote.projectId,
      companyId: quote.companyId,
      contactId: quote.contactId,
      quoteNumber: quote.quoteNumber,
      revision: quote.revision,
      signerName: input.signerName.trim(),
      signerEmail: input.signerEmail?.trim() || undefined,
      method: input.method,
      signatureText: input.method === 'typed' ? (input.signatureText?.trim() || input.signerName.trim()) : undefined,
      strokes: input.method === 'drawn' ? structuredClone(input.strokes ?? []) : [],
      consentText: input.consentText,
      acceptedAt: new Date().toISOString(),
      acceptedSnapshot: buildAcceptedQuoteSnapshot(quote),
    };

    const signatures = [...get().signatures, record];
    persist(signatures);
    set({ signatures });
    return record;
  },
}));
