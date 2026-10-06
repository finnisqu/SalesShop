import {
  displayQuoteNumber,
  quoteTotal,
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
  return {
    quoteId: quote.id,
    quoteNumber: displayQuoteNumber(quote),
    documentType: quote.documentType,
    parentQuoteId: quote.parentQuoteId,
    changeOrderNumber: quote.changeOrderNumber,
    revision: quote.revision,
    revisionLabel: quote.revisionLabel,
    quoteDate: quote.quoteDate,
    title: quote.title,
    projectId: quote.projectId,
    companyId: quote.companyId,
    companyName: quote.companyName,
    contactId: quote.contactId,
    contactName: quote.contactName,
    contactEmail: quote.contactEmail,
    address: quote.address,
    sections: structuredClone(quote.sections.filter((section) => section.customerVisible)),
    lines: structuredClone(quote.lines.filter((line) => line.customerVisible)),
    customerColumns: { ...quote.customerColumns },
    customerNotes: quote.customerNotes,
    pricingSchedule: quote.documentType === 'pricing-schedule'
      ? { customerItems: structuredClone(quote.pricingSchedule?.customerItems ?? []) }
      : undefined,
    acceptedTotal: quoteTotal(quote),
  };
}
