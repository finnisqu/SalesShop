import type {
  SupplierImportDetectedRegion,
  SupplierImportMappingField,
  SupplierImportRegionKind,
  SupplierImportStructuredPreview,
} from '../types/supplierImport';

export interface SupplierImportMappingFieldDefinition {
  field: SupplierImportMappingField;
  label: string;
  required?: boolean;
  hint: string;
  aliases: string[];
}

export interface SupplierImportRangeTable {
  headers: string[];
  rows: string[][];
  totalRows: number;
  rangeA1: string;
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

const MAX_SOURCE_ROWS = 500;
const MAX_SOURCE_COLUMNS = 80;

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

function valuePresent(value: string | undefined) {
  return Boolean(value?.trim());
}

function numericValue(value: string | undefined) {
  if (!valuePresent(value)) return undefined;
  const cleaned = value!.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  if (!cleaned || !/^-?\d+(?:\.\d+)?$/.test(cleaned)) return undefined;
  return Number(cleaned);
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

function rangeA1(startRow: number, startColumn: number, endRow: number, endColumn: number) {
  return `${excelColumn(startColumn)}${startRow}:${excelColumn(endColumn)}${endRow}`;
}

function rowNonEmptyCount(row: string[], startColumn = 1, endColumn = row.length) {
  let count = 0;
  for (let column = startColumn; column <= endColumn; column += 1) {
    if (valuePresent(row[column - 1])) count += 1;
  }
  return count;
}

function lastNonEmptyColumn(row: string[]) {
  for (let index = row.length - 1; index >= 0; index -= 1) {
    if (valuePresent(row[index])) return index + 1;
  }
  return 0;
}

function regionHasToken(rows: string[][], startRow: number, endRow: number, startColumn: number, endColumn: number, pattern: RegExp) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      if (pattern.test(rows[row - 1]?.[column - 1] ?? '')) return true;
    }
  }
  return false;
}

function trimBlankRows(rows: string[][], startRow: number, endRow: number, startColumn: number, endColumn: number) {
  let nextEnd = endRow;
  while (nextEnd > startRow && rowNonEmptyCount(rows[nextEnd - 1] ?? [], startColumn, endColumn) === 0) nextEnd -= 1;
  return nextEnd;
}

function groupedPriceMatrixRegion(rows: string[][]): SupplierImportDetectedRegion | undefined {
  const groupMatches: Array<{ row: number; column: number }> = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (/^\s*group\s*\d+\b/i.test(cell)) {
        groupMatches.push({ row: rowIndex + 1, column: columnIndex + 1 });
      }
    });
  });

  if (groupMatches.length < 2) return undefined;

  const columnCounts = new Map<number, number>();
  groupMatches.forEach(({ column }) => columnCounts.set(column, (columnCounts.get(column) ?? 0) + 1));
  const groupColumn = [...columnCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
  const alignedGroups = groupMatches.filter((match) => match.column === groupColumn).sort((a, b) => a.row - b.row);
  if (alignedGroups.length < 2) return undefined;

  const firstGroupRow = alignedGroups[0].row;
  const lastGroupRow = alignedGroups[alignedGroups.length - 1].row;
  const headerPattern = /^(?:1(?:\.5)?\s*cm|2\s*cm|3\s*cm|jumbo|\d{2,3}\s*[x×]\s*\d{2,3})$/i;
  let headerRow = Math.max(1, firstGroupRow - 1);

  for (let row = firstGroupRow - 1; row >= Math.max(1, firstGroupRow - 5); row -= 1) {
    const values = rows[row - 1] ?? [];
    const tokenCount = values.filter((value) => headerPattern.test(value.trim())).length;
    if (tokenCount >= 2) {
      headerRow = row;
      break;
    }
  }

  const headerLastColumn = Math.max(lastNonEmptyColumn(rows[headerRow - 1] ?? []), groupColumn + 1);
  let endColumn = headerLastColumn;
  for (let column = headerLastColumn + 1; column <= (rows[0]?.length ?? headerLastColumn); column += 1) {
    let occupied = 0;
    for (let row = headerRow; row <= Math.min(rows.length, lastGroupRow + 35); row += 1) {
      if (valuePresent(rows[row - 1]?.[column - 1])) occupied += 1;
    }
    if (occupied === 0) break;
    endColumn = column;
  }

  let discontinuationRow: number | undefined;
  for (let row = lastGroupRow + 1; row <= rows.length; row += 1) {
    const joined = (rows[row - 1] ?? []).slice(groupColumn - 1, endColumn).join(' ');
    if (/discontinued/i.test(joined)) {
      discontinuationRow = row;
      break;
    }
  }

  let endRow = discontinuationRow ? discontinuationRow - 1 : rows.length;
  endRow = trimBlankRows(rows, headerRow, endRow, groupColumn, endColumn);

  const availabilityMatrix = regionHasToken(rows, headerRow, endRow, groupColumn, endColumn, /^x$/i);
  const notes = [
    `${alignedGroups.length} numbered supplier groups detected`,
    'Group rows contain prices that can be inherited by colors below them',
  ];
  if (availabilityMatrix) notes.push('Size availability is encoded as an X / dimension matrix');

  return {
    id: `grouped-${headerRow}-${endRow}`,
    label: 'Main grouped price matrix',
    kind: 'grouped-price-matrix',
    confidence: alignedGroups.length >= 5 ? 'high' : 'medium',
    rangeA1: rangeA1(headerRow, groupColumn, endRow, endColumn),
    startRow: headerRow,
    endRow,
    startColumn: groupColumn,
    endColumn,
    headerRow,
    notes,
  };
}

function recordBlockRegions(rows: string[][], scanStartColumn: number): SupplierImportDetectedRegion[] {
  const recordRows: number[] = [];
  for (let row = 1; row <= rows.length; row += 1) {
    const values = rows[row - 1] ?? [];
    const nonEmpty = rowNonEmptyCount(values, scanStartColumn, values.length);
    if (nonEmpty < 3) continue;
    const hasNumber = values.slice(scanStartColumn - 1).some((value) => numericValue(value) !== undefined);
    const hasText = values.slice(scanStartColumn - 1).some((value) => valuePresent(value) && numericValue(value) === undefined);
    if (hasNumber && hasText) recordRows.push(row);
  }

  const blocks: Array<{ start: number; end: number }> = [];
  let start: number | undefined;
  let previous: number | undefined;

  recordRows.forEach((row) => {
    if (start === undefined || previous === undefined || row > previous + 1) {
      if (start !== undefined && previous !== undefined) blocks.push({ start, end: previous });
      start = row;
    }
    previous = row;
  });
  if (start !== undefined && previous !== undefined) blocks.push({ start, end: previous });

  return blocks
    .filter((block) => block.end - block.start + 1 >= 3)
    .map((block, blockIndex) => {
      let startColumn = Number.POSITIVE_INFINITY;
      let endColumn = 0;
      let skuLike = 0;
      let recordCount = 0;

      for (let row = block.start; row <= block.end; row += 1) {
        const values = rows[row - 1] ?? [];
        for (let column = scanStartColumn; column <= values.length; column += 1) {
          const value = values[column - 1] ?? '';
          if (!valuePresent(value)) continue;
          startColumn = Math.min(startColumn, column);
          endColumn = Math.max(endColumn, column);
          if (/^[A-Z0-9]+[-][A-Z0-9*.-]+$/i.test(value.trim())) skuLike += 1;
        }
        recordCount += 1;
      }

      if (!Number.isFinite(startColumn) || endColumn < startColumn) return undefined;

      let startRow = block.start;
      for (let candidate = block.start - 1; candidate >= Math.max(1, block.start - 2); candidate -= 1) {
        if (rowNonEmptyCount(rows[candidate - 1] ?? [], startColumn, endColumn) > 0) {
          startRow = candidate;
        }
      }

      const joined = rows.slice(startRow - 1, block.end)
        .map((row) => row.slice(startColumn - 1, endColumn).join(' '))
        .join(' ');
      const thickness = joined.match(/\b(1\.5|2|3)\s*cm\b/i)?.[1];
      const label = thickness ? `${thickness}cm material table` : `Side material table ${blockIndex + 1}`;
      const notes = [
        `${recordCount} repeated material rows detected`,
      ];
      if (skuLike >= Math.max(2, Math.floor(recordCount / 2))) notes.push('A consistent SKU/code column was detected');

      return {
        id: `record-${startRow}-${block.end}-${startColumn}`,
        label,
        kind: 'record-block' as SupplierImportRegionKind,
        confidence: skuLike >= Math.max(2, Math.floor(recordCount / 2)) ? 'high' : 'medium',
        rangeA1: rangeA1(startRow, startColumn, block.end, endColumn),
        startRow,
        endRow: block.end,
        startColumn,
        endColumn,
        headerRow: startRow < block.start ? startRow : undefined,
        notes,
      };
    })
    .filter((region): region is SupplierImportDetectedRegion => Boolean(region));
}

export function detectStructuredSupplierRegions(rows: string[][]): SupplierImportDetectedRegion[] {
  if (!rows.length) return [];
  const grouped = groupedPriceMatrixRegion(rows);
  const regions: SupplierImportDetectedRegion[] = [];
  if (grouped) regions.push(grouped);

  const rightSideStart = grouped ? grouped.endColumn + 2 : 1;
  if (rightSideStart <= (rows[0]?.length ?? 0)) regions.push(...recordBlockRegions(rows, rightSideStart));

  if (!regions.length) {
    let firstRow = 1;
    while (firstRow <= rows.length && rowNonEmptyCount(rows[firstRow - 1] ?? []) === 0) firstRow += 1;
    let lastRow = rows.length;
    while (lastRow >= firstRow && rowNonEmptyCount(rows[lastRow - 1] ?? []) === 0) lastRow -= 1;
    let firstColumn = Number.POSITIVE_INFINITY;
    let lastColumn = 0;
    for (let row = firstRow; row <= lastRow; row += 1) {
      (rows[row - 1] ?? []).forEach((value, index) => {
        if (!valuePresent(value)) return;
        firstColumn = Math.min(firstColumn, index + 1);
        lastColumn = Math.max(lastColumn, index + 1);
      });
    }
    if (Number.isFinite(firstColumn) && lastColumn >= firstColumn) {
      regions.push({
        id: 'primary-data-area',
        label: 'Primary data area',
        kind: firstRow === 1 ? 'tabular' : 'unknown',
        confidence: firstRow === 1 ? 'medium' : 'low',
        rangeA1: rangeA1(firstRow, firstColumn, lastRow, lastColumn),
        startRow: firstRow,
        endRow: lastRow,
        startColumn: firstColumn,
        endColumn: lastColumn,
        headerRow: firstRow,
        notes: [firstRow === 1 ? 'The first populated row is being treated as the header row' : 'Review the selected table boundaries before mapping'],
      });
    }
  }

  return regions;
}

function parseCellReference(value: string) {
  const match = value.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return undefined;
  let column = 0;
  for (const character of match[1]) column = column * 26 + (character.charCodeAt(0) - 64);
  return { row: Number(match[2]), column };
}

function parseRangeReference(value: string) {
  const normalized = value.split('!').pop()?.replace(/\$/g, '') ?? value;
  const [startText, endText = startText] = normalized.split(':');
  const start = parseCellReference(startText);
  const end = parseCellReference(endText);
  if (!start || !end) return undefined;
  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endColumn: Math.max(start.column, end.column),
  };
}

export function structuredTableForRange(preview: SupplierImportStructuredPreview, selectedRangeA1: string): SupplierImportRangeTable {
  const parsed = parseRangeReference(selectedRangeA1);
  if (!parsed) return { headers: preview.headers, rows: preview.rows, totalRows: preview.totalRows, rangeA1: selectedRangeA1 };

  const width = parsed.endColumn - parsed.startColumn + 1;
  const headerValues = Array.from({ length: width }, (_, index) => preview.sourceRows[parsed.startRow - 1]?.[parsed.startColumn - 1 + index] ?? '');
  const headers = headerValues.map((value, index) => value.trim() || `Column ${excelColumn(parsed.startColumn + index)}`);
  const bodyRows = preview.sourceRows
    .slice(parsed.startRow, parsed.endRow)
    .map((row) => Array.from({ length: width }, (_, index) => row[parsed.startColumn - 1 + index] ?? ''));

  return {
    headers,
    rows: bodyRows.slice(0, 8),
    totalRows: bodyRows.length,
    rangeA1: rangeA1(parsed.startRow, parsed.startColumn, parsed.endRow, parsed.endColumn),
  };
}

function previewFromSourceRows({
  fileName,
  fileType,
  sheetName,
  sheetNames,
  sourceRows,
  sourceRowCount,
  sourceColumnCount,
}: {
  fileName: string;
  fileType: 'csv' | 'xlsx';
  sheetName?: string;
  sheetNames: string[];
  sourceRows: string[][];
  sourceRowCount: number;
  sourceColumnCount: number;
}): SupplierImportStructuredPreview {
  const detectedRegions = detectStructuredSupplierRegions(sourceRows);
  const primary = detectedRegions[0];
  const primaryStartRow = primary?.headerRow ?? primary?.startRow ?? 1;
  const primaryStartColumn = primary?.startColumn ?? 1;
  const primaryEndColumn = primary?.endColumn ?? sourceColumnCount;
  const headerWidth = Math.max(1, primaryEndColumn - primaryStartColumn + 1);
  const headers = Array.from({ length: headerWidth }, (_, index) => {
    const value = sourceRows[primaryStartRow - 1]?.[primaryStartColumn - 1 + index] ?? '';
    return value.trim() || `Column ${excelColumn(primaryStartColumn + index)}`;
  });
  const dataRows = sourceRows
    .slice(primaryStartRow, primary?.endRow ?? sourceRows.length)
    .map((row) => Array.from({ length: headerWidth }, (_, index) => row[primaryStartColumn - 1 + index] ?? ''));

  return {
    fileName,
    fileType,
    sheetName,
    sheetNames,
    headers,
    rows: dataRows.slice(0, 8),
    totalRows: dataRows.length,
    sourceRows,
    sourceRowCount,
    sourceColumnCount,
    detectedRegions,
  };
}

export function structuredPreviewFromCsvText(text: string, fileName = 'supplier.csv'): SupplierImportStructuredPreview {
  const parsed = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (!parsed.length) throw new Error('This CSV does not contain any readable rows.');

  const width = Math.max(...parsed.map((row) => row.length), 1);
  const sourceRows = rectangularRows(parsed, width);
  const preview = previewFromSourceRows({
    fileName,
    fileType: 'csv',
    sheetNames: [],
    sourceRows,
    sourceRowCount: sourceRows.length,
    sourceColumnCount: width,
  });

  if (preview.detectedRegions[0]?.kind !== 'tabular') {
    preview.detectedRegions = [{
      id: 'csv-table',
      label: 'CSV table',
      kind: 'tabular',
      confidence: 'high',
      rangeA1: rangeA1(1, 1, sourceRows.length, width),
      startRow: 1,
      endRow: sourceRows.length,
      startColumn: 1,
      endColumn: width,
      headerRow: 1,
      notes: ['CSV header row detected'],
    }];
    const table = structuredTableForRange(preview, preview.detectedRegions[0].rangeA1);
    preview.headers = table.headers;
    preview.rows = table.rows;
  }

  return preview;
}

function worksheetRows(worksheet: {
  actualRowCount: number;
  actualColumnCount: number;
  getRow: (index: number) => { getCell: (column: number) => { text: string } };
}) {
  const rowCount = Math.min(Math.max(worksheet.actualRowCount, 1), MAX_SOURCE_ROWS);
  const columnCount = Math.min(Math.max(worksheet.actualColumnCount, 1), MAX_SOURCE_COLUMNS);
  return {
    rows: Array.from({ length: rowCount }, (_, rowIndex) => (
      Array.from({ length: columnCount }, (_, columnIndex) => worksheet.getRow(rowIndex + 1).getCell(columnIndex + 1).text.trim())
    )),
    rowCount,
    columnCount,
  };
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

  const extracted = worksheetRows(worksheet);
  if (!extracted.rows.some((row) => row.some(valuePresent))) throw new Error(`${worksheet.name} does not contain any readable rows.`);

  return previewFromSourceRows({
    fileName: file.name,
    fileType: 'xlsx',
    sheetName: worksheet.name,
    sheetNames: workbook.worksheets.map((candidate) => candidate.name),
    sourceRows: extracted.rows,
    sourceRowCount: worksheet.actualRowCount,
    sourceColumnCount: worksheet.actualColumnCount,
  });
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
