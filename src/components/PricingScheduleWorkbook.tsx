import { useEffect, useMemo, useRef, useState } from 'react';
import type { IWorkbookData } from '@univerjs/core';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import '@univerjs/preset-sheets-core/lib/index.css';
import {
  autoDetectPricingScheduleMapping,
  createPricingScheduleData,
  exportExcelPricingWorkbook,
  importExcelPricingWorkbook,
  mergePricingScheduleData,
  PRICING_SCHEDULE_FIELD_LABELS,
  pricingScheduleColumnOptions,
  pricingScheduleSheets,
} from '../services/pricingSchedule';
import { useQuoteStore } from '../store/quoteStore';
import {
  PRICING_SCHEDULE_FIELDS,
  type PricingScheduleData,
  type PricingScheduleField,
  type PricingScheduleMapping,
  type Quote,
} from '../types/quote';
import { PricingScheduleBuilder } from './PricingScheduleBuilder';
import { PricingScheduleCustomerTable } from './PricingScheduleCustomerTable';
import '../pricing-schedule.css';

const SAVE_DEBOUNCE_MS = 500;
type WorkspaceMode = 'builder' | 'spreadsheet';

function positiveInteger(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function baseMapping(schedule: PricingScheduleData): PricingScheduleMapping {
  const sheets = pricingScheduleSheets(schedule.workbookData);
  return schedule.mapping ?? {
    sheetId: sheets[0]?.id ?? '',
    headerRow: 1,
    firstDataRow: 2,
    columns: {},
  };
}

export function PricingScheduleWorkbook({ quote }: { quote: Quote }) {
  const updateQuote = useQuoteStore((state) => state.updateQuote);
  const schedule = quote.pricingSchedule ?? createPricingScheduleData(quote.id);
  const scheduleRef = useRef(schedule);
  const hostRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<WorkspaceMode>(schedule.publishSource === 'workbook' ? 'spreadsheet' : 'builder');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    scheduleRef.current = quote.pricingSchedule ?? createPricingScheduleData(quote.id);
  }, [quote.id, quote.pricingSchedule]);

  const saveSchedule = (patch: Partial<PricingScheduleData>) => {
    const next = mergePricingScheduleData(quote.id, scheduleRef.current, patch);
    scheduleRef.current = next;
    updateQuote(quote.id, { pricingSchedule: next });
  };

  const sheets = useMemo(() => pricingScheduleSheets(schedule.workbookData), [schedule.workbookData]);
  const columnOptions = useMemo(
    () => pricingScheduleColumnOptions(schedule.workbookData, schedule.mapping),
    [schedule.workbookData, schedule.mapping],
  );

  useEffect(() => {
    if (mode !== 'spreadsheet') return;
    const host = hostRef.current;
    const workbookData = scheduleRef.current.workbookData;
    if (!host || !workbookData) return;

    const container = document.createElement('div');
    container.className = 'pricing-schedule-univer-mount';
    host.append(container);

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS) },
      presets: [
        UniverSheetsCorePreset({
          container,
          header: false,
          toolbar: true,
          formulaBar: true,
          footer: { sheetBar: true, statisticBar: true, menus: true, zoomSlider: true },
          contextMenu: true,
          disableAutoFocus: true,
        }),
      ],
    });

    const workbook = univerAPI.createWorkbook(workbookData as IWorkbookData);
    let saveTimer: number | undefined;
    const queueSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => saveSchedule({ workbookData: workbook.save() }), SAVE_DEBOUNCE_MS);
    };
    const commandSubscription = workbook.onCommandExecuted(queueSave);

    return () => {
      window.clearTimeout(saveTimer);
      const next = mergePricingScheduleData(quote.id, scheduleRef.current, { workbookData: workbook.save() });
      scheduleRef.current = next;
      updateQuote(quote.id, { pricingSchedule: next });
      commandSubscription.dispose();
      queueMicrotask(() => {
        univer.dispose();
        container.remove();
      });
    };
  }, [mode, quote.id, quote.pricingSchedule?.importedAt]);

  const setMapping = (patch: Partial<PricingScheduleMapping>) => {
    const current = baseMapping(scheduleRef.current);
    saveSchedule({ publishSource: 'workbook', mapping: { ...current, ...patch, columns: patch.columns ?? current.columns } });
  };

  const setColumn = (field: PricingScheduleField, value: string) => {
    const mapping = baseMapping(scheduleRef.current);
    const columns = { ...mapping.columns };
    if (value === '') delete columns[field];
    else columns[field] = Number(value);
    setMapping({ columns });
  };

  const autoMap = () => {
    const mapping = autoDetectPricingScheduleMapping(scheduleRef.current.workbookData);
    if (!mapping) {
      setMessage('I could not confidently identify the commercial columns. Map them manually below.');
      return;
    }
    saveSchedule({ publishSource: 'workbook', mapping });
    setMessage('Headers mapped. Spreadsheet is now the published source; unmapped columns remain internal.');
  };

  const publishWorkbook = () => {
    saveSchedule({ publishSource: 'workbook' });
    setMessage('Spreadsheet is now the published source for the customer schedule.');
  };

  const publishBuilder = () => {
    saveSchedule({ publishSource: 'builder' });
    setMessage('Structured Builder is now the published source for the customer schedule.');
  };

  const importFile = async (file: File) => {
    setImporting(true);
    setMessage('');
    try {
      const workbookData = await importExcelPricingWorkbook(file);
      const mapping = autoDetectPricingScheduleMapping(workbookData);
      saveSchedule({
        publishSource: 'workbook',
        workbookData,
        mapping,
        sourceFileName: file.name,
        importedAt: new Date().toISOString(),
      });
      setMode('spreadsheet');
      setMessage(mapping
        ? 'Workbook imported, commercial columns auto-mapped, and Spreadsheet set as the published source.'
        : 'Workbook imported. Map the customer-facing columns below.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The workbook could not be imported.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="pricing-schedule-workspace">
      <header className="pricing-schedule-workspace-header pricing-schedule-mode-header">
        <div>
          <span className="quote-control-heading">Pricing Schedule workspace</span>
          <small>{schedule.customerItems.length} published customer row{schedule.customerItems.length === 1 ? '' : 's'} · source: {schedule.publishSource === 'workbook' ? 'Spreadsheet' : 'Structured Builder'}</small>
        </div>
        <div className="pricing-schedule-mode-switch" aria-label="Pricing Schedule workspace mode">
          <button type="button" className={mode === 'builder' ? 'active' : ''} onClick={() => setMode('builder')}>Builder</button>
          <button type="button" className={mode === 'spreadsheet' ? 'active' : ''} onClick={() => setMode('spreadsheet')}>Spreadsheet</button>
        </div>
      </header>

      {message && <div className="pricing-schedule-message">{message}</div>}

      {mode === 'builder' ? (
        <>
          <div className="pricing-schedule-source-banner">
            <div><strong>Structured Builder</strong><span>Recommended for repeatable builder/community pricing.</span></div>
            {schedule.publishSource === 'builder'
              ? <strong className="is-published">✓ Published source</strong>
              : <button type="button" onClick={publishBuilder}>Publish Builder</button>}
          </div>
          <PricingScheduleBuilder quote={quote} />
        </>
      ) : (
        <>
          <header className="pricing-schedule-workspace-header pricing-schedule-spreadsheet-toolbar">
            <div>
              <span className="quote-control-heading">Advanced spreadsheet</span>
              <small>{schedule.sourceFileName || 'Built in SalesShop'} · import builder templates or do custom calculations here.</small>
            </div>
            <div className="pricing-schedule-workbook-actions">
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
              }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Importing…' : 'Import .xlsx'}</button>
              <button type="button" onClick={() => void exportExcelPricingWorkbook(scheduleRef.current.workbookData, scheduleRef.current.sourceFileName || `${quote.title}.xlsx`)}>Export .xlsx</button>
              <button type="button" onClick={autoMap}>Auto-map headers</button>
              {schedule.publishSource === 'workbook' ? <strong className="pricing-schedule-published-pill">✓ Published</strong> : <button type="button" onClick={publishWorkbook}>Publish Spreadsheet</button>}
            </div>
          </header>

          <div className="pricing-schedule-workbook-layout">
            <div ref={hostRef} className="pricing-schedule-workbook-host" aria-label="Pricing schedule workbook" />
            <aside className="pricing-schedule-mapping-panel">
              <header><strong>Publish mapping</strong><small>Only mapped fields become customer contract data. Everything else stays internal.</small></header>
              <label><span>Sheet</span><select value={schedule.mapping?.sheetId ?? sheets[0]?.id ?? ''} onChange={(event) => setMapping({ sheetId: event.target.value })}>{sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select></label>
              <div className="pricing-schedule-row-map">
                <label><span>Header row</span><input type="number" min="1" value={schedule.mapping?.headerRow ?? 1} onChange={(event) => setMapping({ headerRow: positiveInteger(event.target.value, 1) })} /></label>
                <label><span>First data row</span><input type="number" min="1" value={schedule.mapping?.firstDataRow ?? 2} onChange={(event) => setMapping({ firstDataRow: positiveInteger(event.target.value, 2) })} /></label>
                <label><span>Last data row</span><input type="number" min="1" value={schedule.mapping?.lastDataRow ?? ''} placeholder="Auto" onChange={(event) => setMapping({ lastDataRow: event.target.value ? positiveInteger(event.target.value, 2) : undefined })} /></label>
              </div>
              <div className="pricing-schedule-field-map">
                {PRICING_SCHEDULE_FIELDS.map((field) => <label key={field}><span>{PRICING_SCHEDULE_FIELD_LABELS[field]}</span><select value={schedule.mapping?.columns[field] ?? ''} onChange={(event) => setColumn(field, event.target.value)}><option value="">Not mapped</option>{columnOptions.map((option) => <option value={option.index} key={`${field}-${option.index}`}>{option.label}</option>)}</select></label>)}
              </div>
              <div className="pricing-schedule-publish-note"><strong>{schedule.publishSource === 'workbook' ? schedule.customerItems.length : '—'}</strong><span>published rows</span><small>Description + Customer price are required before Send.</small></div>
            </aside>
          </div>

          <section className="pricing-schedule-mapped-preview">
            <header><div><span className="quote-control-heading">Spreadsheet publish preview</span><small>Switching the published source to Spreadsheet makes these mapped rows contractual.</small></div></header>
            <PricingScheduleCustomerTable items={schedule.publishSource === 'workbook' ? schedule.customerItems : mergePricingScheduleData(quote.id, schedule, { publishSource: 'workbook' }).customerItems} compact />
          </section>
        </>
      )}
    </div>
  );
}
