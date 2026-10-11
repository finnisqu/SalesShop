import { describe, expect, it } from 'vitest';
import type { StockMaterial } from '../types/settings';
import { buildSupplierImportPublishPlan } from './supplierImportCatalog';
import {
  SALESSHOP_TEMPLATE_HEADERS,
  SALESSHOP_TEMPLATE_HEADERS_V1_0,
  SALESSHOP_TEMPLATE_PARSER_ID,
  stageSalesShopMaterialTemplate,
} from './salesShopMaterialTemplateImport';

type TemplateRow = Partial<Record<(typeof SALESSHOP_TEMPLATE_HEADERS)[number], string | number>>;

const baseRow: TemplateRow = {
  Include: 'Yes',
  'Supplier / Importer': 'UMI',
  'Brand / Manufacturer': 'Vicostone',
  'Material Family': 'Engineered Surfaces',
  'Material Type': 'Quartz',
  'Color / Product Name': 'Akoya',
  'Collection / Series': 'Classic',
  'Supplier Group': 'Group 2',
  'Material SKU': 'BQ8583',
  'Variant SKU': 'BQ8583',
  Thickness: '3cm',
  Finish: 'Polished',
  'Format Name': 'Jumbo',
  'Format Kind': 'slab',
  'Length In': 130,
  'Width In': 65,
  'Area SF Listed': 58.68,
  Availability: 'stock',
  'Default Variant': 'Yes',
  'Purchase Program': 'Standard',
  'Pricing Basis': 'slab',
  'Cost / SF Listed': 14.5,
  'Cost / Unit Listed': 850.86,
  'Default Purchase': 'Yes',
  'Effective Date': '2026-10-01',
  'Source File': 'UMI-Oct-2026.pdf',
  'Source Page / Sheet': 'Page 2',
  'Source Reference / Original Label': 'Group 2 · Akoya',
  'Price Provenance': 'supplier-listed',
  Active: 'Yes',
};

async function makeTemplateFile(
  rows: TemplateRow[],
  options: {
    templateVersion?: string;
    priceListLabel?: string;
    rule?: string;
  } = {},
) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  const meta = workbook.addWorksheet('META');
  [
    ['Key', 'Value'],
    ['TemplateVersion', options.templateVersion ?? '1.1'],
    ['SchemaName', 'SalesShop Material Import'],
    ['ImportMode', 'SupplierCatalog'],
    ['PriceListLabel', options.priceListLabel ?? 'October 2026'],
    ['DefaultEffectiveDate', '2026-10-01'],
    ['Currency', 'USD'],
    ['SourceFiles', 'UMI-Oct-2026.pdf'],
  ].forEach((row) => meta.addRow(row));

  const imports = workbook.addWorksheet('IMPORT_ROWS');
  const templateVersion = options.templateVersion ?? '1.1';
  const headers = templateVersion === '1.0' ? SALESSHOP_TEMPLATE_HEADERS_V1_0 : SALESSHOP_TEMPLATE_HEADERS;
  imports.addRow([...headers]);
  rows.forEach((source) => {
    imports.addRow(headers.map((header) => source[header] ?? ''));
  });

  const rules = workbook.addWorksheet('SOURCE_RULES');
  rules.addRow(['Include', 'Supplier / Importer', 'Brand / Manufacturer', 'Rule Scope', 'Scope Value', 'Rule Type', 'Rule Text', 'Effective Date', 'Source File', 'Source Page / Sheet', 'Source Reference', 'Reference Only']);
  if (options.rule) rules.addRow(['Yes', 'UMI', 'Vicostone', 'Batch', '', 'Minimum Quantity', options.rule, '2026-10-01', 'UMI-Oct-2026.pdf', 'Page 1', 'Terms', 'Yes']);

  const buffer = await workbook.xlsx.writeBuffer();
  return new File([new Uint8Array(buffer as ArrayBuffer)], 'SalesShop_Material_Import_Template_v1.1.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function existingAkoya(overrides: Partial<StockMaterial> = {}): StockMaterial {
  return {
    id: 'catalog-akoya',
    name: 'Akoya',
    supplier: 'UMI',
    brand: 'Vicostone',
    collection: 'Classic',
    supplierGroup: 'Group 2',
    sku: 'BQ8583',
    materialType: 'Quartz',
    stockProgram: true,
    builderLevelId: 'level-2',
    unit: 'sf',
    active: true,
    variants: [{
      id: 'catalog-akoya-3cm',
      active: true,
      default: true,
      sku: 'BQ8583',
      thickness: '3cm',
      finish: 'Polished',
      formatName: 'Jumbo',
      formatKind: 'slab',
      lengthIn: 130,
      widthIn: 65,
      areaSf: 58.68,
      availability: 'stock',
      purchaseOptions: [{
        id: 'catalog-akoya-standard',
        label: 'Standard',
        active: true,
        default: true,
        pricingBasis: 'slab',
        costPerSf: 13.75,
        costPerUnit: 806.85,
      }],
    }],
    ...overrides,
  };
}

describe('SalesShop canonical material template importer', () => {
  it('groups purchase-program rows into one material and one physical variant', async () => {
    const file = await makeTemplateFile([
      baseRow,
      {
        ...baseRow,
        'Purchase Program': 'Bundle 8+',
        'Min Quantity': 8,
        'Cost / SF Listed': 13.5,
        'Cost / Unit Listed': 792.18,
        'Default Purchase': 'No',
      },
    ], { rule: 'Bundle program requires 8 slabs of the same color.' });

    const session = await stageSalesShopMaterialTemplate(file, []);

    expect(session.source.parserId).toBe(SALESSHOP_TEMPLATE_PARSER_ID);
    expect(session.source.priceListLabel).toBe('October 2026');
    expect(session.source.supplierRules).toEqual(['Minimum Quantity: Bundle program requires 8 slabs of the same color.']);
    expect(session.candidates).toHaveLength(1);

    const candidate = session.candidates[0];
    expect(candidate.status).toBe('new');
    expect(candidate.confidence).toBe('high');
    expect(candidate.material).toMatchObject({
      name: 'Akoya',
      supplier: 'UMI',
      brand: 'Vicostone',
      materialFamily: 'Engineered Surfaces',
      materialType: 'Quartz',
      stockProgram: false,
    });
    expect(candidate.material.variants).toHaveLength(1);
    expect(candidate.material.variants?.[0].purchaseOptions).toHaveLength(2);
    expect(candidate.material.variants?.[0].purchaseOptions.map((option) => option.label)).toEqual(['Standard', 'Bundle 8+']);

    const standardId = candidate.material.variants?.[0].purchaseOptions[0].id ?? '';
    expect(candidate.priceEvidence?.[standardId]).toMatchObject({
      sourceFileName: 'UMI-Oct-2026.pdf',
      sourcePageSheet: 'Page 2',
      sourceReference: 'Group 2 · Akoya',
      effectiveDate: '2026-10-01',
      effectiveCostPerSf: 'supplier-listed',
    });
  });

  it('uses canonical Brand + Family + Type + Color identity when SKU is absent', async () => {
    const withoutSku = {
      ...baseRow,
      'Material SKU': '',
      'Variant SKU': '',
      'Cost / SF Listed': 14.75,
      'Cost / Unit Listed': 865.23,
    };
    const existing = existingAkoya({
      sku: undefined,
      variants: [{
        ...existingAkoya().variants![0],
        sku: undefined,
      }],
    });
    const session = await stageSalesShopMaterialTemplate(await makeTemplateFile([withoutSku]), [existing]);

    expect(session.candidates[0].status).toBe('changed');
    expect(session.candidates[0].matchBasis).toBe('identity');
    expect(session.candidates[0].confidence).toBe('high');
    expect(session.candidates[0].changeSummary.join(' ')).toMatch(/price/i);
  });


  it('stages conflicting supplier groups as a resolvable material issue', async () => {
    const file = await makeTemplateFile([
      {
        ...baseRow,
        'Color / Product Name': 'Pure White',
        'Supplier Group': 'B',
        Finish: 'Polished',
        'Source Reference / Original Label': 'Group B',
      },
      {
        ...baseRow,
        'Color / Product Name': 'Pure White',
        'Supplier Group': 'C',
        Finish: 'Honed',
        'Cost / SF Listed': 11.5,
        'Cost / Unit Listed': 888.06,
        'Default Variant': 'No',
        'Source Reference / Original Label': 'Group C',
      },
    ]);

    const session = await stageSalesShopMaterialTemplate(file, []);
    const candidate = session.candidates[0];
    expect(session.candidates).toHaveLength(1);
    expect(candidate.material.supplierGroup).toBeUndefined();
    expect(candidate.material.variants).toHaveLength(2);
    expect(candidate.status).toBe('new');
    expect(candidate.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'material',
        field: 'supplierGroup',
        severity: 'blocking',
        values: ['B', 'C'],
        resolution: 'unresolved',
      }),
    ]));
  });

  it('stages conflicting collection values instead of rejecting the workbook', async () => {
    const file = await makeTemplateFile([
      {
        ...baseRow,
        'Color / Product Name': 'Aeris',
        'Collection / Series': '2025 Builder Program',
        'Format Name': 'Slab',
      },
      {
        ...baseRow,
        'Color / Product Name': 'Aeris',
        'Collection / Series': '2025 Builder Program · Shower Walls',
        'Supplier Group': 'Shower Group 1',
        Thickness: '8mm',
        'Format Name': 'Shower Wall 96x64',
        'Purchase Program': 'Shower Wall',
        'Cost / SF Listed': 5.5,
        'Cost / Unit Listed': '',
        'Default Variant': 'No',
      },
    ]);
    const session = await stageSalesShopMaterialTemplate(file, []);
    const candidate = session.candidates[0];
    expect(candidate.material.collection).toBeUndefined();
    expect(candidate.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'collection',
        values: ['2025 Builder Program', '2025 Builder Program · Shower Walls'],
        resolution: 'unresolved',
      }),
    ]));
  });

  it('accepts Natural Stone as a safe fallback type when geology is unverified', async () => {
    const file = await makeTemplateFile([{
      ...baseRow,
      'Brand / Manufacturer': 'Scalea',
      'Material Family': 'Natural Stone',
      'Material Type': 'Natural Stone',
      'Color / Product Name': 'White Napoli',
    }]);
    const session = await stageSalesShopMaterialTemplate(file, []);
    expect(session.candidates[0].material).toMatchObject({
      brand: 'Scalea',
      materialFamily: 'Natural Stone',
      materialType: 'Natural Stone',
      name: 'White Napoli',
    });
  });

  it('stages a recognizable family/type mismatch as a row issue instead of rejecting the workbook', async () => {
    const file = await makeTemplateFile([{
      ...baseRow,
      'Material Family': 'Natural Stone',
      'Material Type': 'Quartz',
    }]);
    const session = await stageSalesShopMaterialTemplate(file, []);
    expect(session.candidates).toHaveLength(1);
    expect(session.candidates[0].material).toMatchObject({
      brand: 'Vicostone',
      materialFamily: 'Engineered Surfaces',
      materialType: 'Quartz',
      name: 'Akoya',
    });
    expect(session.candidates[0].material.variants).toHaveLength(0);
    expect(session.candidates[0].validationIssues?.[0]).toMatchObject({
      scope: 'row',
      severity: 'blocking',
      rowNumbers: [2],
      resolution: 'unresolved',
    });
    expect(session.candidates[0].validationIssues?.[0].message).toMatch(/does not match Material Type/i);
  });

  it('keeps v1.0 templates backward compatible by deriving Material Family', async () => {
    const legacyRow = { ...baseRow };
    delete legacyRow['Material Family'];
    const file = await makeTemplateFile([legacyRow], { templateVersion: '1.0' });
    const session = await stageSalesShopMaterialTemplate(file, []);
    expect(session.candidates[0].material.materialFamily).toBe('Engineered Surfaces');
    expect(session.candidates[0].material.materialType).toBe('Quartz');
  });

  it('treats a supplier change as an update to the same branded material', async () => {
    const withoutSku = {
      ...baseRow,
      'Supplier / Importer': 'New Distributor',
      'Material SKU': '',
      'Variant SKU': '',
    };
    const existing = existingAkoya({
      supplier: 'Old Distributor',
      sku: undefined,
      variants: [{
        ...existingAkoya().variants![0],
        sku: undefined,
      }],
    });

    const session = await stageSalesShopMaterialTemplate(await makeTemplateFile([withoutSku]), [existing]);
    const candidate = session.candidates[0];

    expect(candidate.status).toBe('changed');
    expect(candidate.matchBasis).toBe('identity');
    expect(candidate.existingMaterialId).toBe(existing.id);
    expect(candidate.changeSummary.join(' ')).toMatch(/Supplier Old Distributor → New Distributor/);
  });

  it('keeps the same color name in different brands as separate materials without duplicate warnings', async () => {
    const vicostoneSparklingBlack: StockMaterial = {
      ...existingAkoya({
        id: 'vicostone-sparkling-black',
        name: 'Sparkling Black',
        sku: undefined,
        variants: [{
          ...existingAkoya().variants![0],
          sku: undefined,
        }],
      }),
      brand: 'Vicostone',
      supplier: 'UMI',
    };

    const msiRow: TemplateRow = {
      ...baseRow,
      'Supplier / Importer': 'MSI',
      'Brand / Manufacturer': 'MSI',
      'Color / Product Name': 'Sparkling Black',
      'Material SKU': '',
      'Variant SKU': '',
    };

    const session = await stageSalesShopMaterialTemplate(await makeTemplateFile([msiRow]), [vicostoneSparklingBlack]);
    const candidate = session.candidates[0];

    expect(candidate.status).toBe('new');
    expect(candidate.existingMaterialId).toBeUndefined();
    expect(candidate.changeSummary).toEqual(['New supplier catalog color from validated SalesShop template']);
  });

  it('stages MSI and Vicostone Sparkling Black as two separate new materials in the same workbook', async () => {
    const file = await makeTemplateFile([
      {
        ...baseRow,
        'Supplier / Importer': 'MSI',
        'Brand / Manufacturer': 'MSI',
        'Color / Product Name': 'Sparkling Black',
        'Material SKU': '',
        'Variant SKU': '',
      },
      {
        ...baseRow,
        'Supplier / Importer': 'UMI',
        'Brand / Manufacturer': 'Vicostone',
        'Color / Product Name': 'Sparkling Black',
        'Material SKU': '',
        'Variant SKU': '',
      },
    ]);

    const session = await stageSalesShopMaterialTemplate(file, []);

    expect(session.candidates).toHaveLength(2);
    expect(session.candidates.map((candidate) => candidate.material.brand).sort()).toEqual(['MSI', 'Vicostone']);
    expect(session.candidates.every((candidate) => candidate.status === 'new')).toBe(true);
  });

  it('publishes row-level source provenance into price history metadata', async () => {
    const staged = await stageSalesShopMaterialTemplate(await makeTemplateFile([baseRow]), []);
    const session = {
      ...staged,
      candidates: staged.candidates.map((candidate) => ({ ...candidate, reviewDecision: 'approved' as const })),
    };
    const plan = buildSupplierImportPublishPlan(session, [], {
      publicationId: 'pub-template-1',
      publishedAt: '2026-10-07T12:00:00.000Z',
      idFactory: (prefix) => `${prefix}-test`,
    });

    const source = plan.stockMaterials[0].variants?.[0].purchaseOptions[0].source;
    expect(source).toMatchObject({
      kind: 'supplier-import',
      publicationId: 'pub-template-1',
      supplier: 'UMI',
      brand: 'Vicostone',
      sourceFileName: 'UMI-Oct-2026.pdf',
      sourcePageSheet: 'Page 2',
      sourceReference: 'Group 2 · Akoya',
      priceListLabel: 'October 2026',
      effectiveDate: '2026-10-01',
      parserId: SALESSHOP_TEMPLATE_PARSER_ID,
    });
  });

  it('returns a useful workbook-read error instead of leaking a parser TypeError', async () => {
    const badFile = new File([new Uint8Array([1, 2, 3, 4, 5])], 'broken.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await expect(stageSalesShopMaterialTemplate(badFile, []))
      .rejects.toThrow(/could not read this \.xlsx workbook/i);
  });

  it('rejects an unsupported workbook version before staging anything', async () => {
    const file = await makeTemplateFile([baseRow], { templateVersion: '2.0' });
    await expect(stageSalesShopMaterialTemplate(file, []))
      .rejects.toThrow(/supports v1\.0 and v1\.1/i);
  });

  it('stages recognizable bad pricing rows as blocking row issues', async () => {
    const file = await makeTemplateFile([{
      ...baseRow,
      'Cost / SF Listed': '',
      'Cost / Unit Listed': '',
    }]);
    const session = await stageSalesShopMaterialTemplate(file, []);
    expect(session.candidates).toHaveLength(1);
    expect(session.candidates[0].material.variants).toHaveLength(0);
    expect(session.candidates[0].validationIssues?.[0]).toMatchObject({
      scope: 'row',
      severity: 'blocking',
      rowNumbers: [2],
      resolution: 'unresolved',
    });
    expect(session.candidates[0].validationIssues?.[0].message).toMatch(/Cost \/ SF Listed or Cost \/ Unit Listed is required/);
  });

  it('skips rows explicitly marked Include = No', async () => {
    const file = await makeTemplateFile([
      { ...baseRow, Include: 'No', 'Color / Product Name': 'Do Not Import' },
      baseRow,
    ]);
    const session = await stageSalesShopMaterialTemplate(file, []);
    expect(session.candidates.map((candidate) => candidate.material.name)).toEqual(['Akoya']);
  });
});
