import { readLocalDocument, writeLocalDocument } from './cloudAwareStorage';
import type { PricingScheduleData, Quote, QuoteDocument } from '../types/quote';

export interface QuoteRepository {
  load(): QuoteDocument | null;
  save(document: QuoteDocument): void;
}

function normalizePricingSchedule(value?: PricingScheduleData): PricingScheduleData | undefined {
  if (!value) return undefined;
  return {
    ...value,
    customerItems: Array.isArray(value.customerItems) ? value.customerItems : [],
  };
}

function normalizeQuote(raw: Quote): Quote {
  return {
    ...raw,
    documentType: raw.documentType ?? 'quote',
    parentQuoteId: raw.parentQuoteId,
    changeOrderNumber: raw.changeOrderNumber,
    companyId: raw.companyId,
    contactId: raw.contactId,
    pricingSchedule: normalizePricingSchedule(raw.pricingSchedule),
    history: (raw.history ?? []).map((revision) => ({
      ...revision,
      documentType: revision.documentType ?? raw.documentType ?? 'quote',
      parentQuoteId: revision.parentQuoteId ?? raw.parentQuoteId,
      changeOrderNumber: revision.changeOrderNumber ?? raw.changeOrderNumber,
      pricingSchedule: normalizePricingSchedule(revision.pricingSchedule),
    })),
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
    const normalized = normalizeDocument(readLocalDocument('quotes'));
    if (normalized) this.save(normalized);
    return normalized;
  },

  save(document) {
    writeLocalDocument('quotes', document);
  },
};
