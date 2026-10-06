import { useEffect, useMemo } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { materialLevelCostBand, resolveMaterialLevel, type MaterialLevelPricingMode } from '../types/materialLevelGuide';
import type { PricingMaterialType } from '../types/quote';
import type { StockMaterialUnit } from '../types/settings';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const materialTypes: PricingMaterialType[] = ['Granite', 'Quartz', 'Marble', 'Quartzite', 'Other'];
const units: Array<[StockMaterialUnit, string]> = [['sf', 'SF'], ['slab', 'Slab'], ['each', 'Each']];

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function MaterialRateBook({ query, showInactive }: { query: string; showInactive: boolean }) {
  const settings = useCompanySettingsStore((state) => state.settings);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const addStockMaterial = useCompanySettingsStore((state) => state.addStockMaterial);
  const updateStockMaterial = useCompanySettingsStore((state) => state.updateStockMaterial);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrated = useMaterialLevelGuideStore((state) => state.hydrated);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const updateGuide = useMaterialLevelGuideStore((state) => state.updateGuide);
  const updateRule = useMaterialLevelGuideStore((state) => state.updateRule);
  const addRule = useMaterialLevelGuideStore((state) => state.addRule);
  const removeRule = useMaterialLevelGuideStore((state) => state.removeRule);
  const captureVersion = useMaterialLevelGuideStore((state) => state.captureVersion);
  const restoreVersion = useMaterialLevelGuideStore((state) => state.restoreVersion);

  useEffect(() => {
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateSettings, hydrateGuide]);

  const orderedRules = useMemo(() => [...guide.rules].sort((a, b) => {
    if (a.maxMaterialCost === undefined) return 1;
    if (b.maxMaterialCost === undefined) return -1;
    return a.maxMaterialCost - b.maxMaterialCost;
  }), [guide.rules]);

  const materials = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return settings.stockMaterials
      .filter((material) => showInactive || material.active)
      .filter((material) => !needle || `${material.name} ${material.brand ?? ''} ${material.materialType} ${material.notes ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name));
  }, [settings.stockMaterials, query, showInactive]);

  if (!hydrated) return <div className="material-rate-loading">Opening material guide…</div>;

  return (
    <div className="material-rate-book">
      <section className="material-level-guide-card">
        <header className="material-level-guide-header">
          <div>
            <span className="board-eyebrow">Builder pricing logic</span>
            <input className="material-level-guide-title" value={guide.name} onChange={(event) => updateGuide({ name: event.target.value })} aria-label="Guide name" />
            <p>These are <strong>final customer countertop $/SF rates</strong>—material, shop, and standard install are already included. Sinks and special add-ons stay separate.</p>
          </div>
          <div className="material-level-guide-actions">
            <button type="button" onClick={() => {
              const note = window.prompt('Version note', 'Builder level guide checkpoint');
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

        <div className="material-level-sheet-scroll">
          <table className="material-level-sheet">
            <thead><tr><th>On</th><th>Level</th><th>Material cost ceiling</th><th>Pricing rule</th><th>Standard customer $/SF</th><th>Meaning</th><th /></tr></thead>
            <tbody>
              {orderedRules.map((rule) => (
                <tr key={rule.id} className={rule.active ? '' : 'is-inactive'}>
                  <td className="material-level-on"><input type="checkbox" checked={rule.active} onChange={(event) => updateRule(rule.id, { active: event.target.checked })} /></td>
                  <td><input value={rule.label} onChange={(event) => updateRule(rule.id, { label: event.target.value })} /></td>
                  <td className="number"><label className="material-currency-cell"><span>$</span><input type="number" step="0.01" value={rule.maxMaterialCost ?? ''} placeholder="No ceiling" onChange={(event) => updateRule(rule.id, { maxMaterialCost: numberValue(event.target.value) })} /></label></td>
                  <td><select value={rule.pricingMode} onChange={(event) => updateRule(rule.id, { pricingMode: event.target.value as MaterialLevelPricingMode })}><option value="fixed">Fixed final $/SF</option><option value="multiplier">Material cost multiplier</option></select></td>
                  <td className="number">{rule.pricingMode === 'fixed' ? <label className="material-currency-cell"><span>$</span><input type="number" step="0.01" value={rule.customerRate ?? ''} onChange={(event) => updateRule(rule.id, { customerRate: numberValue(event.target.value) })} /></label> : <label className="material-multiplier-cell"><input type="number" step="0.01" value={rule.multiplier ?? ''} onChange={(event) => updateRule(rule.id, { multiplier: numberValue(event.target.value) })} /><span>× cost</span></label>}</td>
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

      <section className="material-catalog-card">
        <header className="material-catalog-header">
          <div><span className="board-eyebrow">Material catalog</span><strong>Colors & level assignment</strong><small>Leave Level on Auto to let material cost choose the standard builder level. Force a level only when sales strategy calls for it.</small></div>
          <button type="button" onClick={() => addStockMaterial()}>+ Material</button>
        </header>

        <div className="material-catalog-scroll">
          <table className="material-catalog-sheet">
            <thead><tr><th>On</th><th>Type</th><th>Level</th><th>Brand</th><th>Color</th><th>Material cost</th><th>Standard builder</th><th>Basis</th><th>Notes</th></tr></thead>
            <tbody>
              {materials.map((material) => {
                const resolved = material.unit === 'sf' ? resolveMaterialLevel(guide.rules, material.internalCost, material.builderLevelId) : undefined;
                const validForced = material.builderLevelId && guide.rules.some((rule) => rule.id === material.builderLevelId);
                return (
                  <tr key={material.id} className={material.active ? '' : 'is-inactive'}>
                    <td className="material-level-on"><input type="checkbox" checked={material.active} onChange={(event) => updateStockMaterial(material.id, { active: event.target.checked })} /></td>
                    <td><select value={material.materialType} onChange={(event) => updateStockMaterial(material.id, { materialType: event.target.value as PricingMaterialType })}>{materialTypes.map((type) => <option key={type}>{type}</option>)}</select></td>
                    <td><select value={validForced ? material.builderLevelId : 'auto'} onChange={(event) => updateStockMaterial(material.id, { builderLevelId: event.target.value === 'auto' ? undefined : event.target.value })}><option value="auto">Auto{resolved ? ` · ${resolved.rule.label}` : ''}</option>{orderedRules.filter((rule) => rule.active).map((rule) => <option value={rule.id} key={rule.id}>{rule.label}</option>)}</select></td>
                    <td><input value={material.brand ?? ''} onChange={(event) => updateStockMaterial(material.id, { brand: event.target.value })} placeholder="Brand" /></td>
                    <td className="material-color-cell"><input value={material.name} onChange={(event) => updateStockMaterial(material.id, { name: event.target.value })} /></td>
                    <td className="number"><div className="material-cost-with-unit"><label className="material-currency-cell"><span>$</span><input type="number" step="0.01" value={material.internalCost ?? ''} onChange={(event) => updateStockMaterial(material.id, { internalCost: numberValue(event.target.value) })} /></label><select value={material.unit} onChange={(event) => updateStockMaterial(material.id, { unit: event.target.value as StockMaterialUnit })}>{units.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div></td>
                    <td className="material-standard-rate">{resolved?.customerRate === undefined ? <span>—</span> : <strong>{money.format(resolved.customerRate)}/SF</strong>}<small>{resolved?.rule.label ?? (material.unit !== 'sf' ? 'Needs $/SF cost' : 'Needs material cost')}</small></td>
                    <td className="material-basis-cell">{resolved?.basis ?? '—'}</td>
                    <td><input value={material.notes ?? ''} onChange={(event) => updateStockMaterial(material.id, { notes: event.target.value })} placeholder="Private note" /></td>
                  </tr>
                );
              })}
              {!materials.length && <tr><td colSpan={9}><div className="rate-book-empty"><strong>No matching materials</strong><span>Add a material or change the filters above.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
