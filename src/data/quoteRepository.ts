import type { Quote, QuoteDocument } from '../types/quote';

const STORAGE_KEY = 'salesshop-react-quotes-v1';

export interface QuoteRepository {
  load(): QuoteDocument | null;
  save(document: QuoteDocument): void;
}

function normalizeQuote(raw: Quote): Quote {
  return {
    ...raw,
    companyId: raw.companyId,
    contactId: raw.contactId,
  };
}

function normalizeDocument(value: unknown): QuoteDocument | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { schemaVersion?: number; quotes?: unknown[]; activeQuoteId?: string | null };
  if (!Array.isArray(candidate.quotes)) return null;
  if (candidate.schemaVersion !== 1 && candidate.schemaVersion !== 2) return null;
  return {
    schemaVersion: 2,
    quotes: candidate.quotes.map((quote) => normalizeQuote(quote as Quote)),
    activeQuoteId: candidate.activeQuoteId ?? null,
  };
}

export const localQuoteRepository: QuoteRepository = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const normalized = normalizeDocument(JSON.parse(raw));
      if (normalized) this.save(normalized);
      return normalized;
    } catch {
      return null;
    }
  },

  save(document) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  },
};
