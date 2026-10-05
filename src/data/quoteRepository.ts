import type { QuoteDocument } from '../types/quote';

const STORAGE_KEY = 'salesshop-react-quotes-v1';

export interface QuoteRepository {
  load(): QuoteDocument | null;
  save(document: QuoteDocument): void;
}

function isQuoteDocument(value: unknown): value is QuoteDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QuoteDocument>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.quotes);
}

export const localQuoteRepository: QuoteRepository = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return isQuoteDocument(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  save(document) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  },
};
