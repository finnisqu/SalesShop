import type { IWorkbookData } from '@univerjs/core';
import { LocaleType } from '@univerjs/core';
import { createPricingScheduleBuilderData, deriveBuilderCustomerItems, pricingBuilderHealth } from './pricingScheduleBuilder';
import type {
  PricingScheduleColumnMapping,
  PricingScheduleData,
  PricingScheduleField,
  PricingScheduleItem,
  PricingScheduleMapping,
} from '../types/quote';

export const PRICING_SCHEDULE_FIELD_LABELS: Record<PricingScheduleField, string> = {
  series: 'Series',
  itemType: 'Base / Option',
  planNumber: 'Plan #',
  planName: 'Plan name',
  optionCode: 'Option code',
  description: 'Description',
  customerPrice: 'Customer price',
};

const STARTER_COLUMNS: Array<{ field: PricingScheduleField; label: string; width: number }> = [
  { field: 'series', label: 'Series', width: 95 },
  { field: 'itemType', label: 'Base / Option', width: 105 },
  { field: 'planNumber', label: 'Plan #', width: 90 },
  { field: 'planName', label: 'Plan Name', width: 145 },
  { field: 'optionCode', label: 'Option Code', width: 115 },
  { field: 'description', label: 'Description', width: 300 },
  { field: 'customerPrice', label: 'Customer Price', width: 120 },
];

type Cell = { v?: unknown; f?: string };
type Sheet = {
  id?: string;
  name?: string;
  rowCount?: number;
  columnCount?: number;
  cellData?: Record<string, Record<string, Cell>>;
  columnData?: Record<string, { w?: number }>;
  mergeData?: Array<{ startRow: number; startColumn: number; endRow: number; endColumn: number }>;
};
type Workbook = { sheetOrder?: string[]; sheets?: Record<string, Sheet> };

function workbook(value: unknown) {
  return value && typeof value === 'object' ? value as Workbook : null;
}

export function createBlankPricingScheduleWorkbook(quoteId: string): IWorkbookData {
  const sheetId = `schedule_sheet_${crypto.randomUUID()}`;
  const headerCells = Object.fromEntries(STARTER_COLUMNS.map((column, index) => [String(index), { v: column.label }]));
  const columnData = Object.fromEntries(STARTER_COLUMNS.map((column, index) => [String(index), { w: column.width }]));
  return {
    id: `schedule_workbook_${quoteId}`,
    name: 'Pricing Schedule',
    appVersion: '1.0.3',
    locale: LocaleType.EN_US,
    styles: {},
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: 'Schedule',
        rowCount: 200,
        columnCount: 24,
        defaultColumnWidth: 100,
        defaultRowHeight: 23,
        mergeData: [],
        cellData: { '0': headerCells },
        rowData: {},
        columnData,
      },
    },
    resources: [],
  } as IWorkbookData;
}

export function createPricingScheduleData(quoteId: string): PricingScheduleData {
  const workbookData = createBlankPricingScheduleWorkbook(quoteId);
  const sheetId = pricingScheduleSheets(workbookData)[0]?.id ?? '';
  const columns: PricingScheduleColumnMapping = {};
  STARTER_COLUMNS.forEach((column, index) => { columns[column.field] = index; });
  return {
    publishSource: 'builder',
    builder: createPricingScheduleBuilderData(),
    workbookData,
    mapping: { sheetId, headerRow: 1, firstDataRow: 2, columns },
    customerItems: [],
  };
}

export function pricingScheduleSheets(value: unknown) {
  const data = workbook(value);
  if (!data?.sheets) return [] as Array<{ id: string; name: string; rowCount: number; columnCount: number }>;
  const order = data.sheetOrder?.length ? data.sheetOrder : Object.keys(data.sheets);
  const result: Array<{ id: string; name: string; rowCount: number; columnCount: number }> = [];
  for (const id of order) {
    const sheet = data.sheets[id];
    if (!sheet) continue;
    result.push({ id, name: sheet.name || 'Sheet', rowCount: Number(sheet.rowCount ?? 0), columnCount: Number(sheet.columnCount ?? 0) });
  }
  return result;
}

function cellValue(value: unknown, sheetId: string, row: number, column: number) {
  return workbook(value)?.sheets?.[sheetId]?.cellData?.[String(row)]?.[String(column)]?.v ?? '';
}

function text(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (object.value !== undefined) return String(object.value ?? '');
    return '';
  }
  return String(value);
}

export function spreadsheetColumnName(index: number) {
  let n = Math.max(0, Math.floor(index)) + 1;
  let label = '';
  while (n > 0) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

const HEADER_PATTERNS: Record<PricingScheduleField, RegExp[]> = {
  series: [/^spec series$/, /^series$/],
  itemType: [/^base\s*\/\s*opt$/, /^base\s*\/\s*option$/, /^base option$/, /^item type$/],
  planNumber: [/^plan\s*#$/, /^plan number$/, /^plan no$/],
  planName: [/^plan name$/],
  optionCode: [/^option$/, /^option code$/, /^code$/],
  description: [/^description$/],
  customerPrice: [/contract pricing/, /^customer price$/, /^contract price$/, /^price$/],
};

function normalizedHeader(value: unknown) {
  return text(value).replace(/\s+/g, ' ').replace(/[.]/g, '').trim().toLowerCase();
}

function detectColumns(value: unknown, sheetId: string, row: number) {
  const sheet = workbook(value)?.sheets?.[sheetId];
  const maxColumns = Math.max(Number(sheet?.columnCount ?? 0), 60);
  const columns: PricingScheduleColumnMapping = {};
  let score = 0;
  for (let column = 0; column < maxColumns; column += 1) {
    const header = normalizedHeader(cellValue(value, sheetId, row, column));
    if (!header) continue;
    for (const field of Object.keys(HEADER_PATTERNS) as PricingScheduleField[]) {
      if (columns[field] !== undefined) continue;
      if (HEADER_PATTERNS[field].some((pattern) => pattern.test(header))) {
        columns[field] = column;
        score += 1;
      }
    }
  }
  return { columns, score };
}

function lastUsedRow(value: unknown, sheetId: string) {
  const rows = Object.keys(workbook(value)?.sheets?.[sheetId]?.cellData ?? {}).map(Number).filter(Number.isFinite);
  return rows.length ? Math.max(...rows) + 1 : 1;
}

export function autoDetectPricingScheduleMapping(value: unknown): PricingScheduleMapping | undefined {
  const sheets = pricingScheduleSheets(value);
  let bestSheet = '';
  let bestHeaderRow = 0;
  let bestColumns: PricingScheduleColumnMapping = {};
  let bestScore = -1;
  for (const sheet of sheets) {
    const scanRows = Math.min(Math.max(sheet.rowCount, 20), 30);
    for (let row = 0; row < scanRows; row += 1) {
      const detected = detectColumns(value, sheet.id, row);
      if (detected.score > bestScore) {
        bestScore = detected.score;
        bestSheet = sheet.id;
        bestHeaderRow = row + 1;
        bestColumns = detected.columns;
      }
    }
  }
  if (!bestSheet || bestScore < 3) return undefined;
  return { sheetId: bestSheet, headerRow: bestHeaderRow, firstDataRow: bestHeaderRow + 1, lastDataRow: lastUsedRow(value, bestSheet), columns: bestColumns };
}

export function pricingScheduleColumnOptions(value: unknown, mapping?: PricingScheduleMapping) {
  const sheetId = mapping?.sheetId ?? pricingScheduleSheets(value)[0]?.id;
  if (!sheetId) return [] as Array<{ index: number; label: string }>;
  const row = Math.max(0, (mapping?.headerRow ?? 1) - 1);
  const sheet = workbook(value)?.sheets?.[sheetId];
  const maxColumns = Math.max(Number(sheet?.columnCount ?? 0), 24);
  const options: Array<{ index: number; label: string }> = [];
  for (let column = 0; column < maxColumns; column += 1) {
    const header = text(cellValue(value, sheetId, row, column)).replace(/\s+/g, ' ').trim();
    if (header) options.push({ index: column, label: `${spreadsheetColumnName(column)} · ${header}` });
  }
  return options;
}

function mappedText(value: unknown, mapping: PricingScheduleMapping, row: number, field: PricingScheduleField) {
  const column = mapping.columns[field];
  if (column === undefined) return undefined;
  return text(cellValue(value, mapping.sheetId, row, column)).trim() || undefined;
}

function mappedNumber(value: unknown, mapping: PricingScheduleMapping, row: number, field: PricingScheduleField) {
  const column = mapping.columns[field];
  if (column === undefined) return undefined;
  const raw = cellValue(value, mapping.sheetId, row, column);
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const number = Number(text(raw).replace(/[$,]/g, '').trim());
  return Number.isFinite(number) ? number : undefined;
}

export function derivePricingScheduleItems(value: unknown, mapping?: PricingScheduleMapping): PricingScheduleItem[] {
  if (!mapping?.sheetId) return [];
  const first = Math.max(1, mapping.firstDataRow) - 1;
  const last = Math.max(mapping.firstDataRow, mapping.lastDataRow ?? lastUsedRow(value, mapping.sheetId)) - 1;
  const items: PricingScheduleItem[] = [];
  for (let row = first; row <= last; row += 1) {
    const item: PricingScheduleItem = {
      sourceRow: row + 1,
      series: mappedText(value, mapping, row, 'series'),
      itemType: mappedText(value, mapping, row, 'itemType'),
      planNumber: mappedText(value, mapping, row, 'planNumber'),
      planName: mappedText(value, mapping, row, 'planName'),
      optionCode: mappedText(value, mapping, row, 'optionCode'),
      description: mappedText(value, mapping, row, 'description'),
      customerPrice: mappedNumber(value, mapping, row, 'customerPrice'),
    };
    if (item.series || item.itemType || item.planNumber || item.planName || item.optionCode || item.description || item.customerPrice !== undefined) items.push(item);
  }
  return items;
}

export function mergePricingScheduleData(quoteId: string, current: PricingScheduleData | undefined, patch: Partial<PricingScheduleData>): PricingScheduleData {
  const workbookData = patch.workbookData ?? current?.workbookData ?? createBlankPricingScheduleWorkbook(quoteId);
  const mapping = patch.mapping !== undefined ? patch.mapping : current?.mapping;
  const builder = patch.builder !== undefined ? patch.builder : current?.builder;
  const publishSource = patch.publishSource ?? current?.publishSource ?? (builder ? 'builder' : 'workbook');
  const workbookItems = derivePricingScheduleItems(workbookData, mapping);
  const builderItems = deriveBuilderCustomerItems(builder);
  return {
    ...current,
    ...patch,
    publishSource,
    builder,
    workbookData,
    mapping,
    customerItems: publishSource === 'builder' ? builderItems : workbookItems,
  };
}

export function validatePricingScheduleForSend(data?: PricingScheduleData) {
  if (!data) throw new Error('Configure the pricing schedule before sending.');
  const source = data.publishSource ?? (data.builder ? 'builder' : 'workbook');
  if (source === 'builder') {
    const health = pricingBuilderHealth(data.builder);
    if (health.length) throw new Error(`Structured Builder needs review: ${health[0]}`);
    if (!data.customerItems.length) throw new Error('The Structured Builder has not generated any customer pricing rows.');
  } else {
    if (!data.workbookData) throw new Error('Add or import the pricing workbook before sending this schedule.');
    if (!data.mapping?.sheetId) throw new Error('Map the pricing workbook before sending this schedule.');
    if (data.mapping.columns.description === undefined || data.mapping.columns.customerPrice === undefined) throw new Error('Map at least Description and Customer price before sending this schedule.');
    if (!data.customerItems.length) throw new Error('The mapped pricing schedule does not contain any customer rows.');
  }
  const incomplete = data.customerItems.filter((item) => !item.description?.trim() || item.customerPrice === undefined);
  if (incomplete.length) {
    const rows = incomplete.slice(0, 4).map((item) => item.sourceRow).join(', ');
    const suffix = incomplete.length > 4 ? ', …' : '';
    throw new Error(`Complete Description and Customer price on published schedule row${incomplete.length === 1 ? '' : 's'} ${rows}${suffix} before sending.`);
  }
}

function excelScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value);
  const object = value as Record<string, unknown>;
  if (Array.isArray(object.richText)) return object.richText.map((part) => typeof part === 'object' && part ? String((part as Record<string, unknown>).text ?? '') : '').join('');
  if (typeof object.text === 'string') return object.text;
  if (object.result !== undefined) return excelScalar(object.result);
  return null;
}

function columnIndex(letters: string) {
  return letters.toUpperCase().split('').reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function mergeRange(reference: string) {
  const [start, end = start] = reference.split(':');
  const parse = (cell: string) => {
    const match = cell.match(/^([A-Z]+)(\d+)$/i);
    return match ? { row: Number(match[2]) - 1, column: columnIndex(match[1]) } : null;
  };
  const a = parse(start);
  const b = parse(end);
  return a && b ? { startRow: a.row, startColumn: a.column, endRow: b.row, endColumn: b.column } : null;
}

export async function importExcelPricingWorkbook(file: File): Promise<IWorkbookData> {
  const ExcelJS = await import('exceljs');
  const excel = new ExcelJS.Workbook();
  await excel.xlsx.load(new Uint8Array(await file.arrayBuffer()) as never);
  const sheets: Record<string, Sheet> = {};
  const sheetOrder: string[] = [];
  excel.eachSheet((worksheet) => {
    const id = `sheet_${crypto.randomUUID()}`;
    sheetOrder.push(id);
    const cellData: Record<string, Record<string, Cell>> = {};
    const columnData: Record<string, { w?: number }> = {};
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const raw = cell.value as unknown;
        if (raw === null || raw === undefined) return;
        const target: Cell = {};
        if (typeof raw === 'object' && raw && 'formula' in (raw as Record<string, unknown>)) {
          const formula = String((raw as Record<string, unknown>).formula ?? '');
          if (formula) target.f = formula.startsWith('=') ? formula : `=${formula}`;
          const result = excelScalar((raw as Record<string, unknown>).result);
          if (result !== null) target.v = result;
        } else {
          const scalar = excelScalar(raw);
          if (scalar !== null) target.v = scalar;
        }
        if (target.v === undefined && target.f === undefined) return;
        const r = String(rowNumber - 1);
        cellData[r] ??= {};
        cellData[r][String(columnNumber - 1)] = target;
      });
    });
    worksheet.columns.forEach((column, index) => {
      if (column.width) columnData[String(index)] = { w: Math.max(50, Math.round(column.width * 7.2)) };
    });
    const merges = ((worksheet.model as unknown as { merges?: string[] }).merges ?? []).map(mergeRange).filter((item): item is NonNullable<ReturnType<typeof mergeRange>> => Boolean(item));
    sheets[id] = { id, name: worksheet.name || `Sheet ${sheetOrder.length}`, rowCount: Math.max(worksheet.rowCount, 200), columnCount: Math.max(worksheet.columnCount, 24), cellData, columnData, mergeData: merges };
  });
  if (!sheetOrder.length) return createBlankPricingScheduleWorkbook(`import_${crypto.randomUUID()}`);
  return { id: `schedule_workbook_${crypto.randomUUID()}`, name: file.name.replace(/\.xlsx?$/i, '') || 'Pricing Schedule', appVersion: '1.0.3', locale: LocaleType.EN_US, styles: {}, sheetOrder, sheets, resources: [] } as IWorkbookData;
}

export async function exportExcelPricingWorkbook(value: unknown, suggestedName = 'pricing-schedule.xlsx') {
  const ExcelJS = await import('exceljs');
  const excel = new ExcelJS.Workbook();
  const data = workbook(value);
  if (!data?.sheets) throw new Error('There is no workbook to export.');
  const order = data.sheetOrder?.length ? data.sheetOrder : Object.keys(data.sheets);
  for (const id of order) {
    const source = data.sheets[id];
    if (!source) continue;
    const sheet = excel.addWorksheet(source.name || 'Sheet');
    for (const [rowKey, columns] of Object.entries(source.cellData ?? {})) {
      for (const [columnKey, cell] of Object.entries(columns ?? {})) {
        const target = sheet.getCell(Number(rowKey) + 1, Number(columnKey) + 1);
        if (cell.f) target.value = { formula: cell.f.replace(/^=/, ''), result: cell.v as never };
        else if (cell.v !== undefined) target.value = cell.v as never;
      }
    }
    for (const [columnKey, column] of Object.entries(source.columnData ?? {})) {
      if (column.w) sheet.getColumn(Number(columnKey) + 1).width = Math.max(6, column.w / 7.2);
    }
    for (const merge of source.mergeData ?? []) sheet.mergeCells(merge.startRow + 1, merge.startColumn + 1, merge.endRow + 1, merge.endColumn + 1);
  }
  const buffer = await excel.xlsx.writeBuffer();
  const blob = new Blob([buffer as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName.toLowerCase().endsWith('.xlsx') ? suggestedName : `${suggestedName}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
