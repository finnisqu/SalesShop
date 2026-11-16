import {useEffect,useMemo,useState} from 'react';
import {RecordCard} from './RecordPageLayout';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useGmailSessionStore,validGmailToken} from '../store/gmailSession359a';
import {useEmailThreadLinkStore} from '../store/emailThreadLinkStore359a';
import {emailWorkspaceScope,type EmailTargetKind} from '../services/emailThreadLinks359a';
import {gmailThreadSummary,gmailThreadDetails,
 type GmailThreadSummary,type GmailThreadDetails} from '../services/gmailRead359a';
import {canEditTeamArea} from '../services/teamDepartments';
import './email-workspace.css';
export function RecordEmailThreadsPanel({kind,id}:{kind:EmailTargetKind;id:string}){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const scope=emailWorkspaceScope(mode,org,user);
 const linkScope=useEmailThreadLinkStore(s=>s.scope),links=useEmailThreadLinkStore(s=>s.links);
 const unlink=useEmailThreadLinkStore(s=>s.unlink);
 const mailbox=useGmailSessionStore(s=>s.mailbox),token=useGmailSessionStore(s=>s.token);
 const [summaries,setSummaries]=useState<Record<string,GmailThreadSummary>>({});
 const [selected,setSelected]=useState<GmailThreadDetails|null>(null);
 const [error,setError]=useState('');
 const mine=useMemo(()=>linkScope===scope?links.filter(row=>row.targetKind===kind&&row.targetId===id):[],
  [links,linkScope,scope,kind,id]);
 const account=perspective?null:validGmailToken(scope);
 const active=mine.filter(row=>!!account&&row.mailbox===account.mailbox);
 const canEdit=!!scope&&!perspective&&canEditTeamArea(role,department,'crm');
 useEffect(()=>{
  // A mailbox switch must never briefly show previously fetched message text.
  setSummaries({});setSelected(null);setError('');
  if(!account)return;
  const connectedToken=account.token;
  let alive=true;
  const ids=[...new Set(mine.filter(link=>link.mailbox===account.mailbox).map(link=>link.threadId))].slice(0,12);
  if(!ids.length){setSummaries({});return;}
  void Promise.all(ids.map(threadId=>gmailThreadSummary(connectedToken,threadId)
   .catch(()=>null))).then(items=>{
    if(!alive||validGmailToken(scope)?.token!==connectedToken)return;
    setSummaries(Object.fromEntries(items.filter((item):item is GmailThreadSummary=>!!item)
      .map(item=>[item.id,item])));
  });
  return()=>{alive=false;};
 },[scope,token,mailbox,mine]);
 const read=async(threadId:string)=>{
  const access=validGmailToken(scope);
  if(!access)return;
  setError('');setSelected(null);
  try{
   const details=await gmailThreadDetails(access.token,threadId);
   if(validGmailToken(scope)?.token===access.token)setSelected(details);
  }catch(e){setError(e instanceof Error?e.message:'Could not read linked conversation.');}
 };
 const remove=(linkId:string)=>{
  if(!canEdit||!window.confirm('Unlink this Gmail conversation? The email remains in Gmail.'))return;
  try{unlink(linkId);setSelected(null);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Could not unlink conversation.');}
 };
 return <RecordCard title="Email conversations" extra={<span>{mine.length} linked</span>}>
  {!mine.length&&<p className="connections-record-helper">
   No Gmail conversations linked. Connect Gmail in Records → More → Email, then link a thread.</p>}
  {!!mine.length&&!account&&<p className="connections-record-helper">
   Linked conversation references are saved privately on this browser. Connect the matching Gmail
   account in Records → More → Email to load their subjects and messages.</p>}
  {!!mine.length&&account&&active.length!==mine.length&&<p className="connections-record-helper">
   Some links belong to another Gmail account; they are hidden until that account is connected.</p>}
  {active.map(link=>{
   const summary=summaries[link.threadId];
   return <div key={link.id} className="ss-email-record-row">
    <div><strong>{summary?.subject??'Linked Gmail conversation'}</strong>
     <small>{summary?.from??link.mailbox}</small></div>
    <button type="button" onClick={()=>{void read(link.threadId);}}>Read</button>
    {canEdit&&<button type="button" onClick={()=>remove(link.id)}>Unlink</button>}
   </div>;
  })}
  {error&&<p className="ss-email-error" role="alert">{error}</p>}
  {selected&&<div className="ss-email-record-detail">
   <h3>{selected.summary.subject}</h3>
   {selected.messages.map(message=><article key={message.id} className="ss-email-message">
    <strong>{message.from}</strong><small>{new Date(message.date).toLocaleString()}</small>
    <pre>{message.text||'(No plain text content)'}</pre>
   </article>)}
  </div>}
  <p className="connections-record-helper">Linked emails are references, not logged Activities or proof of sent Quote delivery.</p>
 </RecordCard>;
}
