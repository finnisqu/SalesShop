import { useMemo, useState } from 'react';
import { SupplierSourceSheetViewer } from './SupplierSourceSheetViewer';
import {
  loadStructuredSupplierPreview,
  structuredTableForRange,
  suggestSupplierImportMapping,
  supplierImportMappingFields,
} from '../services/structuredSupplierImport';
import type {
  SupplierImportDetectedRegion,
  SupplierImportMappingDraft,
  SupplierImportStructuredPreview,
} from '../types/supplierImport';
import type { PricingMaterialType } from '../types/quote';

const materialTypes: PricingMaterialType[] = ['Granite', 'Quartz', 'Marble', 'Quartzite', 'Porcelain', 'Solid Surface', 'Other'];

const REGION_KIND_LABELS = {
  tabular: 'Direct table',
  'grouped-price-matrix': 'Grouped price matrix',
  'record-block': 'Repeated record block',
  unknown: 'Review boundaries',
} as const;

function mappedFieldLabels(columns: SupplierImportMappingDraft['columns'], header: string) {
  return supplierImportMappingFields
    .filter((definition) => columns[definition.field] === header)
    .map((definition) => definition.label);
}

export function SupplierImportMappingWorkspace({ onBack }: { onBack: () => void }) {
  const [supplier, setSupplier] = useState('');
  const [brand, setBrand] = useState('');
  const [materialType, setMaterialType] = useState<PricingMaterialType>('Quartz');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SupplierImportStructuredPreview | null>(null);
  const [columns, setColumns] = useState<SupplierImportMappingDraft['columns']>({});
  const [defaults, setDefaults] = useState<SupplierImportMappingDraft['defaults']>({ purchaseLabel: 'Standard' });
  const [sourceRangeA1, setSourceRangeA1] = useState('');
  const [focusedRangeA1, setFocusedRangeA1] = useState('');
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyDetectedRegion = (nextPreview: SupplierImportStructuredPreview, region: SupplierImportDetectedRegion) => {
    setActiveRegionId(region.id);
    setSourceRangeA1(region.rangeA1);
    setFocusedRangeA1(region.rangeA1);
    const table = structuredTableForRange(nextPreview, region.rangeA1);
    setColumns(region.kind === 'tabular' ? suggestSupplierImportMapping(table.headers) : {});
  };

  const applyManualRange = (rangeA1: string) => {
    if (!preview || !rangeA1) return;
    const table = structuredTableForRange(preview, rangeA1);
    setActiveRegionId(null);
    setSourceRangeA1(table.rangeA1);
    setFocusedRangeA1(table.rangeA1);
    setColumns(suggestSupplierImportMapping(table.headers));
  };

  const loadFile = async (nextFile: File, sheetName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const nextPreview = await loadStructuredSupplierPreview(nextFile, sheetName);
      setPreview(nextPreview);
      const primaryRegion = nextPreview.detectedRegions[0];
      if (primaryRegion) {
        applyDetectedRegion(nextPreview, primaryRegion);
      } else {
        setActiveRegionId(null);
        setSourceRangeA1('');
        setFocusedRangeA1('');
        setColumns(suggestSupplierImportMapping(nextPreview.headers));
      }
    } catch (reason) {
      setPreview(null);
      setColumns({});
      setSourceRangeA1('');
      setFocusedRangeA1('');
      setActiveRegionId(null);
      setError(reason instanceof Error ? reason.message : 'SalesShop could not read this supplier file.');
    } finally {
      setLoading(false);
    }
  };

  const activeRegion = useMemo(
    () => preview?.detectedRegions.find((region) => region.id === activeRegionId),
    [preview, activeRegionId],
  );

  const selectedTable = useMemo(
    () => preview && sourceRangeA1 ? structuredTableForRange(preview, sourceRangeA1) : null,
    [preview, sourceRangeA1],
  );

  const mappedCount = Object.values(columns).filter(Boolean).length;
  const transformRequired = Boolean(activeRegion && activeRegion.kind !== 'tabular');
  const requiredReady = Boolean(supplier.trim() && brand.trim() && columns.name);
  const priceReady = Boolean(columns.costPerSf || columns.costPerUnit);
  const ready = !transformRequired && requiredReady && priceReady;

  const draft = useMemo<SupplierImportMappingDraft | null>(() => {
    if (!preview) return null;
    return {
      supplier: supplier.trim(),
      brand: brand.trim(),
      materialType,
      sourceFileType: preview.fileType,
      sheetName: preview.sheetName,
      sourceRangeA1: sourceRangeA1 || undefined,
      regionKind: activeRegion?.kind ?? 'unknown',
      columns,
      defaults,
    };
  }, [preview, supplier, brand, materialType, sourceRangeA1, activeRegion, columns, defaults]);

  return (
    <section className="supplier-mapping-workspace">
      <header className="supplier-mapping-header">
        <div>
          <span className="board-eyebrow">New mapped supplier</span>
          <strong>Teach SalesShop a structured price list</strong>
          <p>Open the original workbook, confirm which table region matters, then map or transform that region into the material fields SalesShop understands.</p>
        </div>
        <button type="button" onClick={onBack}>Back to saved profile</button>
      </header>

      <div className="supplier-mapping-identity">
        <label><span>Supplier / importer</span><input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="UMI, MSI, Cosmos…" /></label>
        <label><span>Brand / manufacturer</span><input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Vicostone, Silestone, Corian…" /></label>
        <label><span>Material type</span><select value={materialType} onChange={(event) => setMaterialType(event.target.value as PricingMaterialType)}>{materialTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="supplier-mapping-file">
          <span>Structured price list</span>
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            setFile(nextFile);
            if (nextFile) void loadFile(nextFile);
          }} />
          <b>{loading ? 'Reading file…' : file?.name ?? 'Choose CSV or XLSX…'}</b>
        </label>
      </div>

      {error && <div className="supplier-import-error">{error}</div>}

      {preview && (
        <>
          <section className="supplier-mapping-source-summary">
            <div><span>File</span><strong>{preview.fileName}</strong></div>
            <div><span>Type</span><strong>{preview.fileType.toUpperCase()}</strong></div>
            <div><span>Rows</span><strong>{preview.sourceRowCount}</strong></div>
            <div><span>Columns</span><strong>{preview.sourceColumnCount}</strong></div>
            {preview.fileType === 'xlsx' && (
              <label>
                <span>Worksheet</span>
                <select value={preview.sheetName ?? ''} onChange={(event) => {
                  if (file) void loadFile(file, event.target.value);
                }}>
                  {preview.sheetNames.map((sheetName) => <option value={sheetName} key={sheetName}>{sheetName}</option>)}
                </select>
              </label>
            )}
          </section>

          <section className="supplier-source-region-workspace">
            <header>
              <div>
                <strong>Source regions</strong>
                <span>SalesShop scans the real sheet for likely pricing tables. Click a detected region or drag-select a different range directly in the workbook.</span>
              </div>
              <span>{preview.detectedRegions.length} detected</span>
            </header>

            <div className="supplier-source-region-layout">
              <aside className="supplier-source-region-list">
                {preview.detectedRegions.map((region) => (
                  <button
                    type="button"
                    className={activeRegionId === region.id ? 'active' : ''}
                    onClick={() => applyDetectedRegion(preview, region)}
                    key={region.id}
                  >
                    <span className={`confidence-${region.confidence}`}>{region.confidence}</span>
                    <strong>{region.label}</strong>
                    <b>{region.rangeA1}</b>
                    <small>{REGION_KIND_LABELS[region.kind]}</small>
                    {region.notes.slice(0, 2).map((note) => <em key={note}>{note}</em>)}
                  </button>
                ))}
              </aside>

              <div className="supplier-source-sheet-panel">
                <SupplierSourceSheetViewer
                  preview={preview}
                  activeRangeA1={focusedRangeA1 || sourceRangeA1}
                  onSelectionChange={setFocusedRangeA1}
                />
                <div className="supplier-source-selection-bar">
                  <div>
                    <span>Workbook selection</span>
                    <strong>{focusedRangeA1 || 'Select a range in the sheet'}</strong>
                    <small>{sourceRangeA1 ? `Current import region: ${sourceRangeA1}` : 'No source region committed yet'}</small>
                  </div>
                  <button
                    type="button"
                    disabled={!focusedRangeA1 || focusedRangeA1 === sourceRangeA1}
                    onClick={() => applyManualRange(focusedRangeA1)}
                  >{focusedRangeA1 === sourceRangeA1 ? 'Using this range' : 'Use selected range'}</button>
                </div>
              </div>
            </div>

            {activeRegion && activeRegion.kind !== 'tabular' && (
              <div className="supplier-transform-required">
                <strong>Transform recipe required</strong>
                <span>{activeRegion.kind === 'grouped-price-matrix'
                  ? 'This is not a normal row-by-row table. SalesShop detected inherited group pricing and a size-availability matrix, so it should be transformed before ordinary field mapping.'
                  : 'These rows look like repeated material records but do not contain a conventional header row. The next transform step will define their field meanings without pretending the first material row is a header.'}</span>
                <small>This batch only identifies and selects the source safely; it does not change the Material Catalog.</small>
              </div>
            )}
          </section>

          <div className="supplier-mapping-grid">
            <section className="supplier-mapping-fields">
              <header>
                <div><strong>Field mapping</strong><span>{transformRequired ? 'This region needs a transform recipe before direct mapping.' : 'SalesShop made a first-pass guess from the committed source range. Confirm the important fields.'}</span></div>
                <span>{mappedCount} mapped</span>
              </header>
              <div className="supplier-mapping-field-list">
                {supplierImportMappingFields.map((definition) => (
                  <label className={definition.required ? 'is-required' : ''} key={definition.field}>
                    <div>
                      <strong>{definition.label}{definition.required ? ' *' : ''}</strong>
                      <small>{definition.hint}</small>
                    </div>
                    <select
                      value={columns[definition.field] ?? ''}
                      disabled={transformRequired}
                      onChange={(event) => setColumns((current) => ({
                        ...current,
                        [definition.field]: event.target.value || undefined,
                      }))}
                    >
                      <option value="">Not mapped</option>
                      {(selectedTable?.headers ?? preview.headers).map((header) => <option value={header} key={header}>{header}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              <details className="supplier-mapping-defaults">
                <summary>Defaults when the supplier omits a field</summary>
                <div>
                  <label><span>Thickness</span><input value={defaults.thickness ?? ''} onChange={(event) => setDefaults((current) => ({ ...current, thickness: event.target.value || undefined }))} placeholder="3cm" /></label>
                  <label><span>Finish</span><input value={defaults.finish ?? ''} onChange={(event) => setDefaults((current) => ({ ...current, finish: event.target.value || undefined }))} placeholder="Polished" /></label>
                  <label><span>Format</span><input value={defaults.formatName ?? ''} onChange={(event) => setDefaults((current) => ({ ...current, formatName: event.target.value || undefined }))} placeholder="Jumbo" /></label>
                  <label><span>Price program</span><input value={defaults.purchaseLabel ?? ''} onChange={(event) => setDefaults((current) => ({ ...current, purchaseLabel: event.target.value || undefined }))} placeholder="Standard" /></label>
                </div>
              </details>
            </section>

            <section className="supplier-mapping-preview">
              <header>
                <div><strong>Committed range preview</strong><span>{sourceRangeA1 || 'No range'} · first {Math.min(selectedTable?.rows.length ?? 0, 8)} data rows</span></div>
              </header>
              <div className="supplier-mapping-preview-scroll">
                <table>
                  <thead>
                    <tr>{(selectedTable?.headers ?? preview.headers).map((header) => {
                      const labels = mappedFieldLabels(columns, header);
                      return <th key={header}><strong>{header}</strong>{labels.length > 0 && <small>{labels.join(' · ')}</small>}</th>;
                    })}</tr>
                  </thead>
                  <tbody>
                    {(selectedTable?.rows ?? preview.rows).map((row, rowIndex) => (
                      <tr key={rowIndex}>{(selectedTable?.headers ?? preview.headers).map((header, columnIndex) => <td key={header}>{row[columnIndex] || '—'}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <footer className={`supplier-mapping-readiness ${ready ? 'is-ready' : ''}`}>
            <div>
              <strong>{transformRequired ? 'Source region detected — transform is next' : ready ? 'Mapping draft is structurally ready' : 'Complete the minimum mapping'}</strong>
              <span>{transformRequired
                ? 'The workbook boundaries are now explicit. The next batch will convert group inheritance / matrix availability into normalized material rows.'
                : !supplier.trim() || !brand.trim()
                  ? 'Enter both Supplier and Brand.'
                  : !columns.name
                    ? 'Map the Color / product name field.'
                    : !priceReady
                      ? 'Map Cost / SF or Cost / unit.'
                      : 'Brand, Supplier, product identity and supplier cost are all defined.'}</span>
            </div>
            <span className="supplier-mapping-next">{draft && ready ? 'Next: save profile + stage through v4' : transformRequired ? 'Transform engine not publishing yet' : 'No catalog changes are being made'}</span>
          </footer>
        </>
      )}

      {!preview && !error && (
        <div className="supplier-mapping-empty">
          <strong>Start with a real supplier spreadsheet</strong>
          <span>CSV and XLSX are supported. SalesShop reads the file locally, detects likely pricing regions, and lets you verify the exact source range before any transform or publish step exists.</span>
        </div>
      )}
    </section>
  );
}
