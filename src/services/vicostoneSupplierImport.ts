import type {
  MaterialPurchaseOption,
  MaterialVariant,
  StockMaterial,
} from '../types/settings';
import type {
  SupplierImportCandidate,
  SupplierImportConfidence,
  SupplierImportParser,
  SupplierImportSession,
  SupplierImportSource,
} from '../types/supplierImport';

export const VICOSTONE_PARSER_ID = 'vicostone-umi-fabricator-pdf';
export const VICOSTONE_PARSER_VERSION = 2;
const PRICE_EPSILON = 0.015;

interface PositionedText {
  str: string;
  x: number;
  y: number;
}

interface PositionedLine {
  pageNumber: number;
  y: number;
  items: PositionedText[];
  text: string;
}

interface PricePair {
  costPerSf?: number;
  costPerUnit?: number;
}

interface VariantSpec {
  thickness: string;
  finish: string;
  formatName: string;
  formatKind: MaterialVariant['formatKind'];
  lengthIn: number;
  widthIn: number;
  areaSf: number;
}

interface ParsedMaterialAccumulator {
  material: StockMaterial;
  warnings: string[];
}

const mainColumns = [
  { spec: ['3cm', 'Super Jumbo', 'slab', 79, 136.5, 74.89] as const, label: 'Standard', sf: [165, 196] as const, unit: [196, 230] as const },
  { spec: ['3cm', 'Jumbo', 'slab', 65, 130, 58.68] as const, label: 'Standard', sf: [235, 265] as const, unit: [265, 300] as const },
  { spec: ['3cm', 'Jumbo', 'slab', 65, 130, 58.68] as const, label: 'Bundle 8+', minQuantity: 8, sf: [305, 335] as const, unit: [335, 370] as const },
  { spec: ['3cm', 'Jumbo Half', 'half-slab', 32.5, 130, 29.34] as const, label: 'Half Slab', sf: [375, 405] as const, unit: [405, 440] as const },
  { spec: ['2cm', 'Jumbo', 'slab', 65, 130, 58.68] as const, label: 'Standard', sf: [445, 475] as const, unit: [475, 510] as const },
  { spec: ['2cm', 'Jumbo', 'slab', 65, 130, 58.68] as const, label: 'Bundle 8+', minQuantity: 8, sf: [515, 545] as const, unit: [545, 580] as const },
];

const regularColumns = [
  { spec: ['3cm', 'Regular', 'slab', 56, 119, 46.28] as const, label: 'Standard', sf: [235, 265] as const, unit: [265, 300] as const },
  { spec: ['3cm', 'Regular', 'slab', 56, 119, 46.28] as const, label: 'Bundle 8+', minQuantity: 8, sf: [305, 335] as const, unit: [335, 370] as const },
  { spec: ['2cm', 'Regular', 'slab', 56, 119, 46.28] as const, label: 'Standard', sf: [375, 405] as const, unit: [405, 440] as const },
  { spec: ['2cm', 'Regular', 'slab', 56, 119, 46.28] as const, label: 'Bundle 8+', minQuantity: 8, sf: [445, 475] as const, unit: [475, 510] as const },
];

const groupByThreeCmJumboCost: Array<[number, string]> = [
  [12.8, '1'],
  [17.19, '2'],
  [19.34, '3'],
  [23.12, '4'],
  [27.95, '5'],
  [30.1, '6'],
  [32.25, '7'],
];

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'row';
}

function normalized(value?: string) {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function moneyValue(text: string) {
  const cleaned = text.replaceAll('$', '').replaceAll(',', '').replaceAll(' ', '');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

function textInBand(line: PositionedLine, minX: number, maxX: number, collapse = false) {
  const parts = line.items
    .filter((item) => item.x >= minX && item.x < maxX)
    .sort((a, b) => a.x - b.x)
    .map((item) => item.str.trim())
    .filter(Boolean);
  return collapse ? parts.join('') : parts.join(' ');
}

function valueInBand(line: PositionedLine, band: readonly [number, number]) {
  return moneyValue(textInBand(line, band[0], band[1], true));
}

function inferGroup(cost?: number) {
  if (cost === undefined) return undefined;
  return groupByThreeCmJumboCost.find(([known]) => Math.abs(cost - known) <= 0.02)?.[1];
}

function parsePricePair(line: PositionedLine, sfBand: readonly [number, number], unitBand: readonly [number, number]): PricePair {
  return {
    costPerSf: valueInBand(line, sfBand),
    costPerUnit: valueInBand(line, unitBand),
  };
}

function detectSku(line: PositionedLine) {
  return line.items
    .map((item) => item.str.trim())
    .find((value) => /^(?:BQ|BS|BC)\d+[A-Z]?$/.test(value));
}

function supplierRulesFromText(text: string) {
  const rules: string[] = [];
  const compact = text.replace(/\s+/g, ' ');
  if (/BUNDLE PRICING.+8 or more slabs of the same color/i.test(compact)) rules.push('Bundle pricing requires 8+ slabs of the same color.');
  if (/NO RETURNS accepted for Half Slabs/i.test(compact)) rules.push('Half slabs are non-returnable.');
  if (/Special Order.+lead time of 9 to 12 weeks/i.test(compact)) rules.push('Special orders carry a 9–12 week lead time.');
  if (/honed or brushed finish.+Add \$?2\.00 per SF/i.test(compact)) rules.push('Special-order honed or brushed finish adds $2.00/SF.');
  if (/1\.2cm thickness.+same price as 2cm/i.test(compact)) rules.push('Special-order 1.2cm is sold at the 2cm price.');
  if (/regular size slab.+56["”]?\s*x\s*119/i.test(compact)) rules.push('Some colors may be special ordered as 56 × 119 regular slabs; availability must be confirmed.');
  return rules;
}

function priceListLabelFromText(text: string) {
  const match = text.match(/PRICE LIST\s*-\s*([A-Z]+\s+\d{4})/i);
  if (!match) return undefined;
  return match[1].replace(/\s+/g, ' ').trim().replace(/\b\w/g, (char) => char.toUpperCase());
}

function finishAndBaseName(rawName: string) {
  const limited = rawName.includes('*');
  const finish = /\bHoned\b/i.test(rawName) ? 'Honed' : /\bBrushed\b/i.test(rawName) ? 'Brushed' : 'Polished';
  const name = rawName
    .replaceAll('*', '')
    .replace(/\b(?:Honed|Brushed)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, finish, limited };
}

function purchaseOptionId(materialKey: string, variantKeyValue: string, label: string) {
  return `staged-price-${safeId(`${materialKey}-${variantKeyValue}-${label}`)}`;
}

function variantKey(spec: VariantSpec) {
  return [spec.thickness, spec.finish, spec.formatName, spec.lengthIn, spec.widthIn].join('|');
}

function ensureVariant(material: StockMaterial, materialKey: string, spec: VariantSpec, variantSku: string) {
  const variants = material.variants ?? [];
  const key = variantKey(spec);
  let variant = variants.find((candidate) => variantKey({
    thickness: candidate.thickness ?? '',
    finish: candidate.finish ?? '',
    formatName: candidate.formatName ?? '',
    formatKind: candidate.formatKind,
    lengthIn: candidate.lengthIn ?? 0,
    widthIn: candidate.widthIn ?? 0,
    areaSf: candidate.areaSf ?? 0,
  }) === key);
  if (!variant) {
    variant = {
      id: `staged-variant-${safeId(`${materialKey}-${key}`)}`,
      active: true,
      default: false,
      sku: variantSku,
      thickness: spec.thickness,
      finish: spec.finish,
      formatName: spec.formatName,
      formatKind: spec.formatKind,
      lengthIn: spec.lengthIn,
      widthIn: spec.widthIn,
      areaSf: spec.areaSf,
      availability: 'unknown',
      features: [],
      purchaseOptions: [],
    };
    variants.push(variant);
    material.variants = variants;
  }
  return variant;
}

function addPriceOption(
  material: StockMaterial,
  materialKey: string,
  variant: MaterialVariant,
  label: string,
  pair: PricePair,
  minQuantity: number | undefined,
  warningSink: string[],
) {
  if (pair.costPerSf === undefined && pair.costPerUnit === undefined) return;
  const variantIdKey = variantKey({
    thickness: variant.thickness ?? '',
    finish: variant.finish ?? '',
    formatName: variant.formatName ?? '',
    formatKind: variant.formatKind,
    lengthIn: variant.lengthIn ?? 0,
    widthIn: variant.widthIn ?? 0,
    areaSf: variant.areaSf ?? 0,
  });
  if (variant.purchaseOptions.some((option) => option.label === label)) return;

  const option: MaterialPurchaseOption = {
    id: purchaseOptionId(materialKey, variantIdKey, label),
    label,
    active: true,
    default: false,
    minQuantity,
    pricingBasis: variant.formatKind === 'half-slab' ? 'half-slab' : 'slab',
    costPerSf: pair.costPerSf,
    costPerUnit: pair.costPerUnit,
    notes: label === 'Bundle 8+' ? '8+ slabs of the same color.' : label === 'Half Slab' ? 'Supplier marks half slabs as non-returnable.' : undefined,
  };
  variant.purchaseOptions.push(option);

  if (pair.costPerSf !== undefined && pair.costPerUnit !== undefined && variant.areaSf) {
    const derived = pair.costPerUnit / variant.areaSf;
    if (Math.abs(derived - pair.costPerSf) > 0.08) {
      warningSink.push(`${material.name} · ${variant.formatName} ${variant.thickness}: $/SF and unit price do not reconcile cleanly (${pair.costPerSf.toFixed(2)} vs ${derived.toFixed(2)} derived).`);
    }
  }
}

function finalizeMaterial(material: StockMaterial) {
  const variants = material.variants ?? [];
  variants.forEach((variant) => {
    if (variant.purchaseOptions.length) {
      const preferred = variant.purchaseOptions.find((option) => option.label === 'Standard') ?? variant.purchaseOptions[0];
      variant.purchaseOptions = variant.purchaseOptions.map((option) => ({ ...option, default: option.id === preferred.id }));
    }
  });
  const preferredVariant = variants.find((variant) => variant.finish === 'Polished' && variant.thickness === '3cm' && variant.formatName === 'Jumbo')
    ?? variants.find((variant) => variant.finish === 'Polished' && variant.thickness === '3cm')
    ?? variants.find((variant) => variant.thickness === '3cm')
    ?? variants[0];
  if (preferredVariant) {
    material.variants = variants.map((variant) => ({ ...variant, default: variant.id === preferredVariant.id }));
  }
  return material;
}

async function extractPdfLines(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: PositionedLine[][] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PositionedText[] = content.items.flatMap((raw) => {
      if (!('str' in raw) || !('transform' in raw) || !raw.str.trim()) return [];
      return [{ str: raw.str, x: raw.transform[4], y: raw.transform[5] }];
    });
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const lines: PositionedLine[] = [];
    items.forEach((item) => {
      const existing = [...lines].reverse().find((line) => Math.abs(line.y - item.y) <= 1.4);
      if (existing) {
        existing.items.push(item);
        existing.y = (existing.y + item.y) / 2;
      } else {
        lines.push({ pageNumber, y: item.y, items: [item], text: '' });
      }
    });
    lines.forEach((line) => {
      line.items.sort((a, b) => a.x - b.x);
      line.text = line.items.map((item) => item.str.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    });
    lines.sort((a, b) => b.y - a.y);
    pages.push(lines);
  }

  return { pages, pageCount: document.numPages };
}

function variantIdentity(variant: MaterialVariant) {
  return normalized([variant.thickness, variant.finish, variant.formatName, variant.lengthIn, variant.widthIn].join('|'));
}

function optionIdentity(option: MaterialPurchaseOption) {
  return normalized(option.label);
}

function compareSupplierOwnedFields(incoming: StockMaterial, existing: StockMaterial) {
  const changes: string[] = [];
  const warnings: string[] = [];

  if (normalized(incoming.supplierGroup) !== normalized(existing.supplierGroup)) {
    changes.push(`Supplier group ${existing.supplierGroup || '—'} → ${incoming.supplierGroup || '—'}`);
  }

  const existingVariants = existing.variants ?? [];
  const incomingVariants = incoming.variants ?? [];
  let newVariantCount = 0;
  let priceChangeCount = 0;
  const priceExamples: string[] = [];

  incomingVariants.forEach((variant) => {
    const oldVariant = existingVariants.find((candidate) => variantIdentity(candidate) === variantIdentity(variant));
    if (!oldVariant) {
      newVariantCount += 1;
      return;
    }
    variant.purchaseOptions.forEach((option) => {
      const oldOption = oldVariant.purchaseOptions.find((candidate) => optionIdentity(candidate) === optionIdentity(option));
      if (!oldOption) {
        priceChangeCount += 1;
        if (priceExamples.length < 3) priceExamples.push(`${variant.finish ?? ''} ${variant.thickness ?? ''} ${variant.formatName ?? ''} · new ${option.label}`.trim());
        return;
      }
      const sfChanged = option.costPerSf !== undefined || oldOption.costPerSf !== undefined
        ? Math.abs((option.costPerSf ?? 0) - (oldOption.costPerSf ?? 0)) > PRICE_EPSILON
        : false;
      const unitChanged = option.costPerUnit !== undefined || oldOption.costPerUnit !== undefined
        ? Math.abs((option.costPerUnit ?? 0) - (oldOption.costPerUnit ?? 0)) > 0.02
        : false;
      if (sfChanged || unitChanged) {
        priceChangeCount += 1;
        if (priceExamples.length < 3) {
          const before = oldOption.costPerSf === undefined ? '—' : `$${oldOption.costPerSf.toFixed(2)}/SF`;
          const after = option.costPerSf === undefined ? '—' : `$${option.costPerSf.toFixed(2)}/SF`;
          priceExamples.push(`${variant.finish ?? ''} ${variant.thickness ?? ''} ${variant.formatName ?? ''} · ${option.label}: ${before} → ${after}`.replace(/\s+/g, ' ').trim());
        }
      }
    });
  });

  if (newVariantCount) changes.push(`${newVariantCount} new physical spec${newVariantCount === 1 ? '' : 's'}`);
  if (priceChangeCount) changes.push(`${priceChangeCount} supplier price change${priceChangeCount === 1 ? '' : 's'}`);
  changes.push(...priceExamples);

  const incomingKeys = new Set(incomingVariants.map(variantIdentity));
  const missingExisting = existingVariants.filter((variant) => !incomingKeys.has(variantIdentity(variant))).length;
  if (missingExisting) warnings.push(`${missingExisting} existing spec${missingExisting === 1 ? '' : 's'} are not present in this sheet. Imports will never remove them automatically.`);

  return { changes, warnings };
}

function skuSet(material: StockMaterial) {
  return new Set([
    material.sku,
    ...(material.variants ?? []).map((variant) => variant.sku),
  ].filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase()));
}

function compareCandidate(material: StockMaterial, catalog: StockMaterial[], parserWarnings: string[]): SupplierImportCandidate {
  const incomingSkus = skuSet(material);
  const exactSku = catalog.find((existing) => {
    const existingSkus = skuSet(existing);
    return [...incomingSkus].some((sku) => existingSkus.has(sku));
  });
  const sameNameSameBrand = catalog.find((existing) => normalized(existing.name) === normalized(material.name)
    && (!existing.brand || normalized(existing.brand) === normalized(material.brand)));
  const sameNameAny = catalog.find((existing) => normalized(existing.name) === normalized(material.name));
  const existing = exactSku ?? sameNameSameBrand;

  const confidence: SupplierImportConfidence = material.sku && (material.variants?.length ?? 0) > 0 && material.supplierGroup ? 'high' : material.sku ? 'medium' : 'low';
  const warnings = [...parserWarnings];

  if (!existing && sameNameAny) {
    return {
      id: `candidate-${safeId(material.sku || material.name)}`,
      material,
      status: 'possible-duplicate',
      confidence,
      existingMaterialId: sameNameAny.id,
      matchBasis: 'name',
      changeSummary: [`Name matches existing ${sameNameAny.supplier || sameNameAny.brand || 'catalog'} material, but supplier/SKU identity differs.`],
      warnings,
    };
  }

  if (!existing) {
    return {
      id: `candidate-${safeId(material.sku || material.name)}`,
      material,
      status: 'new',
      confidence,
      changeSummary: ['New supplier catalog color'],
      warnings,
    };
  }

  const diff = compareSupplierOwnedFields(material, existing);
  warnings.push(...diff.warnings);
  return {
    id: `candidate-${safeId(material.sku || material.name)}`,
    material,
    status: diff.changes.length ? 'changed' : 'unchanged',
    confidence,
    existingMaterialId: existing.id,
    matchBasis: exactSku ? (normalized(existing.sku) === normalized(material.sku) ? 'sku' : 'variant-sku') : 'name',
    changeSummary: diff.changes.length ? diff.changes : ['Supplier-owned fields match the current catalog'],
    warnings,
  };
}

export async function stageVicostoneFabricatorPdf(file: File, catalog: StockMaterial[], effectiveDate?: string): Promise<SupplierImportSession> {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Vicostone importer v2 expects a PDF price sheet.');
  const { pages, pageCount } = await extractPdfLines(file);
  const allText = pages.flat().map((line) => line.text).join('\n');
  if (!/umistone\.com/i.test(allText) || !/FABRICATOR/i.test(allText) || !/Bundle \(8\+ slabs\)/i.test(allText)) {
    throw new Error('This PDF does not look like the Vicostone / UMI fabricator price-list layout this parser knows yet. Nothing was staged.');
  }

  const accumulators = new Map<string, ParsedMaterialAccumulator>();

  pages.forEach((lines) => {
    let regularSection = false;
    lines.forEach((line) => {
      if (/^REGULAR$/i.test(line.text)) {
        regularSection = true;
        return;
      }
      const sku = detectSku(line);
      if (!sku) return;
      const rawName = textInBand(line, 84, 165).trim();
      if (!rawName) return;

      const { name, finish, limited } = finishAndBaseName(rawName);
      const baseSku = finish === 'Honed' && sku.endsWith('H') ? sku.slice(0, -1) : sku;
      const materialKey = baseSku || normalized(name);
      const columns = regularSection ? regularColumns : mainColumns;
      const threeCmBaseCost = valueInBand(line, [235, 265]);
      const group = inferGroup(threeCmBaseCost);

      let accumulator = accumulators.get(materialKey);
      if (!accumulator) {
        accumulator = {
          material: {
            id: `staged-material-${safeId(materialKey)}`,
            name,
            supplier: 'UMI',
            brand: 'Vicostone',
            supplierGroup: group ? `Group ${group}` : undefined,
            sku: baseSku,
            materialType: 'Quartz',
            stockProgram: false,
            unit: 'sf',
            active: true,
            features: limited ? ['Limited edition'] : [],
            variants: [],
          },
          warnings: [],
        };
        accumulators.set(materialKey, accumulator);
      } else {
        if (!accumulator.material.supplierGroup && group) accumulator.material.supplierGroup = `Group ${group}`;
        if (limited && !accumulator.material.features?.includes('Limited edition')) accumulator.material.features = [...(accumulator.material.features ?? []), 'Limited edition'];
      }

      columns.forEach((column) => {
        const pair = parsePricePair(line, column.sf, column.unit);
        if (pair.costPerSf === undefined && pair.costPerUnit === undefined) return;
        const [thickness, formatName, formatKind, lengthIn, widthIn, areaSf] = column.spec;
        const spec: VariantSpec = { thickness, finish, formatName, formatKind, lengthIn, widthIn, areaSf };
        const variant = ensureVariant(accumulator!.material, materialKey, spec, sku);
        addPriceOption(accumulator!.material, materialKey, variant, column.label, pair, column.minQuantity, accumulator!.warnings);
      });
    });
  });

  if (accumulators.size < 5) throw new Error(`Only ${accumulators.size} colors were recognized. Nothing was staged because parser confidence is too low.`);

  const materials = [...accumulators.values()].map((entry) => ({ material: finalizeMaterial(entry.material), warnings: [...new Set(entry.warnings)] }));
  const source: SupplierImportSource = {
    parserId: VICOSTONE_PARSER_ID,
    parserVersion: VICOSTONE_PARSER_VERSION,
    supplier: 'UMI',
    brand: 'Vicostone',
    fileName: file.name,
    fileSize: file.size,
    pageCount,
    importedAt: new Date().toISOString(),
    priceListLabel: priceListLabelFromText(allText),
    effectiveDate: effectiveDate || undefined,
    supplierRules: supplierRulesFromText(allText),
    rulesReferenceOnly: true,
  };

  const candidates = materials
    .map(({ material, warnings }) => compareCandidate(material, catalog, warnings))
    .sort((a, b) => a.material.supplierGroup?.localeCompare(b.material.supplierGroup ?? '') || a.material.name.localeCompare(b.material.name));

  return {
    schemaVersion: 2,
    id: `supplier-import-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    source,
    candidates,
  };
}


export const vicostoneSupplierParser: SupplierImportParser = {
  id: VICOSTONE_PARSER_ID,
  version: VICOSTONE_PARSER_VERSION,
  label: 'Vicostone / UMI Fabricator PDF',
  explicitListingsOnly: true,
  accepts: (file) => file.name.toLowerCase().endsWith('.pdf'),
  stage: (file, context) => stageVicostoneFabricatorPdf(file, context.catalog, context.effectiveDate),
};
