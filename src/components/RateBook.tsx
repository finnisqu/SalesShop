import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useRateBookStore } from '../store/rateBookStore';
import {
  RATE_BOOK_CATEGORIES,
  RATE_BOOK_CATEGORY_LABELS,
  RATE_BOOK_DIVISIONS,
  RATE_BOOK_PRICING_BEHAVIORS,
  RATE_BOOK_PRICING_BEHAVIOR_LABELS,
  RATE_BOOK_UNIT_LABELS,
  RATE_BOOK_UNITS,
  resolveRateBookValues,
  type RateBookCategory,
  type RateBookItem,
  type RateBookPricingBehavior,
  type RateBookUnit,
} from '../types/rateBook';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type CategoryFilter = 'all' | RateBookCategory;
type SheetColumnKey = 'active' | 'category' | 'item' | 'code' | 'cost' | 'sell' | 'unit' | 'behavior' | 'margin' | 'effective' | 'context';
type BulkField = 'internalCost' | 'sellRate' | 'category' | 'unit' | 'pricingBehavior' | 'active';

interface SheetColumn {
  key: SheetColumnKey;
  label: string;
  width: number;
  minWidth: number;
  lockVisible?: boolean;
}

const SHEET_COLUMNS: SheetColumn[] = [
  { key: 'active', label: 'On', width: 48, minWidth: 42 },
  { key: 'category', label: 'Category', width: 142, minWidth: 105 },
  { key: 'item', label: 'Item', width: 210, minWidth: 150, lockVisible: true },
  { key: 'code', label: 'Code', width: 92, minWidth: 70 },
  { key: 'cost', label: 'Cost', width: 108, minWidth: 82 },
  { key: 'sell', label: 'Suggested sell', width: 118, minWidth: 92 },
  { key: 'unit', label: 'Unit', width: 76, minWidth: 66 },
  { key: 'behavior', label: 'Pricing behavior', width: 166, minWidth: 132 },
  { key: 'margin', label: 'Margin', width: 76, minWidth: 66 },
  { key: 'effective', label: 'Effective', width: 128, minWidth: 110 },
  { key: 'context', label: 'Context', width: 86, minWidth: 74 },
];

const DEFAULT_COLUMN_WIDTHS = Object.fromEntries(SHEET_COLUMNS.map((column) => [column.key, column.width])) as Record<SheetColumnKey, number>;
const GRID_PREFS_KEY = 'salesshop-rate-book-grid-v1';

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function moneyLabel(value?: number) {
  return value === undefined ? '—' : money.format(value);
}

function marginLabel(item: RateBookItem) {
  if (item.sellRate === undefined || item.internalCost === undefined || item.sellRate === 0) return '—';
  const margin = ((item.sellRate - item.internalCost) / item.sellRate) * 100;
  return `${margin.toFixed(1)}%`;
}

function RateBookDetails({ item }: { item: RateBookItem }) {
  const setDivisionOverride = useRateBookStore((state) => state.setDivisionOverride);
  const setCurrentHistoryNote = useRateBookStore((state) => state.setCurrentHistoryNote);
  const updateItem = useRateBookStore((state) => state.updateItem);
  const duplicateItem = useRateBookStore((state) => state.duplicateItem);
  const deleteItem = useRateBookStore((state) => state.deleteItem);
  const stockMaterials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const stockMaterial = item.stockMaterialId ? stockMaterials.find((candidate) => candidate.id === item.stockMaterialId) : undefined;
  const currentHistory = item.history.find((version) => version.effectiveDate === item.effectiveDate);
  const history = [...item.history].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  return (
    <div className="rate-book-detail-panel">
      <section className="rate-book-override-panel">
        <header><div><strong>Division overrides</strong><small>Blank cells inherit the base company rate above.</small></div></header>
        <div className="rate-book-override-grid">
          <span className="is-head">Division</span><span className="is-head">Internal cost</span><span className="is-head">Suggested sell</span>
          {RATE_BOOK_DIVISIONS.map((division) => {
            const override = item.divisionOverrides.find((candidate) => candidate.division === division);
            const resolved = resolveRateBookValues(item, division);
            return (
              <div className="rate-book-override-row" key={division}>
                <strong>{division}</strong>
                <label><span>$</span><input type="number" step="0.01" value={override?.internalCost ?? ''} placeholder={item.internalCost?.toFixed(2) ?? '—'} onChange={(event) => setDivisionOverride(item.id, division, { internalCost: numberValue(event.target.value) })} /></label>
                <label><span>$</span><input type="number" step="0.01" value={override?.sellRate ?? ''} placeholder={item.sellRate?.toFixed(2) ?? '—'} onChange={(event) => setDivisionOverride(item.id, division, { sellRate: numberValue(event.target.value) })} /></label>
                <small>{moneyLabel(resolved.internalCost)} cost · {moneyLabel(resolved.sellRate)} suggested</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rate-book-history-panel">
        <header><div><strong>Rate history</strong><small>One version per effective date. Change the effective date before entering a new annual rate.</small></div></header>
        <label className="rate-book-history-note"><span>Note for {item.effectiveDate || 'current version'}</span><input value={currentHistory?.note ?? ''} onChange={(event) => setCurrentHistoryNote(item.id, event.target.value)} placeholder="Supplier increase, annual update, new installer agreement…" /></label>
        <div className="rate-book-history-list">
          {history.map((version) => (
            <div className="rate-book-history-row" key={version.id}>
              <strong>{version.effectiveDate}</strong>
              <span>{moneyLabel(version.internalCost)} cost</span>
              <span>{moneyLabel(version.sellRate)} suggested</span>
              <span>{RATE_BOOK_PRICING_BEHAVIOR_LABELS[version.pricingBehavior]}</span>
              <small>{version.divisionOverrides.length ? `${version.divisionOverrides.length} division override${version.divisionOverrides.length === 1 ? '' : 's'}` : 'Base rates only'}</small>
              {version.note && <em>{version.note}</em>}
            </div>
          ))}
        </div>
      </section>

      <section className="rate-book-row-admin">
        <label><span>Internal notes</span><input value={item.notes ?? ''} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder={stockMaterial ? `Linked to ${stockMaterial.name}` : 'Optional private note'} /></label>
        {stockMaterial && <span className="rate-book-stock-link">Stock color · {stockMaterial.materialType}</span>}
        <div><button type="button" onClick={() => duplicateItem(item.id)}>Duplicate</button><button type="button" className="danger" onClick={() => { if (window.confirm(`Delete ${item.name}?`)) deleteItem(item.id); }}>Delete</button></div>
      </section>
    </div>
  );
}

function RateBookSheetRow({
  item,
  rowNumber,
  columns,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  item: RateBookItem;
  rowNumber: number;
  columns: SheetColumn[];
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const updateItem = useRateBookStore((state) => state.updateItem);
  const updatePricing = useRateBookStore((state) => state.updatePricing);

  const renderCell = (column: SheetColumn) => {
    switch (column.key) {
      case 'active':
        return <td className="rate-book-check" key={column.key}><input type="checkbox" checked={item.active} onChange={(event) => updateItem(item.id, { active: event.target.checked })} aria-label={`${item.name} active`} /></td>;
      case 'category':
        return <td key={column.key}><select value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value as RateBookCategory })}>{RATE_BOOK_CATEGORIES.map((category) => <option value={category} key={category}>{RATE_BOOK_CATEGORY_LABELS[category]}</option>)}</select></td>;
      case 'item':
        return <td className="rate-book-item-cell" key={column.key}><input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /></td>;
      case 'code':
        return <td key={column.key}><input value={item.code ?? ''} onChange={(event) => updateItem(item.id, { code: event.target.value })} placeholder="—" /></td>;
      case 'cost':
        return <td className="number" key={column.key}><input type="number" step="0.01" value={item.internalCost ?? ''} onChange={(event) => updatePricing(item.id, { internalCost: numberValue(event.target.value) })} placeholder="—" /></td>;
      case 'sell':
        return <td className="number" key={column.key}><input type="number" step="0.01" value={item.sellRate ?? ''} onChange={(event) => updatePricing(item.id, { sellRate: numberValue(event.target.value) })} placeholder="—" /></td>;
      case 'unit':
        return <td key={column.key}><select value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value as RateBookUnit })}>{RATE_BOOK_UNITS.map((unit) => <option value={unit} key={unit}>{RATE_BOOK_UNIT_LABELS[unit]}</option>)}</select></td>;
      case 'behavior':
        return <td key={column.key}><select value={item.pricingBehavior} onChange={(event) => updatePricing(item.id, { pricingBehavior: event.target.value as RateBookPricingBehavior })}>{RATE_BOOK_PRICING_BEHAVIORS.map((behavior) => <option value={behavior} key={behavior}>{RATE_BOOK_PRICING_BEHAVIOR_LABELS[behavior]}</option>)}</select></td>;
      case 'margin':
        return <td className="rate-book-margin-cell" key={column.key}>{marginLabel(item)}</td>;
      case 'effective':
        return <td key={column.key}><input type="date" value={item.effectiveDate ?? ''} onChange={(event) => updatePricing(item.id, { effectiveDate: event.target.value || undefined })} /></td>;
      case 'context':
        return <td className="rate-book-detail-cell" key={column.key}><button type="button" onClick={onToggle}>{expanded ? 'Close' : 'Details'}</button></td>;
    }
  };

  return (
    <>
      <tr className={`${item.active ? '' : 'is-inactive'} ${expanded ? 'is-expanded' : ''} ${selected ? 'is-selected' : ''}`}>
        <td className="rate-book-row-header"><button type="button" className={selected ? 'is-selected' : ''} onClick={onSelect} title="Select row. Shift-click to select a range.">{selected ? '✓' : rowNumber}</button></td>
        {columns.map(renderCell)}
      </tr>
      {expanded && <tr className="rate-book-detail-row"><td colSpan={columns.length + 1}><RateBookDetails item={item} /></td></tr>}
    </>
  );
}

export function RateBook() {
  const items = useRateBookStore((state) => state.items);
  const hydrated = useRateBookStore((state) => state.hydrated);
  const hydrate = useRateBookStore((state) => state.hydrate);
  const addItem = useRateBookStore((state) => state.addItem);
  const updateItem = useRateBookStore((state) => state.updateItem);
  const updatePricing = useRateBookStore((state) => state.updatePricing);
  const stockMaterials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkField, setBulkField] = useState<BulkField>('internalCost');
  const [bulkValue, setBulkValue] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<SheetColumnKey>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<SheetColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const [gridPrefsLoaded, setGridPrefsLoaded] = useState(false);

  useEffect(() => {
    hydrate();
    void hydrateSettings();
  }, [hydrate, hydrateSettings]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GRID_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { hiddenColumns?: SheetColumnKey[]; columnWidths?: Partial<Record<SheetColumnKey, number>> };
        const validKeys = new Set(SHEET_COLUMNS.map((column) => column.key));
        const hidden = (parsed.hiddenColumns ?? []).filter((key) => validKeys.has(key) && key !== 'item');
        setHiddenColumns(new Set(hidden));
        setColumnWidths((current) => ({ ...current, ...(parsed.columnWidths ?? {}) }));
      }
    } catch {
      // Keep defaults if old/local preferences are malformed.
    }
    setGridPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!gridPrefsLoaded) return;
    localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ hiddenColumns: [...hiddenColumns], columnWidths }));
  }, [gridPrefsLoaded, hiddenColumns, columnWidths]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => showInactive || item.active)
      .filter((item) => !needle || `${item.name} ${item.code ?? ''} ${item.notes ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => RATE_BOOK_CATEGORIES.indexOf(a.category) - RATE_BOOK_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name));
  }, [items, category, query, showInactive]);

  const visibleColumns = useMemo(() => SHEET_COLUMNS.filter((column) => !hiddenColumns.has(column.key)), [hiddenColumns]);
  const sheetMinWidth = 44 + visibleColumns.reduce((total, column) => total + columnWidths[column.key], 0);
  const activeCount = items.filter((item) => item.active).length;
  const referenceOnlyCount = items.filter((item) => item.active && item.pricingBehavior !== 'suggested').length;
  const overrideCount = items.filter((item) => item.active && item.divisionOverrides.length).length;
  const historyCount = items.reduce((total, item) => total + item.history.length, 0);
  const availableStock = stockMaterials.filter((material) => material.active && !items.some((item) => item.stockMaterialId === material.id));
  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id));

  const addCurrent = () => {
    const nextCategory: RateBookCategory = category === 'all' ? 'material' : category;
    const id = addItem(nextCategory);
    setCategory(nextCategory);
    setExpandedId(id);
  };

  const addStockMaterial = (stockId: string) => {
    const stock = stockMaterials.find((material) => material.id === stockId);
    if (!stock) return;
    const id = addItem('material', {
      name: stock.name,
      stockMaterialId: stock.id,
      internalCost: stock.internalCost,
      unit: stock.unit,
      notes: stock.notes,
      pricingBehavior: 'cost-reference',
    });
    setCategory('material');
    setExpandedId(id);
  };

  const toggleRowSelection = (id: string, shiftKey: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (shiftKey && lastSelectedId) {
        const from = filtered.findIndex((item) => item.id === lastSelectedId);
        const to = filtered.findIndex((item) => item.id === id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from];
          filtered.slice(start, end + 1).forEach((item) => next.add(item.id));
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastSelectedId(id);
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filtered.forEach((item) => next.delete(item.id));
      else filtered.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const changeBulkField = (field: BulkField) => {
    setBulkField(field);
    if (field === 'category') setBulkValue('material');
    else if (field === 'unit') setBulkValue('sf');
    else if (field === 'pricingBehavior') setBulkValue('suggested');
    else if (field === 'active') setBulkValue('true');
    else setBulkValue('');
  };

  const applyBulkEdit = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    ids.forEach((id) => {
      if (bulkField === 'internalCost') updatePricing(id, { internalCost: numberValue(bulkValue) });
      else if (bulkField === 'sellRate') updatePricing(id, { sellRate: numberValue(bulkValue) });
      else if (bulkField === 'category') updateItem(id, { category: bulkValue as RateBookCategory });
      else if (bulkField === 'unit') updateItem(id, { unit: bulkValue as RateBookUnit });
      else if (bulkField === 'pricingBehavior') updatePricing(id, { pricingBehavior: bulkValue as RateBookPricingBehavior });
      else updateItem(id, { active: bulkValue === 'true' });
    });
  };

  const toggleColumn = (key: SheetColumnKey) => {
    if (key === 'item') return;
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startResize = (column: SheetColumn, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[column.key];
    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(column.minWidth, Math.round(startWidth + moveEvent.clientX - startX));
      setColumnWidths((current) => ({ ...current, [column.key]: nextWidth }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('rate-book-is-resizing');
    };
    document.body.classList.add('rate-book-is-resizing');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  if (!hydrated) return <div className="rate-book-loading">Opening Rate Book…</div>;

  return (
    <main className="rate-book-view">
      <header className="rate-book-header">
        <div>
          <span className="board-eyebrow">Company pricing system</span>
          <h1>Rate Book</h1>
          <p>Company costs and suggested rates are references—not rules. Salespeople can override them, use cost only, or bypass the Rate Book entirely on a quote.</p>
        </div>
        <button type="button" className="rate-book-add" onClick={addCurrent}>+ Rate row</button>
      </header>

      <section className="rate-book-stats" aria-label="Rate Book summary">
        <div><span>Active</span><strong>{activeCount}</strong></div>
        <div><span>Reference/manual</span><strong>{referenceOnlyCount}</strong></div>
        <div><span>Division overrides</span><strong>{overrideCount}</strong></div>
        <div><span>Price versions</span><strong>{historyCount}</strong></div>
      </section>

      <section className="rate-book-controls">
        <div className="rate-book-category-switch" role="tablist" aria-label="Rate Book categories">
          <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All</button>
          {RATE_BOOK_CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{RATE_BOOK_CATEGORY_LABELS[item]}</button>)}
        </div>
        <div className="rate-book-filter-row">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rates…" aria-label="Search Rate Book" />
          <label><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Show inactive</label>
          <details className="rate-book-column-menu">
            <summary>Columns</summary>
            <div>
              <strong>Show / hide</strong>
              {SHEET_COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={!hiddenColumns.has(column.key)} disabled={column.lockVisible} onChange={() => toggleColumn(column.key)} /> {column.label}</label>)}
              <button type="button" onClick={() => { setHiddenColumns(new Set()); setColumnWidths(DEFAULT_COLUMN_WIDTHS); }}>Reset grid</button>
            </div>
          </details>
        </div>
      </section>

      {selectedIds.size > 0 && (
        <section className="rate-book-bulk-bar" aria-label="Bulk edit selected Rate Book rows">
          <strong>{selectedIds.size} row{selectedIds.size === 1 ? '' : 's'} selected</strong>
          <select value={bulkField} onChange={(event) => changeBulkField(event.target.value as BulkField)} aria-label="Bulk edit field">
            <option value="internalCost">Cost</option><option value="sellRate">Suggested sell</option><option value="category">Category</option><option value="unit">Unit</option><option value="pricingBehavior">Pricing behavior</option><option value="active">Active state</option>
          </select>
          {bulkField === 'internalCost' || bulkField === 'sellRate' ? (
            <input type="number" step="0.01" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="Blank clears value" aria-label="Bulk value" />
          ) : bulkField === 'category' ? (
            <select value={bulkValue || 'material'} onChange={(event) => setBulkValue(event.target.value)}>{RATE_BOOK_CATEGORIES.map((value) => <option value={value} key={value}>{RATE_BOOK_CATEGORY_LABELS[value]}</option>)}</select>
          ) : bulkField === 'unit' ? (
            <select value={bulkValue || 'sf'} onChange={(event) => setBulkValue(event.target.value)}>{RATE_BOOK_UNITS.map((value) => <option value={value} key={value}>{RATE_BOOK_UNIT_LABELS[value]}</option>)}</select>
          ) : bulkField === 'pricingBehavior' ? (
            <select value={bulkValue || 'suggested'} onChange={(event) => setBulkValue(event.target.value)}>{RATE_BOOK_PRICING_BEHAVIORS.map((value) => <option value={value} key={value}>{RATE_BOOK_PRICING_BEHAVIOR_LABELS[value]}</option>)}</select>
          ) : (
            <select value={bulkValue || 'true'} onChange={(event) => setBulkValue(event.target.value)}><option value="true">Active</option><option value="false">Inactive</option></select>
          )}
          <button type="button" className="primary" onClick={applyBulkEdit}>Apply to selected</button>
          <button type="button" onClick={() => { setSelectedIds(new Set()); setLastSelectedId(null); }}>Clear selection</button>
        </section>
      )}

      {category === 'material' && (
        <section className="rate-book-material-source">
          <div><strong>Stock material library</strong><small>Bring an existing company color into the Rate Book as a cost-reference row.</small></div>
          <select value="" disabled={!availableStock.length} onChange={(event) => { if (event.target.value) addStockMaterial(event.target.value); }}>
            <option value="">{availableStock.length ? 'Add stocked material…' : 'All active stock colors are linked'}</option>
            {availableStock.map((material) => <option value={material.id} key={material.id}>{material.name} · {material.materialType}</option>)}
          </select>
        </section>
      )}

      <section className="rate-book-sheet-shell">
        <div className="rate-book-sheet-scroll">
          <table className="rate-book-sheet" style={{ minWidth: sheetMinWidth }}>
            <colgroup>
              <col style={{ width: 44 }} />
              {visibleColumns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] }} />)}
            </colgroup>
            <thead><tr>
              <th className="rate-book-row-header-cell"><button type="button" onClick={toggleAllVisible} title={allVisibleSelected ? 'Clear visible row selection' : 'Select all visible rows'}>{allVisibleSelected ? '✓' : '#'}</button></th>
              {visibleColumns.map((column) => (
                <th key={column.key} title="Drag the right edge to resize. Right-click to hide this column." onContextMenu={(event) => { if (!column.lockVisible) { event.preventDefault(); toggleColumn(column.key); } }}>
                  <span>{column.label}</span>
                  <span className="rate-book-column-resizer" role="separator" aria-orientation="vertical" onPointerDown={(event) => startResize(column, event)} />
                </th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((item, index) => <RateBookSheetRow item={item} rowNumber={index + 1} columns={visibleColumns} key={item.id} expanded={expandedId === item.id} selected={selectedIds.has(item.id)} onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)} onSelect={(event) => toggleRowSelection(item.id, event.shiftKey)} />)}
              {!filtered.length && <tr><td colSpan={visibleColumns.length + 1}><div className="rate-book-empty"><strong>No matching rate rows</strong><span>Add a row or change the filters above.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="rate-book-footnote"><strong>Pricing rule:</strong> Rate Book → context-adjusted reference → quote snapshot → salesperson chooses the actual customer price.</footer>
    </main>
  );
}
