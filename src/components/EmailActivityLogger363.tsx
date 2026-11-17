import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import type {Company,Contact,Project} from '../types/crm';
import type {GmailThreadDetails} from '../services/gmailRead359a';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {validGmailToken} from '../store/gmailSession359a';
import {emailWorkspaceScope} from '../services/emailThreadLinks359a';
import {personEmailAddress} from '../services/emailAutoMatch361';
import {canEditTeamArea} from '../services/teamDepartments';
import {activityRelationsWithContext,primaryActivityRelations}
 from '../services/activityRelations';
import {recordActivityOnce} from '../services/activitySaveRecovery351d';
import {gmailActivityId,gmailActivitySourceKey,gmailMessageDate,gmailMessageDirection,
 loggedGmailActivity} from '../services/gmailActivity363';
import {EmailFollowUp364} from './EmailFollowUp364';
import {usePersonalTaskStore,taskScope,type TaskPriority} from '../store/personalTaskStore';
import {gmailFollowUpSourceId,existingGmailFollowUp,gmailFollowUpTomorrow,
 gmailFollowUpDateAfter,isValidGmailFollowUpDate,gmailFollowUpTitle,
 gmailFollowUpNotes,gmailFollowUpAssociations} from '../services/gmailFollowUp364';
import {gmailCombinedSaveState,suggestGmailReply} from '../services/gmailCombinedWorkflow365';
import {DEFAULT_GMAIL_REVIEW_RULES,type GmailReviewRules} from '../services/gmailTriagePrefs370';
import './email-workspace.css';

interface Props {
 details:GmailThreadDetails;
 mailbox:string;
 scope:string|null;
 contacts:readonly Contact[];
 companies:readonly Company[];
 deals:readonly Project[];
 initialPersonId?:string;
 initialDealId?:string;
 suppressReplyHint?:boolean;
 reviewRules?:Readonly<GmailReviewRules>;
 defaultLogOpen?:boolean;
}
/** Explicit human-confirmed Activity: a Gmail read or match alone never writes CRM. */
export function EmailActivityLogger363({details,mailbox,scope,contacts,companies,deals,
 initialPersonId,initialDealId,suppressReplyHint=false,
 reviewRules=DEFAULT_GMAIL_REVIEW_RULES,defaultLogOpen=false}:Props){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const logPanelRef=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(defaultLogOpen)logPanelRef.current?.setAttribute('open','');},[defaultLogOpen]);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const activities=useCrmStore(s=>s.activities);
 const hydrated=useCrmStore(s=>s.hydrated);
 const participants=useMemo(()=>new Set(details.summary.participants.map(p=>
  p.trim().toLowerCase())),[details.summary.participants]);
 const people=useMemo(()=>contacts.filter(contact=>{
  const email=personEmailAddress(contact.email);
  return email&&participants.has(email);
 }),[contacts,participants]);
 const startingPerson=initialPersonId&&people.some(p=>p.id===initialPersonId)?
  initialPersonId:people.length===1?people[0].id:'';
 const [personId,setPersonId]=useState(startingPerson);
 const last=details.messages[details.messages.length-1];
 const [messageId,setMessageId]=useState(last?.id??'');
 const [dealId,setDealId]=useState(initialDealId??'');
 const [extraCompanyId,setExtraCompanyId]=useState('');
 const [notes,setNotes]=useState(details.summary.subject==='(No subject)'?''
  :'Subject: '+details.summary.subject.slice(0,300));
 const [keyState,setKeyState]=useState<{messageId:string;key:string}|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [saving,setSaving]=useState(false);
 const [withFollowUp,setWithFollowUp]=useState(false);
 const [followUpDueDate,setFollowUpDueDate]=useState(()=>gmailFollowUpTomorrow());
 const [followUpPriority,setFollowUpPriority]=useState<TaskPriority>('normal');
 const [followUpTitle,setFollowUpTitle]=useState(()=>
  gmailFollowUpTitle(people.find(p=>p.id===startingPerson)?.name??'customer'));
 const [followUpNotes,setFollowUpNotes]=useState(()=>
  gmailFollowUpNotes(last?.subject??details.summary.subject,
   last?.date??details.summary.date));
 const taskRows=usePersonalTaskStore(s=>s.tasks),storedTaskScope=usePersonalTaskStore(s=>s.scope);
 const taskSyncStatus=usePersonalTaskStore(s=>s.syncStatus);
 const pending=useRef(false);
 const access=validGmailToken(scope);
 const canLog=!!access&&access.mailbox===mailbox&&
  mode==='cloud'&&Boolean(org&&userId&&scope===emailWorkspaceScope(mode,org,userId))&&
  !perspective&&canEditTeamArea(role,department,'crm')&&hydrated;
 const person=people.find(p=>p.id===personId);
 const personCompany=person?.companyId&&companies.some(c=>c.id===person.companyId)
  ?person.companyId:undefined;
 const eligibleDeals=deals.filter(d=>!personCompany||!d.companyId||d.companyId===personCompany);
 const chosenDeal=eligibleDeals.find(d=>d.id===dealId);
 const chosenCompany=personCompany??(companies.some(c=>c.id===extraCompanyId)?extraCompanyId:undefined);
 const chosenMessage=details.messages.find(m=>m.id===messageId);
 const key=keyState?.messageId===messageId?keyState.key:null;
 const combined=key?gmailCombinedSaveState(activities,taskRows,key,withFollowUp):null;
 const alreadyLogged=combined?.activity;
 const existingFollowUp=combined?.task;
 const privateScope=taskScope(mode,org,userId);
 const taskReady=!!privateScope&&storedTaskScope===privateScope;
 const replyHint=useMemo(()=>suppressReplyHint?null:suggestGmailReply(details,mailbox,
  Date.now(),reviewRules),[details,mailbox,suppressReplyHint,reviewRules]);

 useEffect(()=>{
  setFollowUpTitle(gmailFollowUpTitle(person?.name??'customer'));
 },[person?.id]);
 useEffect(()=>{
  setFollowUpNotes(gmailFollowUpNotes(
   chosenMessage?.subject??details.summary.subject,
   chosenMessage?.date??details.summary.date));
 },[messageId,details]);

 useEffect(()=>{
  setKeyState(null);setError('');setNotice('');
  const msg=details.messages.find(m=>m.id===messageId);
  if(!msg||!org||!canLog)return;
  let canceled=false;
  void gmailActivitySourceKey(org,mailbox,msg.id).then(fingerprint=>{
   if(!canceled)setKeyState({messageId:msg.id,key:fingerprint});
  }).catch(reason=>{
   if(!canceled)setError(reason instanceof Error?reason.message:'Could not verify Gmail message identity.');
  });
  return ()=>{canceled=true;};
 },[messageId,org,mailbox,details,canLog]);

 const log=(event:FormEvent)=>{
  event.preventDefault();
  if(pending.current||saving||!combined?.canSubmit)return;
  setError('');setNotice('');
  const msg=chosenMessage;
  const date=msg?gmailMessageDate(msg):null;
  if(!msg||!date){setError('Choose a Gmail message with a valid past date.');return;}
  if(!person||!key){setError('Select an existing Person and a verified Gmail message.');return;}
  const wantsTask=withFollowUp;
  const taskDueDate=followUpDueDate,taskPriority=followUpPriority;
  const taskTitle=followUpTitle.trim(),taskNotes=followUpNotes.trim().slice(0,5000);
  if(wantsTask&&!existingFollowUp&&(!taskReady||
     !isValidGmailFollowUpDate(taskDueDate)||!taskTitle||taskTitle.length>240)){
   setError(!taskReady?'Personal Tasks are still loading. Reopen or retry.':
    'Choose a valid Task title and a follow-up date of today or later.');return;
  }
  const auth=useAuthStore.getState(),accessNow=validGmailToken(scope);
  if(!canLog||!auth.organizationId||!accessNow||accessNow.mailbox!==mailbox||
   scope!==emailWorkspaceScope(auth.mode,auth.organizationId,auth.user?.id)||
   useRolePerspectiveStore.getState().activePerspective||
   !canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm')){
   setError('Your Gmail connection or SalesShop access changed. Reopen the conversation.');return;
  }
  pending.current=true;setSaving(true);
  let activitySaved=false;
  void (async()=>{
   try{
    const fingerprint=await gmailActivitySourceKey(auth.organizationId!,mailbox,msg.id);
    if(fingerprint!==key)throw new Error('The selected Gmail message changed. Reopen it to log.');
    const latestAuth=useAuthStore.getState(),latestAccess=validGmailToken(scope);
    const latestPrivateScope=taskScope(latestAuth.mode,latestAuth.organizationId,
     latestAuth.user?.id);
    if(!latestAccess||latestAccess.token!==accessNow.token||
      latestAccess.mailbox!==mailbox||
      emailWorkspaceScope(latestAuth.mode,latestAuth.organizationId,latestAuth.user?.id)!==scope||
      useRolePerspectiveStore.getState().activePerspective||
      !canEditTeamArea(latestAuth.teamRole,latestAuth.teamDepartment,'crm'))
     throw new Error('Account or permissions changed during logging. Reconnect and retry.');
    const state=useCrmStore.getState();
    const latestPerson=state.contacts.find(p=>p.id===person.id&&
     personEmailAddress(p.email)&&participants.has(personEmailAddress(p.email)!));
    if(!state.hydrated||!latestPerson)
     throw new Error('The matching Person is no longer available. Refresh CRM records.');
    const latestDeal=chosenDeal?state.projects.find(d=>d.id===chosenDeal.id):undefined;
    if(chosenDeal&&!latestDeal)throw new Error('The Deal changed. Choose a current Deal.');
    if(latestDeal&&latestPerson.companyId&&latestDeal.companyId&&
       latestPerson.companyId!==latestDeal.companyId)
     throw new Error('The Deal belongs to another Company. Review the association.');
    const latestCompany=extraCompanyId&&!latestPerson.companyId?
     state.companies.find(c=>c.id===extraCompanyId):undefined;
    if(extraCompanyId&&!latestPerson.companyId&&!latestCompany)
     throw new Error('The selected Company is no longer available.');
    const relationships=activityRelationsWithContext([
     {type:'contact',id:latestPerson.id,label:'Person · '+latestPerson.name},
     ...(latestDeal?[{type:'project' as const,id:latestDeal.id,
       label:'Deal · '+latestDeal.name}]:[]),
     ...(latestCompany?[{type:'company' as const,id:latestCompany.id,
       label:'Company · '+latestCompany.name}]:[]),
    ],state.contacts,state.projects,[]);

    // Prevalidate the Task and all record associations BEFORE writing the Activity.
    const taskState=usePersonalTaskStore.getState();
    const existingTask=wantsTask?existingGmailFollowUp(taskState.tasks,fingerprint):undefined;
    const taskAssociations=wantsTask&&!existingTask?gmailFollowUpAssociations(latestPerson,
     state.companies,latestDeal,latestCompany?.id):[];
    if(wantsTask&&!existingTask){
     if(!latestPrivateScope||taskState.scope!==latestPrivateScope||
      !isValidGmailFollowUpDate(taskDueDate))
      throw new Error('Your personal Task session or follow-up date changed. Retry.');
    }
    const activityId=gmailActivityId(fingerprint);
    const existingActivity=loggedGmailActivity(state.activities,fingerprint)||
      state.activities.find(a=>a.id===activityId);
    if(!existingActivity){
     const primary=primaryActivityRelations(relationships);
     recordActivityOnce(activityId,state.activities,id=>state.recordActivity({
      id,type:'manual-touchpoint',
      summary:'Email with '+latestPerson.name,
      occurredAt:date,...primary,
      metadata:{
       interactionMethod:'email',source:'manual',recordedAt:new Date().toISOString(),
       relatedRecords:relationships,notes:notes.trim().slice(0,5000)||undefined,
       gmailMessageFingerprint:fingerprint,
       gmailDirection:gmailMessageDirection(msg,mailbox),
      },
     }));
    }
    activitySaved=true;
    if(wantsTask&&!existingGmailFollowUp(usePersonalTaskStore.getState().tasks,fingerprint)){
     // Explicit follow-up, scoped to the signed-in user's own Task store.
     const currentTasks=usePersonalTaskStore.getState();
     if(currentTasks.scope!==latestPrivateScope||
       validGmailToken(scope)?.token!==accessNow.token||
       emailWorkspaceScope(useAuthStore.getState().mode,
        useAuthStore.getState().organizationId,useAuthStore.getState().user?.id)!==scope)
      throw new Error('Account changed before Task creation. Reconnect and retry.');
     const created=currentTasks.createTask(taskTitle,{
      type:'follow-up',priority:taskPriority,dueDate:taskDueDate,status:'open',
      queue:'Follow-ups',associations:taskAssociations,
      sourceObjectId:gmailFollowUpSourceId(fingerprint),
      notes:taskNotes||undefined,
     });
     if(!created)throw new Error('Task creation could not be confirmed. Retry to finish the follow-up.');
    }
    setNotice(wantsTask?'Email Activity and follow-up Task are saved. Last Contacted uses the original message date.':
     'Email Activity logged. Related CRM timelines and Last Contacted now use the original message date.');
   }catch(reason){
    const message=reason instanceof Error?reason.message:'Could not save the Gmail interaction.';
    setError(activitySaved&&wantsTask?
     'Email Activity is saved, but the follow-up Task was not confirmed. Retry to finish without logging the email twice. '+message:
     message);
   }finally{pending.current=false;setSaving(false);}
  })();
 };
 if(!canLog)return null;
 return <section className="ss-email-activity" aria-label="Gmail CRM actions">
  <header><h4>Email actions</h4>
   <small>Matching conversations are not automatically logged as Activities.
    Create a follow-up independently, or explicitly log the message below.</small></header>
  {replyHint&&<div className="ss-email-reply-hint">
   <strong>Possible reply needed</strong>
   <p>{replyHint.description} This is a suggestion, not a confirmed unanswered message.</p>
   <button type="button" disabled={saving} onClick={()=>{
    setMessageId(replyHint.messageId);
   }}>Prepare follow-up Task</button>
  </div>}
  <div className="ss-email-activity-targets">
   <label>Message
    <select value={messageId} disabled={saving} onChange={e=>setMessageId(e.target.value)}>
     {details.messages.map(message=><option key={message.id} value={message.id}>
      {new Date(message.date).toLocaleString()} · {message.from.slice(0,65)}
     </option>)}
    </select>
   </label>
   <label>Person
    <select value={personId} disabled={saving} onChange={e=>{
     setPersonId(e.target.value);setDealId('');setExtraCompanyId('');
    }}>
     <option value="">Choose matching Person</option>
     {people.map(p=><option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}
    </select>
   </label>
   {!people.length&&<p className="ss-email-create-helper">
    Create a Person from this conversation first, then log an email Activity.</p>}
   {!!person&&<div className="ss-email-activity-fields">
    {personCompany?<p className="ss-email-create-helper">Company: {
     companies.find(c=>c.id===personCompany)?.name} (from Person record)</p>:
     <label>Company (optional)
      <select value={extraCompanyId} disabled={saving}
       onChange={e=>setExtraCompanyId(e.target.value)}>
       <option value="">No Company</option>
       {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
     </label>}
    <label>Deal (optional)
     <select value={chosenDeal?.id??''} disabled={saving}
      onChange={e=>setDealId(e.target.value)}>
      <option value="">No Deal</option>
      {eligibleDeals.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
     </select>
    </label>
   </div>}
  </div>
  {person&&chosenMessage&&key&&<EmailFollowUp364
   key={messageId+'|'+person.id}
   scope={scope} mailbox={mailbox} message={chosenMessage} fingerprint={key}
   person={person} company={companies.find(c=>c.id===chosenCompany)}
   deal={chosenDeal} participants={details.summary.participants}/>}
  <details className="ss-email-standalone ss-email-log-panel" ref={logPanelRef}>
   <summary>{alreadyLogged?'Email Activity already logged · View details':
    'Log this email as an Activity (optional)'}</summary>
   <form onSubmit={log}>
   <label>Activity notes
    <textarea value={notes} maxLength={5000} rows={2} disabled={saving||!!alreadyLogged}
     onChange={e=>setNotes(e.target.value)}
     placeholder="Optional subject or follow-up notes"/>
   </label>
   <label className="ss-email-combined-toggle">
    <input type="checkbox" checked={withFollowUp} disabled={saving}
     onChange={e=>setWithFollowUp(e.target.checked)}/>
    <span>Also create a personal follow-up Task</span>
   </label>
   {withFollowUp&&<div className="ss-email-combined-details">
    {existingFollowUp?<p className="ss-email-notice">
     Follow-up already exists: {existingFollowUp.title}. It won't be duplicated.</p>:<>
     <div className="ss-email-followup-fields">
      <label>Due date
       <input type="date" value={followUpDueDate}
        min={gmailFollowUpDateAfter(0)} disabled={saving}
        onChange={e=>setFollowUpDueDate(e.target.value)}/>
      </label>
      <label>Priority
       <select value={followUpPriority} disabled={saving}
        onChange={e=>setFollowUpPriority(e.target.value as TaskPriority)}>
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
        <option value="low">Low</option>
       </select>
      </label>
     </div>
     <div className="ss-email-followup-presets" aria-label="Follow-up due date shortcuts">
      {[{label:'Today',days:0},{label:'Tomorrow',days:1},
        {label:'In 3 days',days:3},{label:'Next week',days:7}].map(preset=>
       <button type="button" key={preset.days} disabled={saving}
        aria-pressed={followUpDueDate===gmailFollowUpDateAfter(preset.days)}
        onClick={()=>setFollowUpDueDate(gmailFollowUpDateAfter(preset.days))}>{preset.label}</button>)}
     </div>
     <label>Task title
      <input value={followUpTitle} maxLength={240} disabled={saving}
       onChange={e=>setFollowUpTitle(e.target.value)}/>
     </label>
     <label>Task notes (private)
      <textarea rows={2} value={followUpNotes} maxLength={5000} disabled={saving}
       onChange={e=>setFollowUpNotes(e.target.value)}/>
     </label>
     {!taskReady&&<p className="ss-email-error">Personal Tasks are loading; follow-up creation isn't available yet.</p>}
    </>}
   </div>}
   <p className="ss-email-create-helper">The confirmed email Activity is shared with CRM;
    the optional follow-up is a personal Task. Only the notes you enter are saved.
    Gmail message bodies, recipients and raw Gmail IDs are not copied into SalesShop.</p>
   {alreadyLogged?<p className="ss-email-notice" role="status">
    This Gmail message is already logged. Use the separate follow-up Task action above,
    or select the combined option to finish a missing Task without recording another Activity.</p>:null}
   {error&&<p className="ss-email-error" role="alert">{error}</p>}
   {notice&&<p className="ss-email-notice" role="status">{notice}</p>}
   {taskSyncStatus==='error'&&withFollowUp&&<p className="ss-email-error">
    Personal Task sync reports an error. Verify the Task in RECORDS → TASKS.</p>}
   <div className="ss-email-auto-actions">
    <button type="submit" disabled={saving||!person||!key||!chosenMessage||
     !combined?.canSubmit||!gmailMessageDate(chosenMessage)||
     (withFollowUp&&!existingFollowUp&&(!taskReady||
      !isValidGmailFollowUpDate(followUpDueDate)||!followUpTitle.trim()))}>
     {saving?'Saving…':alreadyLogged?'Create missing follow-up Task':
      withFollowUp?'Log email + create follow-up':'Log email Activity'}</button>
   </div>
   </form>
  </details>
 </section>;
}
