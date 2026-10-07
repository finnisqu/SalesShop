import type {
  SupplierImportMappingField,
  SupplierImportStructuredPreview,
} from '../types/supplierImport';

export interface SupplierImportMappingFieldDefinition {
  field: SupplierImportMappingField;
  label: string;
  required?: boolean;
  hint: string;
  aliases: string[];
}

export const supplierImportMappingFields: readonly SupplierImportMappingFieldDefinition[] = [
  { field: 'name', label: 'Color / product name', required: true, hint: 'Akoya, Calacatta Gold…', aliases: ['color', 'color name', 'product', 'product name', 'design', 'design name', 'material name'] },
  { field: 'sku', label: 'SKU / color code', hint: 'BQ8583, Q123…', aliases: ['sku', 'item', 'item code', 'product code', 'color code', 'code'] },
  { field: 'supplierGroup', label: 'Supplier group', hint: 'Group 3, F…', aliases: ['group', 'price group', 'pricing group', 'supplier group', 'group level'] },
  { field: 'thickness', label: 'Thickness', hint: '3cm, 2cm…', aliases: ['thickness', 'thick', 'gauge'] },
  { field: 'finish', label: 'Finish', hint: 'Polished, Honed…', aliases: ['finish', 'surface finish', 'surface'] },
  { field: 'formatName', label: 'Size / format name', hint: 'Jumbo, Super Jumbo…', aliases: ['format', 'format name', 'size class', 'slab size', 'size name'] },
  { field: 'lengthIn', label: 'Length', hint: 'Slab length in inches', aliases: ['length', 'length in', 'length inches', 'slab length'] },
  { field: 'widthIn', label: 'Width', hint: 'Slab width in inches', aliases: ['width', 'width in', 'width inches', 'slab width'] },
  { field: 'areaSf', label: 'Area / SF', hint: 'Supplier-listed slab square footage', aliases: ['area', 'area sf', 'square feet', 'sq ft', 'sf', 'slab sf'] },
  { field: 'purchaseLabel', label: 'Price program', hint: 'Standard, Bundle 8+…', aliases: ['program', 'price program', 'pricing program', 'price type', 'tier'] },
  { field: 'minQuantity', label: 'Minimum quantity', hint: '1, 8…', aliases: ['min qty', 'minimum qty', 'minimum quantity', 'min quantity', 'minimum'] },
  { field: 'costPerSf', label: 'Cost / SF', hint: 'Supplier-listed cost per square foot', aliases: ['cost sf', 'cost per sf', 'price sf', 'price per sf', '$/sf', 'sf price', 'square foot price'] },
  { field: 'costPerUnit', label: 'Cost / unit', hint: 'Slab/sheet/unit price', aliases: ['unit cost', 'unit price', 'slab cost', 'cost per slab', 'slab price', 'price per slab', 'sheet cost', 'price per sheet'] },
  { field: 'availability', label: 'Availability', hint: 'Stock, special order…', aliases: ['availability', 'status', 'inventory status', 'stock status'] },
  { field: 'availabilityNote', label: 'Availability note / ETA', hint: 'ETA, lead time, notes…', aliases: ['availability note', 'eta', 'lead time', 'availability eta', 'stock note'] },
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/[^a-z0-9$/. ]+/g, '').replace(/\s+/g, ' ');
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      cell = '';
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function rectangularRows(rows: string[][], width: number) {
  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
}

export function structuredPreviewFromCsvText(text: string, fileName = 'supplier.csv'): SupplierImportStructuredPreview {
  const parsed = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (!parsed.length) throw new Error('This CSV does not contain any readable rows.');

  const headers = parsed[0].map((value, index) => value || `Column ${index + 1}`);
  if (!headers.some((header) => header.trim())) throw new Error('SalesShop could not find a header row in this CSV.');

  const dataRows = rectangularRows(parsed.slice(1), headers.length);
  return {
    fileName,
    fileType: 'csv',
    sheetNames: [],
    headers,
    rows: dataRows.slice(0, 8),
    totalRows: dataRows.length,
  };
}

function worksheetRows(worksheet: {
  name: string;
  eachRow: (options: { includeEmpty: boolean }, callback: (row: { actualCellCount: number; getCell: (index: number) => { text: string } }, rowNumber: number) => void) => void;
}) {
  const rawRows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const width = Math.max(row.actualCellCount, 1);
    rawRows.push(Array.from({ length: width }, (_, index) => row.getCell(index + 1).text.trim()));
  });
  return rawRows;
}

async function structuredPreviewFromXlsx(file: File, requestedSheetName?: string): Promise<SupplierImportStructuredPreview> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const bytes = new Uint8Array(await file.arrayBuffer());
  await workbook.xlsx.load(bytes as never);

  if (!workbook.worksheets.length) throw new Error('This workbook does not contain any worksheets.');
  const worksheet = requestedSheetName
    ? workbook.worksheets.find((candidate) => candidate.name === requestedSheetName) ?? workbook.worksheets[0]
    : workbook.worksheets[0];

  const parsed = worksheetRows(worksheet);
  if (!parsed.length) throw new Error(`${worksheet.name} does not contain any readable rows.`);

  const headers = parsed[0].map((value, index) => value || `Column ${index + 1}`);
  const dataRows = rectangularRows(parsed.slice(1), headers.length);
  return {
    fileName: file.name,
    fileType: 'xlsx',
    sheetName: worksheet.name,
    sheetNames: workbook.worksheets.map((candidate) => candidate.name),
    headers,
    rows: dataRows.slice(0, 8),
    totalRows: dataRows.length,
  };
}

export async function loadStructuredSupplierPreview(file: File, sheetName?: string): Promise<SupplierImportStructuredPreview> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv')) return structuredPreviewFromCsvText(await file.text(), file.name);
  if (lower.endsWith('.xlsx')) return structuredPreviewFromXlsx(file, sheetName);
  throw new Error('Mapped supplier imports currently accept CSV or XLSX files.');
}

export function suggestSupplierImportMapping(headers: string[]): Partial<Record<SupplierImportMappingField, string>> {
  const normalized = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));
  const claimed = new Set<string>();
  const result: Partial<Record<SupplierImportMappingField, string>> = {};

  // Claim exact header matches first so a broad alias such as "SF" cannot steal
  // a more specific column like "Price per SF" from the pricing field.
  supplierImportMappingFields.forEach((definition) => {
    const aliases = definition.aliases.map(normalizeHeader);
    const exact = normalized.find(({ header, normalized: candidate }) => !claimed.has(header) && aliases.includes(candidate));
    if (exact) {
      result[definition.field] = exact.header;
      claimed.add(exact.header);
    }
  });

  supplierImportMappingFields.forEach((definition) => {
    if (result[definition.field]) return;
    const aliases = definition.aliases.map(normalizeHeader).filter((alias) => alias.length >= 4);
    const fuzzy = normalized.find(({ header, normalized: candidate }) => !claimed.has(header)
      && aliases.some((alias) => candidate.includes(alias) || alias.includes(candidate)));
    if (fuzzy) {
      result[definition.field] = fuzzy.header;
      claimed.add(fuzzy.header);
    }
  });

  return result;
}
