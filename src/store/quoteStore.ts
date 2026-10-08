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
  canPermanentlyDeleteQuote,
  createQuoteRevisionSnapshot,
  quoteCanCreateRevision,
  quoteIsCommerciallyEditable,
  sanitizeQuotePatchForStatus,
} from '../services/quoteIntegrity';
import {
  deleteNormalizedQuote,
  deleteNormalizedQuoteLine,
  deleteNormalizedQuoteSection,
  syncNormalizedQuotes,
} from '../services/normalizedQuoteSync';
import { validatePricingScheduleForSend } from '../services/pricingSchedule';
import { relinkQuotesForCompany, relinkQuotesForContact } from '../services/crmIdentity';
import {
  isDraftQuoteNumber,
  type Quote,
  type QuoteCustomerColumns,
  type QuoteDocument,
  type QuoteLine,
  type QuoteLineKind,
  type QuotePatch,
  type QuoteSection,
  type QuoteStatus,
} from '../types/quote';
import type { Company, Contact } from '../types/crm';
import { useAuthStore } from './authStore';

interface QuoteState {
  quotes: Quote[];
  activeQuoteId: string | null;
  recentCatalogInsert: { quoteId: string; lineId: string } | null;
  clearCatalogInsert: () => void;
  hydrated: boolean;
  undoStacks: Record<string, Quote[]>;
  redoStacks: Record<string, Quote[]>;
  hydrate: () => void;
  createQuote: (prefill?: Partial<Pick<Quote, 'documentType' | 'title' | 'projectId' | 'companyId' | 'companyName' | 'contactId' | 'contactName' | 'contactEmail'>>) => string;
  createChangeOrder: (sourceQuoteId: string) => string | null;
  selectQuote: (quoteId: string) => void;
  updateQuote: (quoteId: string, patch: QuotePatch) => void;
  deleteQuote: (quoteId: string) => void;
  restoreQuote: (quoteId: string) => void;
  touchQuote: (quoteId: string) => void;
  relinkCompanyIdentity: (primary: Pick<Company, 'id' | 'name'>, duplicateId: string) => void;
  relinkContactIdentity: (primary: Pick<Contact, 'id' | 'name' | 'email'>, duplicateId: string) => void;
  linkQuoteCompany: (quoteId: string, company: Pick<Company, 'id' | 'name'>) => void;
  linkQuoteContact: (quoteId: string, contact: Pick<Contact, 'id' | 'name' | 'email'>) => void;
  addLine: (quoteId: string, kind?: QuoteLineKind, sectionId?: string) => string;
  addCatalogLine: (quoteId: string, kind: 'material' | 'sink' | 'rate', patch: Partial<Omit<QuoteLine, 'id'>>) => string;
  updateLine: (quoteId: string, lineId: string, patch: Partial<Omit<QuoteLine, 'id'>>) => void;
  deleteLine: (quoteId: string, lineId: string) => void;
  addSection: (quoteId: string) => string;
  updateSection: (quoteId: string, sectionId: string, patch: Partial<Omit<QuoteSection, 'id'>>) => void;
  reorderSection: (quoteId: string, sectionId: string, targetSectionId: string) => void;
  deleteSection: (quoteId: string, sectionId: string) => void;
  setCustomerColumns: (quoteId: string, patch: Partial<QuoteCustomerColumns>) => void;
  recordSent: (quoteId: string) => Promise<void>;
  createRevision: (quoteId: string) => void;
  undoQuote: (quoteId: string) => void;
  redoQuote: (quoteId: string) => void;
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
    material: 'Select material',
    sink: 'Select sink',
    rate: 'Select rate',
    allowance: 'Allowance',
    discount: 'Discount',
    tax: 'Taxes',
    note: 'Customer note',
    scope: 'Scope',
    warranty: 'Warranty',
  };
  const materialKind = kind === 'material';
  const sinkKind = kind === 'sink';
  const rateKind = kind === 'rate';
  return {
    id: uid('line'),
    sectionId,
    kind,
    description: labels[kind],
    pricingMode: textKind ? 'none' : materialKind || sinkKind || rateKind ? 'quantity-rate' : 'direct',
    quantity: sinkKind ? 1 : undefined,
    rate: undefined,
    amount: textKind || materialKind || sinkKind || rateKind ? undefined : 0,
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

const QUOTE_HISTORY_LIMIT = 50;

function historyPatch(state: Pick<QuoteState, 'undoStacks' | 'redoStacks'>, quoteId: string, current: Quote) {
  return {
    undoStacks: {
      ...state.undoStacks,
      [quoteId]: [...(state.undoStacks[quoteId] ?? []), structuredClone(current)].slice(-QUOTE_HISTORY_LIMIT),
    },
    redoStacks: {
      ...state.redoStacks,
      [quoteId]: [],
    },
  };
}

async function reconcileQuoteSnapshotInCloud(current: Quote, target: Quote, document: QuoteDocument) {
  const organizationId = cloudOrganizationId();
  if (!organizationId) return;
  const targetLineIds = new Set(target.lines.map((line) => line.id));
  const targetSectionIds = new Set(target.sections.map((section) => section.id));
  await Promise.all([
    ...current.lines.filter((line) => !targetLineIds.has(line.id))
      .map((line) => deleteNormalizedQuoteLine(organizationId, line.id)),
    ...current.sections.filter((section) => !targetSectionIds.has(section.id))
      .map((section) => deleteNormalizedQuoteSection(organizationId, section.id)),
  ]);
  await syncNormalizedQuotes(organizationId, document);
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
  recentCatalogInsert: null,
  clearCatalogInsert: () => set({ recentCatalogInsert: null }),
  hydrated: false,
  undoStacks: {},
  redoStacks: {},

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

    const safePatch = sanitizeQuotePatchForStatus(current, patch);
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

    const history = historyPatch(get(), quoteId, current);
    const quotes = get().quotes.map((quote) => quote.id === quoteId ? updated : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });

    if (Object.prototype.hasOwnProperty.call(safePatch, 'projectId') && safePatch.projectId && safePatch.projectId !== current.projectId) {
      recordQuoteLinked(updated);
    }
  },

  deleteQuote: (quoteId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current) return;

    if (!canPermanentlyDeleteQuote(current, get().quotes)) {
      const timestamp = now();
      const quotes = get().quotes.map((quote) => quote.id === quoteId
        ? { ...quote, archivedAt: timestamp, updatedAt: timestamp }
        : quote);
      const visible = quotes.find((quote) => !quote.archivedAt && quote.id !== quoteId);
      const activeQuoteId = get().activeQuoteId === quoteId ? (visible?.id ?? quoteId) : get().activeQuoteId;
      persist(quotes, activeQuoteId);
      set({ quotes, activeQuoteId });
      return;
    }

    const organizationId = cloudOrganizationId();
    let quotes = get().quotes.filter((quote) => quote.id !== quoteId);
    if (!quotes.length) quotes = [newQuote()];
    const activeQuoteId = get().activeQuoteId === quoteId ? quotes[0].id : get().activeQuoteId;
    persist(quotes, activeQuoteId);
    set({ quotes, activeQuoteId });
    if (organizationId) void deleteNormalizedQuote(organizationId, quoteId).catch(reportCloudDeleteError);
  },

  restoreQuote: (quoteId) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, archivedAt: undefined, updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  touchQuote: (quoteId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current) return;
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId ? { ...quote, updatedAt: timestamp } : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  relinkCompanyIdentity: (primary, duplicateId) => {
    const timestamp = now();
    const quotes = relinkQuotesForCompany(get().quotes, { ...primary, kind: 'customer', createdAt: timestamp, updatedAt: timestamp }, duplicateId, timestamp);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  relinkContactIdentity: (primary, duplicateId) => {
    const timestamp = now();
    const quotes = relinkQuotesForContact(get().quotes, { ...primary, createdAt: timestamp, updatedAt: timestamp }, duplicateId, timestamp);
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  linkQuoteCompany: (quoteId, company) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => {
      if (quote.id !== quoteId) return quote;
      const editable = !quote.archivedAt && (quote.status === 'Draft' || quote.status === 'Ready');
      return {
        ...quote,
        companyId: company.id,
        companyName: editable ? company.name : quote.companyName,
        updatedAt: timestamp,
      };
    });
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  linkQuoteContact: (quoteId, contact) => {
    const timestamp = now();
    const quotes = get().quotes.map((quote) => {
      if (quote.id !== quoteId) return quote;
      const editable = !quote.archivedAt && (quote.status === 'Draft' || quote.status === 'Ready');
      return {
        ...quote,
        contactId: contact.id,
        contactName: editable ? contact.name : quote.contactName,
        contactEmail: editable ? (contact.email ?? quote.contactEmail) : quote.contactEmail,
        updatedAt: timestamp,
      };
    });
    persist(quotes, get().activeQuoteId);
    set({ quotes });
  },

  addLine: (quoteId, kind = 'item', sectionId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current)) return '';
    const line = newLine(kind, sectionId);
    const history = historyPatch(get(), quoteId, current);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, lines: [...quote.lines, line], updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });
    return line.id;
  },

  addCatalogLine: (quoteId, kind, patch) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current) || current.documentType === 'pricing-schedule') return '';
    const line: QuoteLine = { ...newLine(kind), ...patch, kind };
    const timestamp = now();
    const history = historyPatch(get(), quoteId, current);
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, lines: [...quote.lines, line], updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history, recentCatalogInsert: { quoteId, lineId: line.id } });
    return line.id;
  },

  updateLine: (quoteId, lineId, patch) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current)) return;
    const history = historyPatch(get(), quoteId, current);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? {
          ...quote,
          lines: quote.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line),
          updatedAt: timestamp,
        }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });
  },

  deleteLine: (quoteId, lineId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current)) return;
    const organizationId = cloudOrganizationId();
    const history = historyPatch(get(), quoteId, current);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, lines: quote.lines.filter((line) => line.id !== lineId), updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });
    if (organizationId) void deleteNormalizedQuoteLine(organizationId, lineId).catch(reportCloudDeleteError);
  },

  addSection: (quoteId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current)) return '';
    const section: QuoteSection = { id: uid('section'), title: 'New area', customerVisible: true, customerDisplayMode: 'detail' };
    const history = historyPatch(get(), quoteId, current);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, sections: [...quote.sections, section], updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });
    return section.id;
  },

  updateSection: (quoteId, sectionId, patch) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current)) return;
    const history = historyPatch(get(), quoteId, current);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? {
          ...quote,
          sections: quote.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section),
          updatedAt: timestamp,
        }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });
  },

  reorderSection: (quoteId, sectionId, targetSectionId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current) || sectionId === targetSectionId) return;
    const sections = [...current.sections];
    const fromIndex = sections.findIndex((section) => section.id === sectionId);
    const targetIndex = sections.findIndex((section) => section.id === targetSectionId);
    if (fromIndex < 0 || targetIndex < 0) return;
    const [moved] = sections.splice(fromIndex, 1);
    if (!moved) return;
    sections.splice(targetIndex, 0, moved);
    const history = historyPatch(get(), quoteId, current);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, sections, updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });
  },

  deleteSection: (quoteId, sectionId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current)) return;
    const organizationId = cloudOrganizationId();
    const history = historyPatch(get(), quoteId, current);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? {
          ...quote,
          sections: quote.sections.filter((section) => section.id !== sectionId),
          lines: quote.lines.map((line) => line.sectionId === sectionId ? { ...line, sectionId: undefined, quantitySource: undefined } : line),
          updatedAt: timestamp,
        }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });
    if (organizationId) void deleteNormalizedQuoteSection(organizationId, sectionId).catch(reportCloudDeleteError);
  },

  setCustomerColumns: (quoteId, patch) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    if (!current || !quoteIsCommerciallyEditable(current)) return;
    const history = historyPatch(get(), quoteId, current);
    const timestamp = now();
    const quotes = get().quotes.map((quote) => quote.id === quoteId
      ? { ...quote, customerColumns: { ...quote.customerColumns, ...patch }, updatedAt: timestamp }
      : quote);
    persist(quotes, get().activeQuoteId);
    set({ quotes, ...history });
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
      history: alreadyCaptured ? current.history : [...current.history, createQuoteRevisionSnapshot(sentQuote, timestamp, 'Sent')],
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
    if (!quoteCanCreateRevision(current)) return;
    const alreadyCaptured = current.history.some((item) => item.revision === current.revision);
    const history = alreadyCaptured ? current.history : [...current.history, createQuoteRevisionSnapshot(current, timestamp)];
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

  undoQuote: (quoteId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    const past = get().undoStacks[quoteId] ?? [];
    const targetSnapshot = past.at(-1);
    if (!current || !targetSnapshot || !quoteIsCommerciallyEditable(current)) return;

    const target: Quote = { ...structuredClone(targetSnapshot), updatedAt: now() };
    const quotes = get().quotes.map((quote) => quote.id === quoteId ? target : quote);
    const undoStacks = { ...get().undoStacks, [quoteId]: past.slice(0, -1) };
    const redoStacks = {
      ...get().redoStacks,
      [quoteId]: [...(get().redoStacks[quoteId] ?? []), structuredClone(current)].slice(-QUOTE_HISTORY_LIMIT),
    };
    persist(quotes, get().activeQuoteId);
    set({ quotes, undoStacks, redoStacks });
    void reconcileQuoteSnapshotInCloud(current, target, {
      schemaVersion: 2,
      quotes,
      activeQuoteId: get().activeQuoteId,
    }).catch(reportCloudDeleteError);
  },

  redoQuote: (quoteId) => {
    const current = get().quotes.find((quote) => quote.id === quoteId);
    const future = get().redoStacks[quoteId] ?? [];
    const targetSnapshot = future.at(-1);
    if (!current || !targetSnapshot || !quoteIsCommerciallyEditable(current)) return;

    const target: Quote = { ...structuredClone(targetSnapshot), updatedAt: now() };
    const quotes = get().quotes.map((quote) => quote.id === quoteId ? target : quote);
    const redoStacks = { ...get().redoStacks, [quoteId]: future.slice(0, -1) };
    const undoStacks = {
      ...get().undoStacks,
      [quoteId]: [...(get().undoStacks[quoteId] ?? []), structuredClone(current)].slice(-QUOTE_HISTORY_LIMIT),
    };
    persist(quotes, get().activeQuoteId);
    set({ quotes, undoStacks, redoStacks });
    void reconcileQuoteSnapshotInCloud(current, target, {
      schemaVersion: 2,
      quotes,
      activeQuoteId: get().activeQuoteId,
    }).catch(reportCloudDeleteError);
  },
}));