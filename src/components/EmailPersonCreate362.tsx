import {useMemo,useRef,useState,type FormEvent} from 'react';
import type {Company,Contact} from '../types/crm';
import type {GmailThreadSummary,GmailThreadDetails} from '../services/gmailRead359a';
import {gmailAddressesInDetails395} from '../services/gmailBodyDiscovery395';
import {personEmailAddress} from '../services/emailAutoMatch361';
import {recordNameKey} from '../services/recordNameKey';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useGmailSessionStore,validGmailToken} from '../store/gmailSession359a';
import {useCrmStore} from '../store/crmStore';
import {emailWorkspaceScope} from '../services/emailThreadLinks359a';
import {canEditTeamArea} from '../services/teamDepartments';
import {companyIdentityMatches} from '../services/crmIdentity';
import {isOurCompany,companyRelationshipPatch} from '../services/companyRelationship';
import {emailDomain,existingPeopleByEmail,gmailContactParticipants,
 isPersonalEmailDomain,suggestedCompaniesFromEmail,suggestedPersonName}
 from '../services/emailPersonFromGmail362';

const NEW_COMPANY='__create_company__';
const MANUAL_EMAIL='__manual_email__';

export function EmailPersonCreate362({thread,details,initialAddress,initialName,
 allowManual=false,mailbox,contacts,companies,scope,canWrite,onCreated,onOpen}:{
 thread:GmailThreadSummary;details?:GmailThreadDetails|null;
 initialAddress?:string;initialName?:string;allowManual?:boolean;
 mailbox:string;contacts:readonly Contact[];companies:readonly Company[];
 scope:string|null;canWrite:boolean;onCreated:(id:string)=>void;onOpen:(id:string)=>void;
}){
 const bodyIsCurrent=!!details&&details.summary.id===thread.id&&
  details.summary.latestMessageId===thread.latestMessageId;
 const addresses=useMemo(()=>bodyIsCurrent&&details?
  gmailAddressesInDetails395(details,mailbox).map(item=>item.address):
  gmailContactParticipants(thread,mailbox),[bodyIsCurrent,details,thread,mailbox]);
 const first=initialAddress&&addresses.includes(initialAddress)?initialAddress:addresses[0]??'';
 const startManual=allowManual&&(!addresses.length||
  (!!initialAddress&&!addresses.includes(initialAddress)));
 const [manualMode,setManualMode]=useState(startManual);
 const [manualEmail,setManualEmail]=useState(startManual?initialAddress??'':'');
 const starter=startManual?initialAddress??'':first;
 const [address,setAddress]=useState(first);
 const getSuggestedChoice=(email:string)=>{
  const suggested=suggestedCompaniesFromEmail(email,contacts,companies);
  return suggested.length===1&&suggested[0].rank===100?suggested[0].company.id:'';
 };
 const [name,setName]=useState(()=>initialName?.trim()||
  (starter?suggestedPersonName(thread,starter):''));
 const [companyChoice,setCompanyChoice]=useState(()=>getSuggestedChoice(starter));
 const [companyName,setCompanyName]=useState('');
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const [createdPerson,setCreatedPerson]=useState<string|null>(null);
 const pending=useRef(false);
 const currentAddress=manualMode?personEmailAddress(manualEmail)??'':
  addresses.includes(address)?address:'';
 const duplicates=existingPeopleByEmail(contacts,currentAddress);
 const suggestions=useMemo(()=>suggestedCompaniesFromEmail(currentAddress,contacts,companies),
  [currentAddress,contacts,companies]);
 const domain=emailDomain(currentAddress);
 const personalProvider=!!domain&&isPersonalEmailDomain(domain);
 const otherCompanies=companies.filter(c=>!isOurCompany(c)&&
  !suggestions.some(s=>s.company.id===c.id)).slice()
  .sort((a,b)=>a.name.localeCompare(b.name));
 const setParticipant=(email:string)=>{
  if(email===MANUAL_EMAIL&&allowManual){
   setManualMode(true);setAddress('');setCompanyChoice('');setCompanyName('');
   setError('');setCreatedPerson(null);return;
  }
  if(!addresses.includes(email))return;
  setManualMode(false);setAddress(email);setName(suggestedPersonName(thread,email));
  setCompanyChoice(getSuggestedChoice(email));setCompanyName('');setError('');
  setCreatedPerson(null);
 };
 const save=(event:FormEvent)=>{
  event.preventDefault();
  if(pending.current||createdPerson)return;
  setError('');
  const auth=useAuthStore.getState();
  const access=validGmailToken(scope);
  const session=useGmailSessionStore.getState();
  // A stale Gmail thread or changed team identity must never create a CRM record.
  if(!canWrite||!scope||!access||access.mailbox!==mailbox||
   session.scope!==scope||
   emailWorkspaceScope(auth.mode,auth.organizationId,auth.user?.id)!==scope||
   !canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm')||
   useRolePerspectiveStore.getState().activePerspective||
   !session.threads.some(row=>row.id===thread.id&&
    row.latestMessageId===thread.latestMessageId&&
    ((allowManual&&manualMode)||
     gmailContactParticipants(row,mailbox).includes(currentAddress)||
     (bodyIsCurrent&&details&&
      gmailAddressesInDetails395(details,mailbox).some(item=>item.address===currentAddress))))){
   setError('Your Gmail or SalesShop session changed. Reopen this conversation to create the Person.');
   return;
  }
  const clean=name.trim();
  if(!clean||clean.length>180||
   (!manualMode&&!currentAddress)||
   (manualMode&&manualEmail.trim()&&!currentAddress)){
   setError('Enter a Person name and a valid email address (or leave manual email blank).');
   return;
  }
  const crm=useCrmStore.getState();
  if(!crm.hydrated){setError('CRM records are still loading. Try again.');return;}
  if(existingPeopleByEmail(crm.contacts,currentAddress).length){
   setError('This email address already belongs to a Person. Open that record instead.');return;
  }
  if(manualMode&&!currentAddress&&crm.contacts.some(person=>
   recordNameKey(person.name)===recordNameKey(clean)&&
   (person.companyId??'')===(companyChoice===NEW_COMPANY?'':companyChoice))){
   setError('A Person with that name may already exist. Search the CRM before creating a duplicate.');
   return;
  }
  let companyId:string|undefined;
  if(companyChoice===NEW_COMPANY){
   const companyLabel=companyName.trim();
   if(!companyLabel||companyLabel.length>180){
    setError('Enter the new Company name before creating this Person.');return;
   }
   const same=companyIdentityMatches(crm.companies,companyLabel);
   if(same.length){
    if(same.length===1&&!isOurCompany(same[0]))setCompanyChoice(same[0].id);
    setError('That Company already exists. Review the existing Company selection and save again.');return;
   }
  }else if(companyChoice){
   const selected=crm.companies.find(company=>company.id===companyChoice&&!isOurCompany(company));
   if(!selected){setError('Selected Company is unavailable. Choose another one.');return;}
   companyId=selected.id;
  }
  pending.current=true;setSaving(true);
  let createdCompanyId:string|undefined;
  try{
   if(companyChoice===NEW_COMPANY){
    const before=new Set(useCrmStore.getState().companies.map(item=>item.id));
    companyId=useCrmStore.getState().resolveCompany(companyName.trim(),'customer');
    if(!companyId)throw new Error('Could not create the Company.');
    if(!before.has(companyId)){
     createdCompanyId=companyId;
     const created=useCrmStore.getState().companies.find(item=>item.id===companyId);
     if(created)useCrmStore.getState().updateCompany(companyId,
      companyRelationshipPatch(created,'prospect'));
    }
   }
   // Resolve against live store again after a possible Company creation.
   if(existingPeopleByEmail(useCrmStore.getState().contacts,currentAddress).length)
    throw new Error('This Person has already been created. Open their existing record instead.');
   const personId=useCrmStore.getState().createContact({
    name:clean,...(currentAddress?{email:currentAddress}:{}),companyId,source:'manual',
   });
   if(!personId)throw new Error('Could not create the Person.');
   setCreatedPerson(personId);
   onCreated(personId);
  }catch(cause){
   if(createdCompanyId)setCompanyChoice(createdCompanyId);
   setError((createdCompanyId?'The Company was saved, but the Person may not be created. ':
    '')+(cause instanceof Error?cause.message:'Could not create the Person.'));
  }finally{
   pending.current=false;setSaving(false);
  }
 };
 if(!canWrite)return null;
 return <section className="ss-email-create-person" aria-label="Create Person from email">
  <header><h4>Create Person from email</h4><small>{allowManual?
   'Choose a detected address or enter one manually.':'Review a detected email address before creating a Person.'}</small></header>
  {!addresses.length&&!allowManual?<p>No usable external email addresses were detected in this conversation.</p>:
   <form onSubmit={save}>
    <label>Email address
     <select value={manualMode?MANUAL_EMAIL:currentAddress} disabled={saving||!!createdPerson}
      onChange={event=>setParticipant(event.target.value)}>
      {addresses.map(email=><option key={email} value={email}>{email}</option>)}
      {allowManual&&<option value={MANUAL_EMAIL}>Enter manually / no email yet</option>}
     </select>
    </label>
    {manualMode&&<label>Person email (optional)
     <input type="email" value={manualEmail} disabled={saving||!!createdPerson}
      placeholder="name@company.com"
      onChange={event=>{setManualEmail(event.target.value);setError('');}}/>
    </label>}
    {duplicates.length>0?<div className="ss-email-person-existing">
     <strong>This email already belongs to {duplicates.length===1?'a Person':'People'}.</strong>
     {duplicates.map(person=><button key={person.id} type="button" onClick={()=>onOpen(person.id)}>
      Open existing Person · {person.name||person.email}
     </button>)}
    </div>:<><label>Person name
     <input value={name} maxLength={180} disabled={saving||!!createdPerson}
      onChange={event=>{setName(event.target.value);setError('');}}
      placeholder="Full name (editable)"/>
    </label>
    <label>Company
     <select value={companyChoice} disabled={saving||!!createdPerson}
      onChange={event=>{setCompanyChoice(event.target.value);setError('');}}>
      <option value="">No Company yet</option>
      {suggestions.length>0&&<optgroup label="Suggested from email domain">
       {suggestions.map(item=><option key={item.company.id} value={item.company.id}>
        {item.company.name}</option>)}
      </optgroup>}
      {otherCompanies.length>0&&<optgroup label="Other existing Companies">
       {otherCompanies.map(company=><option key={company.id} value={company.id}>
        {company.name}</option>)}
      </optgroup>}
      <option value={NEW_COMPANY}>+ Create a new Company</option>
     </select>
    </label>
    {!!suggestions.find(item=>item.company.id===companyChoice)&&
     <p className="ss-email-create-helper">Suggested: {suggestions.find(item=>item.company.id===companyChoice)?.reason}.
      Confirm this association before creating the Person.</p>}
    {personalProvider&&<p className="ss-email-create-helper">
     Personal email provider: choose a Company manually if this Person has one.</p>}
    {companyChoice===NEW_COMPANY&&<label>New Company name
     <input value={companyName} maxLength={180} disabled={saving}
      onChange={event=>{setCompanyName(event.target.value);setError('');}}
      placeholder="Enter the business name"/>
     <small>Creates a Prospect Company when you save this Person.</small>
    </label>}
    <div className="ss-email-auto-actions">
     {createdPerson?<button type="button" onClick={()=>onOpen(createdPerson)}>
      Open created Person</button>:
      <button type="submit" disabled={saving||!name.trim()||
       (!manualMode&&!currentAddress)||
       (manualMode&&!!manualEmail.trim()&&!currentAddress)||
       (companyChoice===NEW_COMPANY&&!companyName.trim())}>
       {saving?'Creating…':'Create Person'}</button>}
    </div></>}
    {error&&<p role="alert" className="ss-email-error">{error}</p>}
    <p className="ss-email-create-helper">Forwarded chains may contain outdated or unrelated
     addresses. Verify the Person before saving. {currentAddress?
      'Gmail matching can use this address while connected.':
      'Add an email later to enable Gmail address matching.'}
     No message body is copied into the CRM.</p>
   </form>}
 </section>;
}
