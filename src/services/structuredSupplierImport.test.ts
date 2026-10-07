import { describe, expect, it } from 'vitest';
import {
  structuredPreviewFromCsvText,
  suggestSupplierImportMapping,
} from './structuredSupplierImport';

describe('structured supplier import mapping', () => {
  it('reads quoted CSV rows without losing embedded commas', () => {
    const preview = structuredPreviewFromCsvText(
      'Color,SKU,Price per SF,Notes\n"Calacatta, Gold",CG100,18.25,"Bundle, stocked"\nAkoya,BQ8583,14.5,Standard',
      'supplier.csv',
    );

    expect(preview.headers).toEqual(['Color', 'SKU', 'Price per SF', 'Notes']);
    expect(preview.totalRows).toBe(2);
    expect(preview.rows[0]).toEqual(['Calacatta, Gold', 'CG100', '18.25', 'Bundle, stocked']);
  });

  it('suggests high-confidence SalesShop mappings from common supplier headers', () => {
    const mapping = suggestSupplierImportMapping([
      'Color Name',
      'Color Code',
      'Thickness',
      'Finish',
      'Slab Length',
      'Slab Width',
      'Price per SF',
      'Price per Slab',
      'Minimum Qty',
    ]);

    expect(mapping).toMatchObject({
      name: 'Color Name',
      sku: 'Color Code',
      thickness: 'Thickness',
      finish: 'Finish',
      lengthIn: 'Slab Length',
      widthIn: 'Slab Width',
      costPerSf: 'Price per SF',
      costPerUnit: 'Price per Slab',
      minQuantity: 'Minimum Qty',
    });
  });

  it('does not reuse one source column for two mapped fields', () => {
    const mapping = suggestSupplierImportMapping(['Color', 'Price', 'Group']);
    const used = Object.values(mapping).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
    expect(mapping.name).toBe('Color');
    expect(mapping.supplierGroup).toBe('Group');
  });
});
