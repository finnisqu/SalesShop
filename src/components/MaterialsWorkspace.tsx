import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import {
  MATERIAL_FAMILIES,
  defaultMaterialPurchaseOption,
  materialPurchaseCostPerSf,
  materialPurchaseSlabCost,
  materialVariantAreaSf,
  resolveStockMaterialCostReference,
  resolvedMaterialFamily,
  type MaterialFamily,
  type MaterialPurchaseOption,
  type MaterialVariant,
  type StockMaterial,
} from '../types/settings';
import { MobileCatalogReferenceCard, MobileCatalogReferenceList } from './MobileCatalogReferenceCard';
import { MobileCatalogActiveFilters, MobileCatalogFilterSheet, MobileCatalogToolsSheet, type MobileCatalogFilterChip } from './MobileCatalogTools';
import { MaterialRateBook } from './MaterialRateBook';
import { SupplierImportLauncher } from './SupplierImportCenter';
import { SuppliersWorkspace } from './SuppliersWorkspace';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const PIN_STORAGE_KEY = 'salesshop-material-comparison-v1';
const MATERIALS_SECTION_KEY = 'salesshop-materials-section-v1';

type MaterialSort = 'stock-brand' | 'name' | 'brand' | 'type' | 'cost-asc' | 'cost-desc';
type ProgramFilter = 'all' | 'stock' | 'non-stock';

function moneyPerSf(value?: number) {
  return value === undefined ? '—' : `${money.format(value)}/SF`;
}

function variantSpec(variant?: MaterialVariant) {
  if (!variant) return 'No structured variant';
  return [variant.thickness, variant.finish, variant.formatName || variant.formatKind]
    .filter(Boolean)
    .join(' · ') || 'Structured variant';
}

function variantSize(variant: MaterialVariant) {
  if (variant.lengthIn && variant.widthIn) return `${variant.lengthIn} × ${variant.widthIn} in`;
  return variant.formatName || variant.formatKind || 'Size not listed';
}

function availabilityLabel(value?: MaterialVariant['availability']) {
  if (!value || value === 'unknown') return 'Availability not tracked';
  return value.replaceAll('-', ' ');
}

function productLinks(material: StockMaterial) {
  return [
    ['Slab', material.slabImageUrl],
    ['Close-up', material.closeUpImageUrl],
    ['Product', material.productUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function pinKey(materialId: string, variantId: string) {
  return `${materialId}::${variantId}`;
}

function activePurchaseOptions(variant: MaterialVariant) {
  return (variant.purchaseOptions ?? []).filter((option) => option.active !== false);
}

function priceProgramSummary(variant: MaterialVariant, option: MaterialPurchaseOption) {
  const costPerSf = materialPurchaseCostPerSf(variant, option);
  const slabCost = materialPurchaseSlabCost(variant, option);
  const unitCost = option.costPerUnit;
  return {
    label: option.label || 'Price',
    costPerSf,
    unitCost,
    slabCost,
  };
}

function compareOptionalNumbers(left?: number, right?: number) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

export function MaterialsWorkspace({ embedded = false }: { embedded?: boolean } = {}) {
  const settings = useCompanySettingsStore((state) => state.settings);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const [sectionView, setSectionView] = useState<'catalog' | 'suppliers'>(() => {
    if (embedded) return 'catalog';
    try { return localStorage.getItem(MATERIALS_SECTION_KEY) === 'suppliers' ? 'suppliers' : 'catalog'; } catch { return 'catalog'; }
  });
  const [editing, setEditing] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [isMobileReference, setIsMobileReference] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches);
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
  const [materialFamilyFilter, setMaterialFamilyFilter] = useState<'all' | MaterialFamily>('all');
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [finishFilter, setFinishFilter] = useState('all');
  const [thicknessFilter, setThicknessFilter] = useState('all');
  const [sort, setSort] = useState<MaterialSort>('stock-brand');
  const [pinnedKeys, setPinnedKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  });
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [dragTarget, setDragTarget] = useState<{ key: string; position: 'before' | 'after' } | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const update = () => setIsMobileReference(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinnedKeys));
  }, [pinnedKeys]);

  useEffect(() => {
    if (embedded) return;
    try { localStorage.setItem(MATERIALS_SECTION_KEY, sectionView); } catch { /* best-effort UI continuity */ }
  }, [embedded, sectionView]);

  const materialTypes = useMemo(() => [...new Set(settings.stockMaterials.map((material) => material.materialType))].sort(), [settings.stockMaterials]);
  const brands = useMemo(() => [...new Set(settings.stockMaterials.map((material) => material.brand?.trim()).filter((value): value is string => Boolean(value)))].sort(), [settings.stockMaterials]);
  const finishes = useMemo(() => [...new Set(settings.stockMaterials.flatMap((material) => (material.variants ?? []).map((variant) => variant.finish?.trim()).filter((value): value is string => Boolean(value))))].sort(), [settings.stockMaterials]);
  const thicknesses = useMemo(() => [...new Set(settings.stockMaterials.flatMap((material) => (material.variants ?? []).map((variant) => variant.thickness?.trim()).filter((value): value is string => Boolean(value))))].sort(), [settings.stockMaterials]);

  const materials = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = settings.stockMaterials
      .filter((material) => material.active)
      .filter((material) => programFilter === 'all' || (programFilter === 'stock' ? material.stockProgram : !material.stockProgram))
      .filter((material) => materialFamilyFilter === 'all' || resolvedMaterialFamily(material) === materialFamilyFilter)
      .filter((material) => materialTypeFilter === 'all' || material.materialType === materialTypeFilter)
      .filter((material) => brandFilter === 'all' || material.brand === brandFilter)
      .filter((material) => finishFilter === 'all' || (material.variants ?? []).some((variant) => variant.finish === finishFilter))
      .filter((material) => thicknessFilter === 'all' || (material.variants ?? []).some((variant) => variant.thickness === thicknessFilter))
      .filter((material) => !needle || `${material.name} ${material.supplier ?? ''} ${material.brand ?? ''} ${material.collection ?? ''} ${material.sku ?? ''} ${resolvedMaterialFamily(material)} ${material.materialType} ${(material.features ?? []).join(' ')} ${(material.variants ?? []).flatMap((variant) => [variant.sku, variant.thickness, variant.finish, variant.formatName, variant.availabilityNote, ...(variant.features ?? [])]).join(' ')}`.toLowerCase().includes(needle));

    return rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'brand') return (a.brand ?? a.supplier ?? '').localeCompare(b.brand ?? b.supplier ?? '') || a.name.localeCompare(b.name);
      if (sort === 'type') return resolvedMaterialFamily(a).localeCompare(resolvedMaterialFamily(b)) || a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name);
      if (sort === 'cost-asc') return compareOptionalNumbers(resolveStockMaterialCostReference(a).costPerSf, resolveStockMaterialCostReference(b).costPerSf) || a.name.localeCompare(b.name);
      if (sort === 'cost-desc') return compareOptionalNumbers(resolveStockMaterialCostReference(b).costPerSf, resolveStockMaterialCostReference(a).costPerSf) || a.name.localeCompare(b.name);
      return Number(b.stockProgram) - Number(a.stockProgram) || (a.brand ?? a.supplier ?? '').localeCompare(b.brand ?? b.supplier ?? '') || a.name.localeCompare(b.name);
    });
  }, [settings.stockMaterials, query, programFilter, materialFamilyFilter, materialTypeFilter, brandFilter, finishFilter, thicknessFilter, sort]);

  const pinnedKeySet = useMemo(() => new Set(pinnedKeys), [pinnedKeys]);

  const pinnedVariants = useMemo(() => {
    const catalog = new Map<string, { material: StockMaterial; variant: MaterialVariant }>();
    settings.stockMaterials.forEach((material) => {
      (material.variants ?? []).forEach((variant) => {
        catalog.set(pinKey(material.id, variant.id), { material, variant });
      });
    });
    return pinnedKeys
      .map((key) => catalog.get(key))
      .filter((entry): entry is { material: StockMaterial; variant: MaterialVariant } => Boolean(entry));
  }, [settings.stockMaterials, pinnedKeys]);

  const activeFilterCount = Number(programFilter !== 'all')
    + Number(materialFamilyFilter !== 'all')
    + Number(materialTypeFilter !== 'all')
    + Number(brandFilter !== 'all')
    + Number(finishFilter !== 'all')
    + Number(thicknessFilter !== 'all');

  const clearFilters = () => {
    setProgramFilter('all');
    setMaterialFamilyFilter('all');
    setMaterialTypeFilter('all');
    setBrandFilter('all');
    setFinishFilter('all');
    setThicknessFilter('all');
  };

  const activeMobileFilters: MobileCatalogFilterChip[] = [
    ...(query.trim() ? [{ key: 'search', label: `Search: ${query.trim()}`, onRemove: () => setQuery('') }] : []),
    ...(programFilter !== 'all' ? [{ key: 'program', label: `Program: ${programFilter === 'stock' ? 'STOCK' : 'Non-stock'}`, onRemove: () => setProgramFilter('all') }] : []),
    ...(materialFamilyFilter !== 'all' ? [{ key: 'family', label: materialFamilyFilter, onRemove: () => setMaterialFamilyFilter('all') }] : []),
    ...(materialTypeFilter !== 'all' ? [{ key: 'type', label: materialTypeFilter, onRemove: () => setMaterialTypeFilter('all') }] : []),
    ...(brandFilter !== 'all' ? [{ key: 'brand', label: brandFilter, onRemove: () => setBrandFilter('all') }] : []),
    ...(finishFilter !== 'all' ? [{ key: 'finish', label: finishFilter, onRemove: () => setFinishFilter('all') }] : []),
    ...(thicknessFilter !== 'all' ? [{ key: 'thickness', label: thicknessFilter, onRemove: () => setThicknessFilter('all') }] : []),
  ];

  const togglePin = (materialId: string, variantId: string, anchor?: HTMLElement | null) => {
    const key = pinKey(materialId, variantId);
    const beforeTop = anchor?.getBoundingClientRect().top;
    setPinnedKeys((current) => current.includes(key)
      ? current.filter((candidate) => candidate !== key)
      : [...current, key]);

    if (anchor && beforeTop !== undefined) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!anchor.isConnected) return;
          const afterTop = anchor.getBoundingClientRect().top;
          const delta = afterTop - beforeTop;
          if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
        });
      });
    }
  };

  const reorderPinned = (sourceKey: string, targetKey: string, position: 'before' | 'after' = 'before') => {
    if (!sourceKey || sourceKey === targetKey) return;
    setPinnedKeys((current) => {
      const sourceIndex = current.indexOf(sourceKey);
      const targetIndex = current.indexOf(targetKey);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      const adjustedTargetIndex = next.indexOf(targetKey);
      const insertionIndex = position === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex;
      next.splice(insertionIndex, 0, moved);
      return next;
    });
  };

  const nudgePinned = (key: string, offset: -1 | 1) => {
    setPinnedKeys((current) => {
      const index = current.indexOf(key);
      const targetIndex = index + offset;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  // The desktop table and compact mobile cards share exactly the same variant details.
  const renderVariantBrowser = (material: StockMaterial) => {
    const activeVariants = (material.variants ?? []).filter((variant) => variant.active !== false);
    return (
      <div className="materials-variant-browser">
        {activeVariants.map((variant) => {
          const area = materialVariantAreaSf(variant);
          const options = activePurchaseOptions(variant);
          const defaultOption = defaultMaterialPurchaseOption(variant);
          const defaultCost = materialPurchaseCostPerSf(variant, defaultOption);
          const isPinned = pinnedKeySet.has(pinKey(material.id, variant.id));
          return (
            <article className={`materials-variant-line ${isPinned ? 'is-pinned' : ''}`} key={variant.id}>
              <div className="materials-variant-identity"><strong>{variantSpec(variant)}</strong><small>{variant.sku || 'No variant SKU'}{variant.default ? ' · Default spec' : ''}</small></div>
              <div><span>Size</span><strong>{variantSize(variant)}</strong><small>{area === undefined ? 'Area not available' : `${area.toFixed(2)} SF`}</small></div>
              <div><span>Availability</span><strong>{availabilityLabel(variant.availability)}</strong><small>{variant.availabilityNote || 'No ETA note'}</small></div>
              <div className="materials-variant-default-cost"><span>Default cost</span><strong>{moneyPerSf(defaultCost)}</strong><small>{defaultOption?.label || 'No default program'}</small></div>
              <div className="materials-price-program-list">
                {options.length ? options.map((option) => {
                  const summary = priceProgramSummary(variant, option);
                  return (
                    <div key={option.id} className={option.default ? 'is-default' : ''}>
                      <span>{summary.label}{option.minQuantity ? ` · ${option.minQuantity}+` : ''}</span>
                      <strong>{moneyPerSf(summary.costPerSf)}</strong>
                      <small>{summary.unitCost === undefined ? 'No unit cost' : `${money.format(summary.unitCost)}/${option.pricingBasis}`}</small>
                    </div>
                  );
                }) : <div className="is-empty"><span>No supplier price programs</span><strong>—</strong></div>}
              </div>
              <button
                type="button"
                className={`materials-pin-button ${isPinned ? 'is-pinned' : ''}`}
                onClick={(event) => togglePin(material.id, variant.id, event.currentTarget)}
              >{isPinned ? 'Pinned' : 'Pin'}</button>
            </article>
          );
        })}
        {!activeVariants.length && <div className="materials-variant-empty">This material has no active structured variants yet. Use Edit materials to add slab sizes and supplier price programs.</div>}
      </div>
    );
  };

  return (
    <main className={`rates-workspace materials-workspace ${embedded ? 'is-catalog-embedded' : ''} ${editing ? 'is-editing' : 'is-reference'}`}>
      <header className="rates-workspace-header">
        <div>
          <span className="board-eyebrow">Supplier material library</span>
          <h1>Materials</h1>
          <p>{sectionView === 'suppliers'
            ? 'Track the vendors behind the catalog, pricing freshness, published price-list history, and purchasing relationship context.'
            : editing
              ? 'Maintain supplier colors, physical variants, slab sizes, purchase programs, and source costs.'
              : 'Browse what we can buy, drill into slab variants, and compare real supplier costs without entering edit mode.'}</p>
        </div>
        <div className="rates-mode-actions">
          {sectionView === 'catalog' && editing && (
            <label className="materials-show-inactive">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              Show inactive
            </label>
          )}
          <span className={`rates-mode-badge ${sectionView === 'catalog' && editing ? 'is-editing' : ''}`}>
            {sectionView === 'suppliers' ? 'Supplier directory' : editing ? 'Editing' : 'Reference mode'}
          </span>
          <SupplierImportLauncher placement="toolbar" />
          {sectionView === 'catalog' && (
            <button type="button" className={editing ? 'rates-done-button' : 'rates-edit-button'} onClick={() => setEditing((value) => !value)}>
              {editing ? 'Done editing' : 'Edit materials'}
            </button>
          )}
        </div>
      </header>

      {!embedded && <nav className="materials-subtabs" aria-label="Materials workspace sections">
        <button
          type="button"
          className={sectionView === 'catalog' ? 'active' : ''}
          onClick={() => setSectionView('catalog')}
        >Catalog</button>
        <button
          type="button"
          className={sectionView === 'suppliers' ? 'active' : ''}
          onClick={() => { setEditing(false); setSectionView('suppliers'); }}
        >Suppliers</button>
      </nav>}

      {sectionView === 'catalog' && <section className="rates-reference-controls rates-shared-controls materials-controls">
        <div className="rates-reference-tools materials-reference-tools">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search colors, suppliers, brands, finishes…"
            aria-label="Search material library"
          />
          <button type="button" className="materials-mobile-tools-trigger" onClick={() => setMobileToolsOpen(true)} aria-label="Open material catalog tools">
            <span>•••</span><strong>Tools</strong>
          </button>
          {!editing && (
            <>
              <details className="rates-filter-menu">
                <summary>Filter{activeFilterCount ? ` · ${activeFilterCount}` : ''}</summary>
                <div className="rates-filter-popover">
                  <label><span>Program</span><select value={programFilter} onChange={(event) => setProgramFilter(event.target.value as ProgramFilter)}><option value="all">All programs</option><option value="stock">STOCK only</option><option value="non-stock">Non-stock only</option></select></label>
                  <label><span>Material family</span><select value={materialFamilyFilter} onChange={(event) => setMaterialFamilyFilter(event.target.value as 'all' | MaterialFamily)}><option value="all">All families</option>{MATERIAL_FAMILIES.map((family) => <option value={family} key={family}>{family}</option>)}</select></label>
                  <label><span>Material type</span><select value={materialTypeFilter} onChange={(event) => setMaterialTypeFilter(event.target.value)}><option value="all">All types</option>{materialTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
                  <label><span>Brand</span><select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}><option value="all">All brands</option>{brands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}</select></label>
                  <label><span>Finish</span><select value={finishFilter} onChange={(event) => setFinishFilter(event.target.value)}><option value="all">All finishes</option>{finishes.map((finish) => <option value={finish} key={finish}>{finish}</option>)}</select></label>
                  <label><span>Thickness</span><select value={thicknessFilter} onChange={(event) => setThicknessFilter(event.target.value)}><option value="all">All thicknesses</option>{thicknesses.map((thickness) => <option value={thickness} key={thickness}>{thickness}</option>)}</select></label>
                  <button type="button" onClick={clearFilters} disabled={!activeFilterCount}>Clear filters</button>
                </div>
              </details>
              <button type="button" className="mobile-catalog-filter-trigger" aria-haspopup="dialog" onClick={() => setMobileFilterOpen(true)}>Filter{activeFilterCount ? ` · ${activeFilterCount}` : ''}</button>
              <label className="rates-sort-control materials-sort-control">
                <span>Sort by</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as MaterialSort)} aria-label="Sort material library">
                  <option value="stock-brand">{isMobileReference ? 'STOCK · Brand' : 'STOCK / brand'}</option>
                  <option value="name">Color A–Z</option>
                  <option value="brand">Brand A–Z</option>
                  <option value="type">Material type</option>
                  <option value="cost-asc">{isMobileReference ? 'Cost · Low first' : 'Cost / SF · low to high'}</option>
                  <option value="cost-desc">{isMobileReference ? 'Cost · High first' : 'Cost / SF · high to low'}</option>
                </select>
              </label>
            </>
          )}
        </div>
      </section>}
      {sectionView === 'catalog' && !editing && (
        <MobileCatalogActiveFilters items={activeMobileFilters} onClear={() => { setQuery(''); clearFilters(); }} />
      )}

      {sectionView === 'catalog' && !editing && mobileFilterOpen && (
        <MobileCatalogFilterSheet section="Materials" onClose={() => setMobileFilterOpen(false)}>
          <label><span>Program</span><select value={programFilter} onChange={(event) => setProgramFilter(event.target.value as ProgramFilter)}><option value="all">All programs</option><option value="stock">STOCK only</option><option value="non-stock">Non-stock only</option></select></label>
                  <label><span>Material family</span><select value={materialFamilyFilter} onChange={(event) => setMaterialFamilyFilter(event.target.value as 'all' | MaterialFamily)}><option value="all">All families</option>{MATERIAL_FAMILIES.map((family) => <option value={family} key={family}>{family}</option>)}</select></label>
                  <label><span>Material type</span><select value={materialTypeFilter} onChange={(event) => setMaterialTypeFilter(event.target.value)}><option value="all">All types</option>{materialTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
                  <label><span>Brand</span><select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}><option value="all">All brands</option>{brands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}</select></label>
                  <label><span>Finish</span><select value={finishFilter} onChange={(event) => setFinishFilter(event.target.value)}><option value="all">All finishes</option>{finishes.map((finish) => <option value={finish} key={finish}>{finish}</option>)}</select></label>
                  <label><span>Thickness</span><select value={thicknessFilter} onChange={(event) => setThicknessFilter(event.target.value)}><option value="all">All thicknesses</option>{thicknesses.map((thickness) => <option value={thickness} key={thickness}>{thickness}</option>)}</select></label>
                  <button type="button" onClick={clearFilters} disabled={!activeFilterCount}>Clear filters</button>
        </MobileCatalogFilterSheet>
      )}

      {mobileToolsOpen && (
        <MobileCatalogToolsSheet title="Catalog tools" section="Materials"
          description="Maintenance controls stay out of reference browsing until you need them."
          onClose={() => setMobileToolsOpen(false)}>
          <section className="materials-mobile-tools-section">
            <span className="materials-mobile-tools-label">Mode</span>
            <div className="materials-mobile-mode-row">
              <button type="button" className={!editing ? 'active' : ''} onClick={() => { setEditing(false); setMobileToolsOpen(false); }}>
                <strong>Reference</strong>
                <small>Search, compare, and look up costs</small>
              </button>
              <button type="button" className={editing ? 'active' : ''} onClick={() => { setEditing(true); setMobileToolsOpen(false); }}>
                <strong>Edit materials</strong>
                <small>Maintain catalog records and variants</small>
              </button>
            </div>
          </section>

          {editing && <section className="materials-mobile-tools-section">
            <span className="materials-mobile-tools-label">Editing</span>
            <label className="materials-mobile-inactive-toggle">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              <span><strong>Show inactive</strong><small>Include archived catalog records while editing</small></span>
            </label>
          </section>}

          <section className="materials-mobile-tools-section">
            <span className="materials-mobile-tools-label">Supplier data</span>
            <SupplierImportLauncher placement="toolbar" />
            <small className="materials-mobile-tools-note">Stage and review supplier price-list updates before publishing them into the catalog.</small>
          </section>
        </MobileCatalogToolsSheet>
      )}

      {sectionView === 'suppliers' ? (
        <SuppliersWorkspace />
      ) : editing ? (
        <div className="materials-editor-host">
          <MaterialRateBook query={query} showInactive={showInactive} mode="catalog" />
        </div>
      ) : (
        <div className="materials-reference-host">
          <section className={`materials-comparison-board ${pinnedVariants.length ? 'has-pins' : ''}`} aria-label="Pinned material comparison">
            <header>
              <div>
                <span className="board-eyebrow">Comparison board</span>
                <strong>{pinnedVariants.length ? `${pinnedVariants.length} pinned variant${pinnedVariants.length === 1 ? '' : 's'}` : 'Pin slab variants while you browse'}</strong>
                <small>Pinned variants stay here while search and filters change.</small>
              </div>
              {pinnedVariants.length > 0 && <button type="button" onClick={() => setPinnedKeys([])}>Clear all</button>}
            </header>
            {pinnedVariants.length > 0 ? (
              <div className="materials-comparison-strip">
                {pinnedVariants.map(({ material, variant }) => {
                  const option = defaultMaterialPurchaseOption(variant);
                  const costPerSf = materialPurchaseCostPerSf(variant, option);
                  const slabCost = materialPurchaseSlabCost(variant, option);
                  const area = materialVariantAreaSf(variant);
                  const key = pinKey(material.id, variant.id);
                  return (
                    <article
                      className={[
                        'materials-comparison-card',
                        draggingKey === key ? 'is-dragging' : '',
                        dragTarget?.key === key && dragTarget.position === 'before' ? 'is-drop-before' : '',
                        dragTarget?.key === key && dragTarget.position === 'after' ? 'is-drop-after' : '',
                      ].filter(Boolean).join(' ')}
                      key={key}
                      data-pin-key={key}
                      style={draggingKey === key ? {
                        transform: `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0) scale(1.025)`,
                      } : undefined}
                    >
                      <button
                        type="button"
                        className="materials-card-drag-handle"
                        title="Drag to reorder comparison cards"
                        aria-label={`Reorder ${material.name} ${variantSpec(variant)}`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          dragOriginRef.current = { x: event.clientX, y: event.clientY };
                          setDragDelta({ x: 0, y: 0 });
                          setDragTarget(null);
                          setDraggingKey(key);
                        }}
                        onPointerMove={(event) => {
                          if (draggingKey !== key || !dragOriginRef.current) return;
                          setDragDelta({
                            x: event.clientX - dragOriginRef.current.x,
                            y: event.clientY - dragOriginRef.current.y,
                          });
                          const target = document.elementsFromPoint(event.clientX, event.clientY)
                            .map((element) => element.closest<HTMLElement>('[data-pin-key]'))
                            .find((candidate) => candidate?.dataset.pinKey && candidate.dataset.pinKey !== key);
                          const targetKey = target?.dataset.pinKey;
                          if (!target || !targetKey) {
                            setDragTarget(null);
                            return;
                          }
                          const rect = target.getBoundingClientRect();
                          setDragTarget({
                            key: targetKey,
                            position: event.clientX < rect.left + rect.width / 2 ? 'before' : 'after',
                          });
                        }}
                        onPointerUp={(event) => {
                          if (dragTarget) reorderPinned(key, dragTarget.key, dragTarget.position);
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                          dragOriginRef.current = null;
                          setDragDelta({ x: 0, y: 0 });
                          setDragTarget(null);
                          setDraggingKey(null);
                        }}
                        onPointerCancel={(event) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                          dragOriginRef.current = null;
                          setDragDelta({ x: 0, y: 0 });
                          setDragTarget(null);
                          setDraggingKey(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowLeft') {
                            event.preventDefault();
                            nudgePinned(key, -1);
                          } else if (event.key === 'ArrowRight') {
                            event.preventDefault();
                            nudgePinned(key, 1);
                          }
                        }}
                      >⠿</button>
                      <button type="button" className="materials-unpin" onClick={() => togglePin(material.id, variant.id)} aria-label={`Unpin ${material.name} ${variantSpec(variant)}`}>×</button>
                      <span>{material.brand || material.supplier || 'Unknown brand'} · {material.materialType || resolvedMaterialFamily(material)}</span>
                      <strong>{material.name}</strong>
                      <b>{variantSpec(variant)}</b>
                      <dl>
                        <div><dt>Size</dt><dd>{variantSize(variant)}</dd></div>
                        <div><dt>Area</dt><dd>{area === undefined ? '—' : `${area.toFixed(2)} SF`}</dd></div>
                        <div><dt>Cost / SF</dt><dd>{moneyPerSf(costPerSf)}</dd></div>
                        <div><dt>Slab cost</dt><dd>{slabCost === undefined ? '—' : money.format(slabCost)}</dd></div>
                      </dl>
                      <small>{option?.label || 'No default price program'} · {availabilityLabel(variant.availability)}</small>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="materials-comparison-empty">Expand <strong>Variants</strong> on any material, then pin the slab options you want to compare.</div>
            )}
          </section>

          <section className="rates-reference-card materials-reference-card">
            <header>
              <div><strong>Supplier material catalog</strong><small>{materials.length} active material{materials.length === 1 ? '' : 's'} shown</small></div>
              <span>Variants reveal slab size, square footage, availability, and every active supplier price program.</span>
            </header>
            {isMobileReference ? (
              <MobileCatalogReferenceList
                label="Materials and default purchase costs"
                empty={!materials.length}
                emptyMessage="No active materials match the current search and filters."
                onReset={query.trim() || activeFilterCount ? () => { setQuery(''); clearFilters(); } : undefined}
              >
                {materials.map((material) => {
                  const reference = resolveStockMaterialCostReference(material);
                  const expanded = expandedMaterialId === material.id;
                  const activeVariantCount = (material.variants ?? []).filter((variant) => variant.active !== false).length;
                  const pinned = (material.variants ?? []).some((variant) => pinnedKeySet.has(pinKey(material.id, variant.id)));
                  return (
                    <MobileCatalogReferenceCard
                      key={material.id}
                      title={material.name}
                      subtitle={`${material.brand || material.supplier || 'Unbranded'} · ${material.materialType || resolvedMaterialFamily(material)}`}
                      price={moneyPerSf(reference.costPerSf)}
                      priceAriaLabel={`Default cost ${moneyPerSf(reference.costPerSf)}`}
                      priceMeta={reference.purchaseOption?.label || (reference.basis === 'legacy' ? 'Legacy cost' : 'No default price')}
                      highlighted={pinned}
                      expanded={expanded}
                      onToggle={() => setExpandedMaterialId(expanded ? null : material.id)}
                      details={() => renderVariantBrowser(material)}
                    />
                  );
                })}
              </MobileCatalogReferenceList>
            ) : (
            <div className="rates-reference-table-wrap">
              <table className="rates-reference-table materials-reference-table">
                <thead><tr><th>Brand</th><th>Name</th><th>Type</th><th>Program</th><th>Default cost</th><th>Default spec</th><th>Product</th><th>Variants</th></tr></thead>
                <tbody>
                  {materials.map((material) => {
                    const reference = resolveStockMaterialCostReference(material);
                    const links = productLinks(material);
                    const activeVariants = (material.variants ?? []).filter((variant) => variant.active !== false);
                    const expanded = expandedMaterialId === material.id;
                    const hasPinnedVariant = activeVariants.some((variant) => pinnedKeySet.has(pinKey(material.id, variant.id)));
                    return (
                      <Fragment key={material.id}>
                        <tr className={`${expanded ? 'is-expanded' : ''} ${hasPinnedVariant ? 'has-pinned-variant' : ''}`}>
                          <td><strong>{material.brand || material.supplier || '—'}</strong></td>
                          <td className="rates-reference-item"><button type="button" className="materials-name-toggle" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} variants for ${material.name}`} onClick={() => setExpandedMaterialId((current) => current === material.id ? null : material.id)}><strong>{material.name}</strong><span className="materials-mobile-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button><small className="materials-mobile-brand">{material.brand || material.supplier || 'Unbranded'}{material.materialType ? ` · ${material.materialType}` : ''}</small><small className="materials-desktop-subtitle">{material.collection || material.sku || '—'}</small></td>
                          <td><strong>{material.materialType || resolvedMaterialFamily(material)}</strong></td>
                          <td><span className={`rates-program-pill ${material.stockProgram ? 'is-stock' : ''}`}>{material.stockProgram ? 'STOCK' : 'Non-stock'}</span></td>
                          <td className="number"><strong>{moneyPerSf(reference.costPerSf)}</strong><small className="materials-cell-note">{reference.purchaseOption?.label || (reference.basis === 'legacy' ? 'Legacy cost' : 'No default price')}</small></td>
                          <td className="materials-default-spec"><strong>{variantSpec(reference.variant)}</strong><small>{reference.variant ? `${variantSize(reference.variant)}${materialVariantAreaSf(reference.variant) ? ` · ${materialVariantAreaSf(reference.variant)?.toFixed(2)} SF` : ''}` : 'No structured slab size'}</small></td>
                          <td className="rates-product-links">{links.length ? links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>) : <span>—</span>}</td>
                          <td className="materials-variant-toggle-cell"><button type="button" className={expanded ? 'active' : ''} onClick={() => setExpandedMaterialId((current) => current === material.id ? null : material.id)}>{expanded ? `Hide · ${activeVariants.length}` : `Variants · ${activeVariants.length}`}</button></td>
                        </tr>
                        {expanded && (
                          <tr key={`${material.id}-variants`} className="materials-variant-expanded-row">
                            <td colSpan={8}>
                              {renderVariantBrowser(material)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {!materials.length && <tr><td colSpan={8}><div className="rates-reference-empty">No active materials match the current search and filters.</div></td></tr>}
                </tbody>
              </table>
            </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
