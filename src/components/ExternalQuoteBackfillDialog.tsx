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
import {companyRelationshipPatch} from '../services/companyRelationship';
import {createExternalQuoteDealWithCompany,linkExternalQuoteDealCompany,
 type ExternalQuoteCompanyLinkRecovery,type ExternalQuoteDealCreateServices} from '../services/externalQuoteDealCreateLink';
import '../external-quote.css';

export function ExternalQuoteBackfillDialog({onClose,onRecorded,initialDealId,initialSentDate}:{
 onClose:()=>void;onRecorded?:(dealName:string,bidSentDate:string)=>void;initialDealId?:string;initialSentDate?:string;
}){
 const deals=useCrmStore(s=>s.projects);
 const companies=useCrmStore(s=>s.companies);
 const createDeal=useCrmStore(s=>s.createProject);
 const assignCompany=useCrmStore(s=>s.setProjectCompany);
 const resolveCompany=useCrmStore(s=>s.resolveCompany);
 const updateCompany=useCrmStore(s=>s.updateCompany);
 const mode=useAuthStore(s=>s.mode),orgId=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const editable=!perspective&&(mode==='local'||Boolean(orgId&&userId&&canEditTeamArea(role,department,'crm')));
 const [selectedId,setSelectedId]=useState(initialDealId??'');
 const [newCompanyId,setNewCompanyId]=useState('');
 const [newCompanyName,setNewCompanyName]=useState('');
 const [linkRecovery,setLinkRecovery]=useState<ExternalQuoteCompanyLinkRecovery|null>(null);
 const ref=useDismissibleLayer<HTMLElement>(true,onClose);
 useModalScrollLock(true);
 const selected=deals.find(d=>d.id===selectedId);
 const createServices=():ExternalQuoteDealCreateServices=>({
  deals:()=>useCrmStore.getState().projects,
  companies:()=>useCrmStore.getState().companies,
  createDeal:name=>createDeal(name,'Discovery'),
  resolveCompany:name=>resolveCompany(name,'customer'),
  assignCompany,
  afterNewCompany:id=>{
   const created=useCrmStore.getState().companies.find(company=>company.id===id);
   if(created)updateCompany(id,companyRelationshipPatch(created,'prospect'));
  },
 });
 const clearCompanyChoice=()=>{setNewCompanyId('');setNewCompanyName('');};
 const selectDeal=(id:string)=>{
  setSelectedId(id);clearCompanyChoice();setLinkRecovery(null);
 };
 const createFromPicker=(name:string)=>{
  if(!editable)throw new Error('Your role cannot create Deals.');
  const result=createExternalQuoteDealWithCompany(name,
   {companyId:newCompanyId||undefined,newCompanyName:newCompanyName||undefined},
   createServices());
  // A successfully created Deal remains selected even when linking its
  // Company fails. The user can retry the exact association, not create again.
  setSelectedId(result.dealId);
  setLinkRecovery(result.recovery);
  if(!result.recovery)clearCompanyChoice();
 };
 const retryCompanyLink=()=>{
  if(!editable||!linkRecovery||selectedId!==linkRecovery.dealId)return;
  const next=linkExternalQuoteDealCompany(linkRecovery.dealId,
   {companyId:linkRecovery.companyId,newCompanyName:linkRecovery.newCompanyName},createServices());
  setLinkRecovery(next);
  if(!next)clearCompanyChoice();
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
       initialSentDate={initialSentDate} onCancel={onClose}
       onRecorded={date=>{try{onRecorded?.(selected.name,date);}finally{onClose();}}}/>}
     {!editable&&<p className="external-quote-error">Your current role cannot record shared CRM quotes.</p>}
     {!selected&&<p className="external-quote-picker-empty">Select a Deal to enter its historical bid amount and sent date.</p>}
    </div>
   </section>
  </div>,document.body);
}
