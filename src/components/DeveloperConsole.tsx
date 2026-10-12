import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { playgroundUrl } from '../lib/developerPlayground';
import { HeadquartersNotebook } from '../platform/HeadquartersNotebook';
import { HeadquartersCrm } from '../platform/HeadquartersCrm';
import { useHeadquartersDocument } from '../platform/useHeadquartersDocument';
import { blankNotebook,cleanNotebook,blankCrm,cleanCrm,remainingFollowUps } from '../platform/headquartersTypes';
import '../developer-console.css';
import '../developer-playground.css';
import '../platform/headquarters.css';

type TenantStatus = 'not_configured' | 'trial' | 'active' | 'past_due' | 'suspended';
type Plan = 'not_configured' | 'starter' | 'growth' | 'enterprise';
type TenantMetadata = {
  id: string;
  name: string;
  createdAt: string;
  lifecycle: TenantStatus;
  plan: Plan;
};
type Overview = { organizations: TenantMetadata[]; organizationCount: number };
type ConsoleTab = 'overview' | 'companies' | 'notebook' | 'crm' | 'playground';

const label = (value: string) => value === 'not_configured' ? 'Not configured'
  : value.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
const date = (iso: string) => {
  const value = new Date(iso);
  return Number.isFinite(value.getTime()) ? value.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  }) : '—';
};

/** Platform console never imports tenant stores and never requests tenant records. */
export function DeveloperConsole() {
  const user = useAuthStore((state) => state.user);
  const platformRole = useAuthStore((state) => state.platformRole);
  const signOut = useAuthStore((state) => state.signOut);
  const [tab, setTab] = useState<ConsoleTab>('overview');
  const notebookStore = useHeadquartersDocument('notebook',blankNotebook,cleanNotebook,platformRole==='developer');
  const crmStore = useHeadquartersDocument('crm',blankCrm,cleanCrm,platformRole==='developer');
  const unsaved = notebookStore.dirty || crmStore.dirty;
  const openPlayground = () => {
    if (unsaved) { window.alert('Please wait for Headquarters changes to finish saving.'); return; }
    window.location.assign(playgroundUrl());
  };
  const guardedSignOut = () => {
    if (unsaved) { window.alert('Please wait for Headquarters changes to finish saving before signing out.'); return; }
    void signOut();
  };
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase || platformRole !== 'developer') return;
    setLoading(true); setError('');
    const { data, error: fetchError } = await supabase.rpc('platform_console_overview');
    if (fetchError) {
      setOverview(null);
      setError(fetchError.message);
    } else if (data && typeof data === 'object'
      && !Array.isArray(data)
      && Array.isArray((data as Overview).organizations)) {
      setOverview(data as Overview);
    } else {
      setOverview(null);
      setError('The platform service returned an unexpected response.');
    }
    setLoading(false);
  }, [platformRole]);

  useEffect(() => { void refresh(); }, [refresh]);
  const tenants = useMemo(() =>
    (overview?.organizations ?? []).filter((item) =>
      item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
    [overview, search]);

  if (platformRole !== 'developer') return null;
  const companyCount = overview?.organizationCount ?? 0;
  const configuredCount = overview?.organizations.filter((item) =>
    item.lifecycle !== 'not_configured').length ?? 0;

  return <div className="developer-console">
    <aside className="developer-console-sidebar" aria-label="Developer navigation">
      <div className="developer-console-brand"><span className="developer-console-brand-icon">S</span>
        <div><strong>SalesShop</strong><small>PLATFORM STUDIO</small></div></div>
      <nav aria-label="Platform sections">
        <button type="button" aria-current={tab === 'overview' ? 'page' : undefined}
          className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button type="button" aria-current={tab === 'companies' ? 'page' : undefined}
          className={tab === 'companies' ? 'active' : ''} onClick={() => setTab('companies')}>Companies</button>
        <button type="button" aria-current={tab === 'notebook' ? 'page' : undefined}
          className={tab === 'notebook' ? 'active' : ''} onClick={() => setTab('notebook')}>Notebook</button>
        <button type="button" aria-current={tab === 'crm' ? 'page' : undefined}
          className={tab === 'crm' ? 'active' : ''} onClick={() => setTab('crm')}>SalesShop CRM</button>
        <button type="button" aria-current={tab === 'playground' ? 'page' : undefined}
          className={tab === 'playground' ? 'active' : ''} onClick={() => setTab('playground')}>Developer Playground</button>
        <span className="developer-console-nav-caption">FUTURE MODULES</span>
        <div className="developer-console-disabled">Subscriptions <span>Planned</span></div>
        <div className="developer-console-disabled">Releases <span>Planned</span></div>
        <div className="developer-console-disabled">Support <span>Planned</span></div>
      </nav>
      <div className="developer-console-sidebar-foot">
        <strong>Developer account</strong>
        <small>{user?.email ?? 'Platform operator'}</small>
        <button type="button" onClick={guardedSignOut}>Sign out</button>
      </div>
    </aside>
    <main className="developer-console-main">
      <header className="developer-console-header">
        <div><span className="developer-console-eyebrow">SALESSHOP / DEVELOPER CONSOLE</span>
          <h1>{tab === 'overview' ? 'SalesShop headquarters'
            : tab === 'companies' ? 'Customer companies'
            : tab === 'notebook' ? 'My notebook'
            : tab === 'crm' ? 'Platform sales CRM' : 'Developer Playground'}</h1>
          <p>{tab === 'overview' ? 'Your private home for growing and building SalesShop.'
            : tab === 'companies' ? 'Customer workspace metadata only. No access to employee or sales records.'
            : tab === 'notebook' ? 'Capture product ideas, meeting notes and next releases in your Developer account.'
            : tab === 'crm' ? 'Manage leads and conversations with companies evaluating SalesShop.'
            : 'Run the actual SalesShop app in an isolated, editable local sandbox.'}</p>
        </div>
        {(tab === 'overview' || tab === 'companies') && <button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>}
      </header>
      {(tab === 'notebook' || tab === 'crm') && <div className="hq-sync-status" role="status">
        {(() => {
          const store = tab === 'notebook' ? notebookStore : crmStore;
          return store.loading ? 'Loading private data…' : store.error ? 'Save unavailable'
            : store.saving || store.dirty ? 'Saving changes…' : '✓ Saved privately to your Developer account';
        })()}
      </div>}
      {((tab === 'notebook' && notebookStore.error) || (tab === 'crm' && crmStore.error)) && <div className="developer-console-error" role="alert">
        <strong>Headquarters data needs attention</strong>
        <span>{tab === 'notebook' ? notebookStore.error : crmStore.error}</span>
        <button type="button" onClick={() => void (tab === 'notebook' ? notebookStore.reload() : crmStore.reload())}>
          Reload saved copy (discard unsaved changes)
        </button>
      </div>}
      {error && (tab === 'overview' || tab === 'companies') && <div className="developer-console-error" role="alert">
        <strong>Could not load platform metadata</strong><span>{error}</span>
      </div>}
      {tab === 'overview' && <div className="developer-console-overview">
        <section className="developer-console-metrics" aria-label="Platform metadata">
          <article><span>Registered companies</span><strong>{loading ? '—' : companyCount}</strong>
            <small>Workspace identities only</small></article>
          <article><span>Lifecycle configured</span><strong>{loading ? '—' : configuredCount}</strong>
            <small>No billing provider connected yet</small></article>
          <article><span>SalesShop leads</span>
            <strong>{crmStore.loading ? '—' : crmStore.document.accounts.filter(a => !['Lost','Cold'].includes(a.stage)).length}</strong>
            <small>Private platform CRM · not tenant customers</small></article>
        </section>
        <section className="hq-overview-actions">
          <button type="button" onClick={() => setTab('crm')}>
            <strong>{crmStore.loading ? '—' : remainingFollowUps(crmStore.document).length} follow-ups due</strong>
            <span>Open sales pipeline →</span></button>
          <button type="button" onClick={() => setTab('notebook')}>
            <strong>{notebookStore.loading ? '—' : notebookStore.document.pages.length} notebook pages</strong>
            <span>Open product notebook →</span></button>
          <div><strong>Product usage metrics</strong>
            <span>Not collected yet. We will add privacy-limited telemetry with a clear customer policy.</span></div>
        </section>
        <section className="developer-console-playground-invite">
          <div><strong>Developer Playground</strong><p>Explore every SalesShop workspace with fictional customers and quotes. No connection to company data.</p></div>
          <button type="button" onClick={openPlayground}>Open sandbox app →</button>
        </section>
        <section className="developer-console-feature">
          <div><span className="developer-console-eyebrow">BUILT FOR MULTIPLE COMPANIES</span>
            <h2>One product. Private company workspaces.</h2>
            <p>Each business owns its people, projects, quotes, pricing and customer relationships.
              Your account maintains the SalesShop platform without inheriting company ownership.</p>
          </div>
          <div className="developer-console-feature-diagram" aria-hidden="true">
            <div>SalesShop <small>Platform</small></div>
            <span>↓</span>
            <div className="developer-console-feature-tenants"><span>Company A</span><span>Company B</span><span>Company C</span></div>
          </div>
        </section>
        <section className="developer-console-privacy">
          <div><strong>Privacy boundary</strong><p>Developer can inspect platform metadata and manage product operations when implemented.</p></div>
          <div><strong>Company ownership</strong><p>Each company's Owner controls its teammates and their access to business information.</p></div>
          <div><strong>Support access</strong><p>Not available by default. Future support sessions require customer approval, expiration and audit logs.</p></div>
        </section>
        <div className="developer-console-section-head"><h2>Customer workspaces</h2>
          <button type="button" onClick={() => setTab('companies')}>View all companies →</button></div>
        <TenantList tenants={(overview?.organizations ?? []).slice(0, 5)} loading={loading}/>
      </div>}
      {tab === 'notebook' && <HeadquartersNotebook store={notebookStore}/>}
      {tab === 'crm' && <HeadquartersCrm store={crmStore} tenants={overview?.organizations ?? []}/>}
      {tab === 'playground' && <section className="developer-console-playground">
        <div className="developer-console-playground-hero">
          <span className="developer-console-eyebrow">SAFE TO EXPERIMENT</span>
          <h2>The real SalesShop interface. Fictional data.</h2>
          <p>Open a local-only demo workspace with sample construction accounts, project boards,
            three editable quotes, notebook pages, Catalog, rates, sinks and Settings.
            Changes persist only in this browser until you reset the sandbox.</p>
          <button type="button" onClick={openPlayground}>
            Launch Playground →
          </button>
        </div>
        <div className="developer-console-playground-cards">
          <article><strong>Full app preview</strong><p>Use the same React screens as your company workspaces, including mobile navigation.</p></article>
          <article><strong>Isolated test content</strong><p>All starter customers, projects and proposals are fictional. Sandbox records use separate local storage keys.</p></article>
          <article><strong>Reset anytime</strong><p>Inside the Playground, erase its local demo changes and restore the default samples in one tap.</p></article>
        </div>
        <p className="developer-console-footnote">The Playground tests local UI behavior and calculations.
          It does not exercise cloud invitations, sharing, live team permissions, subscriptions or server-side RLS.
          Those need a separate staging backend and test identities in a future batch.</p>
      </section>}
      {tab === 'companies' && <section className="developer-console-companies">
        <div className="developer-console-company-tools">
          <label><span>Find a company</span><input type="search" value={search}
            onChange={(event) => setSearch(event.target.value)} placeholder="Search workspace names"
            aria-label="Search company names"/></label>
          <small>{tenants.length} shown</small>
        </div>
        <TenantList tenants={tenants} loading={loading}/>
        <p className="developer-console-footnote">Company names, registration dates and platform lifecycle metadata
          are visible here. Quotes, customers, contacts, employee profiles, and private notes never load in this console.</p>
      </section>}
    </main>
  </div>;
}

function TenantList({ tenants, loading }: { tenants: TenantMetadata[]; loading: boolean }) {
  if (loading) return <p className="developer-console-empty" role="status">Loading company metadata…</p>;
  if (!tenants.length) return <p className="developer-console-empty">No companies match this view.</p>;
  return <div className="developer-console-tenants">
    {tenants.map((tenant) => <article className="developer-console-tenant" key={tenant.id}>
      <div className="developer-console-tenant-avatar" aria-hidden="true">{tenant.name.slice(0, 1).toUpperCase()}</div>
      <div className="developer-console-tenant-title"><strong>{tenant.name}</strong>
        <small>Created {date(tenant.createdAt)}</small></div>
      <div className="developer-console-tenant-meta"><span>{label(tenant.plan)}</span>
        <small>{label(tenant.lifecycle)}</small></div>
      <span className="developer-console-private" title="Developer access is restricted to platform metadata">Private workspace</span>
    </article>)}
  </div>;
}
