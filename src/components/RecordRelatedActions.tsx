import {useState} from 'react';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {isOurOrgCompany,isOurOrgContact} from '../services/ourOrganizationDirectory';
import {companyRelationshipPatch,isOurCompany} from '../services/companyRelationship';
import {UnifiedRecordPicker,type RecordPickerOption} from './UnifiedRecordPicker';
import {useNavigationStore} from '../store/navigationStore';
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
  quotes.filter(q=>!q.archivedAt&&(q.status==='Draft'||q.status==='Ready')&&
   (mode!=='cloud'||q.ownerUserId===user))
   .map(q=>({id:q.id,name:q.title||q.quoteNumber||'Untitled quote'}));
 const visible=options.filter(x=>x.id!==source.id).sort((a,b)=>a.name.localeCompare(b.name));
 const apply=()=>{
  if(!id)return;
  setError('');
  try{
   if(target==='quote'&&!quotes.some(q=>q.id===id&&!q.archivedAt&&
      (q.status==='Draft'||q.status==='Ready')))
    throw new Error('Only editable draft Quotes can be reassigned from here.');
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
 const targetLabel=label??(target==='person'?'Person':target==='company'?'Company':
  target==='deal'?'Deal':'Quote');
 return <div className="ss-record-link-existing">
  <button type="button" className="connections-record-add"
   aria-expanded={open} onClick={()=>{setOpen(v=>!v);setError('');setId('');}}>
   {open?'Cancel link':'+ Link Existing '+targetLabel}
  </button>
  {open&&<div className="ss-record-link-inline" role="group" aria-label={'Link existing '+targetLabel}>
   <select aria-label={'Choose '+targetLabel} value={id} onChange={e=>setId(e.target.value)}>
    <option value="">Choose {targetLabel}…</option>
    {visible.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select>
   <button type="button" disabled={!id} onClick={apply}>Link</button>
   {target==='quote'&&<small>Draft and Ready Quotes only. Updates the quote's primary {source.kind==='person'?'contact':source.kind==='company'?'company':'Deal'} link. Review any existing assignment before linking.</small>}
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
   onClick={()=>{setOpen(v=>!v);setError('');}}>{open?'Cancel new deal':'+ New Deal'}</button>
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

export function RecordNewCompany({source,onCreated}:{
 source:{kind:'person'|'deal';id:string};onCreated?:(id:string)=>void;
}){
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
 const resolve=useCrmStore(s=>s.resolveCompany),update=useCrmStore(s=>s.updateCompany);
 const updatePerson=useCrmStore(s=>s.updateContact);
 const setDealCompany=useCrmStore(s=>s.setProjectCompany);
 const companies=useCrmStore(s=>s.companies);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const eligible=!perspective&&(mode==='local'||Boolean(org&&user&&canEditTeamArea(role,department,'crm')));
 if(!eligible)return null;
 const save=()=>{
  const cleaned=name.trim();if(!cleaned)return;
  if(companies.some(c=>c.name.toLowerCase()===cleaned.toLowerCase())){
   setError('That Company already exists. Use Link existing instead.');return;
  }
  try{
   const before=new Set(companies.map(c=>c.id));
   const id=resolve(cleaned,'customer');
   if(!id)throw new Error('Unable to create Company.');
   if(before.has(id))
    throw new Error('That name matches an existing Company. Choose Link existing to confirm it.');
   if(!before.has(id)){
    const created=useCrmStore.getState().companies.find(c=>c.id===id);
    if(created)update(id,companyRelationshipPatch(created,'prospect'));
   }
   if(source.kind==='person')updatePerson(source.id,{companyId:id});
   else setDealCompany(source.id,id);
   setName('');setOpen(false);onCreated?.(id);
  }catch(e){setError(e instanceof Error?e.message:'Unable to create Company.');}
 };
 return <div className="ss-record-link-existing">
  <button type="button" className="connections-record-add"
    onClick={()=>{setOpen(v=>!v);setError('');}}>{open?'Cancel new company':'+ New Company'}</button>
  {open&&<div role="group" aria-label="Create and link company" className="ss-record-link-inline">
   <input aria-label="Company name" placeholder="Company name" maxLength={180}
    value={name} onChange={e=>setName(e.target.value)}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();save();}}}/>
   <button type="button" disabled={!name.trim()} onClick={save}>Create & link</button>
   {error&&<p role="alert">{error}</p>}
  </div>}
 </div>;
}

/** The same search field offers an existing relationship or a new record.
 * Uses only explicit CRM/Quote links; no synthetic Activity is written. */
export function RecordRelationshipPicker({source,target}:{
 source:{kind:RelatedEntityKind;id:string;name:string};target:RelatedTarget;
}){
 const companies=useCrmStore(s=>s.companies),people=useCrmStore(s=>s.contacts),
  deals=useCrmStore(s=>s.projects),quotes=useQuoteStore(s=>s.quotes);
 const updateContact=useCrmStore(s=>s.updateContact),
  createContact=useCrmStore(s=>s.createContact),
  setProjectCompany=useCrmStore(s=>s.setProjectCompany),
  createDeal=useCrmStore(s=>s.createProject),
  resolveCompany=useCrmStore(s=>s.resolveCompany),
  updateCompany=useCrmStore(s=>s.updateCompany);
 const linkQuoteCompany=useQuoteStore(s=>s.linkQuoteCompany),
  linkQuoteContact=useQuoteStore(s=>s.linkQuoteContact),
  updateQuote=useQuoteStore(s=>s.updateQuote),
  createQuote=useQuoteStore(s=>s.createQuote);
 const nav=useNavigationStore();
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const crmEditable=!perspective&&(mode==='local'||Boolean(org&&user&&canEditTeamArea(role,department,'crm')));
 const quoteEditable=mode==='local'||Boolean(org&&user&&canEditTeamArea(role,department,'quotes'));
 const allowed=(source.kind==='company'&&['person','deal','quote'].includes(target))||
  (source.kind==='person'&&['company','quote'].includes(target))||
  (source.kind==='deal'&&['company','quote'].includes(target));
 const company=companies.find(c=>c.id===source.id);
 const person=people.find(p=>p.id===source.id);
 const deal=deals.find(d=>d.id===source.id);
 const options:RecordPickerOption[]=target==='company'?
   companies.filter(c=>!isOurOrgCompany(c)&&!isOurCompany(c)&&c.id!==person?.companyId&&c.id!==deal?.companyId)
     .map(c=>({id:c.id,name:c.name})):
  target==='person'?people.filter(p=>!isOurOrgContact(p,companies)&&p.companyId!==source.id)
     .map(p=>({id:p.id,name:p.name||p.email||'Unnamed',detail:p.email})):
  target==='deal'?deals.filter(d=>d.companyId!==source.id)
     .map(d=>({id:d.id,name:d.name,detail:d.stage})):
  quotes.filter(q=>!q.archivedAt&&['Draft','Ready'].includes(q.status)&&
   (mode!=='cloud'||q.ownerUserId===user)&&
   (source.kind==='company'?q.companyId!==source.id:
    source.kind==='deal'?q.projectId!==source.id:q.contactId!==source.id))
   .map(q=>({id:q.id,name:q.title||q.quoteNumber||'Untitled Quote',detail:q.status}));
 const link=(id:string)=>{
  if(source.kind==='company'&&target==='person')updateContact(id,{companyId:source.id});
  else if(source.kind==='company'&&target==='deal')setProjectCompany(id,source.id);
  else if(source.kind==='company'&&target==='quote')
   linkQuoteCompany(id,{id:source.id,name:source.name});
  else if(source.kind==='person'&&target==='company')updateContact(source.id,{companyId:id});
  else if(source.kind==='person'&&target==='quote'){
   if(!person)throw new Error('Person unavailable.');
   linkQuoteContact(id,{id:person.id,name:person.name,email:person.email});
  }else if(source.kind==='deal'&&target==='company')setProjectCompany(source.id,id);
  else if(source.kind==='deal'&&target==='quote')updateQuote(id,{projectId:source.id});
  else throw new Error('Unsupported relationship.');
 };
 const create=(name:string)=>{
  if(!name.trim())throw new Error('Enter a name.');
  const existing=target==='company'?companies:target==='person'?people:
    target==='deal'?deals:quotes;
  if(existing.some(record=>('name'in record?record.name:'title'in record?record.title:'')
     ?.trim().toLowerCase()===name.toLowerCase()))
   throw new Error('A matching record exists. Select it above instead.');
  if(target==='person'&&source.kind==='company'){
   const id=createContact({name,companyId:source.id,source:'manual'});
   if(!id)throw new Error('Unable to create Person.');
   return;
  }
  if(target==='deal'&&source.kind==='company'){
   const id=createDeal(name,'Discovery');
   if(!id)throw new Error('Unable to create Deal.');
   setProjectCompany(id,source.id);
   return;
  }
  if(target==='company'&&(source.kind==='person'||source.kind==='deal')){
   const known=new Set(companies.map(c=>c.id));
   const id=resolveCompany(name,'customer');
   if(!id||known.has(id))throw new Error('This Company may already exist. Select it from search.');
   const created=useCrmStore.getState().companies.find(c=>c.id===id);
   if(created)updateCompany(id,companyRelationshipPatch(created,'prospect'));
   if(source.kind==='person')updateContact(source.id,{companyId:id});
   else setProjectCompany(source.id,id);
   return;
  }
  if(target==='quote'){
   const id=createQuote({title:name,...(source.kind==='company'?{
     companyId:source.id,companyName:source.name
   }:source.kind==='person'?{
     contactId:source.id,contactName:person?.name,contactEmail:person?.email,
     companyId:person?.companyId,companyName:companies.find(c=>c.id===person?.companyId)?.name
   }:{
     projectId:source.id,companyId:deal?.companyId,companyName:deal?.companyName
   })});
   if(!id)throw new Error('Unable to create Quote.');
   nav.openQuote(id);
   return;
  }
  throw new Error('Cannot create this relationship here.');
 };
 if(!allowed||!crmEditable||(target==='quote'&&!quoteEditable))return null;
 const kind=target==='person'?'Person':target==='company'?'Company':
   target==='deal'?'Deal':'Quote';
 return <UnifiedRecordPicker kind={kind} items={options} onLink={link}
   onCreate={create} helper={target==='quote'
    ?'Only Draft/Ready Quotes can be reassigned; issued or signed documents are protected.':
    target==='person'&&source.kind==='company'?
    'Linking an existing Person updates their primary Company. Internal roster People are managed in Our Organization.':
    undefined}/>;
}
