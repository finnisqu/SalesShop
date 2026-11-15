import {useState} from 'react';
import {useCrmStore} from '../store/crmStore';
import type {TaskAssociation} from '../store/personalTaskStore';
import {isOurOrgCompany} from '../services/ourOrganizationDirectory';
import {companyRelationshipPatch} from '../services/companyRelationship';
import {recordEmailError} from './RecordFormFeedback';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
import {recordNameKey} from '../services/recordNameKey';
import {stageActivityCompanyName,resolveActivityCompanyStage} from '../services/activityCompanyStage351c';
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
 const [stagedCompanyName,setStagedCompanyName]=useState('');
 const [createdCompanyId,setCreatedCompanyId]=useState<string|null>(null);
 const [error,setError]=useState('');
 const companies=useCrmStore(s=>s.companies);
 const people=useCrmStore(s=>s.contacts);
 const deals=useCrmStore(s=>s.projects);
 const resolveCompany=useCrmStore(s=>s.resolveCompany);
 const updateCompany=useCrmStore(s=>s.updateCompany);
 const createContact=useCrmStore(s=>s.createContact);
 const createDeal=useCrmStore(s=>s.createProject);
 const relinkDealCompany=useCrmStore(s=>s.relinkProjectCompany);
 const availableCompanies=companies.filter(c=>!isOurOrgCompany(c)).slice()
  .sort((a,b)=>a.name.localeCompare(b.name));
 const choose=(next:Kind)=>{setKind(next);setName('');setEmail('');setPhone('');
  setTitle('');setCompanyId('');setStagedCompanyName('');setCreatedCompanyId(null);setError('');};
 const createCompanyWhileLogging=(raw:string)=>{
  // The nested Company picker stages a name only. Closing the Activity
  // form or switching record type must not leave an unused Company behind.
  const clean=stageActivityCompanyName(raw,useCrmStore.getState().companies);
  setStagedCompanyName(clean);
  setCompanyId('');setCreatedCompanyId(null);
 };
 const resolveSelectedCompany=()=>{
  return resolveActivityCompanyStage({companyId,stagedCompanyName},{
   companies:()=>useCrmStore.getState().companies,
   resolveCompany:name=>resolveCompany(name,'customer'),
   onCreated:id=>{
    // Keep the resolved Company even if an optional classification or
    // subsequent Person/Deal save fails. Retrying never duplicates it.
    setCompanyId(id);setStagedCompanyName('');setCreatedCompanyId(id);
   },
   classifyNewCompany:id=>{
    const created=useCrmStore.getState().companies.find(c=>c.id===id);
    if(created)updateCompany(id,companyRelationshipPatch(created,'prospect'));
   },
  });
 };
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
    if(companies.some(c=>recordNameKey(c.name)===recordNameKey(clean))){
     setError('That company already exists. Find and link it above.');return;
    }
    const existingIds=new Set(useCrmStore.getState().companies.map(c=>c.id));
    id=resolveCompany(clean,'customer');
    if(!id)throw new Error('Could not create the company.');
    if(!existingIds.has(id))
      updateCompany(id,companyRelationshipPatch({aliases:[]},'prospect'));
    link={type:'company',id,label:'Company · '+clean};
   }else if(kind==='person'){
    const emailIssue=recordEmailError(email);
    if(emailIssue){setError(emailIssue);return;}
    if(people.some(p=>(email.trim()&&p.email?.toLowerCase()===email.trim().toLowerCase())||
      (recordNameKey(p.name)===recordNameKey(clean)&&(p.companyId??'')===companyId))){
     setError('That person may already exist. Find and link their record above.');return;
    }
    const resolvedCompanyId=resolveSelectedCompany();
    id=createContact({name:clean,email:email.trim(),phone:phone.trim(),title:title.trim(),
      companyId:resolvedCompanyId,source:'manual'});
    if(!id)throw new Error('Could not create the person.');
    link={type:'contact',id,label:'Person · '+clean};
   }else{
    if(deals.some(d=>recordNameKey(d.name)===recordNameKey(clean)&&
      (d.companyId??'')===companyId)){
     setError('That Deal already exists. Find and link it above.');return;
    }
    const resolvedCompanyId=resolveSelectedCompany();
    id=createDeal(clean,'Discovery');
    if(!id)throw new Error('Could not create the Deal.');
    if(resolvedCompanyId)relinkDealCompany(id,resolvedCompanyId);
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
      if(event.key==='Enter'&&event.target instanceof HTMLInputElement&&
         !event.target.closest('.ss-unified-record-picker')){
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
    {kind!=='company'&&<div className="activity-related-company-picker" role="group"
      aria-label="Company for new record">
      <strong>Company (optional)</strong>
      <div className="ss-record-association-current">
       <span>{stagedCompanyName?'New Company (not yet saved) · '+stagedCompanyName:companyId
         ?availableCompanies.find(c=>c.id===companyId)?.name??'Selected company'
         :'Unassigned'}</span>
       {(companyId||stagedCompanyName)&&<button type="button" disabled={disabled}
        onClick={()=>{setCompanyId('');setStagedCompanyName('');setCreatedCompanyId(null);}}>Clear</button>}
      </div>
      <UnifiedRecordPicker kind="Company" disabled={disabled}
       triggerLabel={companyId||stagedCompanyName?'Change Company':'Search or create Company'}
       items={availableCompanies.map(c=>({id:c.id,name:c.name}))}
       onLink={id=>{setCompanyId(id);setStagedCompanyName('');setCreatedCompanyId(null);}}
       onCreate={createCompanyWhileLogging}
       helper="Find a Company or stage a new one. A new Company is only created when you save the Person or Deal."/>
      {stagedCompanyName&&<small className="activity-related-company-created">
        Not saved yet. Canceling this Activity will not create the Company.
       </small>}
      {createdCompanyId&&createdCompanyId===companyId&&<small className="activity-related-company-created">
        Company saved. If the {kind} could not be created, retrying uses this Company.
       </small>}
     </div>}
    {error&&<p role="alert" className="activity-related-quick-error">{error}</p>}
    <div className="activity-related-quick-buttons">
     <button type="button" onClick={()=>setKind(null)} disabled={disabled}>Cancel</button>
     <button type="button" disabled={disabled||!name.trim()}
      onClick={submit}>Create & link {kind}</button>
    </div>
  </div>}
 </div>;
}
