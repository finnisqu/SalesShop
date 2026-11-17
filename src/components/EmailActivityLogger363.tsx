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
}
/** Explicit human-confirmed Activity: a Gmail read or match alone never writes CRM. */
export function EmailActivityLogger363({details,mailbox,scope,contacts,companies,deals,
 initialPersonId,initialDealId}:Props){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
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
 const alreadyLogged=key?loggedGmailActivity(activities,key):undefined;

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
  if(pending.current||saving)return;
  setError('');setNotice('');
  const msg=chosenMessage;
  const date=msg?gmailMessageDate(msg):null;
  if(!msg||!date){setError('Choose a Gmail message with a valid past date.');return;}
  if(!person||!key){setError('Select an existing Person and a verified Gmail message.');return;}
  const auth=useAuthStore.getState(),accessNow=validGmailToken(scope);
  if(!canLog||!auth.organizationId||!accessNow||accessNow.mailbox!==mailbox||
   scope!==emailWorkspaceScope(auth.mode,auth.organizationId,auth.user?.id)||
   useRolePerspectiveStore.getState().activePerspective||
   !canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm')){
   setError('Your Gmail connection or SalesShop access changed. Reopen the conversation.');return;
  }
  pending.current=true;setSaving(true);
  // Key derivation and identity recheck are inside the protected saving attempt.
  void (async()=>{
   try{
    const fingerprint=await gmailActivitySourceKey(auth.organizationId!,mailbox,msg.id);
    if(fingerprint!==key)throw new Error('The selected Gmail message changed. Reopen it to log.');
    const latestAuth=useAuthStore.getState(),latestAccess=validGmailToken(scope);
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
    const activityId=gmailActivityId(fingerprint);
    const existing=loggedGmailActivity(state.activities,fingerprint)||
      state.activities.find(a=>a.id===activityId);
    if(existing){setNotice('This Gmail message has already been logged as an Activity.');return;}
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
    setNotice('Email Activity logged. The Person and any linked Company/Deal timelines and Last Contacted now use this date.');
   }catch(reason){setError(reason instanceof Error?reason.message:'Could not log Gmail Activity.');}
   finally{pending.current=false;setSaving(false);}
  })();
 };
 if(!canLog)return null;
 return <section className="ss-email-activity" aria-label="Log Gmail as CRM Activity">
  <header><h4>Log email Activity</h4><small>Record a specific Gmail message in CRM.</small></header>
  <form onSubmit={log}>
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
   <label>Activity notes
    <textarea value={notes} maxLength={5000} rows={2} disabled={saving}
     onChange={e=>setNotes(e.target.value)}
     placeholder="Optional subject or follow-up notes"/>
   </label>
   <p className="ss-email-create-helper">Only when you press Log will the Activity be
    shared with your CRM team. The notes above are saved; email bodies, mailbox,
    thread IDs and message IDs are not copied into the CRM.</p>
   {alreadyLogged?<p className="ss-email-notice" role="status">
    This specific Gmail message is already logged in CRM.</p>:null}
   {error&&<p className="ss-email-error" role="alert">{error}</p>}
   {notice&&<p className="ss-email-notice" role="status">{notice}</p>}
   <div className="ss-email-auto-actions">
    <button type="submit" disabled={saving||!person||!key||!chosenMessage||
     !!alreadyLogged||!gmailMessageDate(chosenMessage)}>
     {saving?'Logging…':'Log email Activity'}</button>
   </div>
  </form>
 </section>;
}
