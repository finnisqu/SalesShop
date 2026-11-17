import {useRef,useState,type FormEvent} from 'react';
import type {Company,Contact,Project} from '../types/crm';
import type {GmailVisibleMessage} from '../services/gmailRead359a';
import type {TaskPriority} from '../store/personalTaskStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNavigationStore} from '../store/navigationStore';
import {rememberRecordsSection} from './RecordsSectionNav';
import {emailWorkspaceScope} from '../services/emailThreadLinks359a';
import {validGmailToken} from '../store/gmailSession359a';
import {personEmailAddress} from '../services/emailAutoMatch361';
import {canEditTeamArea} from '../services/teamDepartments';
import {gmailActivitySourceKey,gmailMessageDate} from '../services/gmailActivity363';
import {gmailFollowUpSourceId,existingGmailFollowUp,gmailFollowUpTomorrow,
 gmailFollowUpDateAfter,isValidGmailFollowUpDate,gmailFollowUpTitle,
 gmailFollowUpNotes,gmailFollowUpAssociations} from '../services/gmailFollowUp364';

/** Creates a private personal Task from a Gmail message without logging an Activity. */
export function EmailFollowUp364({scope,mailbox,message,fingerprint,person,deal,company,participants}:{
 scope:string|null;mailbox:string;message:GmailVisibleMessage;fingerprint:string;
 person:Contact;deal?:Project;company?:Company;participants:readonly string[];
}){
 const today=new Date();
 const [title,setTitle]=useState(()=>gmailFollowUpTitle(person.name));
 const [notes,setNotes]=useState(()=>gmailFollowUpNotes(message.subject,message.date));
 const [dueDate,setDueDate]=useState(()=>gmailFollowUpTomorrow());
 const [priority,setPriority]=useState<TaskPriority>('normal');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const savingRef=useRef(false);
 const tasks=usePersonalTaskStore(s=>s.tasks),storedScope=usePersonalTaskStore(s=>s.scope);
 const synced=usePersonalTaskStore(s=>s.syncStatus);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const privateScope=taskScope(mode,org,userId);
 const validScope=!!scope&&scope===emailWorkspaceScope(mode,org,userId)&&
  storedScope===privateScope&&!!privateScope&&mode==='cloud';
 const canCreate=validScope&&!perspective&&canEditTeamArea(role,department,'crm')&&
  validGmailToken(scope)?.mailbox===mailbox;
 const existing=existingGmailFollowUp(tasks,fingerprint);
 const jumpToTasks=()=>{
  rememberRecordsSection('tasks');
  useNavigationStore.getState().setView('dashboard');
 };
 const submit=(event:FormEvent)=>{
  event.preventDefault();
  if(savingRef.current||saving)return;
  setError('');setNotice('');
  const date=gmailMessageDate(message);
  if(!date||!isValidGmailFollowUpDate(dueDate)){
   setError('Choose a valid follow-up date, today or later.');return;
  }
  if(!title.trim()||title.trim().length>240){
   setError('Enter a Task title of 240 characters or fewer.');return;
  }
  const auth=useAuthStore.getState(),access=validGmailToken(scope);
  const expected=emailWorkspaceScope(auth.mode,auth.organizationId,auth.user?.id);
  const taskAccount=taskScope(auth.mode,auth.organizationId,auth.user?.id);
  if(!canCreate||!auth.organizationId||!access||!taskAccount||
     expected!==scope||taskAccount!==usePersonalTaskStore.getState().scope||
     access.mailbox!==mailbox||useRolePerspectiveStore.getState().activePerspective||
     !canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm')){
   setError('Your SalesShop or Gmail account changed. Reopen the conversation.');return;
  }
  savingRef.current=true;setSaving(true);
  void (async()=>{
   try{
    const fresh=await gmailActivitySourceKey(auth.organizationId!,mailbox,message.id);
    if(fresh!==fingerprint)throw new Error('The selected Gmail message changed. Reopen it.');
    const latestAuth=useAuthStore.getState(),latestAccess=validGmailToken(scope);
    const latestTasks=usePersonalTaskStore.getState();
    if(!latestAccess||latestAccess.token!==access.token||latestAccess.mailbox!==mailbox||
       emailWorkspaceScope(latestAuth.mode,latestAuth.organizationId,latestAuth.user?.id)!==scope||
       latestTasks.scope!==taskAccount||
       useRolePerspectiveStore.getState().activePerspective||
       !canEditTeamArea(latestAuth.teamRole,latestAuth.teamDepartment,'crm'))
     throw new Error('Account or permissions changed during Task creation. Try again.');
    const crm=useCrmStore.getState();
    const matching=crm.contacts.find(p=>p.id===person.id&&
      !!personEmailAddress(p.email)&&participants.some(address=>
       personEmailAddress(address)===personEmailAddress(p.email)));
    if(!crm.hydrated||!matching)
     throw new Error('The Person email is no longer a confirmed participant.');
    const selectedDeal=deal?crm.projects.find(p=>p.id===deal.id):undefined;
    if(deal&&!selectedDeal)throw new Error('The selected Deal is no longer available.');
    const selectedCompany=company?crm.companies.find(c=>c.id===company.id):undefined;
    if(company&&!selectedCompany)throw new Error('The Company selection is no longer available.');
    const associations=gmailFollowUpAssociations(matching,crm.companies,selectedDeal,
     selectedCompany?.id);
    const already=existingGmailFollowUp(latestTasks.tasks,fresh);
    if(already){
     setNotice('A follow-up Task already exists for this Gmail message.');return;
    }
    const created=latestTasks.createTask(title.trim(),{
     type:'follow-up',priority,dueDate,status:'open',queue:'Follow-ups',
     associations,sourceObjectId:gmailFollowUpSourceId(fresh),
     notes:notes.trim().slice(0,5000)||undefined,
    });
    if(!created)throw new Error('Task creation was not confirmed. Refresh Tasks and try again.');
    setNotice('Follow-up Task created for '+dueDate+'. It is available in HOME and RECORDS → TASKS.');
   }catch(cause){
    setError(cause instanceof Error?cause.message:'Unable to create follow-up Task.');
   }finally{savingRef.current=false;setSaving(false);}
  })();
 };
 if(!canCreate)return null;
 return <section className="ss-email-followup" aria-label="Create Gmail follow-up Task">
  <header><h4>Create follow-up Task</h4>
   <small>A personal Task associated with {person.name}, separate from logging the email Activity.</small></header>
  {existing?<div className="ss-email-followup-existing" role="status">
   <strong>Follow-up already created</strong>
   <span>{existing.title} · {existing.status==='completed'?'Completed':existing.dueDate
    ?'Due '+existing.dueDate:'No due date'}</span>
   <button type="button" onClick={jumpToTasks}>View in Tasks</button>
  </div>:<form onSubmit={submit}>
   <label>Task title
    <input value={title} maxLength={240} disabled={saving} required
     onChange={event=>{setTitle(event.target.value);setNotice('');}}/>
   </label>
   <div className="ss-email-followup-fields">
    <label>Due date
     <input type="date" min={gmailFollowUpDateAfter(0,today)} value={dueDate}
      disabled={saving} required onChange={event=>{setDueDate(event.target.value);setNotice('');}}/>
    </label>
    <label>Priority
     <select value={priority} disabled={saving}
      onChange={event=>setPriority(event.target.value as TaskPriority)}>
      <option value="normal">Normal</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
      <option value="low">Low</option>
     </select>
    </label>
   </div>
   <div className="ss-email-followup-presets" aria-label="Due date shortcuts">
    {[{label:'Today',days:0},{label:'Tomorrow',days:1},{label:'In 3 days',days:3},
      {label:'Next week',days:7}].map(option=><button key={option.days}
     type="button" disabled={saving}
     aria-pressed={dueDate===gmailFollowUpDateAfter(option.days,today)}
     onClick={()=>setDueDate(gmailFollowUpDateAfter(option.days))}>{option.label}</button>)}
   </div>
   <label>Task notes (editable)
    <textarea rows={2} value={notes} maxLength={5000} disabled={saving}
     placeholder="Email subject and next steps"
     onChange={event=>setNotes(event.target.value)}/>
   </label>
   <p className="ss-email-create-helper">This Task is private to your SalesShop user, with
    {deal?' the selected Deal,':' no Deal unless selected above,'} and the Person
    {company?' and Company':''} linked. Its title and notes will be saved, but the Gmail
    body, mailbox, recipients and raw message ID will not. No email Activity is logged by this action.</p>
   {error&&<p className="ss-email-error" role="alert">{error}</p>}
   {notice&&<p className="ss-email-notice" role="status">{notice}</p>}
   <div className="ss-email-auto-actions">
    <button type="submit" disabled={saving||!isValidGmailFollowUpDate(dueDate)||!title.trim()}>
     {saving?'Creating…':'Create follow-up Task'}</button>
    {!!notice&&<button type="button" onClick={jumpToTasks}>View in Tasks</button>}
   </div>
  </form>}
  {synced==='error'&&<p className="ss-email-error">
   Personal Task cloud sync reports a problem; check RECORDS → TASKS before relying on reminders.</p>}
 </section>;
}
