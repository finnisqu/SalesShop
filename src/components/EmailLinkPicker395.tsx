import {useState,type FormEvent} from 'react';
import type {Company,Contact,Project} from '../types/crm';
import type {GmailThreadSummary,GmailThreadDetails} from '../services/gmailRead359a';
import type {EmailTarget,EmailTargetSuggestion} from '../services/emailThreadMatching359a';
import {personEmailAddress} from '../services/emailAutoMatch361';
import {recordNameKey} from '../services/recordNameKey';
import {emailWorkspaceScope} from '../services/emailThreadLinks359a';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useGmailSessionStore,validGmailToken} from '../store/gmailSession359a';
import {useCrmStore} from '../store/crmStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
import {EmailPersonCreate362} from './EmailPersonCreate362';

type Draft={kind:'person'|'deal';seed:string};
export function EmailLinkPicker395({thread,details,mailbox,scope,contacts,companies,deals,
 suggestions,selectedTarget,onSelect,onOpenPerson,canWrite}:{
 thread:GmailThreadSummary;details:GmailThreadDetails|null;mailbox:string;scope:string|null;
 contacts:readonly Contact[];companies:readonly Company[];deals:readonly Project[];
 suggestions:readonly EmailTargetSuggestion[];
 selectedTarget:string;onSelect:(key:string)=>void;
 onOpenPerson:(id:string)=>void;canWrite:boolean;
}){
 const [draft,setDraft]=useState<Draft|null>(null);
 const [dealName,setDealName]=useState('');
 const [dealCompany,setDealCompany]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const selected=selectedTarget?[
  ...contacts.map(p=>({key:'person:'+p.id,title:p.name||p.email||'Person'})),
  ...deals.map(d=>({key:'deal:'+d.id,title:d.name})),
 ].find(row=>row.key===selectedTarget):undefined;
 const options=[
  ...suggestions.map(s=>({id:s.kind+':'+s.id,name:s.title,
   detail:(s.kind==='person'?'Person':'Deal')+' · '+s.reason})),
  ...contacts.map(p=>({id:'person:'+p.id,name:p.name||p.email||'Unnamed Person',
   detail:'Person'+(p.email?' · '+p.email:'')})),
  ...deals.map(d=>({id:'deal:'+d.id,name:d.name,
   detail:'Deal'+(d.companyName?' · '+d.companyName:'')})),
 ].filter((value,index,list)=>list.findIndex(other=>other.id===value.id)===index);
 const startCreate=(seed:string)=>{
  const address=personEmailAddress(seed);
  setDraft({kind:'person',seed:address??seed.trim()});
  setDealName(address?'':seed.trim());setDealCompany('');setError('');
 };
 const chooseDraft=(kind:Draft['kind'])=>{
  if(!draft)return;
  setDraft({...draft,kind});setError('');
  if(kind==='deal'&&!dealName)setDealName(personEmailAddress(draft.seed)?'':draft.seed);
 };
 const saveDeal=(event:FormEvent)=>{
  event.preventDefault();
  if(busy||!draft||draft.kind!=='deal')return;
  const clean=dealName.trim(),state=useAuthStore.getState();
  const access=validGmailToken(scope),gmail=useGmailSessionStore.getState();
  if(!scope||!canWrite||!access||access.mailbox!==mailbox||gmail.scope!==scope||
   emailWorkspaceScope(state.mode,state.organizationId,state.user?.id)!==scope||
   !canEditTeamArea(state.teamRole,state.teamDepartment,'crm')||
   useRolePerspectiveStore.getState().activePerspective||
   !gmail.threads.some(row=>row.id===thread.id)){
   setError('The SalesShop or Gmail account changed. Reopen the email before creating a Deal.');
   return;
  }
  if(!clean||clean.length>180){setError('Enter a Deal name up to 180 characters.');return;}
  const crm=useCrmStore.getState();
  if(!crm.hydrated){setError('CRM is still loading.');return;}
  if(crm.projects.some(d=>recordNameKey(d.name)===recordNameKey(clean))){
   setError('That Deal name already exists. Search for and select it above.');return;
  }
  if(dealCompany&&!crm.companies.some(c=>c.id===dealCompany)){
   setError('The selected Company is no longer available.');return;
  }
  setBusy(true);setError('');
  try{
   const id=crm.createProject(clean,'Discovery');
   if(!id)throw new Error('Could not create Deal.');
   if(dealCompany)useCrmStore.getState().relinkProjectCompany(id,dealCompany);
   onSelect('deal:'+id);setDraft(null);
  }catch(e){setError(e instanceof Error?e.message:'Could not create Deal.');}
  finally{setBusy(false);}
 };
 return <div className="ss-email-link-picker">
  <UnifiedRecordPicker kind="CRM record" disabled={!canWrite||busy}
   triggerLabel={selected?'Change record · '+selected.title:'Search or create Person / Deal'}
   createLabel="record" items={options}
   onLink={key=>{onSelect(key);setDraft(null);setError('');}}
   onCreate={startCreate}
   helper="Search names and email addresses. Creating a record does not link the conversation until you confirm Link conversation."/>
  {selected&&<small>Selected: {selected.title} · Click Link conversation to save this association.</small>}
  {draft&&<div className="ss-email-link-new-record">
   <div className="ss-email-link-new-header">
    <strong>New record (not saved yet)</strong>
    <button type="button" onClick={()=>{setDraft(null);setError('');}}>Cancel</button>
   </div>
   <div className="ss-email-link-kind" role="group" aria-label="Record type">
    <button type="button" aria-pressed={draft.kind==='person'}
     onClick={()=>chooseDraft('person')}>Person</button>
    <button type="button" aria-pressed={draft.kind==='deal'}
     onClick={()=>chooseDraft('deal')}>Deal</button>
   </div>
   {draft.kind==='person'?<EmailPersonCreate362
    key={thread.id+'|'+draft.seed+'|person'} thread={thread} details={details}
    initialAddress={personEmailAddress(draft.seed)??undefined}
    initialName={personEmailAddress(draft.seed)?undefined:draft.seed}
    mailbox={mailbox} scope={scope} contacts={contacts} companies={companies}
    canWrite={canWrite}
    onCreated={id=>{onSelect('person:'+id);setDraft(null);}}
    onOpen={onOpenPerson}/>:
    <form className="ss-email-link-deal-create" onSubmit={saveDeal}>
     <label>Deal name<input value={dealName} maxLength={180} required disabled={busy}
      onChange={e=>{setDealName(e.target.value);setError('');}}/></label>
     <label>Company (optional)
      <select value={dealCompany} disabled={busy}
       onChange={e=>setDealCompany(e.target.value)}>
       <option value="">Unassigned</option>
       {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
     </label>
     <button type="submit" disabled={busy||!dealName.trim()}>
      {busy?'Creating…':'Create Deal and select'}</button>
    </form>}
   {error&&<p role="alert">{error}</p>}
  </div>}
 </div>;
}
