import type { IWorkbookData } from '@univerjs/core';
import { LocaleType } from '@univerjs/core';
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

interface UniverCellData {
  v?: unknown;
  f?: string;
}

interface UniverWorksheetLike {
  id?: string;
  name?: string;
  rowCount?: number;
  columnCount?: number;
  cellData?: Record<string, Record<string, UniverCellData>>;
  columnData?: Record<string, { w?: number }>;
  mergeData?: Array<{ startRow: number; startColumn: number; endRow: number; endColumn: number }>;
}

interface UniverWorkbookLike {
  id?: string;
  name?: string;
  sheetOrder?: string[];
  sheets?: Record<string, UniverWorksheetLike>;
}

export function createBlankPricingScheduleWorkbook(quoteId: string): IWorkbookData {
  const sheetId = `schedule_sheet_${crypto.randomUUID()}`;
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
        zoomRatio: 1,
        freeze: { startRow: -1, startColumn: -1, xSplit: 0, ySplit: 0 },
        scrollTop: 0,
        scrollLeft: 0,
        defaultColumnWidth: 100,
        defaultRowHeight: 23,
        mergeData: [],
        cellData: {},
        rowData: {},
        columnData: {},
        showGridlines: 1,
        rowHeader: { width: 46, hidden: 0 },
        columnHeader: { height: 20, hidden: 0 },
        rightToLeft: 0,
      },
    },
    resources: [],
  } as IWorkbookData;
}

export function createPricingScheduleData(quoteId: string): PricingScheduleData {
  return {
    workbookData: createBlankPricingScheduleWorkbook(quoteId),
    customerItems: [],
  };
}

function asWorkbook(value: unknown): UniverWorkbookLike | null {
  if (!value || typeof value !== 'object') return null;
  return value as UniverWorkbookLike;
}

export function pricingScheduleSheets(workbookData: unknown) {
  const workbook = asWorkbook(workbookData);
  if (!workbook?.sheets) return [] as Array<{ id: string; name: string; rowCount: number; columnCount: number }>;
  const order = workbook.sheetOrder?.length ? workbook.sheetOrder : Object.keys(workbook.sheets);
  return order
    .map((id) => workbook.sheets?.[id] ? {
      id,
      name: workbook.sheets[id].name || 'Sheet',
      rowCount: Number(workbook.sheets[id].rowCount ?? 0),
      columnCount: Number(workbook.sheets[id].columnCount ?? 0),
    } : null)
    .filter((item): item is { id: string; name: string; rowCount: number; columnCount: number } => Boolean(item));
}

function cellValue(workbookData: unknown, sheetId: string, rowIndex: number, columnIndex: number) {
  const sheet = asWorkbook(workbookData)?.sheets?.[sheetId];
  const cell = sheet?.cellData?.[String(rowIndex)]?.[String(columnIndex)];
  return cell?.v ?? '';
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('value' in (value as Record<string, unknown>)) return String((value as Record<string, unknown>).value ?? '');
    return '';
  }
  return String(value);
}

export function spreadsheetColumnName(index: number) {
  let value = Math.max(0, Math.floor(index)) + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function normalizeHeader(value: unknown) {
  return displayValue(value)
    .replace(/\s+/g, ' ')
    .replace(/[.]/g, '')
    .trim()
    .toLowerCase();
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

function detectColumns(workbookData: unknown, sheetId: string, rowIndex: number) {
  const sheet = asWorkbook(workbookData)?.sheets?.[sheetId];
  const maxColumns = Math.max(Number(sheet?.columnCount ?? 0), 60);
  const columns: PricingScheduleColumnMapping = {};
  let score = 0;

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    const header = normalizeHeader(cellValue(workbookData, sheetId, rowIndex, columnIndex));
    if (!header) continue;
    (Object.keys(HEADER_PATTERNS) as PricingScheduleField[]).forEach((field) => {
      if (columns[field] !== undefined) return;
      if (HEADER_PATTERNS[field].some((pattern) => pattern.test(header))) {
        columns[field] = columnIndex;
        score += 1;
      }
    });
  }
  return { columns, score };
}

function lastUsedRow(workbookData: unknown, sheetId: string) {
  const cellData = asWorkbook(workbookData)?.sheets?.[sheetId]?.cellData;
  if (!cellData) return 1;
  const rows = Object.keys(cellData).map(Number).filter(Number.isFinite);
  return rows.length ? Math.max(...rows) + 1 : 1;
}

export function autoDetectPricingScheduleMapping(workbookData: unknown): PricingScheduleMapping | undefined {
  const sheets = pricingScheduleSheets(workbookData);
  let best: { sheetId: string; headerRow: number; columns: PricingScheduleColumnMapping; score: number } | null = null;

  sheets.forEach((sheet) => {
    const scanRows = Math.min(Math.max(sheet.rowCount, 20), 30);
    for (let rowIndex = 0; rowIndex < scanRows; rowIndex += 1) {
      const detected = detectColumns(workbookData, sheet.id, rowIndex);
      if (!best || detected.score > best.score) best = { sheetId: sheet.id, headerRow: rowIndex + 1, ...detected };
    }
  });

  if (!best || best.score < 3) return undefined;
  return {
    sheetId: best.sheetId,
    headerRow: best.headerRow,
    firstDataRow: best.headerRow + 1,
    lastDataRow: lastUsedRow(workbookData, best.sheetId),
    columns: best.columns,
  };
}

export function pricingScheduleColumnOptions(workbookData: unknown, mapping?: PricingScheduleMapping) {
  const sheets = pricingScheduleSheets(workbookData);
  const sheetId = mapping?.sheetId ?? sheets[0]?.id;
  if (!sheetId) return [] as Array<{ index: number; label: string }>;
  const headerRowIndex = Math.max(0, (mapping?.headerRow ?? 1) - 1);
  const sheet = asWorkbook(workbookData)?.sheets?.[sheetId];
  const maxColumn = Math.max(Number(sheet?.columnCount ?? 0), 24);
  const options: Array<{ index: number; label: string }> = [];
  for (let columnIndex = 0; columnIndex < maxColumn; columnIndex += 1) {
    const header = displayValue(cellValue(workbookData, sheetId, headerRowIndex, columnIndex)).replace(/\s+/g, ' ').trim();
    if (header) options.push({ index: columnIndex, label: `${spreadsheetColumnName(columnIndex)} · ${header}` });
  }
  return options;
}

function mappedText(workbookData: unknown, mapping: PricingScheduleMapping, rowIndex: number, field: PricingScheduleField) {
  const column = mapping.columns[field];
  if (column === undefined) return undefined;
  const value = displayValue(cellValue(workbookData, mapping.sheetId, rowIndex, column)).trim();
  return value || undefined;
}

function mappedNumber(workbookData: unknown, mapping: PricingScheduleMapping, rowIndex: number, field: PricingScheduleField) {
  const column = mapping.columns[field];
  if (column === undefined) return undefined;
  const raw = cellValue(workbookData, mapping.sheetId, rowIndex, column);
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const numeric = Number(displayValue(raw).replace(/[$,]/g, '').trim());
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function derivePricingScheduleItems(workbookData: unknown, mapping?: PricingScheduleMapping): PricingScheduleItem[] {
  if (!mapping?.sheetId) return [];
  const firstRow = Math.max(1, mapping.firstDataRow) - 1;
  const lastRow = Math.max(mapping.firstDataRow, mapping.lastDataRow ?? lastUsedRow(workbookData, mapping.sheetId)) - 1;
  const items: PricingScheduleItem[] = [];

  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
    const item: PricingScheduleItem = {
      sourceRow: rowIndex + 1,
      series: mappedText(workbookData, mapping, rowIndex, 'series'),
      itemType: mappedText(workbookData, mapping, rowIndex, 'itemType'),
      planNumber: mappedText(workbookData, mapping, rowIndex, 'planNumber'),
      planName: mappedText(workbookData, mapping, rowIndex, 'planName'),
      optionCode: mappedText(workbookData, mapping, rowIndex, 'optionCode'),
      description: mappedText(workbookData, mapping, rowIndex, 'description'),
      customerPrice: mappedNumber(workbookData, mapping, rowIndex, 'customerPrice'),
    };
    if (item.series || item.itemType || item.planNumber || item.planName || item.optionCode || item.description || item.customerPrice !== undefined) {
      items.push(item);
    }
  }
  return items;
}

export function mergePricingScheduleData(
  quoteId: string,
  current: PricingScheduleData | undefined,
  patch: Partial<PricingScheduleData>,
): PricingScheduleData {
  const workbookData = patch.workbookData ?? current?.workbookData ?? createBlankPricingScheduleWorkbook(quoteId);
  const mapping = patch.mapping !== undefined ? patch.mapping : current?.mapping;
  return {
    ...current,
    ...patch,
    workbookData,
    mapping,
    customerItems: derivePricingScheduleItems(workbookData, mapping),
  };
}

export function validatePricingScheduleForSend(data?: PricingScheduleData) {
  if (!data?.workbookData) throw new Error('Add or import the pricing workbook before sending this schedule.');
  if (!data.mapping?.sheetId) throw new Error('Map the pricing workbook before sending this schedule.');
  if (data.mapping.columns.description === undefined || data.mapping.columns.customerPrice === undefined) {
    throw new Error('Map at least Description and Customer price before sending this schedule.');
  }
  if (!data.customerItems.length) throw new Error('The mapped pricing schedule does not contain any customer rows.');
}

function columnIndexFromLetters(letters: string) {
  return letters.toUpperCase().split('').reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function parseA1Cell(reference: string) {
  const match = reference.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return { row: Number(match[2]) - 1, column: columnIndexFromLetters(match[1]) };
}

function parseMerge(reference: string) {
  const [start, end = start] = reference.split(':');
  const startCell = parseA1Cell(start);
  const endCell = parseA1Cell(end);
  if (!startCell || !endCell) return null;
  return { startRow: startCell.row, startColumn: startCell.column, endRow: endCell.row, endColumn: endCell.column };
}

function excelScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value);
  const object = value as Record<string, unknown>;
  if (Array.isArray(object.richText)) {
    return object.richText.map((part) => typeof part === 'object' && part ? String((part as Record<string, unknown>).text ?? '') : '').join('');
  }
  if (typeof object.text === 'string') return object.text;
  if (typeof object.hyperlink === 'string') return String(object.text ?? object.hyperlink);
  if (object.result !== undefined) return excelScalar(object.result);
  return null;
}

export async function importExcelPricingWorkbook(file: File): Promise<IWorkbookData> {
  const { default: ExcelJS } = await import('exceljs');
  const excel = new ExcelJS.Workbook();
  const bytes = new Uint8Array(await file.arrayBuffer());
  await excel.xlsx.load(bytes as never);

  const sheets: Record<string, UniverWorksheetLike> = {};
  const sheetOrder: string[] = [];

  excel.eachSheet((worksheet) => {
    const sheetId = `sheet_${crypto.randomUUID()}`;
    sheetOrder.push(sheetId);
    const cellData: Record<string, Record<string, UniverCellData>> = {};
    const columnData: Record<string, { w?: number }> = {};

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const raw = cell.value as unknown;
        if (raw === null || raw === undefined) return;
        const record: UniverCellData = {};
        if (typeof raw === 'object' && raw && 'formula' in (raw as Record<string, unknown>)) {
          const formula = String((raw as Record<string, unknown>).formula ?? '');
          if (formula) record.f = formula.startsWith('=') ? formula : `=${formula}`;
          const result = excelScalar((raw as Record<string, unknown>).result);
          if (result !== null) record.v = result;
        } else {
          const scalar = excelScalar(raw);
          if (scalar !== null) record.v = scalar;
        }
        if (record.v === undefined && record.f === undefined) return;
        const rowIndex = rowNumber - 1;
        const columnIndex = columnNumber - 1;
        cellData[String(rowIndex)] ??= {};
        cellData[String(rowIndex)][String(columnIndex)] = record;
      });
    });

    worksheet.columns.forEach((column, index) => {
      if (column.width) columnData[String(index)] = { w: Math.max(50, Math.round(column.width * 7.2)) };
    });

    const mergeRefs = ((worksheet.model as unknown as { merges?: string[] }).merges ?? []);
    const mergeData = mergeRefs.map(parseMerge).filter((item): item is NonNullable<ReturnType<typeof parseMerge>> => Boolean(item));

    sheets[sheetId] = {
      id: sheetId,
      name: worksheet.name || `Sheet ${sheetOrder.length}`,
      rowCount: Math.max(worksheet.rowCount, 200),
      columnCount: Math.max(worksheet.columnCount, 24),
      cellData,
      columnData,
      mergeData,
    };
  });

  if (!sheetOrder.length) return createBlankPricingScheduleWorkbook(`import_${crypto.randomUUID()}`);

  return {
    id: `schedule_workbook_${crypto.randomUUID()}`,
    name: file.name.replace(/\.xlsx?$/i, '') || 'Pricing Schedule',
    appVersion: '1.0.3',
    locale: LocaleType.EN_US,
    styles: {},
    sheetOrder,
    sheets,
    resources: [],
  } as IWorkbookData;
}

function workbookCellEntries(sheet: UniverWorksheetLike) {
  const entries: Array<{ row: number; column: number; cell: UniverCellData }> = [];
  Object.entries(sheet.cellData ?? {}).forEach(([rowKey, columns]) => {
    Object.entries(columns ?? {}).forEach(([columnKey, cell]) => {
      entries.push({ row: Number(rowKey), column: Number(columnKey), cell });
    });
  });
  return entries;
}

export async function exportExcelPricingWorkbook(workbookData: unknown, suggestedName = 'pricing-schedule.xlsx') {
  const { default: ExcelJS } = await import('exceljs');
  const excel = new ExcelJS.Workbook();
  const workbook = asWorkbook(workbookData);
  if (!workbook?.sheets) throw new Error('There is no workbook to export.');
  const order = workbook.sheetOrder?.length ? workbook.sheetOrder : Object.keys(workbook.sheets);

  order.forEach((sheetId) => {
    const source = workbook.sheets?.[sheetId];
    if (!source) return;
    const worksheet = excel.addWorksheet(source.name || 'Sheet');
    workbookCellEntries(source).forEach(({ row, column, cell }) => {
      const target = worksheet.getCell(row + 1, column + 1);
      if (cell.f) {
        target.value = { formula: cell.f.replace(/^=/, ''), result: cell.v as never };
      } else if (cell.v !== undefined) {
        target.value = cell.v as never;
      }
    });
    Object.entries(source.columnData ?? {}).forEach(([columnKey, data]) => {
      if (data.w) worksheet.getColumn(Number(columnKey) + 1).width = Math.max(6, data.w / 7.2);
    });
    (source.mergeData ?? []).forEach((merge) => {
      worksheet.mergeCells(
        merge.startRow + 1,
        merge.startColumn + 1,
        merge.endRow + 1,
        merge.endColumn + 1,
      );
    });
  });

  const buffer = await excel.xlsx.writeBuffer();
  const blob = new Blob([buffer as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName.toLowerCase().endsWith('.xlsx') ? suggestedName : `${suggestedName}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
