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
  type PricingScheduleRoute,
  type Quote,
} from '../types/quote';
import { PricingRateSheet } from './PricingRateSheet';
import { PricingScheduleBuilder } from './PricingScheduleBuilder';
import { PricingScheduleCustomerTable } from './PricingScheduleCustomerTable';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import '../pricing-schedule.css';

const SAVE_DEBOUNCE_MS = 500;

type WorkspaceMode = PricingScheduleRoute;

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

function initialMode(schedule: PricingScheduleData): WorkspaceMode {
  if (schedule.route) return schedule.route;
  if (schedule.publishSource === 'workbook') return 'workbook';
  if (schedule.publishSource === 'builder') return 'plan-builder';
  return 'rate-sheet';
}

const ROUTES: Array<{ id: WorkspaceMode; title: string; description: string }> = [
  { id: 'rate-sheet', title: 'Simple Rates', description: 'Material levels, approved colors, sinks and add-ons.' },
  { id: 'plan-builder', title: 'Plan Pricing', description: 'Rate Book + plan takeoffs + reusable option packages.' },
  { id: 'workbook', title: 'Spreadsheet', description: 'Advanced or builder-required workbook and mapping.' },
];

export function PricingScheduleWorkbook({ quote }: { quote: Quote }) {
  const updateQuote = useQuoteStore((state) => state.updateQuote);
  const schedule = quote.pricingSchedule ?? createPricingScheduleData(quote.id);
  const editable=quoteIsCommerciallyEditable(quote);
  const scheduleRef = useRef(schedule);
  const hostRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const liveWorkbookRef = useRef<null | (()=>IWorkbookData)>(null);
  const recalculateRef = useRef<null | (()=>Promise<void>)>(null);
  const [recalculating,setRecalculating]=useState(false);
  const [mappingOpen,setMappingOpen]=useState(false);
  const [mode, setMode] = useState<WorkspaceMode>(initialMode(schedule));
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

  const selectRoute = (route: WorkspaceMode) => {
    // Snapshot any in-flight spreadsheet edits before changing the published route.
    if (mode==='workbook' && liveWorkbookRef.current)
      saveSchedule({workbookData:liveWorkbookRef.current()});
    setMode(route);
    setMessage('');
    saveSchedule({
      route,
      publishSource: route === 'workbook' ? 'workbook' : route === 'plan-builder' ? 'builder' : 'rate-sheet',
    });
  };

  const sheets = useMemo(() => pricingScheduleSheets(schedule.workbookData), [schedule.workbookData]);
  const columnOptions = useMemo(
    () => pricingScheduleColumnOptions(schedule.workbookData, schedule.mapping),
    [schedule.workbookData, schedule.mapping],
  );

  useEffect(() => {
    if (mode !== 'workbook') return;
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

    const mountedImportId=scheduleRef.current.importedAt;
    const workbook = univerAPI.createWorkbook(workbookData as IWorkbookData);
    const readLive=()=>workbook.save();
    liveWorkbookRef.current=readLive;
    let saveTimer: number | undefined;
    const persistLive = () => {
      // A replacement XLSX has already been imported: never copy the old editor's
      // cells over the new file as the previous Univer instance unmounts.
      if (scheduleRef.current.importedAt !== mountedImportId) return;
      saveSchedule({workbookData:readLive()});
    };
    const queueSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(persistLive, SAVE_DEBOUNCE_MS);
    };
    const commandSubscription = workbook.onCommandExecuted(queueSave);
    // Calculation completes asynchronously. Persist *after* the resulting
    // formulas are applied, not only when the input-edit command executes.
    const formulaAPI=univerAPI.getFormula();
    const calculationSubscription=formulaAPI.calculationResultApplied(queueSave);
    const recalculate=async()=>{
      formulaAPI.executeCalculation();
      await formulaAPI.onCalculationResultApplied();
      persistLive();
    };
    recalculateRef.current=recalculate;

    return () => {
      window.clearTimeout(saveTimer);
      if(liveWorkbookRef.current===readLive)liveWorkbookRef.current=null;
      if(recalculateRef.current===recalculate)recalculateRef.current=null;
      persistLive();
      commandSubscription.dispose();
      calculationSubscription.dispose();
      queueMicrotask(() => {
        univer.dispose();
        container.remove();
      });
    };
  }, [mode, quote.id, quote.pricingSchedule?.importedAt]);

  const recalculateAndSave=async()=>{
    if(!recalculateRef.current)return;
    setRecalculating(true);
    try{
      await recalculateRef.current();
      setMessage('Formulas recalculated; published prices and the saved workbook are updated.');
    }catch(reason){
      setMessage(reason instanceof Error?reason.message:'Formula calculation failed.');
    }finally{setRecalculating(false);}
  };

  const exportCurrentWorkbook=async()=>{
    try{
      // Do not export an earlier cached result while recalculation is pending.
      if(recalculateRef.current)await recalculateRef.current();
      await exportExcelPricingWorkbook(liveWorkbookRef.current?.()??scheduleRef.current.workbookData,
        scheduleRef.current.sourceFileName || `${quote.title}.xlsx`);
      setMessage('Workbook exported. Review unsupported Excel features in the downloaded file.');
    }catch(reason){
      setMessage(reason instanceof Error?reason.message:'Could not export the workbook.');
    }
  };

  const setMapping = (patch: Partial<PricingScheduleMapping>) => {
    const current = baseMapping(scheduleRef.current);
    saveSchedule({ route: 'workbook', publishSource: 'workbook', mapping: { ...current, ...patch, columns: patch.columns ?? current.columns } });
  };

  const setColumn = (field: PricingScheduleField, value: string) => {
    const mapping = baseMapping(scheduleRef.current);
    const columns = { ...mapping.columns };
    if (value === '') delete columns[field];
    else columns[field] = Number(value);
    setMapping({ columns });
  };

  const autoMap = () => {
    const currentWorkbook=liveWorkbookRef.current?.()??scheduleRef.current.workbookData;
    const mapping = autoDetectPricingScheduleMapping(currentWorkbook);
    if (!mapping) {
      setMessage('I could not confidently identify the commercial columns. Map them manually below.');
      return;
    }
    saveSchedule({route:'workbook',publishSource:'workbook',
      workbookData:currentWorkbook,mapping});
    setMessage('Headers mapped. Unmapped workbook columns remain internal.');
  };

  const importFile = async (file: File) => {
    setImporting(true);
    setMessage('');
    try {
      const workbookData = await importExcelPricingWorkbook(file);
      const mapping = autoDetectPricingScheduleMapping(workbookData);
      saveSchedule({
        route: 'workbook',
        publishSource: 'workbook',
        workbookData,
        // A failed auto-map must not reuse the sheet ID and price columns from
        // the previously imported file.
        mapping: mapping??{sheetId:pricingScheduleSheets(workbookData)[0]?.id??'',
          headerRow:1,firstDataRow:2,columns:{}},
        sourceFileName: file.name,
        importedAt: new Date().toISOString(),
      });
      setMode('workbook');
      setMessage(mapping
        ? 'Workbook imported and commercial columns auto-mapped.'
        : 'Workbook imported. Map the customer-facing columns below.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The workbook could not be imported.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Issued and archived schedules must not mount interactive pricing controls.
  // A new commercial revision is required before changing published rows.
  if(!editable)return <section className="pricing-schedule-workspace" aria-label="Read-only Pricing Schedule">
    <header className="pricing-schedule-workspace-header">
      <div><strong>{quote.archivedAt?'Archived':'Issued'} Pricing Schedule · read-only</strong>
        <small>Published customer prices are frozen. Use Details to review earlier documents or create a new revision.</small></div>
    </header>
    <PricingScheduleCustomerTable items={schedule.customerItems} compact/>
  </section>;

  return (
    <div className="pricing-schedule-workspace">
      <header className="pricing-schedule-workspace-header pricing-schedule-route-header">
        <div>
          <span className="quote-control-heading">How does this customer price work?</span>
          <small>Choose the lightest workflow that matches the builder. You can change routes while the document is still a draft.</small>
        </div>
      </header>

      <div className="pricing-schedule-route-grid" aria-label="Pricing Schedule route">
        {ROUTES.map((route) => (
          <button type="button" key={route.id} className={`pricing-schedule-route-card ${mode === route.id ? 'active' : ''}`} onClick={() => selectRoute(route.id)}>
            <strong>{route.title}</strong>
            <span>{route.description}</span>
            {mode === route.id && <small>✓ Published route</small>}
          </button>
        ))}
      </div>

      {message && <div className="pricing-schedule-message">{message}</div>}

      {mode === 'rate-sheet' && <PricingRateSheet quote={quote} />}

      {mode === 'plan-builder' && (
        <>
          <div className="pricing-schedule-source-banner">
            <div><strong>Plan Pricing</strong><span>Use the shared Rate Book to calculate plan and option prices from takeoffs.</span></div>
            <strong className="is-published">✓ Published route</strong>
          </div>
          <PricingScheduleBuilder quote={quote} />
        </>
      )}

      {mode === 'workbook' && (
        <>
          <header className="pricing-schedule-workspace-header pricing-schedule-spreadsheet-toolbar">
            <div>
              <span className="quote-control-heading">Advanced spreadsheet</span>
              <small>{schedule.sourceFileName || 'Built in SalesShop'} · import a builder template or do custom calculations here.</small>
              <small>Excel formulas use cached results on import. Recalculate here after editing; verify unsupported Excel features in the exported file.</small>
            </div>
            <div className="pricing-schedule-workbook-actions">
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
              }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Importing…' : 'Import .xlsx'}</button>
              <button type="button" onClick={()=>void exportCurrentWorkbook()}>Export .xlsx</button>
              <button type="button" disabled={recalculating} onClick={()=>void recalculateAndSave()}>{recalculating?'Calculating…':'Recalculate formulas'}</button>
              <button type="button" onClick={autoMap}>Auto-map headers</button>
              <strong className="pricing-schedule-published-pill">✓ Published</strong>
            </div>
          </header>

          <div className="pricing-schedule-workbook-layout">
            <div ref={hostRef} className="pricing-schedule-workbook-host" aria-label="Pricing schedule workbook" />
            <aside className={'pricing-schedule-mapping-panel'+(mappingOpen?' is-open':'')}>
              <header><strong>Publish mapping</strong>
                <button type="button" className="pricing-schedule-mapping-toggle" aria-expanded={mappingOpen}
                  onClick={()=>setMappingOpen(v=>!v)}>{mappingOpen?'Hide columns':'Map columns'} ▾</button>
                <small>Only mapped fields become customer contract data. Everything else stays internal.</small>
              </header>
              <label><span>Sheet</span><select value={schedule.mapping?.sheetId ?? sheets[0]?.id ?? ''} onChange={(event) => setMapping({ sheetId: event.target.value })}>{sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select></label>
              <div className="pricing-schedule-row-map">
                <label><span>Header row</span><input type="number" min="1" value={schedule.mapping?.headerRow ?? 1} onChange={(event) => setMapping({ headerRow: positiveInteger(event.target.value, 1) })} /></label>
                <label><span>First data row</span><input type="number" min="1" value={schedule.mapping?.firstDataRow ?? 2} onChange={(event) => setMapping({ firstDataRow: positiveInteger(event.target.value, 2) })} /></label>
                <label><span>Last data row</span><input type="number" min="1" value={schedule.mapping?.lastDataRow ?? ''} placeholder="Auto" onChange={(event) => setMapping({ lastDataRow: event.target.value ? positiveInteger(event.target.value, 2) : undefined })} /></label>
              </div>
              <div className="pricing-schedule-field-map">
                {PRICING_SCHEDULE_FIELDS.map((field) => <label key={field}><span>{PRICING_SCHEDULE_FIELD_LABELS[field]}</span><select value={schedule.mapping?.columns[field] ?? ''} onChange={(event) => setColumn(field, event.target.value)}><option value="">Not mapped</option>{columnOptions.map((option) => <option value={option.index} key={`${field}-${option.index}`}>{option.label}</option>)}</select></label>)}
              </div>
              <div className="pricing-schedule-publish-note"><strong>{schedule.customerItems.length}</strong><span>published rows</span><small>Description + Customer price are required before Send.</small></div>
            </aside>
          </div>

          <section className="pricing-schedule-mapped-preview">
            <header><div><span className="quote-control-heading">Spreadsheet publish preview</span><small>These mapped rows become the contractual customer schedule.</small></div></header>
            <PricingScheduleCustomerTable items={schedule.customerItems} compact />
          </section>
        </>
      )}
    </div>
  );
}
