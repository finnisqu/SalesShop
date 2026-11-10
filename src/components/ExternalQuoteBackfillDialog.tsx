import {useMemo,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {ExternalQuoteSentForm} from './ExternalQuoteSentForm';
import {PreviewPanelClose} from './PreviewPanelChrome';
import {isOurOrgCompany} from '../services/ourOrganizationDirectory';
import '../external-quote.css';

export function ExternalQuoteBackfillDialog({onClose,onRecorded,initialDealId,initialSentDate}:{
 onClose:()=>void;onRecorded?:(dealName:string,bidSentDate:string)=>void;initialDealId?:string;initialSentDate?:string;
}){
 const deals=useCrmStore(s=>s.projects);
 const companies=useCrmStore(s=>s.companies);
 const createDeal=useCrmStore(s=>s.createProject);
 const assignCompany=useCrmStore(s=>s.setProjectCompany);
 const mode=useAuthStore(s=>s.mode),orgId=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const editable=!perspective&&(mode==='local'||Boolean(orgId&&userId&&canEditTeamArea(role,department,'crm')));
 const [query,setQuery]=useState('');
 const [selectedId,setSelectedId]=useState(initialDealId??'');
 const [newDealOpen,setNewDealOpen]=useState(false);
 const [newDealName,setNewDealName]=useState('');
 const [newCompanyId,setNewCompanyId]=useState('');
 const [error,setError]=useState('');
 const ref=useDismissibleLayer<HTMLElement>(true,onClose);
 useModalScrollLock(true);
 const filtered=useMemo(()=>deals.filter(d=>
  [d.name,d.companyName,d.stage].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  .slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[deals,query]);
 const selected=deals.find(d=>d.id===selectedId);
 const create=(event:FormEvent)=>{
  event.preventDefault();if(!editable)return;
  if(!newDealName.trim()){setError('Enter a Deal name.');return;}
  const name=newDealName.trim();
  if(deals.some(d=>d.name.toLowerCase()===name.toLowerCase()&&
   (d.companyId??'')===newCompanyId)){
    setError('A Deal with this name already exists. Search for it first.');return;
  }
  const id=createDeal(name,'Discovery');
  if(!id){setError('Could not create the Deal.');return;}
  if(newCompanyId)assignCompany(id,newCompanyId);
  setSelectedId(id);setNewDealOpen(false);setNewDealName('');setError('');
 };
 return createPortal(<div className="external-quote-picker-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
   <section ref={ref} role="dialog" aria-modal="true"
    aria-label="Record external quote" className="external-quote-picker">
    <header><div><small>CRM · HISTORICAL RECORD</small><h2>Record external quote</h2></div>
     <PreviewPanelClose onClose={onClose} label="Close external quote" initialFocus={false}/></header>
    <div className="external-quote-picker-body">
     <p className="external-quote-picker-intro">Record a quote sent outside SalesShop, including one you sent today. Choose the Deal and the actual date sent; no SalesShop quote document is created.</p>
     <label>Search Deals
      <input type="search" autoFocus data-dialog-initial-focus value={query}
       onChange={e=>setQuery(e.target.value)} placeholder="Project, builder, or company name…"/>
     </label>
     <label>Deal
      <select value={selectedId} onChange={e=>{setSelectedId(e.target.value);setError('');}}>
       <option value="">Choose an existing Deal</option>
       {selected&&!filtered.some(d=>d.id===selected.id)&&
         <option value={selected.id}>{selected.name} · {selected.stage}</option>}
       {filtered.map(d=><option key={d.id} value={d.id}>
        {d.name} · {d.stage}{d.companyName?' · '+d.companyName:''}
       </option>)}
      </select>
     </label>
     {editable&&<button type="button" className="external-quote-newdeal-toggle"
      onClick={()=>{setNewDealOpen(v=>!v);setError('');}}>
      {newDealOpen?'Cancel new Deal':'+ Create Deal for external quote'}
     </button>}
     {newDealOpen&&editable&&<form className="external-quote-newdeal-form" onSubmit={create}>
      <label>Deal name<input required value={newDealName} maxLength={180}
        onChange={e=>setNewDealName(e.target.value)} placeholder="Project name"/></label>
      <label>Company (optional)<select value={newCompanyId}
        onChange={e=>setNewCompanyId(e.target.value)}>
        <option value="">No company</option>
        {companies.filter(c=>!isOurOrgCompany(c)).map(c=>
          <option key={c.id} value={c.id}>{c.name}</option>)}
       </select></label>
      <button type="submit">Create Deal & continue</button>
     </form>}
     {error&&<p className="external-quote-error" role="alert">{error}</p>}
     {selected&&editable&&<ExternalQuoteSentForm key={selected.id} deal={selected}
       initialSentDate={initialSentDate} onCancel={onClose} onRecorded={date=>onRecorded?.(selected.name,date)}/>}
     {!editable&&<p className="external-quote-error">Your current role cannot record shared CRM quotes.</p>}
     {!selected&&<p className="external-quote-picker-empty">Select a Deal to enter its historical bid amount and sent date.</p>}
    </div>
   </section>
  </div>,document.body);
}
