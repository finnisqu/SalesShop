import { useMemo } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';

export function CompanySettings() {
  const settings = useCompanySettingsStore((state) => state.settings);
  const update = useCompanySettingsStore((state) => state.update);
  const saving = useCompanySettingsStore((state) => state.saving);
  const error = useCompanySettingsStore((state) => state.error);
  const materialSummary = useMemo(() => {
    const active = settings.stockMaterials.filter((material) => material.active);
    return {
      activeColors: active.length,
      stockColors: active.filter((material) => material.stockProgram).length,
      variants: active.reduce((total, material) => total + (material.variants?.filter((variant) => variant.active !== false).length ?? 0), 0),
      suppliers: new Set(active.map((material) => material.supplier?.trim()).filter(Boolean)).size,
    };
  }, [settings.stockMaterials]);

  return (
    <main className="company-settings-view">
      <header className="company-settings-header">
        <div><span className="board-eyebrow">Organization defaults</span><h1>Company Settings</h1><p>Brand the documents customers see and keep private company defaults in one place.</p></div>
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
        <header className="company-settings-stock-header">
          <div><strong>Material catalog</strong><small>Material pricing is managed in <b>Rate Book → Materials</b>. Supplier catalogs can be broad; the STOCK program is the smaller set of colors that receives your Level pricing guide.</small></div>
          <div><span>{materialSummary.stockColors} STOCK · {materialSummary.activeColors} active</span></div>
        </header>
        <div className="company-settings-fields company-material-summary">
          <div><span>Active colors</span><strong>{materialSummary.activeColors}</strong></div>
          <div><span>STOCK program</span><strong>{materialSummary.stockColors}</strong></div>
          <div><span>Physical variants</span><strong>{materialSummary.variants}</strong></div>
          <div><span>Suppliers</span><strong>{materialSummary.suppliers}</strong></div>
          <p>Company Settings owns your organization identity. The Rate Book owns supplier material intelligence and the deliberate STOCK-program selection, so salespeople have one authoritative pricing reference.</p>
        </div>
      </section>
    </main>
  );
}
