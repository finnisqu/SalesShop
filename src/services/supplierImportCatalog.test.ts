import { describe, expect, it } from 'vitest';
import type { StockMaterial } from '../types/settings';
import type { SupplierImportCandidate, SupplierImportSession } from '../types/supplierImport';
import {
  assertSupplierImportPublishable,
  buildSupplierImportPublishPlan,
  validateStagedAgainstCatalog,
} from './supplierImportCatalog';
import { getSupplierImportParser } from './supplierImportParsers';
import { VICOSTONE_PARSER_ID } from './vicostoneSupplierImport';

const publishedAt = '2026-10-06T21:30:00.000Z';
let idCounter = 0;
const idFactory = (prefix: string) => `${prefix}_test_${++idCounter}`;

function material(overrides: Partial<StockMaterial> = {}): StockMaterial {
  return {
    id: 'staged-1',
    name: 'Arctic White',
    supplier: 'UMI',
    brand: 'Vicostone',
    supplierGroup: 'Group 1',
    sku: 'BQ100',
    materialType: 'Quartz',
    stockProgram: false,
    unit: 'sf',
    active: true,
    features: [],
    variants: [{
      id: 'variant-new',
      active: true,
      default: true,
      sku: 'BQ100',
      thickness: '3cm',
      finish: 'Polished',
      formatName: 'Jumbo',
      formatKind: 'slab',
      lengthIn: 65,
      widthIn: 130,
      areaSf: 58.68,
      features: [],
      purchaseOptions: [{
        id: 'price-new',
        label: 'Standard',
        active: true,
        default: true,
        pricingBasis: 'slab',
        costPerSf: 12.8,
        costPerUnit: 751.1,
      }],
    }],
    ...overrides,
  };
}

function candidate(overrides: Partial<SupplierImportCandidate> = {}): SupplierImportCandidate {
  return {
    id: 'candidate-1',
    material: material(),
    status: 'new',
    confidence: 'high',
    changeSummary: ['New supplier catalog color'],
    warnings: [],
    reviewDecision: 'approved',
    ...overrides,
  };
}

function session(candidates: SupplierImportCandidate[], overrides: Partial<SupplierImportSession> = {}): SupplierImportSession {
  return {
    schemaVersion: 2,
    id: 'session-1',
    createdAt: publishedAt,
    source: {
      parserId: VICOSTONE_PARSER_ID,
      parserVersion: 2,
      supplier: 'UMI',
      brand: 'Vicostone',
      fileName: 'vicostone.pdf',
      fileSize: 1234,
      pageCount: 2,
      importedAt: publishedAt,
      priceListLabel: 'July 2026',
      supplierRules: ['Special-order honed or brushed finish adds $2.00/SF.'],
      rulesReferenceOnly: true,
    },
    candidates,
    ...overrides,
  };
}

describe('supplier import publishing policy', () => {
  it('publishes a new supplier color as Non-stock and does not invent rule-derived variants', () => {
    idCounter = 0;
    const input = session([candidate()]);
    const plan = buildSupplierImportPublishPlan(input, [], {
      publicationId: 'publication-1',
      publishedAt,
      idFactory,
    });

    expect(plan.summary).toEqual({
      publishedCount: 1,
      newCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      ignoredCount: 0,
    });

    const published = plan.stockMaterials[0];
    expect(published.stockProgram).toBe(false);
    expect(published.builderLevelId).toBeUndefined();
    expect(published.variants).toHaveLength(1);
    expect(published.variants?.[0].finish).toBe('Polished');
    expect(plan.auditChanges).toHaveLength(1);
  });

  it('preserves management-owned fields and missing existing specs while updating supplier pricing', () => {
    idCounter = 0;
    const existing: StockMaterial = material({
      id: 'catalog-1',
      stockProgram: true,
      builderLevelId: 'level-1',
      slabImageUrl: 'https://example.com/slab.jpg',
      closeUpImageUrl: 'https://example.com/close.jpg',
      productUrl: 'https://example.com/product',
      notes: 'Management note',
      internalCost: 9.5,
      variants: [
        {
          id: 'variant-existing',
          active: true,
          default: true,
          sku: 'BQ100',
          thickness: '3cm',
          finish: 'Polished',
          formatName: 'Jumbo',
          formatKind: 'slab',
          lengthIn: 65,
          widthIn: 130,
          areaSf: 58.68,
          features: [],
          purchaseOptions: [{
            id: 'price-existing',
            label: 'Standard',
            active: true,
            default: true,
            pricingBasis: 'slab',
            costPerSf: 11.5,
            costPerUnit: 674.82,
            notes: 'Keep this manager note',
            source: {
              kind: 'supplier-import',
              publicationId: 'older-pub',
              supplier: 'UMI',
              recordedAt: '2026-01-01T00:00:00.000Z',
              effectiveDate: '2026-01-01',
              provenance: 'supplier-listed',
            },
          }],
        },
        {
          id: 'legacy-honed',
          active: true,
          default: false,
          sku: 'BQ100H',
          thickness: '3cm',
          finish: 'Honed',
          formatName: 'Jumbo',
          formatKind: 'slab',
          lengthIn: 65,
          widthIn: 130,
          areaSf: 58.68,
          features: [],
          purchaseOptions: [{
            id: 'legacy-honed-price',
            label: 'Standard',
            active: true,
            default: true,
            pricingBasis: 'slab',
            costPerSf: 13.5,
          }],
        },
      ],
    });

    const incoming = material();
    const input = session([candidate({
      material: incoming,
      status: 'changed',
      existingMaterialId: existing.id,
      matchBasis: 'sku',
      changeSummary: ['1 supplier price change'],
    })]);

    const plan = buildSupplierImportPublishPlan(input, [existing], {
      publicationId: 'publication-2',
      publishedAt,
      idFactory,
    });
    const updated = plan.stockMaterials[0];

    expect(updated.stockProgram).toBe(true);
    expect(updated.builderLevelId).toBe('level-1');
    expect(updated.slabImageUrl).toBe(existing.slabImageUrl);
    expect(updated.closeUpImageUrl).toBe(existing.closeUpImageUrl);
    expect(updated.productUrl).toBe(existing.productUrl);
    expect(updated.notes).toBe('Management note');
    expect(updated.internalCost).toBe(9.5);
    expect(updated.variants).toHaveLength(2);
    expect(updated.variants?.some((variant) => variant.id === 'legacy-honed')).toBe(true);

    const standard = updated.variants?.find((variant) => variant.id === 'variant-existing')?.purchaseOptions[0];
    expect(standard?.costPerSf).toBe(12.8);
    expect(standard?.notes).toBe('Keep this manager note');
    expect(standard?.priceHistory).toHaveLength(1);
    expect(standard?.priceHistory?.[0].costPerSf).toBe(11.5);
    expect(standard?.priceHistory?.[0].source?.publicationId).toBe('older-pub');
  });

  it('adds an explicitly listed new physical spec without deleting existing specs', () => {
    idCounter = 0;
    const existing = material({
      id: 'catalog-1',
      variants: [{
        id: 'old-jumbo',
        active: true,
        default: true,
        sku: 'BQ100',
        thickness: '3cm',
        finish: 'Polished',
        formatName: 'Jumbo',
        formatKind: 'slab',
        lengthIn: 65,
        widthIn: 130,
        areaSf: 58.68,
        features: [],
        purchaseOptions: [{ id: 'old-price', label: 'Standard', active: true, default: true, pricingBasis: 'slab', costPerSf: 12.8 }],
      }],
    });

    const incoming = material({
      variants: [{
        id: 'new-super',
        active: true,
        default: true,
        sku: 'BQ100',
        thickness: '3cm',
        finish: 'Polished',
        formatName: 'Super Jumbo',
        formatKind: 'slab',
        lengthIn: 79,
        widthIn: 136.5,
        areaSf: 74.89,
        features: [],
        purchaseOptions: [{ id: 'super-price', label: 'Standard', active: true, default: true, pricingBasis: 'slab', costPerSf: 13.2 }],
      }],
    });

    const plan = buildSupplierImportPublishPlan(session([candidate({
      material: incoming,
      status: 'changed',
      existingMaterialId: existing.id,
      matchBasis: 'sku',
      changeSummary: ['1 new physical spec'],
    })]), [existing], { publicationId: 'publication-3', publishedAt, idFactory });

    expect(plan.stockMaterials[0].variants?.map((variant) => variant.formatName).sort()).toEqual(['Jumbo', 'Super Jumbo']);
  });

  it('blocks unresolved or already-published sessions and skips ignored records', () => {
    expect(() => assertSupplierImportPublishable(session([candidate({ reviewDecision: 'needs-review' })])))
      .toThrow(/Resolve the 1 item/);

    expect(() => assertSupplierImportPublishable(session([candidate()], {
      publication: {
        id: 'pub',
        publishedAt,
        publishedCount: 1,
        newCount: 1,
        updatedCount: 0,
        unchangedCount: 0,
        ignoredCount: 0,
      },
    }))).toThrow(/already been published/);

    const plan = buildSupplierImportPublishPlan(session([
      candidate(),
      candidate({ id: 'ignored', material: material({ id: 'ignored-material', sku: 'BQ200' }), reviewDecision: 'ignored' }),
    ]), [], { publicationId: 'publication-4', publishedAt, idFactory });

    expect(plan.summary.publishedCount).toBe(1);
    expect(plan.summary.ignoredCount).toBe(1);
    expect(plan.stockMaterials).toHaveLength(1);
  });

  it('fails safely when a new staged SKU now collides with the live catalog', () => {
    const live = material({ id: 'live-1', name: 'Existing Color', sku: 'BQ100' });
    expect(() => validateStagedAgainstCatalog(session([candidate()]), [live]))
      .toThrow(/overlaps Existing Color by SKU/);
  });
});

describe('supplier parser contract', () => {
  it('registers Vicostone as an explicit-listings-only parser', () => {
    const parser = getSupplierImportParser(VICOSTONE_PARSER_ID);
    expect(parser.label).toBe('Vicostone / UMI Fabricator PDF');
    expect(parser.version).toBe(2);
    expect(parser.explicitListingsOnly).toBe(true);
  });
});
