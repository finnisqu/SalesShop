import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { appAbsoluteUrl } from '../lib/appUrl';
import { blankStudioSettings,STUDIO_ACCENTS,STUDIO_DENSITIES,STUDIO_TABS,STUDIO_TAB_LABELS,
  type StudioSettingsDocument } from './headquartersSettingsTypes';
import type { HeadquartersDocumentState } from './useHeadquartersDocument';
import type { PlatformCrmDocument,PlatformNotebookDocument } from './headquartersTypes';

type Props={
  store:HeadquartersDocumentState<StudioSettingsDocument>;
  notebook:HeadquartersDocumentState<PlatformNotebookDocument>;
  crm:HeadquartersDocumentState<PlatformCrmDocument>;
  email:string;
  verified:boolean;
  registeredCompanies:number|null;
  lifecycleConfigured:number|null;
  openPlayground:()=>void;
};

export function HeadquartersSettings({store,notebook,crm,email,verified,
  registeredCompanies,lifecycleConfigured,openPlayground}:Props) {
  const {document,change,loading}=store;
  const [resetBusy,setResetBusy]=useState(false);
  const [resetFeedback,setResetFeedback]=useState('');
  const [exportProblem,setExportProblem]=useState('');
  const set=<K extends keyof StudioSettingsDocument>(key:K,value:StudioSettingsDocument[K])=>
    change(previous=>({...previous,[key]:value}));
  const sendPasswordReset=async()=>{
    if(!supabase || !email || resetBusy)return;
    setResetBusy(true);setResetFeedback('');
    try{
      const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:appAbsoluteUrl('/')});
      if(error)throw error;
      setResetFeedback('Password reset instructions requested. Check your Developer email.');
    }catch(err){
      setResetFeedback(err instanceof Error?err.message:'Could not request a password reset.');
    }finally{setResetBusy(false);}
  };
  const exportData=()=>{
    if(notebook.loading||crm.loading||store.loading
      ||notebook.error||crm.error||store.error||notebook.dirty||crm.dirty||store.dirty
      ||notebook.saving||crm.saving||store.saving){
      setExportProblem('Wait until Notebook, CRM and Settings are loaded and saved before exporting.');
      return;
    }
    setExportProblem('');
    const payload={
      format:'salesshop-headquarters-export-v1',
      exportedAt:new Date().toISOString(),
      notice:'Private developer sales contacts and notes. Store this export securely.',
      notebook:notebook.document,
      crm:crm.document,
      settings:store.document,
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=`salesshop-headquarters-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  if(loading)return <p className="hq-empty">Loading your private Studio preferences…</p>;
  return <div className="hq-settings">
    <div className="hq-settings-intro">
      <div><span className="hq-kicker">PLATFORM OWNER'S WORKSPACE</span>
        <h2>Studio settings</h2>
        <p>Customize how you run SalesShop, manage your separate Developer login, and inspect the current platform capabilities.</p></div>
      <span className="hq-settings-capsule">Developer only</span>
    </div>
    <section className="hq-settings-card" aria-label="Studio preferences">
      <div className="hq-settings-card-header">
        <span className="hq-kicker">YOUR WORKSPACE</span><h3>Appearance & navigation</h3>
        <p>These preferences are saved privately to your Developer account and sync between devices.</p>
      </div>
      <div className="hq-settings-fields">
        <label>Start page
          <select value={document.startTab} onChange={e=>set('startTab',e.target.value as StudioSettingsDocument['startTab'])}>
            {STUDIO_TABS.map(tab=><option value={tab} key={tab}>{STUDIO_TAB_LABELS[tab]}</option>)}
          </select><small>Shown when you next open Platform Studio.</small>
        </label>
        <label>Layout density
          <select value={document.density} onChange={e=>set('density',e.target.value as StudioSettingsDocument['density'])}>
            {STUDIO_DENSITIES.map(item=><option key={item} value={item}>{item==='compact'?'Compact':'Comfortable'}</option>)}
          </select>
        </label>
      </div>
      <div className="hq-settings-choice">
        <span>Studio accent</span>
        <div className="hq-settings-accent-options" role="group" aria-label="Studio accent">
          {STUDIO_ACCENTS.map(accent=><button type="button" key={accent}
            className={`hq-settings-accent ${accent}${document.accent===accent?' is-active':''}`}
            aria-pressed={document.accent===accent} onClick={()=>set('accent',accent)}>
            <span aria-hidden="true"/> {accent[0].toUpperCase()+accent.slice(1)}
          </button>)}
        </div>
      </div>
      <label className="hq-settings-toggle">
        <input type="checkbox" checked={document.showFollowUps}
          onChange={e=>set('showFollowUps',e.target.checked)}/>
        <span><strong>Show follow-up summary on Overview</strong>
          <small>This only changes your dashboard display; CRM follow-ups are retained.</small></span>
      </label>
      <div className="hq-settings-card-footer">
        <button type="button" className="hq-settings-secondary" onClick={()=>change(()=>blankStudioSettings())}>Restore preference defaults</button>
      </div>
    </section>
    <section className="hq-settings-card" aria-label="Developer identity and security">
      <div className="hq-settings-card-header"><span className="hq-kicker">ACCOUNT</span><h3>Developer identity & security</h3>
        <p>Separate from every customer's SalesShop workspace.</p></div>
      <div className="hq-settings-detail-rows">
        <div><span>Signed-in email</span><strong>{email||'Unavailable'}</strong></div>
        <div><span>Platform role</span><strong>Developer</strong></div>
        <div><span>Email verification</span><strong>{verified?'Verified':'Not verified'}</strong></div>
        <div><span>Tenant membership</span><strong>Not permitted for Developer accounts</strong></div>
      </div>
      <div className="hq-settings-card-footer">
        <button type="button" className="hq-primary" onClick={()=>void sendPasswordReset()}
          disabled={!email||resetBusy}>{resetBusy?'Sending…':'Email me a password reset link'}</button>
        {resetFeedback&&<p role="status" className="hq-settings-feedback">{resetFeedback}</p>}
        <p className="hq-settings-hint">Password changes use SalesShop's existing authentication provider. Never share a password here.</p>
      </div>
    </section>
    <section className="hq-settings-card" aria-label="Developer tools and data">
      <div className="hq-settings-card-header"><span className="hq-kicker">DEVELOPER TOOLS</span>
        <h3>Playground & Headquarters data</h3>
        <p>The Playground is fictional and local-only. Headquarters Notebook, CRM and Settings are private cloud documents.</p></div>
      <div className="hq-settings-tool-actions">
        <button type="button" onClick={openPlayground} className="hq-primary">Open Developer Playground ↗</button>
        <button type="button" onClick={exportData} className="hq-settings-secondary">Export my Headquarters data (.json)</button>
      </div>
      {exportProblem&&<p role="alert" className="hq-settings-error">{exportProblem}</p>}
      <p className="hq-settings-hint">Exports can include private sales contacts and notes; keep downloaded files secure. The export does not include customer-company records.</p>
    </section>
    <section className="hq-settings-card" aria-label="Product configuration and status">
      <div className="hq-settings-card-header"><span className="hq-kicker">PLATFORM OPERATIONS</span>
        <h3>Subscriptions, analytics & access</h3>
        <p>Real configuration state, without opening customer data or presenting unfinished tools as operational.</p></div>
      <div className="hq-settings-status-list">
        <div><div><strong>Registered customer workspaces</strong><small>Organization metadata, not business records</small></div>
          <span className="hq-settings-status">{registeredCompanies===null?'Unavailable':registeredCompanies}</span></div>
        <div><div><strong>Subscription lifecycle records</strong><small>Only existing platform billing/lifecycle metadata</small></div>
          <span className="hq-settings-status">{lifecycleConfigured===null?'Unavailable':lifecycleConfigured+' configured'}</span></div>
        <div><div><strong>Billing provider & subscription controls</strong><small>Payment processing, plan changes and invoices</small></div>
          <span className="hq-settings-status muted">Not connected</span></div>
        <div><div><strong>Privacy-limited customer usage analytics</strong><small>No seat activity, quote activity, or customer content is being gathered here</small></div>
          <span className="hq-settings-status muted">Not implemented</span></div>
        <div><div><strong>Customer-approved support access</strong><small>Would require approval, expiry and auditing</small></div>
          <span className="hq-settings-status muted">Unavailable</span></div>
        <div><div><strong>Release management within Studio</strong><small>GitHub remains the source of truth</small></div>
          <span className="hq-settings-status muted">Planned</span></div>
      </div>
    </section>
    <section className="hq-settings-card" aria-label="Project and infrastructure links">
      <div className="hq-settings-card-header"><span className="hq-kicker">DEVELOPMENT</span>
        <h3>Infrastructure & release workflow</h3>
        <p>Links open external administration tools. They do not grant additional permissions inside SalesShop.</p></div>
      <div className="hq-settings-links">
        <a href="https://github.com/finnisqu/SalesShop/tree/architecture/react-foundation" target="_blank" rel="noopener noreferrer">React foundation branch ↗</a>
        <a href="https://github.com/finnisqu/SalesShop/actions" target="_blank" rel="noopener noreferrer">GitHub Actions & deployments ↗</a>
        <a href="https://supabase.com/dashboard/project/pvchgibllozuwickhfqz" target="_blank" rel="noopener noreferrer">Supabase project console ↗</a>
      </div>
      <p className="hq-settings-hint">Current development workflow: deploy from <code>architecture/react-foundation</code>; keep <code>main</code> untouched until explicitly approved.</p>
    </section>
  </div>;
}
