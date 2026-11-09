import { useEffect, useState } from 'react';
import { useQuotesMobileBetaStore } from '../store/quotesMobileBetaStore';
import {useDealTimelineBetaStore} from '../store/dealTimelineBetaStore';
import { useNavigationStore } from '../store/navigationStore';
import { supabase } from '../lib/supabase';
import { useAppearanceStore } from '../store/appearanceStore';
import { AppearanceThemePicker } from './AppearanceThemePicker';
import { PersonalDateTimeSettings } from './PersonalDateTimeSettings';
import { CompanyDocumentTermsReference } from './CompanyDocumentTermsReference';
import { OwnerRolePreviewSettings } from './RolePerspectiveControls';
import { PageHeader, Panel, Button } from '../design-system/components';
import {WorkspaceHelp} from './WorkspaceHelp';
import {WorkspaceHeader,WorkspaceMoreMenu} from './WorkspaceHeader';
import { SettingsIdentityFields, SettingsProfileFields } from './SettingsIdentityFields';
import { TeamAccessSettings } from './TeamAccessSettings';
import { SalesTeamManagement } from './SalesTeamManagement';
import type { TeamRole } from '../services/teamAccess';
import { useAuthStore } from '../store/authStore';
import { useRolePerspectiveStore } from '../store/rolePerspectiveStore';
import { useCompanySettingsStore } from '../store/companySettingsStore';

type SettingsTab = 'company' | 'account' | 'team' | 'appearance' | 'beta' | 'data' | 'advanced';
type RecordKind = 'quote' | 'person' | 'company' | 'deal' | 'activity';
const manageRecords=(kind:RecordKind,testMode=false)=>{
  window.dispatchEvent(new CustomEvent('salesshop:open-cleanup-center',{detail:{kind,testMode}}));
};
const TABS: Array<{ id: SettingsTab; title: string; subtitle: string }> = [
  { id: 'company', title: 'Company & Branding', subtitle: 'Customer-facing identity' },
  { id: 'account', title: 'My Account', subtitle: 'Salesperson profile' },
  { id: 'team', title: 'Team', subtitle: 'People in your shop' },
  { id: 'appearance', title: 'Appearance & Accessibility', subtitle: 'Personal preferences' },
  { id: 'beta', title: 'Beta Features', subtitle: 'Quote editor & project timeline' },
  { id: 'data', title: 'Data Management', subtitle: 'Delete & archive records' },
  { id: 'advanced', title: 'Advanced', subtitle: 'Optional tools' },
];
const localMessage = 'Sign in to a cloud workspace to manage your salesperson profile and team.';

export function CompanySettings() {
  const settings = useCompanySettingsStore((state) => state.settings);
  const update = useCompanySettingsStore((state) => state.update);
  const saving = useCompanySettingsStore((state) => state.saving);
  const error = useCompanySettingsStore((state) => state.error);
  const mode = useAuthStore((state) => state.mode);
  const actualRole = useAuthStore((state) => state.teamRole);
  const actualDepartment = useAuthStore((state) => state.teamDepartment);
  const perspective = useRolePerspectiveStore((state) => state.activePerspective);
  const user = useAuthStore((state) => state.user);
  const organizationId = useAuthStore((state) => state.organizationId);
  const signOut = useAuthStore((state) => state.signOut);
  const appearance = useAppearanceStore((state) => state.preferences);
  const updateAppearance = useAppearanceStore((state) => state.update);
  const resetAppearance = useAppearanceStore((state) => state.reset);
  const [tab, setTab] = useState<SettingsTab>('company');
  const [sectionSearch,setSectionSearch]=useState('');
  const quotesBetaEnabled = useQuotesMobileBetaStore((state) => state.enabled);
  const setQuotesBetaEnabled = useQuotesMobileBetaStore((state) => state.setEnabled);
  const timelineBetaEnabled=useDealTimelineBetaStore(state=>state.enabled);
  const setTimelineBetaEnabled=useDealTimelineBetaStore(state=>state.setEnabled);
  const setAppView = useNavigationStore((state) => state.setView);
  const [profileName, setProfileName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [workspaces, setWorkspaces] = useState<Array<{id:string;name:string}>>([]);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const cloudReady = mode === 'cloud' && Boolean(user && organizationId && supabase);
  const [companyRole, setCompanyRole] = useState<TeamRole | null>(null);
  const canEditCompany = mode === 'local' || companyRole === 'owner' || companyRole === 'admin';
  // Shared-record deletion is deliberate maintenance, not ordinary CRM editing.
  const canManageRecords = !perspective && (mode === 'local' || actualRole === 'owner' || actualRole === 'admin');
  const canQuickCreate=!perspective&&(mode==='local'||actualRole==='owner'||actualRole==='admin'||
    (actualRole==='member'&&actualDepartment==='general'));
  const visibleTabs = TABS.filter((item) => item.id === 'data' ? canManageRecords :
    item.id !== 'advanced' || (mode === 'cloud' && actualRole === 'owner'));
  useEffect(() => {
    if (!visibleTabs.some(item => item.id === tab)) setTab('company');
  }, [tab, mode, actualRole, canManageRecords]);
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
        <WorkspaceHeader title="Settings" help={<WorkspaceHelp page="settings" section={tab}/>}
          className="ss-settings-mobile-header"
          mobileTabs={visibleTabs.map(item=>({value:item.id,label:item.title}))}
          mobileTabValue={tab}
          onMobileTabChange={value=>setTab(value as SettingsTab)}
          tabs={<nav aria-label="Settings quick views"><button type="button" onClick={()=>setTab('company')}>Company</button>
            <button type="button" onClick={()=>setTab('account')}>My Account</button></nav>}
          more={<WorkspaceMoreMenu items={visibleTabs.map(item=>({
            label:item.title,onClick:()=>setTab(item.id),active:tab===item.id,
          }))}/>}
          search={<input type="search" aria-label="Find settings section"
            placeholder="Find settings section…" value={sectionSearch}
            onChange={event=>{
              const value=event.target.value;setSectionSearch(value);
              const found=visibleTabs.find(item=>(item.title+' '+item.subtitle).toLowerCase().includes(value.toLowerCase()));
              if(value.trim()&&found)setTab(found.id);
            }}/>}
          primary={<button type="button" aria-label="Quick create" title="Quick create"
            disabled={!canQuickCreate}
            onClick={()=>document.querySelector<HTMLButtonElement>('.mobile-app-hidden-launchers .quick-create-launcher')?.click()}>
            + Create</button>}
        />
        <PageHeader
          className="company-settings-header settings-foundation-page-header"
          eyebrow="Your workspace"
          title="Settings"
          description="Company identity, account information, and the way SalesShop feels to you."
          actions={tab === 'company' ? <div className="company-settings-save-state" role="status">{error ? <strong className="has-error">{error}</strong> : <span>{saving ? 'Saving…' : 'Saved automatically'}</span>}</div> : undefined}
        />
        <label className="settings-mobile-section-select">
          <span>Settings section</span>
          <select aria-label="Settings section" value={tab}
            onChange={event => setTab(event.target.value as SettingsTab)}>
            {visibleTabs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <nav className="settings-tabs" aria-label="Settings sections">
          {visibleTabs.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''}
              aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>
              <strong>{item.title}</strong><small>{item.subtitle}</small>
            </button>
          ))}
        </nav>

        {tab === 'company' && <section className="company-settings-grid settings-company-grid" aria-label="Company and branding">
          {!canEditCompany && <p className="settings-company-role-note" role="status">Only owners and admins can change company branding and shared pricing. Contact an administrator to request an update.</p>}
          <Panel className="company-settings-card settings-foundation-panel"
            heading={<><div className="settings-foundation-panel-title"><strong>Company identity</strong><small>Appears on customer-facing documents and shared quotes.</small></div><span className="settings-card-save" role="status">{error ? 'Save issue' : saving ? 'Saving…' : 'Auto-saved'}</span></>}>
            <fieldset className="company-settings-fields team-company-fieldset settings-foundation-fields" disabled={!canEditCompany}>
              <SettingsIdentityFields settings={settings} update={update} />
            </fieldset>
          </Panel>
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
          <CompanyDocumentTermsReference />
        </section>}

        {tab === 'account' && <section className="settings-panel-grid" aria-label="Salesperson account">
          <Panel className="company-settings-card settings-main-card settings-foundation-panel"
            heading={<div className="settings-foundation-panel-title"><strong>My salesperson profile</strong><small>Personal account details, separate from your company’s branding.</small></div>}>
            {!cloudReady ? <p className="settings-help">{localMessage}</p> : <>
              <div className="settings-account-identity">
                <span className="settings-avatar">{(profileName || user?.email || 'S').charAt(0).toUpperCase()}</span>
                <div><strong>{profileName || 'Your account'}</strong><small>{user?.email}</small></div>
              </div>
              <div className="company-settings-fields settings-foundation-fields">
                <SettingsProfileFields name={profileName} email={user?.email || ''} busy={profileLoading || profileSaving}
                  onNameChange={(name) => { setProfileName(name); setProfileNotice(''); }} />
              </div>
              <div className="settings-inline-actions">
                <Button variant="primary" disabled={profileLoading} loading={profileSaving} loadingLabel="Saving profile"
                  onClick={() => void saveProfile()}>{profileSaving ? 'Saving…' : 'Save profile'}</Button>
                <Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>
              </div>
              {profileNotice && <p className="settings-feedback" role="status">{profileNotice}</p>}
            </>}
          </Panel>
          <article className="company-settings-card settings-secondary-card">
            <header><div><strong>Account & privacy</strong><small>What belongs to you and what belongs to the shop.</small></div></header>
            <p className="settings-help">Your Notebook and Post-its are private to your account. Quotes and CRM records still follow the company's current access policies; restricted salesperson sharing is being developed separately. Signing in to another company does not merge your workspaces.</p>
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
          <PersonalDateTimeSettings userId={user?.id ?? null} />
        </section>}

        {tab === 'team' && <><TeamAccessSettings /><SalesTeamManagement /></>}
        {tab === 'appearance' && <section className="settings-panel-grid" aria-label="Appearance and accessibility preferences">
          <AppearanceThemePicker />
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
            <header><div><strong>Reference preview</strong><small>Theme choices affect the app—not prices, print layouts, or customer quote documents.</small></div></header>
            <div className="settings-appearance-preview"><div><strong>Calacatta Laza</strong><small>MSI · Quartz · 3cm</small></div><div><strong>$12.50/SF</strong><small>Reference cost</small></div></div>
            <p className="settings-help">Preferences affect your interface, not the pricing or document values your customers see.</p>
          </article>
        </section>}
        {tab === 'beta' && <section className="settings-panel-grid" aria-label="Beta features">
          <article className="company-settings-card settings-main-card">
            <header><div><strong>Choose your Quote editor</strong>
              <small>Use Quick Quote for everyday estimating; keep Detailed Editor for specialist tools.</small></div>
              <span className="settings-card-save">{quotesBetaEnabled ? 'Quick Quote' : 'Detailed Editor'}</span>
            </header>
            <label className="settings-preference-row">
              <div><strong>Use Quick Quote as my editor</strong>
                <small>Compact spreadsheet workflow on phone and desktop. Detailed Editor remains available for advanced and legacy workflows.</small></div>
              <input type="checkbox" checked={quotesBetaEnabled}
                onChange={event=>setQuotesBetaEnabled(event.target.checked)} />
            </label>
            <p className="settings-help">Both editors open the same records. Switching changes this device's editor preference only; no data is migrated, copied, or deleted. Detailed Editor retains specialist workbook and split-view workflows while parity is validated.</p>
            <div className="settings-inline-actions">
              <Button variant="primary" onClick={()=>{setQuotesBetaEnabled(true);setAppView('quotes');}}>Open Quick Quote</Button>
              <Button variant="secondary" onClick={()=>{setQuotesBetaEnabled(false);setAppView('quotes');}}>Open Detailed Editor</Button>
            </div>
            <small className="settings-muted">This preference is saved on the device. You can also switch from a Quote's Document options menu.</small>
          </article>
          <article className="company-settings-card settings-secondary-card">
            <header><div><strong>Project Timeline (Beta)</strong>
              <small>Start simple: editable milestone dates and statuses under each Deal.</small></div>
              <span className="settings-card-save">{timelineBetaEnabled?'On':'Off'}</span>
            </header>
            <label className="settings-preference-row">
              <div><strong>Enable Project Timelines</strong>
                <small>Add a Timeline view to Connections → Deals and a milestone table to Deal details.</small></div>
              <input type="checkbox" checked={timelineBetaEnabled}
                onChange={event=>setTimelineBetaEnabled(event.target.checked)}/>
            </label>
            <p className="settings-help">This first beta uses your existing Deals, but timeline edits are private drafts saved in this browser only. They do not update CRM stages, create tasks, generate invoices, or sync across devices. Turning it off hides the timeline without deleting your drafts.</p>
            <div className="settings-inline-actions">
              <Button variant="primary" disabled={!timelineBetaEnabled}
                onClick={()=>setAppView('connections')}>Explore Deal Timelines</Button>
            </div>
          </article>
        </section>}
        {tab === 'data' && canManageRecords && <section className="settings-panel-grid" aria-label="Data management">
          <article className="company-settings-card settings-main-card settings-record-management">
            <header><div>
              <strong>Manage CRM records and documents</strong>
              <small>Administrative tools for records that should no longer be in SalesShop.</small>
            </div></header>
            <p className="settings-help">Choose a record type, find the exact item, then review its relationships before removal. Records linked to quotes, other CRM history, or tasks cannot be deleted until those links are resolved. Issued quotes are archived, not permanently erased.</p>
            <div className="settings-record-management-actions" role="group" aria-label="Manage records by type">
              {([['person','People'],['company','Companies'],['deal','Deals'],['quote','Quotes'],['activity','Activities']] as const)
                .map(([kind,label])=><button key={kind} type="button" onClick={()=>manageRecords(kind)}>
                  Manage {label}
                </button>)}
            </div>
            <details className="settings-maintenance-tools">
              <summary>Maintenance and test data</summary>
              <p className="settings-help">Review sample or test records one by one. This does not automatically delete or identify test records.</p>
              <div className="settings-inline-actions">
                <button type="button" onClick={()=>manageRecords('quote',true)}>Clean up test records</button>
                <button type="button" onClick={()=>window.dispatchEvent(new Event('salesshop:open-task-cleanup'))}>Review overdue tasks</button>
              </div>
            </details>
          </article>
        </section>}
        {tab === 'advanced' && mode === 'cloud' && actualRole === 'owner' && (
          <section className="settings-panel-grid" aria-label="Advanced settings">
            <OwnerRolePreviewSettings />
          </section>
        )}
      </div>
    </main>
  );
}
