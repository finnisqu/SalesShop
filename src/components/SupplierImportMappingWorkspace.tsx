import { useMemo, useState } from 'react';
import {
  loadStructuredSupplierPreview,
  suggestSupplierImportMapping,
  supplierImportMappingFields,
} from '../services/structuredSupplierImport';
import type {
  SupplierImportMappingDraft,
  SupplierImportMappingField,
  SupplierImportStructuredPreview,
} from '../types/supplierImport';
import type { PricingMaterialType } from '../types/quote';

const materialTypes: PricingMaterialType[] = ['Granite', 'Quartz', 'Marble', 'Quartzite', 'Porcelain', 'Solid Surface', 'Other'];

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = async (nextFile: File, sheetName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const nextPreview = await loadStructuredSupplierPreview(nextFile, sheetName);
      setPreview(nextPreview);
      setColumns(suggestSupplierImportMapping(nextPreview.headers));
    } catch (reason) {
      setPreview(null);
      setColumns({});
      setError(reason instanceof Error ? reason.message : 'SalesShop could not read this supplier file.');
    } finally {
      setLoading(false);
    }
  };

  const mappedCount = Object.values(columns).filter(Boolean).length;
  const requiredReady = Boolean(supplier.trim() && brand.trim() && columns.name);
  const priceReady = Boolean(columns.costPerSf || columns.costPerUnit);
  const ready = requiredReady && priceReady;

  const draft = useMemo<SupplierImportMappingDraft | null>(() => {
    if (!preview) return null;
    return {
      supplier: supplier.trim(),
      brand: brand.trim(),
      materialType,
      sourceFileType: preview.fileType,
      sheetName: preview.sheetName,
      columns,
      defaults,
    };
  }, [preview, supplier, brand, materialType, columns, defaults]);

  return (
    <section className="supplier-mapping-workspace">
      <header className="supplier-mapping-header">
        <div>
          <span className="board-eyebrow">New mapped supplier</span>
          <strong>Teach SalesShop a structured price list</strong>
          <p>Define the purchasing identity once, open a CSV or XLSX, then map supplier columns to the material fields SalesShop understands.</p>
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
            <div><span>Rows</span><strong>{preview.totalRows}</strong></div>
            <div><span>Columns</span><strong>{preview.headers.length}</strong></div>
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

          <div className="supplier-mapping-grid">
            <section className="supplier-mapping-fields">
              <header>
                <div><strong>Field mapping</strong><span>SalesShop made a first-pass guess. Confirm the important fields and leave anything unused as Not mapped.</span></div>
                <span>{mappedCount} mapped</span>
              </header>
              <div className="supplier-mapping-field-list">
                {supplierImportMappingFields.map((definition) => (
                  <label className={definition.required ? 'is-required' : ''} key={definition.field}>
                    <div>
                      <strong>{definition.label}{definition.required ? ' *' : ''}</strong>
                      <small>{definition.hint}</small>
                    </div>
                    <select value={columns[definition.field] ?? ''} onChange={(event) => setColumns((current) => ({
                      ...current,
                      [definition.field]: event.target.value || undefined,
                    }))}>
                      <option value="">Not mapped</option>
                      {preview.headers.map((header) => <option value={header} key={header}>{header}</option>)}
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
                <div><strong>Source preview</strong><span>First {Math.min(preview.rows.length, 8)} data rows from {preview.sheetName ?? preview.fileName}</span></div>
              </header>
              <div className="supplier-mapping-preview-scroll">
                <table>
                  <thead>
                    <tr>{preview.headers.map((header) => {
                      const labels = mappedFieldLabels(columns, header);
                      return <th key={header}><strong>{header}</strong>{labels.length > 0 && <small>{labels.join(' · ')}</small>}</th>;
                    })}</tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>{preview.headers.map((header, columnIndex) => <td key={header}>{row[columnIndex] || '—'}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <footer className={`supplier-mapping-readiness ${ready ? 'is-ready' : ''}`}>
            <div>
              <strong>{ready ? 'Mapping draft is structurally ready' : 'Complete the minimum mapping'}</strong>
              <span>{!supplier.trim() || !brand.trim()
                ? 'Enter both Supplier and Brand.'
                : !columns.name
                  ? 'Map the Color / product name field.'
                  : !priceReady
                    ? 'Map Cost / SF or Cost / unit.'
                    : 'Brand, Supplier, product identity and supplier cost are all defined.'}</span>
            </div>
            <span className="supplier-mapping-next">{draft && ready ? 'Next: save profile + stage through v4' : 'No catalog changes are being made'}</span>
          </footer>
        </>
      )}

      {!preview && !error && (
        <div className="supplier-mapping-empty">
          <strong>Start with a real supplier spreadsheet</strong>
          <span>CSV and XLSX are supported in this mapping preview. The file is read locally; this batch does not publish or change the Material Catalog.</span>
        </div>
      )}
    </section>
  );
}
