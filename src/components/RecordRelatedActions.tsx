import {useState} from 'react';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {isOurOrgCompany} from '../services/ourOrganizationDirectory';
import {RecordCard} from './RecordPageLayout';
import '../record-related-actions.css';

export type RelatedEntityKind='company'|'person'|'deal';
export type RelatedTarget='company'|'person'|'deal'|'quote';
/** Uses existing, durable FK links only; no fabricated activity or private relationship shadow. */
export function LinkExistingRecord({source,target,label,onLinked}:{
 source:{kind:RelatedEntityKind;id:string;name:string};
 target:RelatedTarget;label?:string;onLinked?:()=>void;
}){
 const [open,setOpen]=useState(false),[id,setId]=useState(''),[error,setError]=useState('');
 const companies=useCrmStore(s=>s.companies),people=useCrmStore(s=>s.contacts),
  deals=useCrmStore(s=>s.projects),quotes=useQuoteStore(s=>s.quotes);
 const updateContact=useCrmStore(s=>s.updateContact);
 const setProjectCompany=useCrmStore(s=>s.setProjectCompany);
 const linkQuoteCompany=useQuoteStore(s=>s.linkQuoteCompany);
 const linkQuoteContact=useQuoteStore(s=>s.linkQuoteContact);
 const updateQuote=useQuoteStore(s=>s.updateQuote);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const canEditCrm=!perspective&&(mode==='local'||Boolean(org&&user&&canEditTeamArea(role,department,'crm')));
 const canEditQuotes=mode==='local'||Boolean(org&&user&&canEditTeamArea(role,department,'quotes'));
 const eligible=canEditCrm&&(target!=='quote'||canEditQuotes);
 const options=target==='company'?companies.filter(c=>!isOurOrgCompany(c)).map(c=>({id:c.id,name:c.name})):
  target==='person'?people.map(p=>({id:p.id,name:p.name||p.email||'Unnamed person'})):
  target==='deal'?deals.map(p=>({id:p.id,name:p.name})):
  quotes.filter(q=>!q.archivedAt&&(source.kind!=='deal'||q.status==='Draft'||q.status==='Ready')&&
   (mode!=='cloud'||q.ownerUserId===user))
   .map(q=>({id:q.id,name:q.title||q.quoteNumber||'Untitled quote'}));
 const visible=options.filter(x=>x.id!==source.id).sort((a,b)=>a.name.localeCompare(b.name));
 const apply=()=>{
  if(!id)return;
  setError('');
  try{
   if(source.kind==='company'&&target==='person')updateContact(id,{companyId:source.id});
   else if(source.kind==='company'&&target==='deal')setProjectCompany(id,source.id);
   else if(source.kind==='company'&&target==='quote')linkQuoteCompany(id,{id:source.id,name:source.name});
   else if(source.kind==='person'&&target==='company')updateContact(source.id,{companyId:id});
   else if(source.kind==='person'&&target==='quote'){
    const person=people.find(p=>p.id===source.id);
    if(!person)throw new Error('Person is no longer available.');
    linkQuoteContact(id,{id:person.id,name:person.name,email:person.email});
   }else if(source.kind==='deal'&&target==='company')setProjectCompany(source.id,id);
   else if(source.kind==='deal'&&target==='quote')updateQuote(id,{projectId:source.id});
   else throw new Error('This relationship needs a dedicated shared link type.');
   setOpen(false);setId('');onLinked?.();
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not link this record.');}
 };
 const supported=
  (source.kind==='company'&&['person','deal','quote'].includes(target))||
  (source.kind==='person'&&['company','quote'].includes(target))||
  (source.kind==='deal'&&['company','quote'].includes(target));
 if(!supported||!eligible)return null;
 const targetLabel=label??(target==='person'?'person':target);
 return <div className="ss-record-link-existing">
  <button type="button" className="connections-record-add"
   aria-expanded={open} onClick={()=>{setOpen(v=>!v);setError('');setId('');}}>
   {open?'Cancel link':'Link existing '+targetLabel}
  </button>
  {open&&<div className="ss-record-link-inline" role="group" aria-label={'Link existing '+targetLabel}>
   <select aria-label={'Choose '+targetLabel} value={id} onChange={e=>setId(e.target.value)}>
    <option value="">Choose {targetLabel}…</option>
    {visible.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select>
   <button type="button" disabled={!id} onClick={apply}>Link</button>
   {target==='quote'&&<small>Updates the quote's primary {source.kind==='person'?'contact':source.kind==='company'?'company':'Deal'} link. Review any existing assignment before linking.</small>}
   {error&&<p role="alert">{error}</p>}
  </div>}
 </div>;
}

export function RecordNewDeal({companyId,companyName,onCreated}:{
 companyId:string;companyName:string;onCreated:(dealId:string)=>void;
}){
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
 const create=useCrmStore(s=>s.createProject),link=useCrmStore(s=>s.setProjectCompany);
 const existing=useCrmStore(s=>s.projects);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  dept=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const editable=!perspective&&(mode==='local'||Boolean(org&&user&&canEditTeamArea(role,dept,'crm')));
 if(!editable)return null;
 const submit=()=>{
  const clean=name.trim();if(!clean)return;
  if(existing.some(d=>d.name.trim().toLowerCase()===clean.toLowerCase()&&d.companyId===companyId)){
   setError('A Deal with that name is already linked. Open it above.');return;
  }
  try{
   const id=create(clean,'Discovery');
   if(!id)throw new Error('Could not create Deal.');
   link(id,companyId);setOpen(false);setName('');onCreated(id);
  }catch(e){setError(e instanceof Error?e.message:'Could not create Deal.');}
 };
 return <div className="ss-record-link-existing">
  <button type="button" className="connections-record-add"
   onClick={()=>{setOpen(v=>!v);setError('');}}>{open?'Cancel new deal':'+ Add Deal'}</button>
  {open&&<div className="ss-record-link-inline" role="group" aria-label="Create Deal">
   <input aria-label="New Deal name" value={name} maxLength={180}
    placeholder={'New Deal at '+companyName}
    onChange={e=>setName(e.target.value)}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submit();}}}/>
   <button type="button" disabled={!name.trim()} onClick={submit}>Create Deal</button>
   {error&&<p role="alert">{error}</p>}
  </div>}
 </div>;
}
