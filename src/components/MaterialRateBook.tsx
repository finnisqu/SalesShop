import { useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import {
  materialLevelCostBand,
  resolveMaterialPricingRecommendation,
  resolveSlabPrice,
} from '../types/materialLevelGuide';
import type { PricingMaterialType } from '../types/quote';
import {
  materialPurchaseCostPerSf,
  materialVariantAreaSf,
  resolveStockMaterialCostReference,
  type MaterialAvailability,
  type MaterialFormatKind,
  type MaterialPurchaseUnit,
  type MaterialVariant,
} from '../types/settings';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const materialTypes: PricingMaterialType[] = ['Granite', 'Quartz', 'Marble', 'Quartzite', 'Porcelain', 'Solid Surface', 'Other'];
const availabilityOptions: Array<[MaterialAvailability, string]> = [
  ['unknown', 'Not tracked'],
  ['stock', 'Stock'],
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low'],
  ['eta', 'ETA'],
  ['special-order', 'Special order'],
  ['discontinued', 'Discontinued'],
];
const formatKinds: Array<[MaterialFormatKind, string]> = [
  ['slab', 'Slab'],
  ['half-slab', 'Half slab'],
  ['sheet', 'Sheet'],
  ['half-sheet', 'Half sheet'],
  ['other', 'Other'],
];
const purchaseUnits: Array<[MaterialPurchaseUnit, string]> = [
  ['sf', '$ / SF'],
  ['slab', '$ / slab'],
  ['half-slab', '$ / half slab'],
  ['sheet', '$ / sheet'],
  ['half-sheet', '$ / half sheet'],
  ['each', '$ / each'],
];

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tagText(tags?: string[]) {
  return (tags ?? []).join(', ');
}

function tagsFromText(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function variantSpec(variant?: MaterialVariant) {
  if (!variant) return 'Legacy / no structured variant';
  const dimensions = variant.lengthIn && variant.widthIn ? `${variant.lengthIn} × ${variant.widthIn}` : '';
  return [variant.thickness, variant.finish, variant.formatName || (variant.formatKind ? formatKinds.find(([value]) => value === variant.formatKind)?.[1] : ''), dimensions]
    .filter(Boolean)
    .join(' · ') || 'Structured variant';
}

function availabilityLabel(value?: MaterialAvailability) {
  return availabilityOptions.find(([candidate]) => candidate === value)?.[1] ?? 'Not tracked';
}

function MaterialVariantEditor({ materialId, variant }: { materialId: string; variant: MaterialVariant }) {
  const updateVariant = useCompanySettingsStore((state) => state.updateMaterialVariant);
  const deleteVariant = useCompanySettingsStore((state) => state.deleteMaterialVariant);
  const addPurchaseOption = useCompanySettingsStore((state) => state.addMaterialPurchaseOption);
  const updatePurchaseOption = useCompanySettingsStore((state) => state.updateMaterialPurchaseOption);
  const deletePurchaseOption = useCompanySettingsStore((state) => state.deleteMaterialPurchaseOption);
  const area = materialVariantAreaSf(variant);

  return (
    <article className={`material-variant-card ${variant.active ? '' : 'is-inactive'}`}>
      <header className="material-variant-header">
        <div>
          <label><input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(materialId, variant.id, { active: event.target.checked })} /> Active</label>
          <label><input type="radio" name={`default-variant-${materialId}`} checked={variant.default} onChange={() => updateVariant(materialId, variant.id, { default: true })} /> Default quote spec</label>
        </div>
        <strong>{variantSpec(variant)}</strong>
        <button type="button" className="material-variant-delete" onClick={() => { if (window.confirm('Delete this material variant and its supplier price options?')) deleteVariant(materialId, variant.id); }}>Delete variant</button>
      </header>

      <div className="material-variant-fields">
        <label><span>Thickness</span><input value={variant.thickness ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { thickness: event.target.value })} placeholder="3cm, 2cm, 1/2 in…" /></label>
        <label><span>Surface finish</span><input value={variant.finish ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { finish: event.target.value })} placeholder="Polished, Honed, Suede…" /></label>
        <label><span>Format</span><select value={variant.formatKind ?? 'slab'} onChange={(event) => updateVariant(materialId, variant.id, { formatKind: event.target.value as MaterialFormatKind })}>{formatKinds.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Size class</span><input value={variant.formatName ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { formatName: event.target.value })} placeholder="Super Jumbo, Jumbo, Wide Sheet…" /></label>
        <label><span>Variant SKU</span><input value={variant.sku ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { sku: event.target.value })} placeholder="Supplier SKU" /></label>
        <label><span>Length (in)</span><input type="number" step="0.01" value={variant.lengthIn ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { lengthIn: numberValue(event.target.value) })} /></label>
        <label><span>Width (in)</span><input type="number" step="0.01" value={variant.widthIn ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { widthIn: numberValue(event.target.value) })} /></label>
        <label><span>Supplier SF override</span><input type="number" step="0.01" value={variant.areaSf ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { areaSf: numberValue(event.target.value) })} placeholder={area ? area.toFixed(2) : 'Auto from L × W'} /></label>
        <label><span>Availability</span><select value={variant.availability ?? 'unknown'} onChange={(event) => updateVariant(materialId, variant.id, { availability: event.target.value as MaterialAvailability })}>{availabilityOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Availability note / ETA</span><input value={variant.availabilityNote ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { availabilityNote: event.target.value })} placeholder="ETA 9/25, call to confirm…" /></label>
        <label className="wide"><span>Special features</span><input value={tagText(variant.features)} onChange={(event) => updateVariant(materialId, variant.id, { features: tagsFromText(event.target.value) })} placeholder="Bookmatched, Full body, Printed, 3D inkjet, Translucent…" /></label>
        <label className="wide"><span>Variant notes</span><input value={variant.notes ?? ''} onChange={(event) => updateVariant(materialId, variant.id, { notes: event.target.value })} placeholder="Physical / supplier-specific note" /></label>
      </div>

      <section className="material-price-programs">
        <header><div><strong>Supplier price programs</strong><small>Keep physical specs separate from how this exact variant is purchased: standard slab, 8+ bundle, half slab, special order, etc.</small></div><button type="button" onClick={() => addPurchaseOption(materialId, variant.id)}>+ Price option</button></header>
        <div className="material-price-program-list">
          {(variant.purchaseOptions ?? []).map((option) => {
            const derived = materialPurchaseCostPerSf(variant, option);
            return (
              <div className={`material-price-program ${option.active ? '' : 'is-inactive'}`} key={option.id}>
                <label className="material-price-check"><input type="checkbox" checked={option.active} onChange={(event) => updatePurchaseOption(materialId, variant.id, option.id, { active: event.target.checked })} /> On</label>
                <label className="material-price-check"><input type="radio" name={`default-price-${variant.id}`} checked={option.default} onChange={() => updatePurchaseOption(materialId, variant.id, option.id, { default: true })} /> Default</label>
                <label><span>Program</span><input value={option.label} onChange={(event) => updatePurchaseOption(materialId, variant.id, option.id, { label: event.target.value })} placeholder="Standard, Bundle 8+…" /></label>
                <label><span>Min qty</span><input type="number" min="0" step="1" value={option.minQuantity ?? ''} onChange={(event) => updatePurchaseOption(materialId, variant.id, option.id, { minQuantity: numberValue(event.target.value) })} placeholder="1" /></label>
                <label><span>Pricing basis</span><select value={option.pricingBasis} onChange={(event) => updatePurchaseOption(materialId, variant.id, option.id, { pricingBasis: event.target.value as MaterialPurchaseUnit })}>{purchaseUnits.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label><span>Cost / SF</span><input type="number" step="0.01" value={option.costPerSf ?? ''} onChange={(event) => updatePurchaseOption(materialId, variant.id, option.id, { costPerSf: numberValue(event.target.value) })} /></label>
                <label><span>Cost / unit</span><input type="number" step="0.01" value={option.costPerUnit ?? ''} onChange={(event) => updatePurchaseOption(materialId, variant.id, option.id, { costPerUnit: numberValue(event.target.value) })} /></label>
                <div className="material-derived-cost"><span>Effective cost</span><strong>{derived === undefined ? '—' : `${money.format(derived)}/SF`}</strong><small>{option.costPerSf !== undefined ? 'supplier $/SF' : option.costPerUnit !== undefined && area ? `${money.format(option.costPerUnit)} ÷ ${area.toFixed(2)} SF` : 'needs $/SF or unit cost + size'}</small></div>
                <label className="material-price-note"><span>Notes</span><input value={option.notes ?? ''} onChange={(event) => updatePurchaseOption(materialId, variant.id, option.id, { notes: event.target.value })} placeholder="8+ slabs same color, no returns, special order…" /></label>
                <button type="button" className="material-price-delete" onClick={() => deletePurchaseOption(materialId, variant.id, option.id)} title="Delete price option">×</button>
              </div>
            );
          })}
          {!(variant.purchaseOptions ?? []).length && <div className="material-variant-empty">No supplier price program yet. Add the standard purchase price first.</div>}
        </div>
      </section>
    </article>
  );
}

export function MaterialRateBook({ query, showInactive, mode = 'all' }: { query: string; showInactive: boolean; mode?: 'all' | 'guide' | 'catalog' }) {
  const settings = useCompanySettingsStore((state) => state.settings);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const addStockMaterial = useCompanySettingsStore((state) => state.addStockMaterial);
  const updateStockMaterial = useCompanySettingsStore((state) => state.updateStockMaterial);
  const deleteStockMaterial = useCompanySettingsStore((state) => state.deleteStockMaterial);
  const addMaterialVariant = useCompanySettingsStore((state) => state.addMaterialVariant);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrated = useMaterialLevelGuideStore((state) => state.hydrated);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const updateGuide = useMaterialLevelGuideStore((state) => state.updateGuide);
  const updateRule = useMaterialLevelGuideStore((state) => state.updateRule);
  const addRule = useMaterialLevelGuideStore((state) => state.addRule);
  const removeRule = useMaterialLevelGuideStore((state) => state.removeRule);
  const captureVersion = useMaterialLevelGuideStore((state) => state.captureVersion);
  const restoreVersion = useMaterialLevelGuideStore((state) => state.restoreVersion);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState<'all' | 'stock' | 'non-stock'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PricingMaterialType>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [finishFilter, setFinishFilter] = useState('all');
  const [thicknessFilter, setThicknessFilter] = useState('all');

  useEffect(() => {
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateSettings, hydrateGuide]);

  const orderedRules = useMemo(() => [...guide.rules].sort((a, b) => {
    if (a.maxMaterialCost === undefined) return 1;
    if (b.maxMaterialCost === undefined) return -1;
    return a.maxMaterialCost - b.maxMaterialCost;
  }), [guide.rules]);

  const suppliers = useMemo(() => [...new Set(settings.stockMaterials.map((material) => material.supplier?.trim()).filter((value): value is string => Boolean(value)))].sort(), [settings.stockMaterials]);
  const finishes = useMemo(() => [...new Set(settings.stockMaterials.flatMap((material) => (material.variants ?? []).map((variant) => variant.finish?.trim()).filter((value): value is string => Boolean(value))))].sort(), [settings.stockMaterials]);
  const thicknesses = useMemo(() => [...new Set(settings.stockMaterials.flatMap((material) => (material.variants ?? []).map((variant) => variant.thickness?.trim()).filter((value): value is string => Boolean(value))))].sort(), [settings.stockMaterials]);

  const materials = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return settings.stockMaterials
      .filter((material) => showInactive || material.active)
      .filter((material) => programFilter === 'all' || (programFilter === 'stock' ? material.stockProgram : !material.stockProgram))
      .filter((material) => typeFilter === 'all' || material.materialType === typeFilter)
      .filter((material) => supplierFilter === 'all' || material.supplier === supplierFilter)
      .filter((material) => finishFilter === 'all' || (material.variants ?? []).some((variant) => variant.finish === finishFilter))
      .filter((material) => thicknessFilter === 'all' || (material.variants ?? []).some((variant) => variant.thickness === thicknessFilter))
      .filter((material) => !needle || `${material.stockProgram ? 'stock program' : 'non-stock'} ${material.name} ${material.supplier ?? ''} ${material.brand ?? ''} ${material.collection ?? ''} ${material.supplierGroup ?? ''} ${material.sku ?? ''} ${material.materialType} ${(material.features ?? []).join(' ')} ${(material.variants ?? []).flatMap((variant) => [variant.sku, variant.thickness, variant.finish, variant.formatName, variant.availabilityNote, ...(variant.features ?? [])]).join(' ')} ${material.notes ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.stockProgram) - Number(a.stockProgram) || (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name));
  }, [settings.stockMaterials, query, showInactive, programFilter, typeFilter, supplierFilter, finishFilter, thicknessFilter]);

  if (!hydrated) return <div className="material-rate-loading">Opening material guide…</div>;

  return (
    <div className="material-rate-book">
      {mode !== 'catalog' && (
        <section className="material-level-guide-card">
        <header className="material-level-guide-header">
          <div>
            <span className="board-eyebrow">Builder pricing guide</span>
            <input className="material-level-guide-title" value={guide.name} onChange={(event) => updateGuide({ name: event.target.value })} aria-label="Guide name" />
            <p><strong>SalesShop suggests a standard Level from effective material cost.</strong> STOCK colors can keep a manager-assigned Level; non-stock colors show the same Level suggestion without silently assigning it. Above the normal Level range, SalesShop switches to slab-pricing review instead of multiplying finished square feet.</p>
          </div>
          <div className="material-level-guide-actions">
            <button type="button" onClick={() => {
              const note = window.prompt('Version note', 'Builder pricing guide checkpoint');
              if (note !== null) captureVersion(note);
            }}>Save version</button>
            <button type="button" onClick={() => addRule()}>+ Level</button>
          </div>
        </header>

        {guide.note && (
          <label className="material-level-guide-note">
            <span>Guide note</span>
            <input value={guide.note} onChange={(event) => updateGuide({ note: event.target.value })} />
          </label>
        )}

        <div className="material-slab-guide">
          <div className="material-slab-guide-copy">
            <span className="board-eyebrow">Above the Level guide</span>
            <strong>Premium slab-pricing review</strong>
            <small>The multiplier applies to the actual slabs purchased—not material $/SF and not finished job SF. If one slab covers the job, a 15 SF job and a 30 SF job can carry the same material price.</small>
          </div>
          <label>
            <span>Level guide through</span>
            <div className="material-guide-number">
              <input type="number" min="0" step="0.01" value={guide.slabPricingThresholdCostPerSf} onChange={(event) => {
                const value = numberValue(event.target.value);
                if (value !== undefined) updateGuide({ slabPricingThresholdCostPerSf: value });
              }} />
              <b>$/SF cost</b>
            </div>
          </label>
          <label>
            <span>Slab multiplier</span>
            <div className="material-guide-number">
              <input type="number" min="0" step="0.01" value={guide.slabPricingMultiplier} onChange={(event) => {
                const value = numberValue(event.target.value);
                if (value !== undefined) updateGuide({ slabPricingMultiplier: value });
              }} />
              <b>× slab cost</b>
            </div>
          </label>
          <div className="material-slab-guide-example">
            <span>Quick-math example</span>
            <strong>{money.format(1500 * guide.slabPricingMultiplier)}/slab</strong>
            <small>{money.format(1500)} actual slab cost × {guide.slabPricingMultiplier}; fabrication/install room is carried by the slab margin.</small>
          </div>
        </div>

        <div className="material-level-sheet-scroll">
          <table className="material-level-sheet material-level-sheet-v3">
            <thead><tr><th>On</th><th>Level</th><th>Material cost ceiling</th><th>Standard customer $/SF</th><th>Meaning</th><th /></tr></thead>
            <tbody>
              {orderedRules.map((rule) => (
                <tr key={rule.id} className={rule.active ? '' : 'is-inactive'}>
                  <td className="material-level-on"><input type="checkbox" checked={rule.active} onChange={(event) => updateRule(rule.id, { active: event.target.checked })} /></td>
                  <td><input value={rule.label} onChange={(event) => updateRule(rule.id, { label: event.target.value })} /></td>
                  <td className="number"><label className="material-currency-cell"><span>$</span><input type="number" step="0.01" value={rule.maxMaterialCost} onChange={(event) => {
                    const value = numberValue(event.target.value);
                    if (value !== undefined) updateRule(rule.id, { maxMaterialCost: value });
                  }} /></label></td>
                  <td className="number"><label className="material-currency-cell"><span>$</span><input type="number" step="0.01" value={rule.customerRate} onChange={(event) => {
                    const value = numberValue(event.target.value);
                    if (value !== undefined) updateRule(rule.id, { customerRate: value });
                  }} /></label></td>
                  <td className="material-level-meaning">{materialLevelCostBand(guide.rules, rule)}</td>
                  <td><button type="button" className="material-level-remove" disabled={guide.rules.length <= 1} onClick={() => removeRule(rule.id)} title="Remove level">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="material-level-history">
          <summary>{guide.history.length} saved guide version{guide.history.length === 1 ? '' : 's'}</summary>
          <div>
            {guide.history.map((version) => <button type="button" key={version.id} onClick={() => { if (window.confirm(`Restore this ${new Date(version.recordedAt).toLocaleDateString()} guide version?`)) restoreVersion(version.id); }}><strong>{new Date(version.recordedAt).toLocaleDateString()}</strong><span>{version.note || 'Saved guide version'} · {version.rules.length} levels</span></button>)}
          </div>
        </details>
        </section>
      )}

      {mode !== 'guide' && (
        <section className="material-catalog-card">
        <header className="material-catalog-header">
          <div><span className="board-eyebrow">Material reference</span><strong>Supplier catalog → STOCK program → pricing guide</strong><small>Maintain the full supplier catalog here, then explicitly choose which colors belong to your STOCK program. Thickness, finish, slab/sheet size and special features live on variants; supplier purchase programs live below each variant.</small></div>
          <button type="button" onClick={() => { const id = addStockMaterial(); setExpandedMaterialId(id); }}>+ Material</button>
        </header>

        <div className="material-reference-filters">
          <label><span>Program</span><select value={programFilter} onChange={(event) => setProgramFilter(event.target.value as 'all' | 'stock' | 'non-stock')}><option value="all">All colors</option><option value="stock">STOCK program</option><option value="non-stock">Non-stock</option></select></label>
          <label><span>Material</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | PricingMaterialType)}><option value="all">All materials</option>{materialTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Supplier</span><select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="all">All suppliers</option>{suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}</select></label>
          <label><span>Finish</span><select value={finishFilter} onChange={(event) => setFinishFilter(event.target.value)}><option value="all">All finishes</option>{finishes.map((finish) => <option key={finish}>{finish}</option>)}</select></label>
          <label><span>Thickness</span><select value={thicknessFilter} onChange={(event) => setThicknessFilter(event.target.value)}><option value="all">All thicknesses</option>{thicknesses.map((thickness) => <option key={thickness}>{thickness}</option>)}</select></label>
          <button type="button" onClick={() => { setProgramFilter('all'); setTypeFilter('all'); setSupplierFilter('all'); setFinishFilter('all'); setThicknessFilter('all'); }}>Clear filters</button>
        </div>

        <div className="material-catalog-scroll">
          <table className="material-catalog-sheet material-reference-sheet material-reference-sheet-compact">
            <thead><tr><th>On</th><th>Type</th><th>Program</th><th>Brand</th><th>Color</th><th>Group</th><th>Default spec</th><th /></tr></thead>
            <tbody>
              {materials.map((material) => {
                const reference = resolveStockMaterialCostReference(material);
                const recommendation = resolveMaterialPricingRecommendation(
                  guide,
                  reference.costPerSf,
                  material.stockProgram ? material.builderLevelId : undefined,
                );
                const validForced = material.stockProgram && material.builderLevelId && guide.rules.some((rule) => rule.id === material.builderLevelId);
                const expanded = expandedMaterialId === material.id;
                const level = recommendation.mode === 'level' ? recommendation.level : undefined;
                return (
                  <>
                    <tr key={material.id} className={`${material.active ? '' : 'is-inactive'} ${expanded ? 'is-expanded' : ''} ${material.stockProgram ? 'is-stock-program' : 'is-non-stock-program'}`}>
                      <td className="material-level-on"><input type="checkbox" checked={material.active} onChange={(event) => updateStockMaterial(material.id, { active: event.target.checked })} /></td>
                      <td><select value={material.materialType} onChange={(event) => updateStockMaterial(material.id, { materialType: event.target.value as PricingMaterialType })}>{materialTypes.map((type) => <option key={type}>{type}</option>)}</select></td>
                      <td className="material-program-cell"><select value={material.stockProgram ? 'stock' : 'non-stock'} onChange={(event) => updateStockMaterial(material.id, { stockProgram: event.target.value === 'stock' })}><option value="stock">STOCK</option><option value="non-stock">Non-stock</option></select></td>
                      <td><input value={material.brand ?? ''} onChange={(event) => updateStockMaterial(material.id, { brand: event.target.value })} placeholder="Vicostone, Corian…" /></td>
                      <td className="material-color-cell"><input value={material.name} onChange={(event) => updateStockMaterial(material.id, { name: event.target.value })} /></td>
                      <td><input value={material.supplierGroup ?? ''} onChange={(event) => updateStockMaterial(material.id, { supplierGroup: event.target.value })} placeholder="Group 3, F…" /></td>
                      <td className="material-default-spec"><strong>{variantSpec(reference.variant)}</strong><small>{reference.variant ? `${availabilityLabel(reference.variant.availability)}${reference.variant.availabilityNote ? ` · ${reference.variant.availabilityNote}` : ''}` : reference.costPerSf !== undefined ? `${money.format(reference.costPerSf)}/SF legacy cost` : 'Add variant details'}</small></td>
                      <td className="material-reference-details"><button type="button" onClick={() => setExpandedMaterialId((current) => current === material.id ? null : material.id)}>{expanded ? 'Close' : 'Details'}</button></td>
                    </tr>
                    {expanded && (
                      <tr className="material-reference-expanded-row" key={`${material.id}-details`}><td colSpan={8}>
                        <section className="material-reference-detail-panel">
                          <div className="material-reference-meta">
                            <label><span>Supplier / importer</span><input value={material.supplier ?? ''} onChange={(event) => updateStockMaterial(material.id, { supplier: event.target.value })} placeholder="UMI, MSI, Hallmark…" /></label>
                            <label><span>STOCK pricing level</span>{material.stockProgram
                              ? <select value={validForced ? material.builderLevelId : 'auto'} onChange={(event) => updateStockMaterial(material.id, { builderLevelId: event.target.value === 'auto' ? undefined : event.target.value })}><option value="auto">Auto{level ? ` · ${level.rule.label}` : recommendation.mode === 'slab-review' ? ' · Slab review' : ''}</option>{orderedRules.filter((rule) => rule.active).map((rule) => <option value={rule.id} key={rule.id}>{rule.label}</option>)}</select>
                              : <div className={`material-detail-readout ${recommendation.mode === 'slab-review' ? 'is-slab-review' : ''}`}>{level ? `Suggested ${level.rule.label}` : recommendation.mode === 'slab-review' ? 'Slab pricing review' : 'Needs effective cost'}</div>}</label>
                            <label><span>Collection / series</span><input value={material.collection ?? ''} onChange={(event) => updateStockMaterial(material.id, { collection: event.target.value })} placeholder="Collection or supplier series" /></label>
                            <label><span>Base SKU / code</span><input value={material.sku ?? ''} onChange={(event) => updateStockMaterial(material.id, { sku: event.target.value })} placeholder="Color code" /></label>
                            <label className="wide"><span>Color-level special features</span><input value={tagText(material.features)} onChange={(event) => updateStockMaterial(material.id, { features: tagsFromText(event.target.value) })} placeholder="Bookmatched, Full body, Limited edition, Printed…" /></label>
                            <label className="wide"><span>Internal material notes</span><input value={material.notes ?? ''} onChange={(event) => updateStockMaterial(material.id, { notes: event.target.value })} placeholder="Private sales / purchasing reference" /></label>
                          </div>

                          <div className="material-reference-variants-header"><div><strong>Physical variants</strong><small>Use one variant for each real combination of thickness, finish and slab/sheet format. Do not duplicate a color just because the supplier sells it in multiple sizes.</small></div><button type="button" onClick={() => addMaterialVariant(material.id)}>+ Variant</button></div>
                          <div className="material-variant-list">
                            {(material.variants ?? []).map((variant) => <MaterialVariantEditor materialId={material.id} variant={variant} key={variant.id} />)}
                            {!(material.variants ?? []).length && <div className="material-variant-empty"><strong>Legacy material row</strong><span>{material.internalCost !== undefined ? `${money.format(material.internalCost)}/${material.unit.toUpperCase()} is still usable for quoting.` : 'No cost reference is set.'} Add a physical variant to capture slab size, finish, features and supplier pricing programs.</span><button type="button" onClick={() => addMaterialVariant(material.id)}>Create first variant</button></div>}
                          </div>
                          <footer className="material-reference-admin"><span>{recommendation.mode === 'level'
                            ? material.stockProgram
                              ? `This STOCK color uses ${recommendation.level.rule.label} at ${money.format(recommendation.level.customerRate)}/SF. SalesShop's automatic suggestion is based on effective material cost; a manager can explicitly assign a different Level.`
                              : `This non-stock color falls in ${recommendation.level.rule.label}. SalesShop suggests ${money.format(recommendation.level.customerRate)}/SF from the standard Level guide without silently assigning it to STOCK.`
                            : recommendation.mode === 'slab-review'
                              ? `This material is above the standard Level range. Premium quick-math uses actual full slabs purchased × ${guide.slabPricingMultiplier}; finished countertop SF is not the multiplier basis.`
                              : 'Set an effective material cost before SalesShop can suggest a standard Level.'}</span><button type="button" className="danger" onClick={() => { if (window.confirm(`Delete ${material.name}?`)) deleteStockMaterial(material.id); }}>Delete material</button></footer>
                        </section>
                      </td></tr>
                    )}
                  </>
                );
              })}
              {!materials.length && <tr><td colSpan={8}><div className="rate-book-empty"><strong>No matching materials</strong><span>Add a material or change the filters above.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
        </section>
      )}
    </div>
  );
}
