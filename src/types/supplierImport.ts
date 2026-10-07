import type { StockMaterial } from './settings';

export type SupplierImportStatus = 'new' | 'changed' | 'unchanged' | 'possible-duplicate';
export type SupplierImportConfidence = 'high' | 'medium' | 'low';
export type SupplierImportReviewDecision = 'pending' | 'approved' | 'needs-review' | 'ignored';
export type SupplierImportPriceProvenance = 'supplier-listed' | 'derived-from-listed-unit';

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
}

export interface SupplierImportCandidate {
  id: string;
  material: StockMaterial;
  status: SupplierImportStatus;
  confidence: SupplierImportConfidence;
  existingMaterialId?: string;
  matchBasis?: 'sku' | 'variant-sku' | 'name';
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


export interface SupplierImportProfile {
  id: string;
  label: string;
  supplier: string;
  brand: string;
  materialType: StockMaterial['materialType'];
  parserId: string;
  fileTypeLabel: string;
  accept: string;
  description: string;
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
