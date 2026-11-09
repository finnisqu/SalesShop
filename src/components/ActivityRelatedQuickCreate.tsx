import {useState} from 'react';
import {useCrmStore} from '../store/crmStore';
import type {TaskAssociation} from '../store/personalTaskStore';
import {isOurOrgCompany} from '../services/ourOrganizationDirectory';
import '../activity-related-create.css';

type Kind='company'|'person'|'deal';
/** Inline creation within an activity form; no navigation and no nested form. */
export function ActivityRelatedQuickCreate({onCreated,disabled=false}:{
 onCreated:(link:TaskAssociation)=>void;disabled?:boolean;
}){
 const [kind,setKind]=useState<Kind|null>(null);
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [phone,setPhone]=useState('');
 const [title,setTitle]=useState('');
 const [companyId,setCompanyId]=useState('');
 const [error,setError]=useState('');
 const companies=useCrmStore(s=>s.companies);
 const people=useCrmStore(s=>s.contacts);
 const deals=useCrmStore(s=>s.projects);
 const resolveCompany=useCrmStore(s=>s.resolveCompany);
 const createContact=useCrmStore(s=>s.createContact);
 const createDeal=useCrmStore(s=>s.createProject);
 const relinkDealCompany=useCrmStore(s=>s.relinkProjectCompany);
 const availableCompanies=companies.filter(c=>!isOurOrgCompany(c)).slice()
  .sort((a,b)=>a.name.localeCompare(b.name));
 const choose=(next:Kind)=>{setKind(next);setName('');setEmail('');setPhone('');
  setTitle('');setCompanyId('');setError('');};
 const submit=()=>{
  // This component lives inside the activity form. Never submit that form.
  if(disabled||!kind)return;
  const clean=name.trim();
  if(!clean){setError('Enter a name to create this record.');return;}
  setError('');
  try{
   let id:string|undefined|null;
   let link:TaskAssociation;
   if(kind==='company'){
    if(companies.some(c=>c.name.trim().toLowerCase()===clean.toLowerCase())){
     setError('That company already exists. Find and link it above.');return;
    }
    id=resolveCompany(clean,'customer');
    if(!id)throw new Error('Could not create the company.');
    link={type:'company',id,label:'Company · '+clean};
   }else if(kind==='person'){
    if(people.some(p=>(email.trim()&&p.email?.toLowerCase()===email.trim().toLowerCase())||
      (p.name.toLowerCase()===clean.toLowerCase()&&(p.companyId??'')===companyId))){
     setError('That person may already exist. Find and link their record above.');return;
    }
    id=createContact({name:clean,email:email.trim(),phone:phone.trim(),title:title.trim(),
      companyId:companyId||undefined,source:'manual'});
    if(!id)throw new Error('Could not create the person.');
    link={type:'contact',id,label:'Person · '+clean};
   }else{
    if(deals.some(d=>d.name.trim().toLowerCase()===clean.toLowerCase()&&
      (d.companyId??'')===companyId)){
     setError('That Deal already exists. Find and link it above.');return;
    }
    id=createDeal(clean,'Discovery');
    if(!id)throw new Error('Could not create the Deal.');
    if(companyId)relinkDealCompany(id,companyId);
    link={type:'project',id,label:'Deal · '+clean};
   }
   onCreated(link);
   choose(kind);
   setKind(null);
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not create this record.');}
 };
 return <div className="activity-related-quick-create">
  <div className="activity-related-quick-actions">
   <span>Create while logging</span>
   {(['company','person','deal'] as const).map(option=><button type="button" key={option}
    disabled={disabled} aria-pressed={kind===option}
    onClick={()=>kind===option?setKind(null):choose(option)}>+ {option==='person'?'Person':option==='deal'?'Deal':'Company'}</button>)}
  </div>
  {kind&&<div className="activity-related-quick-fields" role="group"
    aria-label={'Create new '+kind+' while logging'}
    onKeyDown={event=>{
      if(event.key==='Enter'&&event.target instanceof HTMLInputElement){
        event.preventDefault();event.stopPropagation();submit();
      }
    }}>
    <label>{kind==='person'?'Full name':kind==='deal'?'Deal name':'Company name'}
     <input autoFocus value={name} maxLength={180} disabled={disabled}
      onChange={e=>setName(e.target.value)}/></label>
    {kind==='person'&&<>
      <label>Title / role (optional)<input value={title} maxLength={120} disabled={disabled}
       onChange={e=>setTitle(e.target.value)}/></label>
      <label>Email (optional)<input type="email" value={email} disabled={disabled}
       onChange={e=>setEmail(e.target.value)}/></label>
      <label>Phone (optional)<input type="tel" value={phone} disabled={disabled}
       onChange={e=>setPhone(e.target.value)}/></label>
    </>}
    {kind!=='company'&&<label>Company (optional)
      <select disabled={disabled} value={companyId} onChange={e=>setCompanyId(e.target.value)}>
       <option value="">Unassigned</option>
       {availableCompanies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
      </select>
     </label>}
    {error&&<p role="alert" className="activity-related-quick-error">{error}</p>}
    <div className="activity-related-quick-buttons">
     <button type="button" onClick={()=>setKind(null)} disabled={disabled}>Cancel</button>
     <button type="button" disabled={disabled||!name.trim()}
      onClick={submit}>Create & link {kind}</button>
    </div>
  </div>}
 </div>;
}
