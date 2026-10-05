export const QUOTE_STATUSES = ['Draft', 'Ready', 'Sent', 'Viewed', 'Signed', 'Declined', 'Expired'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type QuoteLineKind = 'item' | 'allowance' | 'discount' | 'tax' | 'note' | 'scope' | 'warranty';
export type QuotePricingMode = 'direct' | 'quantity-rate' | 'none';

export interface QuoteCustomerColumns {
  quantity: boolean;
  rate: boolean;
  lineAmount: boolean;
}

export interface QuoteSection {
  id: string;
  title: string;
  customerVisible: boolean;
}

export interface QuoteLine {
  id: string;
  sectionId?: string;
  kind: QuoteLineKind;
  description: string;
  pricingMode: QuotePricingMode;
  quantity?: number;
  rate?: number;
  amount?: number;
  customerVisible: boolean;
  includeInTotal: boolean;
}

export interface QuoteRevisionSnapshot {
  revision: number;
  label?: string;
  quoteDate: string;
  capturedAt: string;
  status: QuoteStatus;
  title: string;
  projectId?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
  sections: QuoteSection[];
  lines: QuoteLine[];
  customerColumns: QuoteCustomerColumns;
  customerNotes: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  originalQuoteDate: string;
  quoteDate: string;
  revision: number;
  revisionLabel?: string;
  status: QuoteStatus;
  title: string;
  projectId?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
  sections: QuoteSection[];
  lines: QuoteLine[];
  customerColumns: QuoteCustomerColumns;
  customerNotes: string;
  internalNotes: string;
  history: QuoteRevisionSnapshot[];
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDocument {
  schemaVersion: 1;
  quotes: Quote[];
  activeQuoteId: string | null;
}

export type QuotePatch = Partial<Pick<Quote,
  | 'title'
  | 'projectId'
  | 'companyName'
  | 'contactName'
  | 'contactEmail'
  | 'address'
  | 'quoteDate'
  | 'revisionLabel'
  | 'status'
  | 'customerNotes'
  | 'internalNotes'
>>;

export function quoteLineTotal(line: QuoteLine) {
  if (!line.includeInTotal || line.pricingMode === 'none') return 0;
  const raw = line.pricingMode === 'quantity-rate'
    ? (line.quantity ?? 0) * (line.rate ?? 0)
    : (line.amount ?? 0);
  return line.kind === 'discount' ? -Math.abs(raw) : raw;
}

export function quoteTotal(quote: Quote) {
  return quote.lines.reduce((total, line) => total + quoteLineTotal(line), 0);
}

export function displayQuoteNumber(quote: Quote) {
  return quote.revision > 0 ? `${quote.quoteNumber}-R${quote.revision}` : quote.quoteNumber;
}
