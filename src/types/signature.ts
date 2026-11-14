import {customerReceiptLines,customerReceiptScheduleItems,customerReceiptSections} from '../services/quoteCustomerReceipt';
import {
  displayQuoteNumber,
  quoteLinesTotal,
  type CommercialDocumentType,
  type PricingScheduleItem,
  type Quote,
  type QuoteCustomerColumns,
  type QuoteLine,
  type QuoteSection,
} from './quote';

export type SignatureMethod = 'drawn' | 'typed';

export interface SignaturePoint {
  x: number;
  y: number;
}

export interface SignatureStroke {
  id: string;
  points: SignaturePoint[];
}

export interface AcceptedQuoteSnapshot {
  quoteId: string;
  quoteNumber: string;
  documentType?: CommercialDocumentType;
  parentQuoteId?: string;
  changeOrderNumber?: number;
  revision: number;
  revisionLabel?: string;
  quoteDate: string;
  title: string;
  projectId?: string;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
  sections: QuoteSection[];
  lines: QuoteLine[];
  customerColumns: QuoteCustomerColumns;
  customerNotes: string;
  pricingSchedule?: { customerItems: PricingScheduleItem[] };
  acceptedTotal: number;
}

export interface SignatureRecord {
  id: string;
  quoteId: string;
  projectId?: string;
  companyId?: string;
  contactId?: string;
  quoteNumber: string;
  revision: number;
  signerName: string;
  signerEmail?: string;
  method: SignatureMethod;
  signatureText?: string;
  strokes: SignatureStroke[];
  consentText: string;
  acceptedAt: string;
  acceptedSnapshot: AcceptedQuoteSnapshot;
}

export interface SignatureDocument {
  schemaVersion: 1;
  signatures: SignatureRecord[];
}

export interface SignatureInput {
  signerName: string;
  signerEmail?: string;
  method: SignatureMethod;
  signatureText?: string;
  strokes?: SignatureStroke[];
  consentText: string;
}

export function buildAcceptedQuoteSnapshot(quote: Quote): AcceptedQuoteSnapshot {
  const frozen = quote.history.find((revision) => revision.revision === quote.revision);
  // After issuance, an absent optional field means ABSENT. Never fill it from
  // later unapproved Quote state (not even for legacy frozen revisions).
  const source = frozen ?? quote;
  const documentType = frozen ? (frozen.documentType ?? 'quote') : quote.documentType;
  const sections = source.sections;
  const lines = source.lines;
  const customerColumns = source.customerColumns;
  const scheduleItems = source.pricingSchedule?.customerItems ?? [];

  return {
    quoteId: quote.id,
    quoteNumber: displayQuoteNumber({
      quoteNumber: quote.quoteNumber, documentType, revision: source.revision,
    }),
    documentType,
    parentQuoteId: source.parentQuoteId,
    changeOrderNumber: source.changeOrderNumber,
    revision: source.revision,
    revisionLabel: frozen ? frozen.label : quote.revisionLabel,
    quoteDate: source.quoteDate,
    title: source.title,
    projectId: source.projectId,
    companyId: source.companyId,
    companyName: source.companyName,
    contactId: source.contactId,
    contactName: source.contactName,
    contactEmail: source.contactEmail,
    address: source.address,
    // Only persist approved public fields; never serialize supplier references
    // or imported spreadsheet metadata in the signed receipt.
    sections: customerReceiptSections(sections),
    lines: customerReceiptLines(lines,sections),
    customerColumns: {quantity:customerColumns.quantity,rate:customerColumns.rate,
      lineAmount:customerColumns.lineAmount},
    customerNotes: source.customerNotes,
    pricingSchedule: documentType === 'pricing-schedule'
      ? { customerItems: customerReceiptScheduleItems(scheduleItems) }
      : undefined,
    acceptedTotal: frozen && Number.isFinite(frozen.customerTotal)
      ? frozen.customerTotal : quoteLinesTotal(lines),
  };
}
