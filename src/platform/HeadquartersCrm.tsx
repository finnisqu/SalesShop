import { useMemo,useState } from 'react';
import type { HeadquartersDocumentState } from './useHeadquartersDocument';
import { remainingFollowUps,SALES_STAGES,newPlatformId,
  type PlatformCrmDocument,type PlatformLeadAccount,type PlatformLeadContact,
  type PlatformSalesStage } from './headquartersTypes';

type LinkedTenant={id:string;name:string};

export function HeadquartersCrm({store,tenants}:{
 store:HeadquartersDocumentState<PlatformCrmDocument>;
 tenants:LinkedTenant[];
}){
 const {document,change,loading}=store;
 const [search,setSearch]=useState('');
 const [stageFilter,setStageFilter]=useState<PlatformSalesStage|'All'>('All');
 const [selected,setSelected]=useState<string|null>(null);
 const [newName,setNewName]=useState('');
 const [contactName,setContactName]=useState('');
 const [contactEmail,setContactEmail]=useState('');
 const [contactTitle,setContactTitle]=useState('');
 const [activitySummary,setActivitySummary]=useState('');
 const accounts=useMemo(()=>document.accounts.filter(a=>
   (stageFilter==='All'||a.stage===stageFilter)
   &&a.name.toLowerCase().includes(search.trim().toLowerCase()))
   .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[document.accounts,stageFilter,search]);
 const active=document.accounts.find(a=>a.id===selected)??accounts[0]??null;
 const contacts=active?document.contacts.filter(c=>c.accountId===active.id):[];
 const activities=active?document.activities.filter(a=>a.accountId===active.id).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)):[];
 const addAccount=()=>{
   const name=newName.trim();if(!name)return;
   const now=new Date().toISOString();
   const account:PlatformLeadAccount={id:newPlatformId('hq_account'),name,stage:'Lead',source:'',
     website:'',notes:'',nextAction:'',followUpDate:'',tenantOrganizationId:null,
     createdAt:now,updatedAt:now};
   change(prev=>({...prev,accounts:[account,...prev.accounts]}));
   setSelected(account.id);setNewName('');setStageFilter('All');setSearch('');
 };
 const patch=(id:string,values:Partial<PlatformLeadAccount>)=>
   change(prev=>({...prev,accounts:prev.accounts.map(a=>a.id===id?{...a,...values,updatedAt:new Date().toISOString()}:a)}));
 const removeAccount=()=>{
   if(!active||!window.confirm(`Delete sales lead "${active.name}" and its associated contacts and activities?`))return;
   change(prev=>({...prev,accounts:prev.accounts.filter(a=>a.id!==active.id),
     contacts:prev.contacts.filter(c=>c.accountId!==active.id),
     activities:prev.activities.filter(a=>a.accountId!==active.id)}));
   setSelected(null);
 };
 const addContact=()=>{
   if(!active||!contactName.trim())return;
   const now=new Date().toISOString();
   const contact:PlatformLeadContact={id:newPlatformId('hq_contact'),accountId:active.id,
     name:contactName.trim(),email:contactEmail.trim(),title:contactTitle.trim(),phone:'',notes:'',
     createdAt:now,updatedAt:now};
   change(prev=>({...prev,contacts:[contact,...prev.contacts]}));
   setContactName('');setContactEmail('');setContactTitle('');
 };
 const logActivity=()=>{
   if(!active||!activitySummary.trim())return;
   change(prev=>({...prev,activities:[{id:newPlatformId('hq_activity'),accountId:active.id,
     summary:activitySummary.trim(),occurredAt:new Date().toISOString()},...prev.activities]}));
   setActivitySummary('');
 };
 const due=remainingFollowUps(document).length;
 if(loading)return <p className="hq-empty">Opening your private SalesShop CRM…</p>;
 return <section className="hq-crm">
   <div className="hq-panel-heading">
     <div><span className="hq-kicker">PRODUCT SALES PIPELINE</span><h2>SalesShop CRM</h2>
       <p>Track companies interested in buying SalesShop, not their internal customers.</p></div>
     <span className="hq-count">{due} follow-ups due</span>
   </div>
   <div className="hq-stage-strip" aria-label="Lead pipeline filters">
     {(['All',...SALES_STAGES] as const).map(stage=><button type="button"
       key={stage} className={stageFilter===stage?'active':''} aria-pressed={stageFilter===stage}
       onClick={()=>{setStageFilter(stage);setSelected(null);}}>
       {stage} <span>{stage==='All'?document.accounts.length:document.accounts.filter(a=>a.stage===stage).length}</span>
     </button>)}
   </div>
   <div className="hq-crm-layout">
     <div className="hq-crm-list">
       <form className="hq-new-lead" onSubmit={event=>{event.preventDefault();addAccount();}}>
         <label>New company lead<input required value={newName} onChange={e=>setNewName(e.target.value)}
           placeholder="e.g. Example Stone Fabricators"/></label>
         <button className="hq-primary" type="submit">+ Add lead</button>
       </form>
       <input aria-label="Search platform CRM accounts" value={search}
         placeholder="Search leads…" onChange={e=>{setSearch(e.target.value);setSelected(null);}}/>
       <div className="hq-crm-cards">
         {accounts.map(account=><button key={account.id} type="button"
           className={`hq-lead-card${active?.id===account.id?' active':''}`}
           onClick={()=>setSelected(account.id)}>
           <strong>{account.name}</strong>
           <span className="hq-lead-stage">{account.stage}</span>
           {account.nextAction&&<small>Next: {account.nextAction}</small>}
           {account.followUpDate&&<small>Follow up: {account.followUpDate}</small>}
         </button>)}
         {!accounts.length&&<p className="hq-empty">{document.accounts.length?'No leads match this filter.':'Start by adding a company you would like to sell SalesShop to.'}</p>}
       </div>
     </div>
     <div className="hq-crm-detail">
       {active?<div className="hq-account-detail" key={active.id}>
         <div className="hq-panel-heading"><div><span className="hq-kicker">COMPANY RECORD</span>
           <h2>{active.name}</h2></div><button type="button" className="hq-danger-link" onClick={removeAccount}>Delete lead</button></div>
         <div className="hq-fields">
           <label className="hq-wide">Company name<input value={active.name} onChange={e=>patch(active.id,{name:e.target.value})}/></label>
           <label>Pipeline stage<select value={active.stage} onChange={e=>patch(active.id,{stage:e.target.value as PlatformSalesStage})}>
             {SALES_STAGES.map(stage=><option key={stage}>{stage}</option>)}</select></label>
           <label>Lead source<input value={active.source} onChange={e=>patch(active.id,{source:e.target.value})} placeholder="Referral / website / event"/></label>
           <label>Website<input value={active.website} onChange={e=>patch(active.id,{website:e.target.value})} placeholder="example.com"/></label>
           <label>Follow-up date<input type="date" value={active.followUpDate} onChange={e=>patch(active.id,{followUpDate:e.target.value})}/></label>
           <label className="hq-wide">Next action<input value={active.nextAction} onChange={e=>patch(active.id,{nextAction:e.target.value})} placeholder="Schedule a demo, send trial invitation…"/></label>
           <label className="hq-wide">Linked customer workspace <select value={active.tenantOrganizationId??''}
             onChange={e=>patch(active.id,{tenantOrganizationId:e.target.value||null})}>
             <option value="">No company linked</option>
             {tenants.map(tenant=><option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}
           </select><small>Links platform metadata only. Does not grant access to that company's data.</small></label>
           <label className="hq-wide">Account notes<textarea rows={4} value={active.notes}
             onChange={e=>patch(active.id,{notes:e.target.value})} placeholder="Conversation context, product fit, objections…"/></label>
         </div>
         <div className="hq-crm-subsection"><h3>People · {contacts.length}</h3>
           {contacts.map(contact=><div className="hq-contact-row" key={contact.id}>
             <div><strong>{contact.name}</strong><small>{[contact.title,contact.email].filter(Boolean).join(' · ')}</small></div>
             <button type="button" aria-label={`Remove ${contact.name}`}
               onClick={()=>{if(window.confirm(`Remove ${contact.name} from this lead?`))change(prev=>({...prev,
                 contacts:prev.contacts.filter(c=>c.id!==contact.id)}));}}>×</button>
           </div>)}
           <form className="hq-contact-add" onSubmit={e=>{e.preventDefault();addContact();}}>
             <input required aria-label="Contact full name" value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="Full name"/>
             <input type="email" aria-label="Contact email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} placeholder="Email"/>
             <input aria-label="Contact job title" value={contactTitle} onChange={e=>setContactTitle(e.target.value)} placeholder="Role / title"/>
             <button type="submit">+ Contact</button>
           </form>
         </div>
         <div className="hq-crm-subsection"><h3>Touchpoints · {activities.length}</h3>
           <form className="hq-touchpoint-add" onSubmit={e=>{e.preventDefault();logActivity();}}>
             <input required aria-label="Log sales touchpoint" value={activitySummary}
               onChange={e=>setActivitySummary(e.target.value)} placeholder="Called to discuss demo, emailed trial link…"/>
             <button type="submit">Log activity</button>
           </form>
           {activities.map(item=><div className="hq-touchpoint" key={item.id}>
             <span>{item.summary}</span><small>{new Date(item.occurredAt).toLocaleString()}</small>
           </div>)}
         </div>
       </div>:<div className="hq-detail-placeholder">
         <h2>Every customer begins as a conversation.</h2>
         <p>Select a lead to manage its pipeline stage, contacts, follow-ups, linked workspace and touchpoints.</p>
       </div>}
     </div>
   </div>
 </section>;
}
