import type { StockMaterial } from './settings';

export type SupplierImportStatus = 'new' | 'changed' | 'unchanged' | 'possible-duplicate';
export type SupplierImportConfidence = 'high' | 'medium' | 'low';
export type SupplierImportReviewDecision = 'pending' | 'approved' | 'needs-review' | 'ignored';
export type SupplierImportPriceProvenance = 'supplier-listed' | 'derived-from-listed-unit' | 'manual';

export interface SupplierImportSource {
  parserId: string;
  parserVersion: number;
  supplier: string;
  brand: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  importedAt: string;
  priceListLabel?: string;
  effectiveDate?: string;
  supplierRules: string[];
  rulesReferenceOnly?: boolean;
}

export interface SupplierImportPriceEvidence {
  optionId: string;
  effectiveCostPerSf: SupplierImportPriceProvenance;
  costPerSfListed: boolean;
  costPerUnitListed: boolean;
  note: string;
  supplier?: string;
  brand?: string;
  sourceFileName?: string;
  sourcePageSheet?: string;
  sourceReference?: string;
  priceListLabel?: string;
  effectiveDate?: string;
}

export interface SupplierImportCandidate {
  id: string;
  material: StockMaterial;
  status: SupplierImportStatus;
  confidence: SupplierImportConfidence;
  existingMaterialId?: string;
  matchBasis?: 'sku' | 'variant-sku' | 'identity' | 'name';
  changeSummary: string[];
  warnings: string[];
  reviewDecision?: SupplierImportReviewDecision;
  attentionReasons?: string[];
  variantDecisions?: Record<string, SupplierImportReviewDecision>;
  priceDecisions?: Record<string, SupplierImportReviewDecision>;
  priceEvidence?: Record<string, SupplierImportPriceEvidence>;
  reviewNote?: string;
}

export interface SupplierImportPublication {
  id: string;
  publishedAt: string;
  publishedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  ignoredCount: number;
}

export interface SupplierImportSession {
  schemaVersion: 2;
  id: string;
  createdAt: string;
  source: SupplierImportSource;
  candidates: SupplierImportCandidate[];
  publication?: SupplierImportPublication;
}


export type SupplierImportMappingField =
  | 'name'
  | 'sku'
  | 'supplierGroup'
  | 'thickness'
  | 'finish'
  | 'formatName'
  | 'lengthIn'
  | 'widthIn'
  | 'areaSf'
  | 'purchaseLabel'
  | 'minQuantity'
  | 'costPerSf'
  | 'costPerUnit'
  | 'availability'
  | 'availabilityNote';

export type SupplierImportRegionKind = 'tabular' | 'grouped-price-matrix' | 'record-block' | 'unknown';

export interface SupplierImportDetectedRegion {
  id: string;
  label: string;
  kind: SupplierImportRegionKind;
  confidence: SupplierImportConfidence;
  rangeA1: string;
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  headerRow?: number;
  notes: string[];
}

export interface SupplierImportStructuredPreview {
  fileName: string;
  fileType: 'csv' | 'xlsx';
  sheetName?: string;
  sheetNames: string[];
  headers: string[];
  rows: string[][];
  totalRows: number;
  sourceRows: string[][];
  sourceRowCount: number;
  sourceColumnCount: number;
  detectedRegions: SupplierImportDetectedRegion[];
}

export interface SupplierImportMappingDraft {
  supplier: string;
  brand: string;
  materialType: StockMaterial['materialType'];
  sourceFileType: 'csv' | 'xlsx';
  sheetName?: string;
  sourceRangeA1?: string;
  regionKind?: SupplierImportRegionKind;
  columns: Partial<Record<SupplierImportMappingField, string>>;
  defaults: {
    thickness?: string;
    finish?: string;
    formatName?: string;
    purchaseLabel?: string;
  };
}

export interface SupplierImportProfile {
  id: string;
  label: string;
  supplier?: string;
  brand?: string;
  materialType?: StockMaterial['materialType'];
  parserId: string;
  fileTypeLabel: string;
  accept: string;
  description: string;
  supportsEffectiveDateOverride?: boolean;
}

export interface SupplierImportParserContext {
  catalog: StockMaterial[];
  effectiveDate?: string;
}

export interface SupplierImportParser {
  id: string;
  version: number;
  label: string;
  explicitListingsOnly: true;
  accepts: (file: File) => boolean;
  stage: (file: File, context: SupplierImportParserContext) => Promise<SupplierImportSession>;
}
