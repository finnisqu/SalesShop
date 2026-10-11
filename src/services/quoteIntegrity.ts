import {
  isDraftQuoteNumber,
  quoteTotal,
  type Quote,
  type QuotePatch,
  type QuoteRevisionSnapshot,
  type QuoteStatus,
} from '../types/quote';

const CUSTOMER_PATCH_KEYS = [
  'documentType',
  'title',
  'projectId',
  'companyId',
  'companyName',
  'contactId',
  'contactName',
  'contactEmail',
  'address',
  'pricingDivision',
  'quoteDate',
  'revisionLabel',
  'lines',
  'customerNotes',
  'pricingSchedule',
] as const satisfies readonly (keyof QuotePatch)[];

export function quoteIsCommerciallyEditable(quote: Pick<Quote, 'status' | 'archivedAt'>) {
  return !quote.archivedAt && (quote.status === 'Draft' || quote.status === 'Ready');
}

export function sanitizeQuotePatchForStatus(
  quote: Pick<Quote, 'status' | 'archivedAt'>,
  patch: QuotePatch,
): QuotePatch {
  if (quoteIsCommerciallyEditable(quote)) return patch;

  const safe: QuotePatch = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) safe.status = patch.status;
  if (Object.prototype.hasOwnProperty.call(patch, 'internalNotes')) safe.internalNotes = patch.internalNotes;

  CUSTOMER_PATCH_KEYS.forEach((key) => {
    void key;
  });
  return safe;
}

export function createQuoteRevisionSnapshot(
  quote: Quote,
  capturedAt: string,
  status: QuoteStatus = quote.status,
): QuoteRevisionSnapshot {
  return {
    revision: quote.revision,
    label: quote.revisionLabel,
    quoteDate: quote.quoteDate,
    capturedAt,
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
    pricingDivision: quote.pricingDivision,
    sections: structuredClone(quote.sections),
    lines: structuredClone(quote.lines),
    customerColumns: { ...quote.customerColumns },
    customerNotes: quote.customerNotes,
    pricingSchedule: quote.pricingSchedule ? structuredClone(quote.pricingSchedule) : undefined,
    customerTotal: quoteTotal(quote),
  };
}

export function canPermanentlyDeleteQuote(quote: Quote, allQuotes: Quote[]) {
  if (!quoteIsCommerciallyEditable(quote)) return false;
  if (!isDraftQuoteNumber(quote.quoteNumber)) return false;
  if (quote.history.length > 0) return false;
  if (allQuotes.some((candidate) => candidate.parentQuoteId === quote.id)) return false;
  return true;
}

export function quoteCanCreateRevision(quote: Pick<Quote, 'status'>) {
  return quote.status === 'Sent'
    || quote.status === 'Viewed'
    || quote.status === 'Declined'
    || quote.status === 'Expired';
}
