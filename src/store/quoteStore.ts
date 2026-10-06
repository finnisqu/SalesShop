import { create } from 'zustand';
import { localQuoteRepository } from '../data/quoteRepository';
import { supabase } from '../lib/supabase';
import {
  applyQuoteSent,
  applyQuoteStatusChange,
  recordQuoteCreated,
  recordQuoteLinked,
  recordRevisionCreated,
} from '../services/quoteCrmService';
import {
  deleteNormalizedQuote,
  deleteNormalizedQuoteLine,
  deleteNormalizedQuoteSection,
  syncNormalizedQuotes,
} from '../services/normalizedQuoteSync';
import { validatePricingScheduleForSend } from '../services/pricingSchedule';
import {
  isDraftQuoteNumber,
  type Quote,
  type QuoteCustomerColumns,
  type QuoteDocument,
  type QuoteLine,
  type QuoteLineKind,
  type QuotePatch,
  type QuoteRevisionSnapshot,
  type QuoteSection,
  type QuoteStatus,
} from '../types/quote';
import { useAuthStore } from './authStore';

interface QuoteState {
  quotes: Quote[];
  activeQuoteId: string | null;
  hydrated: boolean;
  hydrate: () => void;
  createQuote: (prefill?: Partial<Pick<Quote, 'documentType' | 'title' | 'projectId' | 'companyId' | 'companyName' | 'contactId' | 'contactName' | 'contactEmail'>>) => string;
  createChangeOrder: (sourceQuoteId: string) => string | null;
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
  recordSent: (quoteId: string) => Promise<void>;
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

function cloudOrganizationId() {
  const auth = useAuthStore.getState();
  return supabase && auth.mode === 'cloud' ? auth.organizationId : null;
}

function reportCloudDeleteError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Cloud delete failed.';
  useAuthStore.setState({ error: `Cloud sync: ${message}` });
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

function newQuote(prefill: Partial<Pick<Quote, 'documentType' | 'title' | 'projectId' | 'companyId' | 'companyName' | 'contactId' | 'contactName' | 'contactEmail'>> = {}): Quote {
  const timestamp = now();
  const date = localDateKey();
  const id = uid('quote');
  return {
    id,
    quoteNumber: `DRAFT-${id}`,
    documentType: prefill.documentType ?? 'quote',
    originalQuoteDate: date,
    quoteDate: date,
    revision: 0,
    status: 'Draft',
    title: prefill.title?.trim() || 'Untitled quote',
    projectId: prefill.projectId,
    companyId: prefill.companyId,
    companyName: prefill.companyName,
    contactId: prefill.contactId,
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
  const quote = newQuote({ title: 'Blue Jay Park', companyName: 'BAR Construction' });
  quote.lines = [
    { ...newLine('item'), description: 'Quartz countertops', amount: 14500 },
    { ...newLine('scope'), description: 'Includes standard fabrication and installation.' },
  ];
  quote.customerNotes = 'Final material selection and field measurements to be confirmed before production.';
  return { schemaVersion: 2, quotes: [quote], activeQuoteId: quote.id };
}

function persist(quotes: Quote[], activeQuoteId: string | null) {
  localQuoteRepository.save({ schemaVersion: 2, quotes, activeQuoteId });
}

function snapshot(quote: Quote, status: QuoteStatus = quote.status): QuoteRevisionSnapshot {
  return {
    revision: quote.revision,
    label: quote.revisionLabel,
    quoteDate: quote.quoteDate,
    capturedAt: now(),
    status,
    documentType: quote.documentType,
    parentQuoteId: quote.parentQuoteId,
    changeOrderNumber: quote.changeOrderNumber,
    title: quote.title,
    projectId: quote.projectId,
    companyId: quote.companyId,
    companyName: quote.companyName,
    contactId: quote.contactId,
    contactName: quote.contactName,
    contactEmail: quote.contactEmail,
    address: quote.address,
    sections: structuredClone(quote.sections),
    lines: structuredClone(quote.lines),
    customerColumns: { ...quote.customerColumns },
    customerNotes: quote.customerNotes,
    pricingSchedule: quote.pricingSchedule ? structuredClone(quote.pricingSchedule) : undefined,
  };
}

function localBaseNumber(quotes: Quote[], date: string) {
  const prefix = `Q-${date.replaceAll('-', '')}-`;
  const max = quotes.reduce((highest, quote) => {
    if (quote.documentType === 'change-order' || !quote.quoteNumber.startsWith(prefix)) return highest;
    const match = quote.quoteNumber.match(/^Q-\d{8}-(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function localCommercialIdentity(quote: Quote, quotes: Quote[]) {
  if (!isDraftQuoteNumber(quote.quoteNumber)) {
    return { quoteNumber: quote.quoteNumber, changeOrderNumber: quote.changeOrderNumber };
  }

  if (quote.documentType === 'change-order') {
    const parent = quote.parentQuoteId ? quotes.find((candidate) => candidate.id === quote.parentQuoteId) : undefined;
    if (!parent || isDraftQuoteNumber(parent.quoteNumber)) {
      throw new Error('The original agreement must be sent before its Change Order can be sent.');
    }
    const next = quotes.reduce((highest, candidate) => candidate.parentQuoteId === parent.id
      ? Math.max(highest, candidate.changeOrderNumber ?? 0)
      : highest, 0) + 1;
    return { quoteNumber: `${parent.quoteNumber}-CO${String(next).padStart(2, '0')}`, changeOrderNumber: next };
  }

  return { quoteNumber: localBaseNumber(quotes, localDateKey()), changeOrderNumber: undefined };
}

async function assignCommercialIdentity(quote: Quote, document: QuoteDocument) {
  if (!isDraftQuoteNumber(quote.quoteNumber)) {
    return { quoteNumber: quote.quoteNumber, changeOrderNumber: quote.changeOrderNumber };
  }

  const auth = useAuthStore.getState();
  if (!supabase || auth.mode !== 'cloud' || !auth.organizationId) {
    return localCommercialIdentity(quote, document.quotes);
  }

  // Ensure this draft and its parent relationship exist before the atomic allocator runs.
  await syncNormalizedQuotes(auth.organizationId, document);
  const { data, error } = await supabase.rpc('assign_commercial_document_number', {
    p_organization_id: auth.organizationId,
    p_quote_id: quote.id,
  });
  if (error) throw error;
  const result = data as { quote_number?: unknown; change_order_number?: unknown } | null;
  const quoteNumber = result?.quote_number ? String(result.quote_number) : '';
  if (!quoteNumber) throw new Error('SalesShop could not assign an official document number.');
  const changeOrderNumber = result?.change_order_number === null || result?.change_order_number === undefined
    ? undefined
    : Number(result.change_order_number);
  return { quoteNumber, changeOrderNumber };
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
    const quote = newQuote(prefill);
    const quotes = [quote, ...get().quotes];
    persist(quotes, quote.id);
    set({ quotes, activeQuoteId: quote.id });
    recordQuoteCreated(quote);
    if (quote.projectId) recordQuoteLinked(quote);
    return quote.id;
  },

  createChangeOrder: (sourceQuoteId) => {
    const source = get().quotes.find((quote) => quote.id === sourceQuoteId);
    if (!source) return null;
    const parentId = source.documentType === 'change-order' ? source.parentQuoteId : source.id;
    const parent = parentId ? get().quotes.find((quote) => quote.id === parentId) : undefined;
    if (!parent || parent.status !== 'Signed') return null;

    const changeOrder = newQuote({
      documentType: 'change-order',
      title: `${parent.title} · Change Order`,
      projectId: parent.projectId,
      companyId: parent.companyId,
      companyName: parent.companyName,
      contactId: parent.contactId,
      contactName: parent.contactName,
      contactEmail: parent.contactEmail,
    });
    changeOrder.parentQuoteId = parent.id;
    changeOrder.address = parent.address;
    changeOrder.lines = [{ ...newLine('item'), description: 'Change order scope' }];

    const quotes = [changeOrder, ...get().quotes];
    persist(quotes, changeOrder.id);
    set({ quotes, activeQuoteId: changeOrder.id });
    recordQuoteCreated(changeOrder);
    return changeOrder.id;
  },

  selectQuote: (activeQuoteId) => {
    persist(get().quotes, activeQuoteId);
    set({ activeQuoteId });
  },

  updateQuote: (quoteId, patch) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current) return;

    if (patch.status === 'Sent' && current.status !== 'Sent') {
      void get().recordSent(quoteId);
      return;
    }

    const safePatch = { ...patch };
    if (safePatch.documentType && ((current.status !== 'Draft' && current.status !== 'Ready') || current.documentType === 'change-order')) {
      safePatch.documentType = current.documentType;
    }

    const timestamp = now();
    let updated: Quote = {
      ...current,
      ...safePatch,
      title: safePatch.title !== undefined ? safePatch.title : current.title,
      updatedAt: timestamp,
    };

    if (safePatch.status && safePatch.status !== current.status) {
      if (safePatch.status === 'Viewed') updated = { ...updated, viewedAt: timestamp };
      if (safePatch.status === 'Signed') updated = { ...updated, signedAt: timestamp };
      const identity = applyQuoteStatusChange(updated, current.status);
      updated = { ...updated, ...identity };
    }

    const quotes = get().quotes.map((quote) => quote.id === quoteId ? updated : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });

    if (Object.prototype.hasOwnProperty.call(safePatch, 'projectId') && safePatch.projectId && safePatch.projectId !== current.projectId) {
      recordQuoteLinked(updated);
    }
  },

  deleteQuote: (quoteId) => {
    if (get().quotes.some((quote) => quote.parentQuoteId === quoteId)) return;
    const organizationId = cloudOrganizationId();
    let quotes = get().quotes.filter((quote) => quote.id !== quoteId);
    if (!quotes.length) quotes = [newQuote()];
    const activeQuoteId = get().activeQuoteId === quoteId ? quotes[0].id : get().activeQuoteId;
    persist(quotes, activeQuoteId);
    set({ quotes, activeQuoteId });
    if (organizationId) void deleteNormalizedQuote(organizationId, quoteId).catch(reportCloudDeleteError);
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
    const organizationId = cloudOrganizationId();
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, lines: quote.lines.filter((line) => line.id !== lineId), updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
    if (organizationId) void deleteNormalizedQuoteLine(organizationId, lineId).catch(reportCloudDeleteError);
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
    const organizationId = cloudOrganizationId();
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
    if (organizationId) void deleteNormalizedQuoteSection(organizationId, sectionId).catch(reportCloudDeleteError);
  },

  setCustomerColumns: (quoteId, patch) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, customerColumns: { ...quote.customerColumns, ...patch }, updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  recordSent: async (quoteId) => {
    const initial = get().quotes.find((quote) => quote.id === quoteId);
    if (!initial || (initial.status !== 'Draft' && initial.status !== 'Ready')) return;
    if (initial.documentType === 'pricing-schedule') validatePricingScheduleForSend(initial.pricingSchedule);

    const identity = await assignCommercialIdentity(initial, {
      schemaVersion: 2,
      quotes: get().quotes,
      activeQuoteId: get().activeQuoteId,
    });

    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || (current.status !== 'Draft' && current.status !== 'Ready')) return;

    const timestamp = now();
    let sentQuote: Quote = {
      ...current,
      quoteNumber: identity.quoteNumber,
      changeOrderNumber: identity.changeOrderNumber,
      status: 'Sent',
      sentAt: timestamp,
      updatedAt: timestamp,
    };
    const crmIdentity = applyQuoteSent(sentQuote);
    sentQuote = { ...sentQuote, ...crmIdentity };
    const alreadyCaptured = current.history.some((item) => item.revision === current.revision);
    sentQuote = {
      ...sentQuote,
      history: alreadyCaptured ? current.history : [...current.history, snapshot(sentQuote, 'Sent')],
    };
    const quotes = get().quotes.map((quote) => quote.id === quoteId ? sentQuote : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });

    const auth = useAuthStore.getState();
    if (supabase && auth.mode === 'cloud' && auth.organizationId) {
      await syncNormalizedQuotes(auth.organizationId, {
        schemaVersion: 2,
        quotes,
        activeQuoteId: get().activeQuoteId,
      });
    }
  },

  createRevision: (quoteId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current) return;
    const timestamp = now();
    const date = localDateKey();
    const alreadyCaptured = current.history.some((item) => item.revision === current.revision);
    const history = alreadyCaptured ? current.history : [...current.history, snapshot(current)];
    const revised: Quote = {
      ...current,
      revision: current.revision + 1,
      revisionLabel: '',
      quoteDate: date,
      status: 'Draft',
      history,
      sentAt: undefined,
      viewedAt: undefined,
      signedAt: undefined,
      updatedAt: timestamp,
    };
    const quotes = get().quotes.map((quote) => quote.id === quoteId ? revised : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
    recordRevisionCreated(revised);
  },
}));