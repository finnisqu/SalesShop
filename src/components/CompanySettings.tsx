import { useMemo } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import type { PricingMaterialType } from '../types/quote';
import type { StockMaterial, StockMaterialUnit } from '../types/settings';

const MATERIAL_TYPES: PricingMaterialType[] = ['Granite', 'Quartz', 'Marble', 'Quartzite', 'Other'];

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function StockMaterialRow({ material }: { material: StockMaterial }) {
  const updateStockMaterial = useCompanySettingsStore((state) => state.updateStockMaterial);
  const deleteStockMaterial = useCompanySettingsStore((state) => state.deleteStockMaterial);
  return (
    <div className="company-stock-row">
      <label><span>Color / material</span><input value={material.name} onChange={(event) => updateStockMaterial(material.id, { name: event.target.value })} /></label>
      <label><span>Material</span><select value={material.materialType} onChange={(event) => updateStockMaterial(material.id, { materialType: event.target.value as PricingMaterialType })}>{MATERIAL_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label><span>Internal cost</span><div className="quote-money-input"><span>$</span><input type="number" step="0.01" value={material.internalCost ?? ''} onChange={(event) => updateStockMaterial(material.id, { internalCost: numberValue(event.target.value) })} /></div></label>
      <label><span>Unit</span><select value={material.unit} onChange={(event) => updateStockMaterial(material.id, { unit: event.target.value as StockMaterialUnit })}><option value="sf">SF</option><option value="slab">Slab</option><option value="each">Each</option></select></label>
      <label className="company-stock-notes"><span>Internal notes</span><input value={material.notes ?? ''} onChange={(event) => updateStockMaterial(material.id, { notes: event.target.value })} /></label>
      <label className="company-stock-active"><input type="checkbox" checked={material.active} onChange={(event) => updateStockMaterial(material.id, { active: event.target.checked })} /> Active</label>
      <button type="button" className="pricing-builder-delete" onClick={() => deleteStockMaterial(material.id)} title="Delete stock material">×</button>
    </div>
  );
}

export function CompanySettings() {
  const settings = useCompanySettingsStore((state) => state.settings);
  const update = useCompanySettingsStore((state) => state.update);
  const addStockMaterial = useCompanySettingsStore((state) => state.addStockMaterial);
  const saving = useCompanySettingsStore((state) => state.saving);
  const error = useCompanySettingsStore((state) => state.error);
  const activeCount = useMemo(() => settings.stockMaterials.filter((material) => material.active).length, [settings.stockMaterials]);

  return (
    <main className="company-settings-view">
      <header className="company-settings-header">
        <div><span className="board-eyebrow">Organization defaults</span><h1>Company Settings</h1><p>Brand the documents customers see and keep private quoting defaults in one place.</p></div>
        <div className="company-settings-save-state">{error ? <strong className="has-error">{error}</strong> : <span>{saving ? 'Saving…' : 'Saved automatically'}</span>}</div>
      </header>

      <section className="company-settings-grid">
        <article className="company-settings-card">
          <header><div><strong>Company identity</strong><small>Used on Quotes, Pricing Schedules, Change Orders, and secure customer links.</small></div></header>
          <div className="company-settings-fields">
            <label className="wide"><span>Company name</span><input value={settings.organizationName} onChange={(event) => update({ organizationName: event.target.value })} /></label>
            <label className="wide"><span>Address</span><textarea rows={2} value={settings.address} onChange={(event) => update({ address: event.target.value })} /></label>
            <label><span>Phone</span><input value={settings.phone} onChange={(event) => update({ phone: event.target.value })} /></label>
            <label><span>Email</span><input type="email" value={settings.email} onChange={(event) => update({ email: event.target.value })} /></label>
            <label className="wide"><span>Website</span><input value={settings.website} onChange={(event) => update({ website: event.target.value })} /></label>
          </div>
        </article>

        <article className="company-settings-card">
          <header><div><strong>Document branding</strong><small>SalesShop uses this contact block on customer-facing commercial documents.</small></div></header>
          <div className="company-branding-preview">
            {settings.logoUrl ? <img src={settings.logoUrl} alt={`${settings.organizationName || 'Company'} logo`} /> : <div className="company-logo-placeholder">LOGO</div>}
            <div><strong>{settings.organizationName || 'Your Company'}</strong><span>{settings.address || 'Company address'}</span><span>{settings.phone || settings.email || 'Company phone / email'}</span></div>
          </div>
          <div className="company-settings-fields">
            <label className="wide"><span>Logo URL</span><input value={settings.logoUrl} onChange={(event) => update({ logoUrl: event.target.value })} placeholder="https://…" /><small>URL support is live now; direct logo upload can use the same field once Storage is added.</small></label>
            <label><span>Default salesperson / document contact</span><input value={settings.quoteContactName} onChange={(event) => update({ quoteContactName: event.target.value })} /></label>
            <label><span>Contact phone</span><input value={settings.quoteContactPhone} onChange={(event) => update({ quoteContactPhone: event.target.value })} /></label>
          </div>
        </article>
      </section>

      <section className="company-settings-card company-stock-library">
        <header className="company-settings-stock-header"><div><strong>Stock material library</strong><small>Private company defaults. Rate Books can select these colors without retyping them.</small></div><div><span>{activeCount} active</span><button type="button" onClick={addStockMaterial}>+ Stock material</button></div></header>
        <div className="company-stock-list">
          {settings.stockMaterials.map((material) => <StockMaterialRow material={material} key={material.id} />)}
          {!settings.stockMaterials.length && <div className="pricing-builder-empty">Add your stocked Granite, Quartz, Marble, or other colors here. Internal costs never appear on customer documents.</div>}
        </div>
      </section>
    </main>
  );
}
