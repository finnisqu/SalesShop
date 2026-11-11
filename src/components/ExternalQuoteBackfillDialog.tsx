import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {ExternalQuoteSentForm} from './ExternalQuoteSentForm';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
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
 const [selectedId,setSelectedId]=useState(initialDealId??'');
 const [newCompanyId,setNewCompanyId]=useState('');
 const ref=useDismissibleLayer<HTMLElement>(true,onClose);
 useModalScrollLock(true);
 const selected=deals.find(d=>d.id===selectedId);
 const createFromPicker=(name:string)=>{
  if(!editable)throw new Error('Your role cannot create Deals.');
  const clean=name.trim();
  if(!clean)throw new Error('Enter a Deal name.');
  if(deals.some(d=>d.name.trim().toLowerCase()===clean.toLowerCase()))
    throw new Error('A Deal with that name already exists. Select it from search.');
  const id=createDeal(clean,'Discovery');
  if(!id)throw new Error('Could not create the Deal.');
  if(newCompanyId)assignCompany(id,newCompanyId);
  setSelectedId(id);
  setNewCompanyId('');
 };
 return createPortal(<div className="external-quote-picker-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
   <section ref={ref} role="dialog" aria-modal="true"
    aria-label="Record external quote" className="external-quote-picker">
    <header><div><small>CRM · HISTORICAL RECORD</small><h2>Record external quote</h2></div>
     <PreviewPanelClose onClose={onClose} label="Close external quote" initialFocus={false}/></header>
    <div className="external-quote-picker-body">
     <p className="external-quote-picker-intro">Record a quote sent outside SalesShop, including one you sent today. Choose the Deal and the actual date sent; no SalesShop quote document is created.</p>
     <div className="external-quote-deal-association" role="group" aria-label="External quote Deal">
      <strong>Deal</strong>
      <div className="ss-record-association-current">
       <span>{selected
         ?selected.name+' · '+selected.stage+(selected.companyName?' · '+selected.companyName:'')
         :'No Deal selected'}</span>
       {selected&&editable&&<button type="button" onClick={()=>setSelectedId('')}
         aria-label="Clear selected Deal">Clear</button>}
      </div>
      <UnifiedRecordPicker kind="Deal" disabled={!editable}
       triggerLabel={selected?'Change Deal':'Search or create Deal'}
       items={deals.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
         .map(d=>({id:d.id,name:d.name,detail:[d.companyName,d.stage].filter(Boolean).join(' · ')}))}
       onLink={id=>{setSelectedId(id);setNewCompanyId('');}}
       onCreate={createFromPicker}
       extra={<label>Company for a new Deal (optional)
         <select value={newCompanyId} onChange={event=>setNewCompanyId(event.target.value)}>
          <option value="">No company</option>
          {companies.filter(c=>!isOurOrgCompany(c))
            .slice().sort((a,b)=>a.name.localeCompare(b.name))
            .map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
         </select>
       </label>}
       helper="Choose a Deal or create one here, then record the external bid. Creating a new Deal adds it to Connections."/>
     </div>
     {selected&&editable&&<ExternalQuoteSentForm key={selected.id} deal={selected}
       initialSentDate={initialSentDate} onCancel={onClose} onRecorded={date=>onRecorded?.(selected.name,date)}/>}
     {!editable&&<p className="external-quote-error">Your current role cannot record shared CRM quotes.</p>}
     {!selected&&<p className="external-quote-picker-empty">Select a Deal to enter its historical bid amount and sent date.</p>}
    </div>
   </section>
  </div>,document.body);
}
