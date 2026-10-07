import {
  MATERIAL_FAMILIES,
  materialFamilyForType,
  resolvedMaterialFamily,
  type MaterialAvailability,
  type MaterialFormatKind,
  type MaterialPurchaseOption,
  type MaterialPurchaseUnit,
  type MaterialVariant,
  type MaterialFamily,
  type StockMaterial,
} from '../types/settings';
import type {
  SupplierImportCandidate,
  SupplierImportParser,
  SupplierImportPriceEvidence,
  SupplierImportPriceProvenance,
  SupplierImportSession,
  SupplierImportSource,
} from '../types/supplierImport';

export const SALESSHOP_TEMPLATE_PARSER_ID = 'salesshop-material-template-xlsx';
export const SALESSHOP_TEMPLATE_PARSER_VERSION = 2;
export const SALESSHOP_TEMPLATE_VERSION = '1.1';
export const SALESSHOP_TEMPLATE_LEGACY_VERSION = '1.0';
export const SALESSHOP_TEMPLATE_SCHEMA_NAME = 'SalesShop Material Import';

export const SALESSHOP_TEMPLATE_HEADERS_V1_0 = [
  'Include',
  'Supplier / Importer',
  'Brand / Manufacturer',
  'Material Type',
  'Color / Product Name',
  'Collection / Series',
  'Supplier Group',
  'Material SKU',
  'Material Features',
  'Material Notes',
  'Variant SKU',
  'Thickness',
  'Finish',
  'Format Name',
  'Format Kind',
  'Length In',
  'Width In',
  'Area SF Listed',
  'Area SF Calc',
  'Availability',
  'Availability Note / ETA',
  'Variant Features',
  'Variant Notes',
  'Default Variant',
  'Purchase Program',
  'Min Quantity',
  'Pricing Basis',
  'Cost / SF Listed',
  'Cost / Unit Listed',
  'Effective Cost / SF',
  'Default Purchase',
  'Purchase Notes',
  'Supplier Notes / Rules',
  'Effective Date',
  'Source File',
  'Source Page / Sheet',
  'Source Reference / Original Label',
  'Price Provenance',
  'Active',
  'Material Key',
  'Variant Key',
  'Purchase Key',
  'Validation Status',
  'Validation Detail',
] as const;

export const SALESSHOP_TEMPLATE_HEADERS = [
  'Include',
  'Supplier / Importer',
  'Brand / Manufacturer',
  'Material Family',
  'Material Type',
  'Color / Product Name',
  'Collection / Series',
  'Supplier Group',
  'Material SKU',
  'Material Features',
  'Material Notes',
  'Variant SKU',
  'Thickness',
  'Finish',
  'Format Name',
  'Format Kind',
  'Length In',
  'Width In',
  'Area SF Listed',
  'Area SF Calc',
  'Availability',
  'Availability Note / ETA',
  'Variant Features',
  'Variant Notes',
  'Default Variant',
  'Purchase Program',
  'Min Quantity',
  'Pricing Basis',
  'Cost / SF Listed',
  'Cost / Unit Listed',
  'Effective Cost / SF',
  'Default Purchase',
  'Purchase Notes',
  'Supplier Notes / Rules',
  'Effective Date',
  'Source File',
  'Source Page / Sheet',
  'Source Reference / Original Label',
  'Price Provenance',
  'Active',
  'Material Key',
  'Variant Key',
  'Purchase Key',
  'Validation Status',
  'Validation Detail',
] as const;

const MATERIAL_TYPES = new Set([
  'Granite', 'Quartzite', 'Marble', 'Dolomite', 'Soapstone', 'Onyx', 'Travertine', 'Limestone', 'Natural Stone',
  'Quartz', 'Sintered Stone', 'Porcelain', 'Solid Surface', 'Terrazzo', 'Other',
]);
const FORMAT_KINDS = new Set<MaterialFormatKind>(['slab', 'sheet', 'half-slab', 'half-sheet', 'other']);
const AVAILABILITY = new Set<MaterialAvailability>(['stock', 'high', 'medium', 'low', 'eta', 'special-order', 'discontinued', 'unknown']);
const PRICING_BASIS = new Set<MaterialPurchaseUnit>(['sf', 'slab', 'sheet', 'half-slab', 'half-sheet', 'each']);
const PRICE_PROVENANCE = new Set<SupplierImportPriceProvenance>(['supplier-listed', 'derived-from-listed-unit', 'manual']);

type RowValues = Record<string, string>;

interface ParsedTemplateRow {
  rowNumber: number;
  supplier: string;
  brand: string;
  materialFamily: MaterialFamily;
  materialType: StockMaterial['materialType'];
  name: string;
  collection?: string;
  supplierGroup?: string;
  materialSku?: string;
  materialFeatures: string[];
  materialNotes?: string;
  variantSku?: string;
  thickness?: string;
  finish?: string;
  formatName?: string;
  formatKind?: MaterialFormatKind;
  lengthIn?: number;
  widthIn?: number;
  areaSf?: number;
  availability?: MaterialAvailability;
  availabilityNote?: string;
  variantFeatures: string[];
  variantNotes?: string;
  defaultVariant: boolean;
  purchaseLabel: string;
  minQuantity?: number;
  pricingBasis: MaterialPurchaseUnit;
  costPerSf?: number;
  costPerUnit?: number;
  defaultPurchase: boolean;
  purchaseNotes?: string;
  supplierNotes?: string;
  effectiveDate?: string;
  sourceFileName?: string;
  sourcePageSheet?: string;
  sourceReference?: string;
  provenance: SupplierImportPriceProvenance;
  active: boolean;
  warnings: string[];
}

interface MaterialAccumulator {
  material: StockMaterial;
  warnings: string[];
  priceEvidence: Record<string, SupplierImportPriceEvidence>;
}

function excelColumn(column: number) {
  let value = Math.max(1, column);
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'row';
}

function normalized(value?: string | number) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function parseList(value: string) {
  return uniqueStrings(value.split(';').map((part) => part.trim()).filter(Boolean));
}

function parseYesNo(value: string, fallback: boolean) {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) return fallback;
  if (['yes', 'y', 'true', '1'].includes(normalizedValue)) return true;
  if (['no', 'n', 'false', '0'].includes(normalizedValue)) return false;
  return fallback;
}

function validYesNo(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  return !normalizedValue || ['yes', 'y', 'true', '1', 'no', 'n', 'false', '0'].includes(normalizedValue);
}

function parseNumber(value: string) {
  const cleaned = value.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const parsedIso = new Date(`${iso[0]}T00:00:00Z`);
    return Number.isNaN(parsedIso.valueOf()) ? undefined : iso[0];
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function variantIdentity(variant: MaterialVariant) {
  return [
    normalized(variant.thickness),
    normalized(variant.finish),
    normalized(variant.formatName),
    normalized(variant.formatKind),
    normalized(variant.lengthIn),
    normalized(variant.widthIn),
    normalized(variant.areaSf),
  ].join('|');
}

function rowVariantIdentity(row: ParsedTemplateRow) {
  return [
    normalized(row.thickness),
    normalized(row.finish),
    normalized(row.formatName),
    normalized(row.formatKind),
    normalized(row.lengthIn),
    normalized(row.widthIn),
    normalized(row.areaSf),
  ].join('|');
}

function optionIdentity(option: MaterialPurchaseOption) {
  return normalized(option.label);
}

function materialIdentity(material: Pick<StockMaterial, 'brand' | 'materialFamily' | 'materialType' | 'name'>) {
  return [
    normalized(material.brand),
    normalized(resolvedMaterialFamily(material)),
    normalized(material.materialType),
    normalized(material.name),
  ].join('|');
}

function skuSet(material: StockMaterial) {
  return new Set([
    material.sku,
    ...(material.variants ?? []).map((variant) => variant.sku),
  ].filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase()));
}

function mergeFeatures(existing: string[] | undefined, incoming: string[]) {
  return uniqueStrings([...(existing ?? []), ...incoming]);
}

function ensureVariant(accumulator: MaterialAccumulator, row: ParsedTemplateRow) {
  const identity = rowVariantIdentity(row);
  let variant = (accumulator.material.variants ?? []).find((candidate) => variantIdentity(candidate) === identity);
  if (!variant) {
    variant = {
      id: `staged-variant-${safeId(`${materialIdentity(accumulator.material)}-${identity}`)}`,
      active: row.active,
      default: row.defaultVariant,
      sku: row.variantSku,
      thickness: row.thickness,
      finish: row.finish,
      formatName: row.formatName,
      formatKind: row.formatKind,
      lengthIn: row.lengthIn,
      widthIn: row.widthIn,
      areaSf: row.areaSf,
      availability: row.availability,
      availabilityNote: row.availabilityNote,
      features: row.variantFeatures,
      purchaseOptions: [],
      notes: row.variantNotes,
    };
    accumulator.material.variants = [...(accumulator.material.variants ?? []), variant];
  } else {
    const conflicts = [
      ['Variant SKU', variant.sku, row.variantSku],
      ['Availability', variant.availability, row.availability],
      ['Availability Note', variant.availabilityNote, row.availabilityNote],
    ].filter(([, current, incoming]) => current && incoming && normalized(current as string) !== normalized(incoming as string));
    if (conflicts.length) {
      accumulator.warnings.push(`Rows for ${row.name} repeat the same physical variant with conflicting ${conflicts.map(([label]) => label).join(', ')}.`);
    }
    variant.sku = variant.sku ?? row.variantSku;
    variant.availability = variant.availability ?? row.availability;
    variant.availabilityNote = variant.availabilityNote ?? row.availabilityNote;
    variant.features = mergeFeatures(variant.features, row.variantFeatures);
    variant.notes = variant.notes ?? row.variantNotes;
    variant.active = variant.active || row.active;
    variant.default = variant.default || row.defaultVariant;
  }
  return variant;
}

function addPurchaseOption(
  accumulator: MaterialAccumulator,
  variant: MaterialVariant,
  row: ParsedTemplateRow,
  priceListLabel?: string,
) {
  const duplicate = variant.purchaseOptions.find((option) => optionIdentity(option) === normalized(row.purchaseLabel));
  if (duplicate) {
    throw new Error(`Row ${row.rowNumber}: duplicate Purchase Program "${row.purchaseLabel}" for ${row.name} · ${row.thickness || 'unspecified thickness'} · ${row.formatName || 'unspecified format'}.`);
  }

  const optionId = `staged-price-${safeId(`${variant.id}-${row.purchaseLabel}`)}`;
  const option: MaterialPurchaseOption = {
    id: optionId,
    label: row.purchaseLabel,
    active: row.active,
    default: row.defaultPurchase,
    minQuantity: row.minQuantity,
    pricingBasis: row.pricingBasis,
    costPerSf: row.costPerSf,
    costPerUnit: row.costPerUnit,
    notes: row.purchaseNotes,
    supplierNotes: row.supplierNotes,
  };
  variant.purchaseOptions.push(option);

  const effectiveProvenance: SupplierImportPriceProvenance = row.provenance === 'manual'
    ? 'manual'
    : row.costPerSf !== undefined
      ? 'supplier-listed'
      : 'derived-from-listed-unit';

  accumulator.priceEvidence[optionId] = {
    optionId,
    effectiveCostPerSf: effectiveProvenance,
    costPerSfListed: row.costPerSf !== undefined,
    costPerUnitListed: row.costPerUnit !== undefined,
    note: effectiveProvenance === 'supplier-listed'
      ? 'The $/SF value is supplier-listed in the canonical SalesShop import template.'
      : effectiveProvenance === 'manual'
        ? 'The template marks this price as manually supplied.'
        : 'The effective $/SF is derived from supplier-listed unit price and explicit material area.',
    supplier: row.supplier,
    brand: row.brand,
    sourceFileName: row.sourceFileName,
    sourcePageSheet: row.sourcePageSheet,
    sourceReference: row.sourceReference,
    priceListLabel,
    effectiveDate: row.effectiveDate,
  };
}

function finalizeAccumulator(accumulator: MaterialAccumulator) {
  const variants = accumulator.material.variants ?? [];
  const requestedDefaultVariants = variants.filter((variant) => variant.default);
  if (requestedDefaultVariants.length > 1) {
    accumulator.warnings.push(`${accumulator.material.name} has more than one Default Variant. SalesShop will use the first explicit default for a new material.`);
  }
  const preferredVariant = requestedDefaultVariants[0] ?? variants[0];
  accumulator.material.variants = variants.map((variant) => {
    const explicitDefaults = variant.purchaseOptions.filter((option) => option.default);
    if (explicitDefaults.length > 1) {
      accumulator.warnings.push(`${accumulator.material.name} · ${variant.formatName || variant.thickness || 'variant'} has more than one Default Purchase program. SalesShop will use the first explicit default for a new variant.`);
    }
    const preferredOption = explicitDefaults[0] ?? variant.purchaseOptions[0];
    return {
      ...variant,
      default: preferredVariant ? variant.id === preferredVariant.id : false,
      purchaseOptions: variant.purchaseOptions.map((option) => ({
        ...option,
        default: preferredOption ? option.id === preferredOption.id : false,
      })),
    };
  });
  return accumulator;
}

function priceChanged(existing: MaterialPurchaseOption | undefined, incoming: MaterialPurchaseOption) {
  if (!existing) return false;
  return existing.costPerSf !== incoming.costPerSf
    || existing.costPerUnit !== incoming.costPerUnit
    || existing.pricingBasis !== incoming.pricingBasis
    || existing.minQuantity !== incoming.minQuantity;
}

function compareSupplierOwnedFields(incoming: StockMaterial, existing: StockMaterial) {
  const changes: string[] = [];
  const warnings: string[] = [];

  const scalarChecks: Array<[string, string | undefined, string | undefined]> = [
    ['Supplier', existing.supplier, incoming.supplier],
    ['Brand', existing.brand, incoming.brand],
    ['Material family', resolvedMaterialFamily(existing), incoming.materialFamily],
    ['Collection', existing.collection, incoming.collection],
    ['Supplier group', existing.supplierGroup, incoming.supplierGroup],
    ['Material SKU', existing.sku, incoming.sku],
    ['Material type', existing.materialType, incoming.materialType],
  ];
  scalarChecks.forEach(([label, before, after]) => {
    if (after !== undefined && normalized(before) !== normalized(after)) changes.push(`${label} ${before || '—'} → ${after || '—'}`);
  });

  const existingFeatureSet = new Set((existing.features ?? []).map(normalized));
  const addedFeatures = (incoming.features ?? []).filter((feature) => !existingFeatureSet.has(normalized(feature)));
  if (addedFeatures.length) changes.push(`${addedFeatures.length} new material feature${addedFeatures.length === 1 ? '' : 's'}`);

  const existingVariants = existing.variants ?? [];
  const incomingVariants = incoming.variants ?? [];
  let newVariantCount = 0;
  let variantMetadataChanges = 0;
  let priceChangeCount = 0;
  const priceExamples: string[] = [];

  incomingVariants.forEach((variant) => {
    const oldVariant = existingVariants.find((candidate) => variantIdentity(candidate) === variantIdentity(variant));
    if (!oldVariant) {
      newVariantCount += 1;
      return;
    }
    if (variant.sku && normalized(variant.sku) !== normalized(oldVariant.sku)) variantMetadataChanges += 1;
    if (variant.availability && variant.availability !== oldVariant.availability) variantMetadataChanges += 1;
    if (variant.availabilityNote && normalized(variant.availabilityNote) !== normalized(oldVariant.availabilityNote)) variantMetadataChanges += 1;

    variant.purchaseOptions.forEach((option) => {
      const oldOption = oldVariant.purchaseOptions.find((candidate) => optionIdentity(candidate) === optionIdentity(option));
      if (!oldOption || priceChanged(oldOption, option)) {
        priceChangeCount += 1;
        if (priceExamples.length < 3) {
          const before = oldOption?.costPerSf === undefined ? '—' : `$${oldOption.costPerSf.toFixed(2)}/SF`;
          const after = option.costPerSf === undefined ? 'unit-priced' : `$${option.costPerSf.toFixed(2)}/SF`;
          priceExamples.push(`${variant.thickness ?? ''} ${variant.finish ?? ''} ${variant.formatName ?? ''} · ${option.label}: ${before} → ${after}`.replace(/\s+/g, ' ').trim());
        }
      }
    });

    const incomingPrograms = new Set(variant.purchaseOptions.map(optionIdentity));
    const missingPrograms = oldVariant.purchaseOptions.filter((option) => !incomingPrograms.has(optionIdentity(option))).length;
    if (missingPrograms) warnings.push(`${incoming.name} · ${variant.formatName || variant.thickness || 'variant'} omits ${missingPrograms} existing purchase program${missingPrograms === 1 ? '' : 's'}; SalesShop will preserve them.`);
  });

  if (newVariantCount) changes.push(`${newVariantCount} new physical spec${newVariantCount === 1 ? '' : 's'}`);
  if (variantMetadataChanges) changes.push(`${variantMetadataChanges} variant metadata change${variantMetadataChanges === 1 ? '' : 's'}`);
  if (priceChangeCount) changes.push(`${priceChangeCount} supplier price/program change${priceChangeCount === 1 ? '' : 's'}`);
  changes.push(...priceExamples);

  const incomingKeys = new Set(incomingVariants.map(variantIdentity));
  const missingExisting = existingVariants.filter((variant) => !incomingKeys.has(variantIdentity(variant))).length;
  if (missingExisting) warnings.push(`${missingExisting} existing spec${missingExisting === 1 ? '' : 's'} are not present in this template. Imports never remove them automatically.`);

  return { changes, warnings };
}

function compareCandidate(
  material: StockMaterial,
  catalog: StockMaterial[],
  parserWarnings: string[],
  priceEvidence: Record<string, SupplierImportPriceEvidence>,
): SupplierImportCandidate {
  const identity = materialIdentity(material);
  const exactIdentity = catalog.find((existing) => materialIdentity(existing) === identity);
  const incomingSkus = skuSet(material);
  const exactSku = catalog.find((existing) => {
    const existingSkus = skuSet(existing);
    return [...incomingSkus].some((sku) => existingSkus.has(sku));
  });

  if (exactSku && (!exactIdentity || exactSku.id !== exactIdentity.id) && materialIdentity(exactSku) !== identity) {
    return {
      id: `candidate-${safeId(material.sku || identity)}`,
      material,
      status: 'possible-duplicate',
      confidence: 'high',
      existingMaterialId: exactSku.id,
      matchBasis: 'sku',
      changeSummary: [`SKU overlaps existing ${exactSku.brand || exactSku.supplier || 'catalog'} material ${exactSku.name}, but canonical Brand / Type / Name identity differs.`],
      warnings: parserWarnings,
      priceEvidence,
    };
  }

  const existing = exactSku ?? exactIdentity;

  if (!existing) {
    return {
      id: `candidate-${safeId(material.sku || identity)}`,
      material,
      status: 'new',
      confidence: 'high',
      changeSummary: ['New supplier catalog color from validated SalesShop template'],
      warnings: parserWarnings,
      priceEvidence,
    };
  }

  const diff = compareSupplierOwnedFields(material, existing);
  return {
    id: `candidate-${safeId(material.sku || identity)}`,
    material,
    status: diff.changes.length ? 'changed' : 'unchanged',
    confidence: 'high',
    existingMaterialId: existing.id,
    matchBasis: exactSku ? (normalized(existing.sku) === normalized(material.sku) ? 'sku' : 'variant-sku') : 'identity',
    changeSummary: diff.changes.length ? diff.changes : ['Supplier-owned fields match the current catalog'],
    warnings: uniqueStrings([...parserWarnings, ...diff.warnings]),
    priceEvidence,
  };
}

type WorksheetRows = unknown[][];

function cellText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function readMeta(rows: WorksheetRows) {
  const values = new Map<string, string>();
  for (let row = 0; row < Math.max(rows.length, 20); row += 1) {
    const key = cellText(rows[row]?.[0]);
    if (!key) continue;
    values.set(key, cellText(rows[row]?.[1]));
  }
  return values;
}

function assertHeaders(rows: WorksheetRows, headers: readonly string[], version: string) {
  const actual = headers.map((_, index) => cellText(rows[0]?.[index]));
  const mismatches = headers.flatMap((expected, index) => actual[index] === expected ? [] : [`${excelColumn(index + 1)}: expected "${expected}", found "${actual[index] || 'blank'}"`]);
  if (mismatches.length) {
    throw new Error(`IMPORT_ROWS does not match SalesShop Material Import Template v${version}. ${mismatches.slice(0, 3).join('; ')}${mismatches.length > 3 ? `; +${mismatches.length - 3} more` : ''}. Nothing was staged.`);
  }
}

function readRow(rows: WorksheetRows, rowNumber: number, headers: readonly string[]): RowValues {
  const source = rows[rowNumber - 1] ?? [];
  return Object.fromEntries(headers.map((header, index) => [header, cellText(source[index])])) as RowValues;
}

function ruleText(rows: WorksheetRows | undefined) {
  if (!rows) return [];
  const rules: string[] = [];
  for (let row = 1; row < rows.length; row += 1) {
    const source = rows[row] ?? [];
    const include = cellText(source[0]);
    const rule = cellText(source[6]);
    if (!rule || !parseYesNo(include, true)) continue;
    const scope = cellText(source[3]);
    const scopeValue = cellText(source[4]);
    const type = cellText(source[5]);
    const prefix = [scope && scope !== 'Batch' ? scope : '', scopeValue, type && type !== 'Reference Only' ? type : ''].filter(Boolean).join(' · ');
    rules.push(prefix ? `${prefix}: ${rule}` : rule);
  }
  return uniqueStrings(rules);
}

function parseTemplateRow(
  values: RowValues,
  rowNumber: number,
  meta: Map<string, string>,
  fallbackEffectiveDate?: string,
  requireExplicitFamily = true,
): { row?: ParsedTemplateRow; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = values['Color / Product Name'].trim();
  if (!name) return { errors };

  if (!parseYesNo(values.Include, true)) return { errors };

  const supplier = values['Supplier / Importer'].trim();
  const brand = values['Brand / Manufacturer'].trim();
  const materialType = values['Material Type'].trim();
  const materialFamilyValue = (values['Material Family'] ?? '').trim();
  const purchaseLabel = values['Purchase Program'].trim();
  const pricingBasis = values['Pricing Basis'].trim();
  const costPerSf = parseNumber(values['Cost / SF Listed']);
  const costPerUnit = parseNumber(values['Cost / Unit Listed']);
  const formatKind = values['Format Kind'].trim();
  const availability = values.Availability.trim();
  const provenance = values['Price Provenance'].trim() || 'supplier-listed';

  if (!validYesNo(values.Include)) errors.push(`Include "${values.Include}" must be Yes or No`);
  if (!validYesNo(values['Default Variant'])) errors.push(`Default Variant "${values['Default Variant']}" must be Yes or No`);
  if (!validYesNo(values['Default Purchase'])) errors.push(`Default Purchase "${values['Default Purchase']}" must be Yes or No`);
  if (!validYesNo(values.Active)) errors.push(`Active "${values.Active}" must be Yes or No`);
  if (!supplier) errors.push('Supplier / Importer is required');
  if (!brand) errors.push('Brand / Manufacturer is required');
  if (!MATERIAL_TYPES.has(materialType)) errors.push(`Material Type "${materialType || 'blank'}" is not a supported SalesShop value`);
  const derivedFamily = MATERIAL_TYPES.has(materialType)
    ? materialFamilyForType(materialType as StockMaterial['materialType'])
    : 'Other';
  const materialFamily = (materialFamilyValue || derivedFamily) as MaterialFamily;
  if (requireExplicitFamily && !materialFamilyValue) errors.push('Material Family is required in v1.1 templates');
  if (materialFamilyValue && !MATERIAL_FAMILIES.includes(materialFamily as MaterialFamily)) errors.push(`Material Family "${materialFamilyValue}" is not supported`);
  if (materialFamilyValue && MATERIAL_FAMILIES.includes(materialFamily as MaterialFamily) && materialFamily !== derivedFamily) {
    errors.push(`Material Family "${materialFamily}" does not match Material Type "${materialType}"`);
  }
  if (!purchaseLabel) errors.push('Purchase Program is required');
  if (!PRICING_BASIS.has(pricingBasis as MaterialPurchaseUnit)) errors.push(`Pricing Basis "${pricingBasis || 'blank'}" is not supported`);
  if (costPerSf === undefined && costPerUnit === undefined) errors.push('Cost / SF Listed or Cost / Unit Listed is required');
  if (costPerSf !== undefined && costPerSf <= 0) errors.push('Cost / SF Listed must be greater than zero');
  if (costPerUnit !== undefined && costPerUnit <= 0) errors.push('Cost / Unit Listed must be greater than zero');
  if (formatKind && !FORMAT_KINDS.has(formatKind as MaterialFormatKind)) errors.push(`Format Kind "${formatKind}" is not supported`);
  if (availability && !AVAILABILITY.has(availability as MaterialAvailability)) errors.push(`Availability "${availability}" is not supported`);
  if (!PRICE_PROVENANCE.has(provenance as SupplierImportPriceProvenance)) errors.push(`Price Provenance "${provenance}" is not supported`);

  const lengthIn = parseNumber(values['Length In']);
  const widthIn = parseNumber(values['Width In']);
  const listedArea = parseNumber(values['Area SF Listed']);
  const minQuantity = parseNumber(values['Min Quantity']);
  const numericChecks: Array<[string, string, number | undefined]> = [
    ['Length In', values['Length In'], lengthIn],
    ['Width In', values['Width In'], widthIn],
    ['Area SF Listed', values['Area SF Listed'], listedArea],
    ['Min Quantity', values['Min Quantity'], minQuantity],
    ['Cost / SF Listed', values['Cost / SF Listed'], costPerSf],
    ['Cost / Unit Listed', values['Cost / Unit Listed'], costPerUnit],
  ];
  numericChecks.forEach(([label, raw, parsed]) => {
    if (raw.trim() && parsed === undefined) errors.push(`${label} "${raw}" is not a valid number`);
  });
  if (minQuantity !== undefined && minQuantity <= 0) errors.push('Min Quantity must be greater than zero');
  if (values['Effective Date'].trim() && !normalizeDate(values['Effective Date'])) errors.push(`Effective Date "${values['Effective Date']}" is not a valid date`);

  const computedArea = lengthIn && widthIn ? Math.round(((lengthIn * widthIn) / 144) * 100) / 100 : undefined;
  if (listedArea && computedArea && Math.abs(listedArea - computedArea) > 1) {
    warnings.push(`Row ${rowNumber}: listed area ${listedArea.toFixed(2)} SF differs from dimensions-derived area ${computedArea.toFixed(2)} SF by more than 1 SF.`);
  }
  const areaSf = listedArea ?? computedArea;

  if (costPerSf === undefined && costPerUnit !== undefined && ['slab', 'sheet', 'half-slab', 'half-sheet'].includes(pricingBasis) && !areaSf) {
    errors.push('Unit pricing requires Area SF Listed or Length In + Width In so SalesShop can derive $/SF');
  }
  if (pricingBasis === 'sf' && costPerSf === undefined) {
    errors.push('Pricing Basis sf requires Cost / SF Listed');
  }
  if (provenance === 'derived-from-listed-unit' && costPerUnit === undefined) {
    errors.push('Price Provenance derived-from-listed-unit requires Cost / Unit Listed');
  }

  const effectiveDate = normalizeDate(values['Effective Date'])
    ?? normalizeDate(meta.get('DefaultEffectiveDate') ?? '')
    ?? fallbackEffectiveDate;
  const sourceFileName = values['Source File'].trim() || meta.get('SourceFiles')?.trim() || undefined;
  if (!effectiveDate) warnings.push(`Row ${rowNumber}: effective date is missing.`);
  if (!sourceFileName) warnings.push(`Row ${rowNumber}: source file is missing.`);

  if (errors.length) return { errors };

  return {
    errors,
    row: {
      rowNumber,
      supplier,
      brand,
      materialFamily,
      materialType: materialType as StockMaterial['materialType'],
      name,
      collection: values['Collection / Series'].trim() || undefined,
      supplierGroup: values['Supplier Group'].trim() || undefined,
      materialSku: values['Material SKU'].trim() || undefined,
      materialFeatures: parseList(values['Material Features']),
      materialNotes: values['Material Notes'].trim() || undefined,
      variantSku: values['Variant SKU'].trim() || undefined,
      thickness: values.Thickness.trim() || undefined,
      finish: values.Finish.trim() || undefined,
      formatName: values['Format Name'].trim() || undefined,
      formatKind: formatKind ? formatKind as MaterialFormatKind : undefined,
      lengthIn,
      widthIn,
      areaSf,
      availability: availability ? availability as MaterialAvailability : undefined,
      availabilityNote: values['Availability Note / ETA'].trim() || undefined,
      variantFeatures: parseList(values['Variant Features']),
      variantNotes: values['Variant Notes'].trim() || undefined,
      defaultVariant: parseYesNo(values['Default Variant'], false),
      purchaseLabel,
      minQuantity,
      pricingBasis: pricingBasis as MaterialPurchaseUnit,
      costPerSf,
      costPerUnit,
      defaultPurchase: parseYesNo(values['Default Purchase'], false),
      purchaseNotes: values['Purchase Notes'].trim() || undefined,
      supplierNotes: values['Supplier Notes / Rules'].trim() || undefined,
      effectiveDate,
      sourceFileName,
      sourcePageSheet: values['Source Page / Sheet'].trim() || undefined,
      sourceReference: values['Source Reference / Original Label'].trim() || undefined,
      provenance: provenance as SupplierImportPriceProvenance,
      active: parseYesNo(values.Active, true),
      warnings,
    },
  };
}

export async function stageSalesShopMaterialTemplate(
  file: File,
  catalog: StockMaterial[],
  fallbackEffectiveDate?: string,
): Promise<SupplierImportSession> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('SalesShop Material Template importer expects an .xlsx workbook.');

  let workbookRows: Record<string, WorksheetRows>;
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
      cellFormula: true,
      cellNF: true,
    });
    workbookRows = Object.fromEntries(workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: '',
        blankrows: true,
      }) as unknown[][];
      return [sheetName, rows];
    }));
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`SalesShop could not read this .xlsx workbook. The file may be damaged or exported in an unsupported format. ${detail}`);
  }

  const metaSheet = workbookRows.META;
  const importSheet = workbookRows.IMPORT_ROWS;
  if (!metaSheet || !importSheet) throw new Error('SalesShop could not read this .xlsx workbook as a valid Material Import Template. META or IMPORT_ROWS is missing. Use SalesShop Material Import Template v1.0. Nothing was staged.');

  const meta = readMeta(metaSheet);
  const templateVersion = meta.get('TemplateVersion') || '';
  if (![SALESSHOP_TEMPLATE_LEGACY_VERSION, SALESSHOP_TEMPLATE_VERSION].includes(templateVersion)) {
    throw new Error(`Unsupported template version "${templateVersion || 'blank'}". SalesShop supports v${SALESSHOP_TEMPLATE_LEGACY_VERSION} and v${SALESSHOP_TEMPLATE_VERSION}. Nothing was staged.`);
  }
  if (meta.get('SchemaName') !== SALESSHOP_TEMPLATE_SCHEMA_NAME || meta.get('ImportMode') !== 'SupplierCatalog') {
    throw new Error('This workbook is not a SalesShop Material Import SupplierCatalog workbook. Nothing was staged.');
  }
  if ((meta.get('Currency') || 'USD').toUpperCase() !== 'USD') {
    throw new Error(`Currency "${meta.get('Currency')}" is not supported yet. Material imports currently require USD. Nothing was staged.`);
  }
  const templateHeaders = templateVersion === SALESSHOP_TEMPLATE_LEGACY_VERSION
    ? SALESSHOP_TEMPLATE_HEADERS_V1_0
    : SALESSHOP_TEMPLATE_HEADERS;
  assertHeaders(importSheet, templateHeaders, templateVersion);

  const parsedRows: ParsedTemplateRow[] = [];
  const rowErrors: string[] = [];
  for (let rowNumber = 2; rowNumber <= importSheet.length; rowNumber += 1) {
    const result = parseTemplateRow(
      readRow(importSheet, rowNumber, templateHeaders),
      rowNumber,
      meta,
      fallbackEffectiveDate,
      templateVersion !== SALESSHOP_TEMPLATE_LEGACY_VERSION,
    );
    if (result.errors.length) rowErrors.push(`Row ${rowNumber}: ${result.errors.join('; ')}`);
    if (result.row) parsedRows.push(result.row);
  }

  if (rowErrors.length) {
    throw new Error(`Template validation found ${rowErrors.length} blocking row error${rowErrors.length === 1 ? '' : 's'}. ${rowErrors.slice(0, 4).join(' | ')}${rowErrors.length > 4 ? ` | +${rowErrors.length - 4} more` : ''}. Nothing was staged.`);
  }
  if (!parsedRows.length) throw new Error('No included material rows were found in IMPORT_ROWS. Nothing was staged.');

  const accumulators = new Map<string, MaterialAccumulator>();

  parsedRows.forEach((row) => {
    const key = [normalized(row.brand), normalized(row.materialFamily), normalized(row.materialType), normalized(row.name)].join('|');
    let accumulator = accumulators.get(key);
    if (!accumulator) {
      accumulator = {
        material: {
          id: `staged-material-${safeId(key)}`,
          name: row.name,
          supplier: row.supplier,
          brand: row.brand,
          materialFamily: row.materialFamily,
          collection: row.collection,
          supplierGroup: row.supplierGroup,
          sku: row.materialSku,
          materialType: row.materialType,
          stockProgram: false,
          unit: 'sf',
          features: row.materialFeatures,
          variants: [],
          notes: row.materialNotes,
          active: row.active,
        },
        warnings: [...row.warnings],
        priceEvidence: {},
      };
      accumulators.set(key, accumulator);
    } else {
      const conflicts = [
        ['Supplier / Importer', accumulator.material.supplier, row.supplier],
        ['Collection / Series', accumulator.material.collection, row.collection],
        ['Material SKU', accumulator.material.sku, row.materialSku],
      ].filter(([, current, incoming]) => current && incoming && normalized(current as string) !== normalized(incoming as string));
      if (conflicts.length) {
        throw new Error(`Row ${row.rowNumber}: ${row.name} repeats with conflicting ${conflicts.map(([label]) => label).join(', ')}. Nothing was staged.`);
      }
      accumulator.material.collection = accumulator.material.collection ?? row.collection;
      // Supplier group may legitimately vary by physical variant / finish.
      // Keep the first explicit material-level group; row-specific group evidence
      // remains preserved in Source Reference and the explicit price data.
      accumulator.material.supplierGroup = accumulator.material.supplierGroup ?? row.supplierGroup;
      accumulator.material.sku = accumulator.material.sku ?? row.materialSku;
      accumulator.material.features = mergeFeatures(accumulator.material.features, row.materialFeatures);
      accumulator.material.notes = accumulator.material.notes ?? row.materialNotes;
      accumulator.material.active = accumulator.material.active || row.active;
      accumulator.warnings.push(...row.warnings);
    }

    const variant = ensureVariant(accumulator, row);
    addPurchaseOption(accumulator, variant, row, meta.get('PriceListLabel') || undefined);
  });

  const finalized = [...accumulators.values()].map(finalizeAccumulator);
  const candidates = finalized
    .map((accumulator) => compareCandidate(
      accumulator.material,
      catalog,
      uniqueStrings(accumulator.warnings),
      accumulator.priceEvidence,
    ))
    .sort((a, b) => (a.material.brand ?? '').localeCompare(b.material.brand ?? '') || a.material.name.localeCompare(b.material.name));

  const suppliers = uniqueStrings(parsedRows.map((row) => row.supplier));
  const brands = uniqueStrings(parsedRows.map((row) => row.brand));
  const effectiveDates = uniqueStrings(parsedRows.map((row) => row.effectiveDate ?? ''));
  const sourceFiles = uniqueStrings(parsedRows.map((row) => row.sourceFileName ?? ''));

  const source: SupplierImportSource = {
    parserId: SALESSHOP_TEMPLATE_PARSER_ID,
    parserVersion: SALESSHOP_TEMPLATE_PARSER_VERSION,
    supplier: suppliers.length === 1 ? suppliers[0] : `${suppliers.length} suppliers`,
    brand: brands.length === 1 ? brands[0] : `${brands.length} brands`,
    fileName: file.name,
    fileSize: file.size,
    pageCount: 1,
    importedAt: new Date().toISOString(),
    priceListLabel: meta.get('PriceListLabel') || undefined,
    effectiveDate: effectiveDates.length === 1 ? effectiveDates[0] : normalizeDate(meta.get('DefaultEffectiveDate') ?? ''),
    supplierRules: ruleText(workbookRows.SOURCE_RULES),
    rulesReferenceOnly: true,
  };

  if (sourceFiles.length > 1 && !source.priceListLabel) {
    source.priceListLabel = `${sourceFiles.length} source files`;
  }

  return {
    schemaVersion: 2,
    id: `supplier-import-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    source,
    candidates,
  };
}

export const salesShopMaterialTemplateParser: SupplierImportParser = {
  id: SALESSHOP_TEMPLATE_PARSER_ID,
  version: SALESSHOP_TEMPLATE_PARSER_VERSION,
  label: 'SalesShop Material Import Template v1.1',
  explicitListingsOnly: true,
  accepts: (file) => file.name.toLowerCase().endsWith('.xlsx'),
  stage: (file, context) => stageSalesShopMaterialTemplate(file, context.catalog, context.effectiveDate),
};
