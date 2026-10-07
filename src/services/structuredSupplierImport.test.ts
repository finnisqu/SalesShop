import { describe, expect, it } from 'vitest';
import {
  detectStructuredSupplierRegions,
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

  it('detects grouped pricing plus parallel material blocks without treating metadata as headers', () => {
    const rows = Array.from({ length: 42 }, () => Array.from({ length: 16 }, () => ''));
    rows[10][3] = '2CM';
    rows[10][4] = '3CM';
    rows[10][5] = '128X65';
    rows[10][6] = '126x63';
    rows[10][7] = '127x64';
    rows[10][8] = '130x65';
    rows[10][9] = '123x60';
    rows[10][10] = 'Jumbo';

    rows[12][0] = 'GROUP 0';
    rows[12][3] = '8.50';
    rows[12][4] = '9.50';
    for (let row = 13; row <= 17; row += 1) {
      rows[row][1] = `Quartz Color ${row}`;
      rows[row][7] = 'X';
      rows[row][12] = `Side Quartz ${row} 1.5CM`;
      rows[row][13] = `QSL-COLOR-${row}`;
      rows[row][14] = '127x64';
      rows[row][15] = '6.50';
    }

    rows[21][15] = '3CM';
    rows[22][0] = 'GROUP 1';
    rows[22][3] = '10.50';
    rows[22][4] = '11.95';
    for (let row = 23; row <= 29; row += 1) {
      rows[row][1] = `Quartz Group 1 Color ${row}`;
      rows[row][8] = 'X';
      rows[row][13] = `Granite Color ${row}`;
      rows[row][14] = `RSL-GRANITE-${row}`;
      rows[row][15] = '7.95';
    }

    rows[31][0] = 'GROUP 2';
    rows[31][3] = '12.00';
    rows[31][4] = '14.00';
    rows[32][1] = 'Quartz Group 2 Color';
    rows[32][10] = '139x80';
    rows[37][1] = 'Active specialty color';
    rows[39][1] = 'DISCONTINUED COLORS - confirm before selling';

    const regions = detectStructuredSupplierRegions(rows);

    expect(regions.map((region) => [region.label, region.rangeA1, region.kind])).toEqual([
      ['Main grouped price matrix', 'A11:K38', 'grouped-price-matrix'],
      ['1.5cm material table', 'M13:P18', 'record-block'],
      ['3cm material table', 'N22:P30', 'record-block'],
    ]);
    expect(regions[0].notes.join(' ')).toMatch(/inherit/i);
  });
});
