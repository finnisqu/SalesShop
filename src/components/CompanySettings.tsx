import { useCompanySettingsStore } from '../store/companySettingsStore';

export function CompanySettings() {
  const settings = useCompanySettingsStore((state) => state.settings);
  const update = useCompanySettingsStore((state) => state.update);
  const saving = useCompanySettingsStore((state) => state.saving);
  const error = useCompanySettingsStore((state) => state.error);

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
    </main>
  );
}
