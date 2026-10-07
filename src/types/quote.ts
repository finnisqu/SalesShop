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

export interface QuoteLineMaterialReference {
  materialId: string;
  variantId?: string;
  purchaseOptionId?: string;
  stockProgram: boolean;
  pricingSource: 'stock-level' | 'non-stock-stock-equivalent' | 'non-stock-guide' | 'suggested-level' | 'slab-multiplier';
  sourceCostPerSf?: number;
  guideRate?: number;
  stockEquivalentLevel?: string;
  sourceSlabCost?: number;
  slabMultiplier?: number;
  slabCount?: number;
  customerPricePerSlab?: number;
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
  materialReference?: QuoteLineMaterialReference;
}

export type PricingScheduleColumnMapping = Partial<Record<PricingScheduleField, number>>;

export interface PricingScheduleMapping {
  sheetId: string;
  headerRow: number;
  firstDataRow: number;
  lastDataRow?: number;
  columns: PricingScheduleColumnMapping;
}

export interface PricingScheduleItem {
  sourceRow: number;
  series?: string;
  itemType?: string;
  planNumber?: string;
  planName?: string;
  optionCode?: string;
  description?: string;
  customerPrice?: number;
  displayType?: 'schedule-item' | 'rate-level' | 'rate-add-on';
  groupLabel?: string;
  priceLabel?: string;
  unitLabel?: string;
  colors?: string[];
  details?: string[];
  detailsLayout?: PricingDetailsLayout;
}

export interface PricingRateItem {
  id: string;
  productType: PricingBuilderProductType;
  name: string;
  unit: PricingBuilderUnit;
  rate?: number;
  kind?: PricingRateKind;
  materialType?: PricingMaterialType;
  level?: string;
  description?: string;
  colors?: string[];
  colorsText?: string;
  colorIds?: string[];
  priceMode?: PricingRatePriceMode;
  customerVisible?: boolean;
  showLevelOnCustomer?: boolean;
  detailsLayout?: PricingDetailsLayout;
  sourceRateBookItemId?: string;
  sourceRateBookEffectiveDate?: string;
  sourcePricingBehavior?: RateBookPricingBehavior;
  pricingDivision?: RateBookDivision;
  internalCost?: number;
  suggestedRate?: number;
}

export interface PricingOptionRule {
  id: string;
  scope: string;
  productType: PricingBuilderProductType;
  rateItemId: string;
}

export interface PricingOptionPackage {
  id: string;
  code: string;
  name: string;
  description?: string;
  isBase?: boolean;
  flatAdjustment?: number;
  rules: PricingOptionRule[];
}

export interface PricingPlan {
  id: string;
  series?: string;
  planNumber: string;
  name: string;
  description?: string;
  notes?: string;
  excludedOptionIds?: string[];
}

export interface PricingPlanTakeoff {
  id: string;
  planId: string;
  room: string;
  piece?: string;
  length?: number;
  width?: number;
  squareFeet?: number;
  kitchenSinks?: number;
  vanityBowls?: number;
  supports?: number;
}

export interface PricingScheduleBuilderData {
  rateBookName: string;
  rates: PricingRateItem[];
  options: PricingOptionPackage[];
  plans: PricingPlan[];
  takeoffs: PricingPlanTakeoff[];
}

export interface PricingScheduleData {
  route?: PricingScheduleRoute;
  publishSource?: PricingSchedulePublishSource;
  builder?: PricingScheduleBuilderData;
  workbookData?: unknown;
  mapping?: PricingScheduleMapping;
  customerItems: PricingScheduleItem[];
  sourceFileName?: string;
  importedAt?: string;
}

export interface QuoteRevisionSnapshot {
  revision: number;
  label?: string;
  quoteDate: string;
  capturedAt: string;
  status: QuoteStatus;
  documentType?: CommercialDocumentType;
  parentQuoteId?: string;
  changeOrderNumber?: number;
  title: string;
  projectId?: string;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
  pricingDivision?: RateBookDivision;
  sections: QuoteSection[];
  lines: QuoteLine[];
  customerColumns: QuoteCustomerColumns;
  customerNotes: string;
  pricingSchedule?: PricingScheduleData;
  customerTotal: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  documentType: CommercialDocumentType;
  parentQuoteId?: string;
  changeOrderNumber?: number;
  originalQuoteDate: string;
  quoteDate: string;
  revision: number;
  revisionLabel?: string;
  status: QuoteStatus;
  title: string;
  projectId?: string;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
  pricingDivision?: RateBookDivision;
  sections: QuoteSection[];
  lines: QuoteLine[];
  customerColumns: QuoteCustomerColumns;
  customerNotes: string;
  internalNotes: string;
  pricingSchedule?: PricingScheduleData;
  history: QuoteRevisionSnapshot[];
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDocument {
  schemaVersion: 2;
  quotes: Quote[];
  activeQuoteId: string | null;
}

export type QuotePatch = Partial<Pick<Quote,
  | 'documentType'
  | 'title'
  | 'projectId'
  | 'companyId'
  | 'companyName'
  | 'contactId'
  | 'contactName'
  | 'contactEmail'
  | 'address'
  | 'pricingDivision'
  | 'quoteDate'
  | 'revisionLabel'
  | 'status'
  | 'lines'
  | 'customerNotes'
  | 'internalNotes'
  | 'pricingSchedule'
>>;

export function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
  return value < 0 ? -magnitude : magnitude;
}

export function quoteLineTotal(line: QuoteLine) {
  if (!line.includeInTotal || line.pricingMode === 'none') return 0;
  const raw = line.pricingMode === 'quantity-rate'
    ? (line.quantity ?? 0) * (line.rate ?? 0)
    : (line.amount ?? 0);
  const signed = line.kind === 'discount' ? -Math.abs(raw) : raw;
  return roundCurrency(signed);
}

export function quoteLinesTotal(lines: QuoteLine[]) {
  return roundCurrency(lines.reduce((total, line) => total + quoteLineTotal(line), 0));
}

export function quoteTotal(quote: Quote) {
  return quoteLinesTotal(quote.lines);
}

export function isDraftQuoteNumber(value: string) {
  return value.startsWith('DRAFT-');
}

export function commercialDocumentLabel(document: Pick<Quote, 'documentType'>) {
  if (document.documentType === 'pricing-schedule') return 'Pricing Schedule';
  if (document.documentType === 'change-order') return 'Change Order';
  return 'Quote';
}

export function displayQuoteNumber(quote: Pick<Quote, 'quoteNumber' | 'revision' | 'documentType'>) {
  if (isDraftQuoteNumber(quote.quoteNumber)) return `${commercialDocumentLabel(quote)} Draft`;
  return quote.revision > 0 ? `${quote.quoteNumber}-R${quote.revision}` : quote.quoteNumber;
}
