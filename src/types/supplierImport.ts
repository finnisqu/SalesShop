import type { StockMaterial } from './settings';

export type SupplierImportStatus = 'new' | 'changed' | 'unchanged' | 'possible-duplicate';
export type SupplierImportConfidence = 'high' | 'medium' | 'low';

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
}

export interface SupplierImportSession {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  source: SupplierImportSource;
  candidates: SupplierImportCandidate[];
}
