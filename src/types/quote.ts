import type {
  RateBookCategory,
  RateBookDivision,
  RateBookPricingBehavior,
  RateBookUnit,
} from './rateBook';
import type {
  SinkCategory,
  SinkConfiguration,
  SinkMountType,
} from './sink';

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
export type PricingMaterialType =
  | 'Granite'
  | 'Quartzite'
  | 'Marble'
  | 'Dolomite'
  | 'Soapstone'
  | 'Onyx'
  | 'Travertine'
  | 'Limestone'
  | 'Natural Stone'
  | 'Quartz'
  | 'Sintered Stone'
  | 'Porcelain'
  | 'Solid Surface'
  | 'Terrazzo'
  | 'Other';
export type PricingDetailsLayout = 'inline' | 'list';

export type QuoteLineKind = 'item' | 'material' | 'sink' | 'rate' | 'allowance' | 'discount' | 'tax' | 'note' | 'scope' | 'warranty';
export type QuotePricingMode = 'direct' | 'quantity-rate' | 'slab-multiplier' | 'none';

export interface QuoteCustomerColumns {
  quantity: boolean;
  rate: boolean;
  lineAmount: boolean;
}

export const QUOTE_AREA_SCOPE_FIELDS = [
  'countertopSf',
  'splashLf',
  'fullHeightSplashSf',
  'kitchenSinkCount',
  'vanitySinkCount',
  'cutoutCount',
] as const;
export type QuoteAreaScopeField = (typeof QUOTE_AREA_SCOPE_FIELDS)[number];

/** A rectangular countertop piece measured in inches; future CAD Lite can map here. */
export interface QuoteTakeoffPiece {
  id: string;
  name: string;
  lengthIn?: number;
  widthIn?: number;
  count: number;
  backsplash?: boolean;
  leftSplash?: boolean;
  rightSplash?: boolean;
  /** Optional per-piece fabricated backsplash height; defaults to 4 inches. */
  splashHeightIn?: number;
  /** Optional fabrication edge selection; defaults to Flat. */
  edgeProfile?: string;
}

export interface QuoteTakeoffSink {
  id: string;
  category: SinkCategory;
  name: string;
  count: number;
  /** Optional private supplier cost per sink (overrides catalog cost). */
  internalCostOverride?: number;
  /** Optional sell price per sink, not cost. */
  unitPrice?: number;
  /** Legacy catalog compatibility flag. New mobile Beta sinks always receive a priced quote line. */
  includeInPricing: boolean;
  /** Nine optional faucet drilling locations at 2-inch intervals relative to center, -8 through +8. */
  faucetHoleOffsetsIn?: number[];
  /** Snapshot of a Catalog sink model + variant at selection time. */
  sinkReference?: QuoteLineSinkReference;
}

export interface QuoteProjectMaterial {
  id: string;
  label: string;
  reference?: QuoteLineMaterialReference;
}
export interface QuoteAreaScope {
  /** Optional Takeoffs Lite measurements. Presence means Takeoffs Lite owns countertopSf. */
  takeoffPieces?: QuoteTakeoffPiece[];
  /** Internal takeoff breakdown; countertopSf below is tops + 4-inch splash. */
  takeoffTopSf?: number;
  takeoffSplashSf?: number;
  /** Label shown in the customer's consolidated area description. */
  takeoffMaterial?: string;
  /** Catalog material + variant and source-cost snapshot, when chosen. */
  takeoffMaterialReference?: QuoteLineMaterialReference;
  takeoffSinks?: QuoteTakeoffSink[];
  /** Default for newly added pieces; individually overridden pieces keep their own choices. */
  takeoffDefaultSplashHeightIn?: number;
  takeoffDefaultEdgeProfile?: string;
  /** Fraction of slab surface expected to be usable; 0.65 by default. */
  slabYield?: number;
  /** Optional manually adjusted whole-slab purchase count. */
  slabCountOverride?: number;
  /** Optional fractional physical slabs purchased for internal costs. Does not affect the whole-slab selling calculator. */
  slabPurchaseQuantityOverride?: number;
  /** Optional private work costs, entered as totals for this Area. */
  shopCostOverride?: number;
  installCostOverride?: number;
  /** Optional per-measured-SF internal shop and installation assumptions. */
  shopCostRateSf?: number;
  installCostRateSf?: number;
  /** Target project gross margin, stored as a fraction (0.25 = 25%). */
  targetMargin?: number;
  /** Explicit shop slab size and buying cost when the catalog lacks them. */
  slabAreaOverrideSf?: number;
  slabCostOverride?: number;
  /** In Takeoffs Lite, the combined top + checked 4-inch splash material SF. */
  countertopSf?: number;
  /** Retained separately for optional splash labor/linear-foot estimating. */
  splashLf?: number;
  fullHeightSplashSf?: number;
  kitchenSinkCount?: number;
  vanitySinkCount?: number;
  cutoutCount?: number;
}

export type QuoteSectionCustomerDisplay = 'detail' | 'summary';

export interface QuoteSection {
  id: string;
  title: string;
  customerVisible: boolean;
  customerDisplayMode?: QuoteSectionCustomerDisplay;
  scope?: QuoteAreaScope;
}

export interface QuoteMaterialCostSnapshot {
  capturedAt: string;
  materialId: string;
  materialName: string;
  brand?: string;
  supplier?: string;
  materialFamily?: string;
  materialType: PricingMaterialType;
  stockProgram: boolean;
  variantId?: string;
  variantLabel?: string;
  thickness?: string;
  finish?: string;
  formatName?: string;
  formatKind?: string;
  lengthIn?: number;
  widthIn?: number;
  areaSf?: number;
  availability?: string;
  purchaseOptionId?: string;
  purchaseOptionLabel?: string;
  purchaseMinQuantity?: number;
  pricingBasis?: string;
  costPerSf?: number;
  slabCost?: number;
  sourcePublicationId?: string;
  sourcePriceListLabel?: string;
  sourceEffectiveDate?: string;
  sourceFileName?: string;
  sourcePageSheet?: string;
  sourceReference?: string;
  sourceRecordedAt?: string;
  sourceProvenance?: string;
}

export interface QuoteRateSnapshot {
  capturedAt: string;
  rateBookItemId: string;
  category: RateBookCategory;
  name: string;
  code?: string;
  unit: RateBookUnit;
  pricingBehavior: RateBookPricingBehavior;
  pricingDivision?: RateBookDivision;
  internalCost?: number;
  sellRate?: number;
  effectiveDate?: string;
  notes?: string;
  sourceUpdatedAt?: string;
}

export interface QuoteLineRateReference {
  rateBookItemId?: string;
  snapshot?: QuoteRateSnapshot;
}

export interface QuoteSinkSnapshot {
  capturedAt: string;
  sinkModelId: string;
  sinkModelName: string;
  modelCode?: string;
  brand?: string;
  supplier?: string;
  category: SinkCategory;
  widthIn?: number;
  depthIn?: number;
  mountType?: SinkMountType;
  material?: string;
  variantId: string;
  variantLabel: string;
  variantCode?: string;
  configuration: SinkConfiguration;
  ada: boolean;
  internalCost?: number;
  sellPrice?: number;
  effectiveDate?: string;
  sourceUpdatedAt?: string;
}

export interface QuoteLineSinkReference {
  sinkModelId?: string;
  variantId?: string;
  snapshot?: QuoteSinkSnapshot;
}

export interface QuoteLineMaterialReference {
  materialId?: string;
  customMaterialName?: string;
  variantId?: string;
  purchaseOptionId?: string;
  stockProgram: boolean;
  pricingSource: 'stock-level' | 'non-stock-stock-equivalent' | 'non-stock-guide' | 'suggested-level' | 'manual-line-rate' | 'slab-multiplier';
  sourceCostPerSf?: number;
  guideRate?: number;
  stockEquivalentLevel?: string;
  sourceSlabCost?: number;
  catalogSlabCost?: number;
  slabCostOverride?: boolean;
  slabMultiplier?: number;
  slabCount?: number;
  customerPricePerSlab?: number;
  snapshot?: QuoteMaterialCostSnapshot;
}

export interface QuoteLineQuantitySource {
  kind: 'area-scope';
  sectionId: string;
  field: QuoteAreaScopeField;
  capturedValue: number;
  appliedAt: string;
  /** Explicit live link to Takeoffs Lite; legacy captures stay snapshots. */
  syncMode?: 'live';
}

export interface QuoteLine {
  id: string;
  sectionId?: string;
  kind: QuoteLineKind;
  description: string;
  pricingMode: QuotePricingMode;
  quantity?: number;
  quantitySource?: QuoteLineQuantitySource;
  rate?: number;
  amount?: number;
  internalCost?: number;
  customerVisible: boolean;
  includeInTotal: boolean;
  materialReference?: QuoteLineMaterialReference;
  sinkReference?: QuoteLineSinkReference;
  /** Links a sink price row managed by Area Takeoffs Lite. */
  takeoffSinkId?: string;
  rateReference?: QuoteLineRateReference;
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

/**
 * D.R. Horton-style contract schedules have base and option price rows, not
 * necessarily additive upgrades. Source columns are preserved for XLSX export.
 */
export const PRICING_CONTRACT_RATE_KEYS = [
  'corbels','kitchenSinks','graniteKitchenSf','quartzKitchenSf','bathSf','bathBowls',
  'graniteBathSf','quartzBathSf','kitchenSplashSf','bathSplashSf',
] as const;
export type PricingContractRateKey = typeof PRICING_CONTRACT_RATE_KEYS[number];
export type PricingContractQuantities = Partial<Record<PricingContractRateKey,number>>;
/** Reusable manual matrix metadata. Actual package prices live in contractRows. */
export interface PricingManualPlan {
  id: string;
  series: string;
  planNumber: string;
  name: string;
  excludedPackageIds?: string[];
}
export interface PricingManualPackage {
  id: string;
  code: string;
  name: string;
  description?: string;
}
export interface PricingManualAddon {
  id: string;
  code: string;
  name: string;
  description?: string;
  unit: 'flat' | 'each' | 'sf';
  /** Increment means additional charge; standalone is a replacement price. */
  behavior: 'increment' | 'standalone';
  defaultRate?: number;
  planRates?: Record<string, number>;
  excludedPlanIds?: string[];
}
export interface PricingContractRow {
  id: string;
  /** Stable manual matrix relationships; source-imported rows may omit these. */
  manualPlanId?: string;
  manualPackageId?: string;
  series: string;
  itemType: 'Base' | 'Option';
  planNumber: string;
  planName: string;
  optionCode: string;
  description: string;
  /** Explicit contract price is authoritative when priceMode is manual. */
  customerPrice?: number;
  priceMode: 'manual' | 'calculated';
  /** Negative quantity in a replacement option is scope metadata, not an automatic discount. */
  quantities: PricingContractQuantities;
  sourceRow?: number;
  /** Original A:AJ cells, retained for detailed builder-takeoff export. */
  sourceCells?: Array<string | number | null>;
  /** Upgrade row can replace an item; a base option price is not always additive. */
  optionBehavior?: 'standalone' | 'increment';
}
export interface PricingScheduleBuilderData {
  outputMode?: 'matrix' | 'contract';
  manualPlans?: PricingManualPlan[];
  manualPackages?: PricingManualPackage[];
  manualAddons?: PricingManualAddon[];
  contractRows?: PricingContractRow[];
  contractRates?: PricingContractQuantities;
  sourceContractFile?: string;
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
  /** Quote-scoped material shortlist, pinned for quoting any Area. */
  projectMaterials?: QuoteProjectMaterial[];
  attachSelectionsSheet?: boolean;
  customerColumns: QuoteCustomerColumns;
  customerNotes: string;
  pricingSchedule?: PricingScheduleData;
  customerTotal: number;
}

export interface Quote {
  /** Quote-scoped pinned material picks; never company-global. */
  projectMaterials?: QuoteProjectMaterial[];
  /** Explicit opt-in to attach a sanitized customer-facing selections appendix. */
  attachSelectionsSheet?: boolean;
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
  /** Responsible salesperson; absent on legacy unassigned documents. */
  ownerUserId?: string;
  /** Organization-scoped reporting group IDs, separate from pricingDivision. */
  divisionId?: string;
  teamId?: string;
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
  | 'attachSelectionsSheet'
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

export function quoteLineAmount(line: QuoteLine) {
  if (line.pricingMode === 'none') return 0;
  const raw = line.pricingMode === 'quantity-rate'
    ? (line.quantity ?? 0) * (line.rate ?? 0)
    : (line.amount ?? 0);
  const signed = line.kind === 'discount' ? -Math.abs(raw) : raw;
  return roundCurrency(signed);
}

export function quoteLineTotal(line: QuoteLine) {
  if (!line.includeInTotal) return 0;
  return quoteLineAmount(line);
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
