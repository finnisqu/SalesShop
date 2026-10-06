import type { RateBookDivision, RateBookPricingBehavior } from './rateBook';

export const QUOTE_STATUSES = ['Draft', 'Ready', 'Sent', 'Viewed', 'Signed', 'Declined', 'Expired'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const COMMERCIAL_DOCUMENT_TYPES = ['quote', 'pricing-schedule', 'change-order'] as const;
export type CommercialDocumentType = (typeof COMMERCIAL_DOCUMENT_TYPES)[number];

export const PRICING_SCHEDULE_FIELDS = [
  'series',
  'itemType',
  'planNumber',
  'planName',
  'optionCode',
  'description',
  'customerPrice',
] as const;
export type PricingScheduleField = (typeof PRICING_SCHEDULE_FIELDS)[number];

export const PRICING_BUILDER_PRODUCT_TYPES = [
  'Countertops',
  'Backsplash',
  'Kitchen Sink',
  'Vanity Sink',
  'Support',
  'Other',
] as const;
export type PricingBuilderProductType = (typeof PRICING_BUILDER_PRODUCT_TYPES)[number];
export type PricingBuilderUnit = 'sf' | 'each' | 'flat';
export type PricingScheduleRoute = 'rate-sheet' | 'plan-builder' | 'workbook';
export type PricingSchedulePublishSource = 'rate-sheet' | 'builder' | 'workbook';
export type PricingRateKind = 'material-level' | 'add-on';
export type PricingRatePriceMode = 'priced' | 'included' | 'no-charge' | 'tbd';
export type PricingMaterialType = 'Granite' | 'Quartz' | 'Marble' | 'Quartzite' | 'Porcelain' | 'Solid Surface' | 'Other';
export type PricingDetailsLayout = 'inline' | 'list';

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
  kind: QuoteLineKind;
  description: string;
  sectionId?: string;
  pricingMode: QuotePricingMode;
  amount?: number;
  quantity?: number;
  rate?: number;
  customerVisible: boolean;
  includeInTotal: boolean;
}

export interface QuoteHistoryItem {
  revision: number;
  label?: string;
  status: QuoteStatus;
  quoteDate: string;
  capturedAt: string;
}

export interface PricingRateItem {
  id: string;
  kind: PricingRateKind;
  label: string;
  materialType?: PricingMaterialType;
  level?: string;
  colors?: string[];
  detailsLayout?: PricingDetailsLayout;
  unit: PricingBuilderUnit;
  rate?: number;
  priceMode?: PricingRatePriceMode;
  customerVisible: boolean;
  sourceRateBookItemId?: string;
  sourcePricingBehavior?: RateBookPricingBehavior;
  sourceInternalCost?: number;
}

export interface PricingScheduleBuilderRow {
  id: string;
  productType: PricingBuilderProductType;
  description: string;
  materialType?: PricingMaterialType;
  materialLevel?: string;
  quantity?: number;
  unit: PricingBuilderUnit;
  rate?: number;
  customerPrice?: number;
  customerVisible: boolean;
}

export interface PricingScheduleBuilderData {
  rates: PricingRateItem[];
  rows: PricingScheduleBuilderRow[];
}

export interface PricingScheduleCustomerItem {
  id: string;
  series?: string;
  itemType?: string;
  planNumber?: string;
  planName?: string;
  optionCode?: string;
  description?: string;
  customerPrice?: number;
}

export interface PricingScheduleData {
  id: string;
  route: PricingScheduleRoute;
  publishSource: PricingSchedulePublishSource;
  customerItems: PricingScheduleCustomerItem[];
  builder: PricingScheduleBuilderData;
  workbook?: {
    columns: string[];
    rows: Array<Record<string, string | number | boolean | null>>;
    fieldMap: Partial<Record<PricingScheduleField, string>>;
  };
}

export interface Quote {
  id: string;
  organizationId?: string;
  quoteNumber: string;
  revision: number;
  revisionLabel?: string;
  parentQuoteId?: string;
  documentType: CommercialDocumentType;
  title: string;
  status: QuoteStatus;
  quoteDate: string;
  companyId?: string;
  contactId?: string;
  projectId?: string;
  companyName?: string;
  contactName?: string;
  address?: string;
  customerNotes: string;
  internalNotes: string;
  customerColumns: QuoteCustomerColumns;
  sections: QuoteSection[];
  lines: QuoteLine[];
  history: QuoteHistoryItem[];
  pricingSchedule?: PricingScheduleData;
  createdAt: string;
  updatedAt: string;
}

export function quoteLineTotal(line: QuoteLine): number {
  if (!line.includeInTotal || line.pricingMode === 'none') return 0;
  if (line.pricingMode === 'quantity-rate') return (line.quantity ?? 0) * (line.rate ?? 0);
  return line.amount ?? 0;
}

export function quoteTotal(quote: Quote): number {
  return quote.lines.reduce((total, line) => total + quoteLineTotal(line), 0);
}

export function commercialDocumentLabel(quote: Pick<Quote, 'documentType'>): string {
  if (quote.documentType === 'pricing-schedule') return 'Pricing Schedule';
  if (quote.documentType === 'change-order') return 'Change Order';
  return 'Quote';
}

export function displayQuoteNumber(quote: Pick<Quote, 'quoteNumber' | 'revision'>): string {
  return quote.revision > 0 ? `${quote.quoteNumber}-R${quote.revision}` : quote.quoteNumber;
}
