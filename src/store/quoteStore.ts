import { create } from 'zustand';
import { localQuoteRepository } from '../data/quoteRepository';
import type {
  Quote,
  QuoteCustomerColumns,
  QuoteDocument,
  QuoteLine,
  QuoteLineKind,
  QuotePatch,
  QuoteRevisionSnapshot,
  QuoteSection,
  QuoteStatus,
} from '../types/quote';

interface QuoteState {
  quotes: Quote[];
  activeQuoteId: string | null;
  hydrated: boolean;
  hydrate: () => void;
  createQuote: (prefill?: Partial<Pick<Quote, 'title' | 'projectId' | 'companyName' | 'contactName' | 'contactEmail'>>) => string;
  selectQuote: (quoteId: string) => void;
  updateQuote: (quoteId: string, patch: QuotePatch) => void;
  deleteQuote: (quoteId: string) => void;
  addLine: (quoteId: string, kind?: QuoteLineKind, sectionId?: string) => string;
  updateLine: (quoteId: string, lineId: string, patch: Partial<Omit<QuoteLine, 'id'>>) => void;
  deleteLine: (quoteId: string, lineId: string) => void;
  addSection: (quoteId: string) => string;
  updateSection: (quoteId: string, sectionId: string, patch: Partial<Omit<QuoteSection, 'id'>>) => void;
  deleteSection: (quoteId: string, sectionId: string) => void;
  setCustomerColumns: (quoteId: string, patch: Partial<QuoteCustomerColumns>) => void;
  recordSent: (quoteId: string) => void;
  createRevision: (quoteId: string) => void;
}

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateQuoteNumber(quotes: Quote[], date: string) {
  const sameDay = quotes.filter((quote) => quote.originalQuoteDate === date).length + 1;
  return `Q-${date.replaceAll('-', '')}-${String(sameDay).padStart(3, '0')}`;
}

function newLine(kind: QuoteLineKind = 'item', sectionId?: string): QuoteLine {
  const textKind = kind === 'note' || kind === 'scope' || kind === 'warranty';
  const labels: Record<QuoteLineKind, string> = {
    item: 'New line item',
    allowance: 'Allowance',
    discount: 'Discount',
    tax: 'Taxes',
    note: 'Customer note',
    scope: 'Scope',
    warranty: 'Warranty',
  };
  return {
    id: uid('line'),
    sectionId,
    kind,
    description: labels[kind],
    pricingMode: textKind ? 'none' : 'direct',
    amount: textKind ? undefined : 0,
    customerVisible: true,
    includeInTotal: !textKind,
  };
}

function newQuote(quotes: Quote[], prefill: Partial<Pick<Quote, 'title' | 'projectId' | 'companyName' | 'contactName' | 'contactEmail'>> = {}): Quote {
  const timestamp = now();
  const date = localDateKey();
  return {
    id: uid('quote'),
    quoteNumber: generateQuoteNumber(quotes, date),
    originalQuoteDate: date,
    quoteDate: date,
    revision: 0,
    status: 'Draft',
    title: prefill.title?.trim() || 'Untitled quote',
    projectId: prefill.projectId,
    companyName: prefill.companyName,
    contactName: prefill.contactName,
    contactEmail: prefill.contactEmail,
    sections: [],
    lines: [newLine('item')],
    customerColumns: { quantity: false, rate: false, lineAmount: true },
    customerNotes: '',
    internalNotes: '',
    history: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function seedDocument(): QuoteDocument {
  const quote = newQuote([], { title: 'Blue Jay Park', companyName: 'BAR Construction' });
  quote.lines = [
    { ...newLine('item'), description: 'Quartz countertops', amount: 14500 },
    { ...newLine('scope'), description: 'Includes standard fabrication and installation.' },
  ];
  quote.customerNotes = 'Final material selection and field measurements to be confirmed before production.';
  return { schemaVersion: 1, quotes: [quote], activeQuoteId: quote.id };
}

function persist(quotes: Quote[], activeQuoteId: string | null) {
  localQuoteRepository.save({ schemaVersion: 1, quotes, activeQuoteId });
}

function snapshot(quote: Quote, status: QuoteStatus = quote.status): QuoteRevisionSnapshot {
  return {
    revision: quote.revision,
    label: quote.revisionLabel,
    quoteDate: quote.quoteDate,
    capturedAt: now(),
    status,
    title: quote.title,
    projectId: quote.projectId,
    companyName: quote.companyName,
    contactName: quote.contactName,
    contactEmail: quote.contactEmail,
    address: quote.address,
    sections: structuredClone(quote.sections),
    lines: structuredClone(quote.lines),
    customerColumns: { ...quote.customerColumns },
    customerNotes: quote.customerNotes,
  };
}

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: [],
  activeQuoteId: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const stored = localQuoteRepository.load() ?? seedDocument();
    if (!stored.quotes.length) {
      const seeded = seedDocument();
      persist(seeded.quotes, seeded.activeQuoteId);
      set({ quotes: seeded.quotes, activeQuoteId: seeded.activeQuoteId, hydrated: true });
      return;
    }
    const activeQuoteId = stored.activeQuoteId && stored.quotes.some((quote) => quote.id === stored.activeQuoteId)
      ? stored.activeQuoteId
      : stored.quotes[0].id;
    persist(stored.quotes, activeQuoteId);
    set({ quotes: stored.quotes, activeQuoteId, hydrated: true });
  },

  createQuote: (prefill = {}) => {
    const quote = newQuote(get().quotes, prefill);
    const quotes = [quote, ...get().quotes];
    persist(quotes, quote.id);
    set({ quotes, activeQuoteId: quote.id });
    return quote.id;
  },

  selectQuote: (activeQuoteId) => {
    persist(get().quotes, activeQuoteId);
    set({ activeQuoteId });
  },

  updateQuote: (quoteId, patch) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, ...patch, title: patch.title?.trim() || quote.title, updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  deleteQuote: (quoteId) => {
    let quotes = get().quotes.filter((quote) => quote.id !== quoteId);
    if (!quotes.length) quotes = [newQuote([])];
    const activeQuoteId = get().activeQuoteId === quoteId ? quotes[0].id : get().activeQuoteId;
    persist(quotes, activeQuoteId);
    set({ quotes, activeQuoteId });
  },

  addLine: (quoteId, kind = 'item', sectionId) => {
    const line = newLine(kind, sectionId);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, lines: [...quote.lines, line], updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
    return line.id;
  },

  updateLine: (quoteId, lineId, patch) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? {
          ...quote,
          lines: quote.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line),
          updatedAt: timestamp,
        }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  deleteLine: (quoteId, lineId) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, lines: quote.lines.filter((line) => line.id !== lineId), updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  addSection: (quoteId) => {
    const section: QuoteSection = { id: uid('section'), title: 'New section', customerVisible: true };
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, sections: [...quote.sections, section], updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
    return section.id;
  },

  updateSection: (quoteId, sectionId, patch) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? {
          ...quote,
          sections: quote.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section),
          updatedAt: timestamp,
        }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  deleteSection: (quoteId, sectionId) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? {
          ...quote,
          sections: quote.sections.filter((section) => section.id !== sectionId),
          lines: quote.lines.map((line) => line.sectionId === sectionId ? { ...line, sectionId: undefined } : line),
          updatedAt: timestamp,
        }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  setCustomerColumns: (quoteId, patch) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, customerColumns: { ...quote.customerColumns, ...patch }, updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  recordSent: (quoteId) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => {
      if (quote.id !== quoteId) return quote;
      const sentQuote = { ...quote, status: 'Sent' as const, sentAt: timestamp, updatedAt: timestamp };
      const alreadyCaptured = quote.history.some((item) => item.revision === quote.revision);
      return {
        ...sentQuote,
        history: alreadyCaptured ? quote.history : [...quote.history, snapshot(sentQuote, 'Sent')],
      };
    });
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  createRevision: (quoteId) => {
    const timestamp = now();
    const date = localDateKey();
    const quotes = get().quotes.map((quote) => {
      if (quote.id !== quoteId) return quote;
      const alreadyCaptured = quote.history.some((item) => item.revision === quote.revision);
      const history = alreadyCaptured ? quote.history : [...quote.history, snapshot(quote)];
      return {
        ...quote,
        revision: quote.revision + 1,
        revisionLabel: '',
        quoteDate: date,
        status: 'Draft' as const,
        history,
        sentAt: undefined,
        viewedAt: undefined,
        signedAt: undefined,
        updatedAt: timestamp,
      };
    });
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },
}));
