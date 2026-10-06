import {
  displayQuoteNumber,
  quoteLineTotal,
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
  const documentType = frozen?.documentType ?? quote.documentType;
  const sections = frozen?.sections ?? quote.sections;
  const lines = frozen?.lines ?? quote.lines;
  const customerColumns = frozen?.customerColumns ?? quote.customerColumns;
  const customerNotes = frozen?.customerNotes ?? quote.customerNotes;
  const scheduleItems = frozen?.pricingSchedule?.customerItems ?? quote.pricingSchedule?.customerItems ?? [];

  return {
    quoteId: quote.id,
    quoteNumber: displayQuoteNumber(quote),
    documentType,
    parentQuoteId: frozen?.parentQuoteId ?? quote.parentQuoteId,
    changeOrderNumber: frozen?.changeOrderNumber ?? quote.changeOrderNumber,
    revision: frozen?.revision ?? quote.revision,
    revisionLabel: frozen?.label ?? quote.revisionLabel,
    quoteDate: frozen?.quoteDate ?? quote.quoteDate,
    title: frozen?.title ?? quote.title,
    projectId: frozen?.projectId ?? quote.projectId,
    companyId: frozen?.companyId ?? quote.companyId,
    companyName: frozen?.companyName ?? quote.companyName,
    contactId: frozen?.contactId ?? quote.contactId,
    contactName: frozen?.contactName ?? quote.contactName,
    contactEmail: frozen?.contactEmail ?? quote.contactEmail,
    address: frozen?.address ?? quote.address,
    sections: structuredClone(sections.filter((section) => section.customerVisible)),
    lines: structuredClone(lines.filter((line) => line.customerVisible)),
    customerColumns: { ...customerColumns },
    customerNotes,
    pricingSchedule: documentType === 'pricing-schedule'
      ? { customerItems: structuredClone(scheduleItems) }
      : undefined,
    acceptedTotal: lines.reduce((total, line) => total + quoteLineTotal(line), 0),
  };
}
