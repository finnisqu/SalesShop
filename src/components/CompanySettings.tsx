import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppearanceStore } from '../store/appearanceStore';
import { TeamAccessSettings } from './TeamAccessSettings';
import type { TeamRole } from '../services/teamAccess';
import { useAuthStore } from '../store/authStore';
import { useCompanySettingsStore } from '../store/companySettingsStore';

type SettingsTab = 'company' | 'account' | 'team' | 'appearance';
const TABS: Array<{ id: SettingsTab; title: string; subtitle: string }> = [
  { id: 'company', title: 'Company & Branding', subtitle: 'Customer-facing identity' },
  { id: 'account', title: 'My Account', subtitle: 'Salesperson profile' },
  { id: 'team', title: 'Team', subtitle: 'People in your shop' },
  { id: 'appearance', title: 'Appearance & Accessibility', subtitle: 'Personal preferences' },
];
const localMessage = 'Sign in to a cloud workspace to manage your salesperson profile and team.';

export function CompanySettings() {
  const settings = useCompanySettingsStore((state) => state.settings);
  const update = useCompanySettingsStore((state) => state.update);
  const saving = useCompanySettingsStore((state) => state.saving);
  const error = useCompanySettingsStore((state) => state.error);
  const mode = useAuthStore((state) => state.mode);
  const user = useAuthStore((state) => state.user);
  const organizationId = useAuthStore((state) => state.organizationId);
  const signOut = useAuthStore((state) => state.signOut);
  const appearance = useAppearanceStore((state) => state.preferences);
  const updateAppearance = useAppearanceStore((state) => state.update);
  const resetAppearance = useAppearanceStore((state) => state.reset);
  const [tab, setTab] = useState<SettingsTab>('company');
  const [profileName, setProfileName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [workspaces, setWorkspaces] = useState<Array<{id:string;name:string}>>([]);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const cloudReady = mode === 'cloud' && Boolean(user && organizationId && supabase);
  const [companyRole, setCompanyRole] = useState<TeamRole | null>(null);
  const canEditCompany = mode === 'local' || companyRole === 'owner' || companyRole === 'admin';
  useEffect(() => {
    if (!cloudReady || !user || !organizationId || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('organization_members').select('role')
        .eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
      if (!cancelled) setCompanyRole((data?.role as TeamRole | undefined) ?? null);
    })();
    return () => { cancelled = true; };
  }, [cloudReady, user?.id, organizationId]);

  useEffect(() => {
    if (tab !== 'account' || !cloudReady || !user || !supabase) return;
    let cancelled = false;
    setProfileLoading(true);
    setProfileNotice('');
    void (async () => {
      const { data, error: loadError } = await supabase.from('profiles')
        .select('display_name').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;
      const fallback = String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? '');
      setProfileName(String(data?.display_name ?? fallback));
      setProfileNotice(loadError ? `Could not load the saved profile: ${loadError.message}` : '');
      setProfileLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tab, cloudReady, user?.id, organizationId]);

  useEffect(() => {
    if (tab !== 'account' || !cloudReady || !user || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data: memberships, error: memberError } = await supabase.from('organization_members')
        .select('organization_id').eq('user_id', user.id);
      if (memberError || cancelled) return;
      const ids = (memberships ?? []).map((row) => String(row.organization_id));
      if (!ids.length) return;
      const { data: organizations } = await supabase.from('organizations').select('id,name').in('id', ids);
      if (!cancelled) setWorkspaces((organizations ?? []).map((row) => ({
        id:String(row.id), name:String(row.name ?? 'Company workspace'),
      })).sort((a,b) => a.name.localeCompare(b.name)));
    })();
    return () => { cancelled = true; };
  }, [tab, cloudReady, user?.id, organizationId]);

  const switchWorkspace = async (targetId:string) => {
    if (!supabase || switchingWorkspace || !organizationId || targetId === organizationId) return;
    const target = workspaces.find((item) => item.id === targetId);
    if (!target || !window.confirm(`Switch to ${target.name}? Your current company records will remain separate.`)) return;
    setSwitchingWorkspace(true);
    setProfileNotice('');
    const { error: switchError } = await supabase.rpc('select_team_workspace', { target_organization:targetId });
    if (switchError) {
      setSwitchingWorkspace(false);
      setProfileNotice(switchError.message);
    } else window.location.reload();
  };


  const saveProfile = async () => {
    if (!cloudReady || !user || !supabase || profileSaving) return;
    setProfileSaving(true);
    setProfileNotice('');
    const clean = profileName.trim();
    const { data, error: saveError } = await supabase.from('profiles')
      .update({ display_name: clean || null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).select('user_id');
    setProfileSaving(false);
    setProfileNotice(saveError?.message || (!data?.length ? 'Your profile could not be updated. Please try signing in again.' : 'Profile saved.'));
  };

  return (
    <main className="company-settings-view">
      <div className="settings-layout">
        <header className="company-settings-header">
          <div><span className="board-eyebrow">Your workspace</span><h1>Settings</h1><p>Company identity, account information, and the way SalesShop feels to you.</p></div>
          {tab === 'company' && <div className="company-settings-save-state" role="status">{error ? <strong className="has-error">{error}</strong> : <span>{saving ? 'Saving…' : 'Saved automatically'}</span>}</div>}
        </header>
        <nav className="settings-tabs" aria-label="Settings sections">
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''}
              aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>
              <strong>{item.title}</strong><small>{item.subtitle}</small>
            </button>
          ))}
        </nav>

        {tab === 'company' && <section className="company-settings-grid settings-company-grid" aria-label="Company and branding">
          {!canEditCompany && <p className="settings-company-role-note" role="status">Only owners and admins can change company branding and shared pricing. Contact an administrator to request an update.</p>}
          <article className="company-settings-card">
            <header><div><strong>Company identity</strong><small>Appears on customer-facing documents and shared quotes.</small></div><span className="settings-card-save" role="status">{error ? 'Save issue' : saving ? 'Saving…' : 'Auto-saved'}</span></header>
            <fieldset className="company-settings-fields team-company-fieldset" disabled={!canEditCompany}>
              <label className="wide"><span>Company name</span><input value={settings.organizationName} onChange={(event) => update({ organizationName: event.target.value })} autoComplete="organization" /></label>
              <label className="wide"><span>Business address</span><textarea rows={2} value={settings.address} onChange={(event) => update({ address: event.target.value })} autoComplete="street-address" /></label>
              <label><span>Phone</span><input type="tel" value={settings.phone} onChange={(event) => update({ phone: event.target.value })} autoComplete="tel" /></label>
              <label><span>Email</span><input type="email" value={settings.email} onChange={(event) => update({ email: event.target.value })} autoComplete="email" /></label>
              <label className="wide"><span>Website</span><input type="url" value={settings.website} onChange={(event) => update({ website: event.target.value })} placeholder="https://…" /></label>
            </fieldset>
          </article>
          <article className="company-settings-card">
            <header><div><strong>Document branding</strong><small>Preview of the contact block customers will see.</small></div></header>
            <div className="company-branding-preview">
              {settings.logoUrl ? <img src={settings.logoUrl} alt={`${settings.organizationName || 'Company'} logo`} /> : <div className="company-logo-placeholder">LOGO</div>}
              <div><strong>{settings.organizationName || 'Your company'}</strong><span>{settings.address || 'Company address'}</span><span>{settings.phone || settings.email || 'Company phone / email'}</span></div>
            </div>
            <fieldset className="company-settings-fields team-company-fieldset" disabled={!canEditCompany}>
              <label className="wide"><span>Logo URL</span><input type="url" value={settings.logoUrl} onChange={(event) => update({ logoUrl: event.target.value })} placeholder="https://…" /><small>Paste a hosted image URL. File upload is not available yet.</small></label>
              <label><span>Default document contact</span><input value={settings.quoteContactName} onChange={(event) => update({ quoteContactName: event.target.value })} /></label>
              <label><span>Contact phone</span><input type="tel" value={settings.quoteContactPhone} onChange={(event) => update({ quoteContactPhone: event.target.value })} /></label>
            </fieldset>
          </article>
        </section>}

        {tab === 'account' && <section className="settings-panel-grid" aria-label="Salesperson account">
          <article className="company-settings-card settings-main-card">
            <header><div><strong>My salesperson profile</strong><small>Personal account details, separate from your company’s branding.</small></div></header>
            {!cloudReady ? <p className="settings-help">{localMessage}</p> : <>
              <div className="settings-account-identity">
                <span className="settings-avatar">{(profileName || user?.email || 'S').charAt(0).toUpperCase()}</span>
                <div><strong>{profileName || 'Your account'}</strong><small>{user?.email}</small></div>
              </div>
              <div className="company-settings-fields">
                <label className="wide"><span>Display name</span><input value={profileName} onChange={(event) => { setProfileName(event.target.value); setProfileNotice(''); }} disabled={profileLoading || profileSaving} placeholder="How your team knows you" autoComplete="name" /></label>
                <label className="wide"><span>Sign-in email</span><input type="email" value={user?.email || ''} readOnly aria-readonly="true" /><small>Managed by your sign-in account.</small></label>
              </div>
              <div className="settings-inline-actions"><button type="button" className="settings-primary-button" disabled={profileLoading || profileSaving} onClick={() => void saveProfile()}>{profileSaving ? 'Saving…' : 'Save profile'}</button><button type="button" onClick={() => void signOut()}>Sign out</button></div>
              {profileNotice && <p className="settings-feedback" role="status">{profileNotice}</p>}
            </>}
          </article>
          <article className="company-settings-card settings-secondary-card">
            <header><div><strong>Account & privacy</strong><small>What belongs to you and what belongs to the shop.</small></div></header>
            <p className="settings-help">Your notebook is private to your account. Company records, quotes, materials, and CRM contacts belong to the shared organization workspace.</p>
            <div className="settings-detail-line"><span>Connection</span><strong>{mode === 'cloud' ? organizationId ? 'Cloud connected' : 'Cloud needs attention' : 'Local mode'}</strong></div>
            {cloudReady && <div className="settings-workspace-selector">
              <strong>Current company</strong>
              {workspaces.length > 1 ? <>
                <label htmlFor="settings-workspace-choice">Select an organization you belong to</label>
                <select id="settings-workspace-choice" value={organizationId ?? ''}
                  disabled={switchingWorkspace}
                  onChange={(event) => void switchWorkspace(event.target.value)}>
                  {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                </select>
                <small>Your personal workspace stays intact when you join a team. Switching never merges company records.</small>
              </> : <span>{workspaces.find((item) => item.id === organizationId)?.name || settings.organizationName || 'Your company'}</span>}
            </div>}
          </article>
        </section>}

        {tab === 'team' && <TeamAccessSettings />}
        {tab === 'appearance' && <section className="settings-panel-grid" aria-label="Appearance and accessibility preferences">
          <article className="company-settings-card settings-main-card">
            <header><div><strong>Reading & interaction</strong><small>Changes apply immediately on this device.</small></div></header>
            <div className="settings-preference-row">
              <div><strong>Text size</strong><small>Give workspace labels and reference cards more room to breathe.</small></div>
              <select value={appearance.textSize} onChange={(event) => updateAppearance({ textSize: event.target.value as 'standard' | 'large' })} aria-label="Text size"><option value="standard">Standard</option><option value="large">Larger</option></select>
            </div>
            <label className="settings-preference-row">
              <div><strong>Stronger contrast</strong><small>Darker text and clearer outlines.</small></div>
              <input type="checkbox" checked={appearance.highContrast} onChange={(event) => updateAppearance({ highContrast: event.target.checked })} />
            </label>
            <label className="settings-preference-row">
              <div><strong>Larger controls</strong><small>Roomier buttons and form fields for touch.</small></div>
              <input type="checkbox" checked={appearance.largerControls} onChange={(event) => updateAppearance({ largerControls: event.target.checked })} />
            </label>
            <label className="settings-preference-row">
              <div><strong>Reduce animations</strong><small>Minimize transitions and motion effects.</small></div>
              <input type="checkbox" checked={appearance.motion === 'reduced'} onChange={(event) => updateAppearance({ motion: event.target.checked ? 'reduced' : 'system' })} />
            </label>
            <div className="settings-inline-actions"><button type="button" onClick={resetAppearance}>Restore defaults</button><span className="settings-muted">Saved on this device</span></div>
          </article>
          <article className="company-settings-card settings-secondary-card">
            <header><div><strong>Preview</strong><small>SalesShop keeps its paper-and-ink character.</small></div></header>
            <div className="settings-appearance-preview"><div><strong>Calacatta Laza</strong><small>MSI · Quartz · 3cm</small></div><div><strong>$12.50/SF</strong><small>Reference cost</small></div></div>
            <p className="settings-help">Preferences affect your interface, not the pricing or document values your customers see.</p>
          </article>
        </section>}
      </div>
    </main>
  );
}
