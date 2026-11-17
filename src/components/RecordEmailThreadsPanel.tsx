import {useEffect,useMemo,useState} from 'react';
import {RecordCard} from './RecordPageLayout';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useGmailSessionStore,validGmailToken} from '../store/gmailSession359a';
import {useEmailThreadLinkStore} from '../store/emailThreadLinkStore359a';
import {emailWorkspaceScope,type EmailTargetKind} from '../services/emailThreadLinks359a';
import {gmailThreadSummary,gmailThreadDetails,gmailThreadPage,
 type GmailThreadSummary,type GmailThreadDetails} from '../services/gmailRead359a';
import {canEditTeamArea} from '../services/teamDepartments';
import {gmailPersonQuery,matchingPersonThreads,mergePersonThreads,personEmailAddress,
 readPersonEmailPreferences,savePersonEmailPreferences} from '../services/emailAutoMatch361';
import './email-workspace.css';

interface AutoResults {
 key:string;
 rows:GmailThreadSummary[];
 nextPageToken?:string;
 loading:boolean;
 error:string;
}
const emptyAuto:AutoResults={key:'',rows:[],loading:false,error:''};

/** Manually linked threads also work for Deals. Person emails are matched live
 * by exact address in the connected Gmail account, with no CRM mail copy. */
export function RecordEmailThreadsPanel({kind,id,email}:{kind:EmailTargetKind;id:string;email?:string}){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const scope=emailWorkspaceScope(mode,org,user);
 const linkScope=useEmailThreadLinkStore(s=>s.scope),links=useEmailThreadLinkStore(s=>s.links);
 const unlink=useEmailThreadLinkStore(s=>s.unlink);
 const mailbox=useGmailSessionStore(s=>s.mailbox),token=useGmailSessionStore(s=>s.token);
 const [summaries,setSummaries]=useState<Record<string,GmailThreadSummary>>({});
 const [selected,setSelected]=useState<{key:string;token:string;details:GmailThreadDetails}|null>(null);
 const [error,setError]=useState('');
 const [auto,setAuto]=useState<AutoResults>(emptyAuto);
 const [preferenceVersion,setPreferenceVersion]=useState(0);
 const [refreshVersion,setRefreshVersion]=useState(0);
 const mine=useMemo(()=>linkScope===scope?links.filter(row=>row.targetKind===kind&&row.targetId===id):[],
  [links,linkScope,scope,kind,id]);
 const account=perspective?null:validGmailToken(scope);
 const recordKey=account?scope+'|'+account.mailbox+'|'+kind+':'+id:'';
 const active=mine.filter(row=>!!account&&row.mailbox===account.mailbox);
 const canEdit=!!scope&&!perspective&&canEditTeamArea(role,department,'crm');
 const personEmail=kind==='person'?personEmailAddress(email):null;
 const prefs=useMemo(()=>readPersonEmailPreferences(scope,account?.mailbox??null,id),
  [scope,account?.mailbox,id,preferenceVersion]);
 const autoEnabled=!!personEmail&&prefs.enabled;
 const autoKey=autoEnabled&&recordKey?recordKey+'|'+personEmail:'';
 const matched=auto.key===autoKey&&autoKey?auto.rows:[];
 const manuallyLinkedIds=new Set(active.map(row=>row.threadId));
 const visibleAutomatic=matched.filter(row=>!manuallyLinkedIds.has(row.id)&&
  !prefs.hiddenThreadIds.includes(row.id));
 const automaticPage=auto.key===autoKey?auto:emptyAuto;
 const shownDetails=account&&selected?.key===recordKey&&selected?.token===account.token?
  selected.details:null;

 useEffect(()=>{
  setSummaries({});setSelected(null);setError('');
  const access=perspective?null:validGmailToken(scope);
  if(!access)return;
  const controller=new AbortController();
  const ids=[...new Set(mine.filter(link=>link.mailbox===access.mailbox).map(link=>link.threadId))].slice(0,12);
  if(ids.length){
   void Promise.all(ids.map(threadId=>gmailThreadSummary(access.token,threadId,controller.signal)
    .catch(()=>null))).then(items=>{
     if(controller.signal.aborted||validGmailToken(scope)?.token!==access.token)return;
     setSummaries(Object.fromEntries(items.filter((item):item is GmailThreadSummary=>!!item)
      .map(item=>[item.id,item])));
    });
  }
  return ()=>controller.abort();
 },[scope,token,mailbox,mine,perspective,recordKey]);

 useEffect(()=>{
  setSelected(null);
  if(!autoKey||!personEmail){setAuto(emptyAuto);return;}
  const access=validGmailToken(scope);
  if(!access){setAuto(emptyAuto);return;}
  const controller=new AbortController();
  setAuto({key:autoKey,rows:[],loading:true,error:''});
  void gmailThreadPage(access.token,gmailPersonQuery(personEmail),undefined,controller.signal)
   .then(page=>{
    if(controller.signal.aborted||validGmailToken(scope)?.token!==access.token)return;
    setAuto({key:autoKey,rows:matchingPersonThreads(page.threads,personEmail),
     nextPageToken:page.nextPageToken,loading:false,error:''});
   }).catch(cause=>{
    if(controller.signal.aborted)return;
    setAuto({key:autoKey,rows:[],loading:false,
     error:cause instanceof Error?cause.message:'Could not find matching Gmail conversations.'});
   });
  return ()=>controller.abort();
 },[scope,token,mailbox,personEmail,autoKey,refreshVersion]);

 const loadMore=async()=>{
  const access=validGmailToken(scope);
  const pageToken=automaticPage.nextPageToken;
  if(!access||!personEmail||!autoKey||!pageToken||automaticPage.loading)return;
  setAuto(previous=>previous.key===autoKey?{...previous,loading:true,error:''}:previous);
  try{
   const page=await gmailThreadPage(access.token,gmailPersonQuery(personEmail),pageToken);
   if(validGmailToken(scope)?.token!==access.token)return;
   setAuto(previous=>previous.key===autoKey?{key:autoKey,
    rows:mergePersonThreads(previous.rows,matchingPersonThreads(page.threads,personEmail)),
    nextPageToken:page.nextPageToken,loading:false,error:''}:previous);
  }catch(cause){
   setAuto(previous=>previous.key===autoKey?{...previous,loading:false,
    error:cause instanceof Error?cause.message:'Could not load more conversations.'}:previous);
  }
 };
 const changePreferences=(next:{enabled:boolean;hiddenThreadIds:string[]})=>{
  if(!scope||!account||kind!=='person')return;
  try{
   savePersonEmailPreferences(scope,account.mailbox,id,next);
   setPreferenceVersion(value=>value+1);
   setError('');
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not save email display preferences.');}
 };
 const hideAutomatic=(threadId:string)=>{
  changePreferences({...prefs,hiddenThreadIds:[...new Set([...prefs.hiddenThreadIds,threadId])]});
  setSelected(null);
 };
 const read=async(threadId:string)=>{
  const access=validGmailToken(scope);
  if(!access)return;
  const requestKey=recordKey;
  setError('');setSelected(null);
  try{
   const details=await gmailThreadDetails(access.token,threadId);
   if(validGmailToken(scope)?.token===access.token)setSelected({key:requestKey,token:access.token,details});
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not read linked conversation.');}
 };
 const remove=(linkId:string)=>{
  if(!canEdit||!window.confirm('Unlink this Gmail conversation? The email remains in Gmail.'))return;
  try{unlink(linkId);setSelected(null);setError('');}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not unlink conversation.');}
 };
 return <RecordCard title="Email conversations" extra={<span>{mine.length} linked
  {personEmail&&account?' · '+visibleAutomatic.length+' auto-matched':''}</span>}>
  {kind==='person'&&!personEmail&&<p className="connections-record-helper">
   Add a valid email address to this Person to automatically discover matching Gmail conversations.</p>}
  {kind==='person'&&personEmail&&<div className="ss-email-auto-controls">
   <label><input type="checkbox" checked={autoEnabled} disabled={!account}
    onChange={event=>changePreferences({...prefs,enabled:event.target.checked})}/>
    Automatically match this Person's email</label>
   <small>Matches the exact address {personEmail} in your connected Gmail mailbox.</small>
   {account&&autoEnabled&&<div className="ss-email-auto-actions">
    <button type="button" onClick={()=>setRefreshVersion(value=>value+1)}
     disabled={automaticPage.loading}>Refresh</button>
    {!!prefs.hiddenThreadIds.length&&<button type="button"
     onClick={()=>changePreferences({...prefs,hiddenThreadIds:[]})}>
     Restore hidden ({prefs.hiddenThreadIds.length})</button>}
   </div>}
  </div>}
  {!mine.length&&kind==='deal'&&<p className="connections-record-helper">
   No Gmail conversations linked. Connect Gmail in Tools → Email, then link a conversation.</p>}
  {!account&&!!mine.length&&<p className="connections-record-helper">
   Linked conversation references are saved privately on this browser. Connect the matching Gmail
   account in Tools → Email to load their subjects and messages.</p>}
  {!account&&kind==='person'&&!!personEmail&&<p className="connections-record-helper">
   Connect Gmail in Tools → Email to see automatic matches; email content is not stored in SalesShop.</p>}
  {!!mine.length&&account&&active.length!==mine.length&&<p className="connections-record-helper">
   Some links belong to another Gmail account; they are hidden until that account is connected.</p>}
  {active.map(link=>{
   const summary=summaries[link.threadId];
   return <div key={link.id} className="ss-email-record-row">
    <div><strong>{summary?.subject??'Linked Gmail conversation'}</strong>
     <small>{summary?.from??link.mailbox} · Linked</small></div>
    <button type="button" onClick={()=>{void read(link.threadId);}}>Read</button>
    {canEdit&&<button type="button" onClick={()=>remove(link.id)}>Unlink</button>}
   </div>;
  })}
  {account&&autoEnabled&&automaticPage.loading&&!matched.length&&<p className="connections-record-helper">
   Finding email conversations…</p>}
  {account&&autoEnabled&&visibleAutomatic.map(thread=><div key={'auto:'+thread.id}
   className="ss-email-record-row">
   <div><strong>{thread.subject}</strong>
    <small>{thread.from} · {new Date(thread.date).toLocaleDateString()} · Auto-matched</small></div>
   <button type="button" onClick={()=>{void read(thread.id);}}>Read</button>
   <button type="button" onClick={()=>hideAutomatic(thread.id)}
    aria-label={'Hide automatic match '+thread.subject}>Hide</button>
  </div>)}
  {account&&autoEnabled&&!automaticPage.loading&&!visibleAutomatic.length&&!automaticPage.error&&
   !mine.length&&<p className="connections-record-helper">
   No matching conversations found in the results loaded from Gmail.</p>}
  {account&&autoEnabled&&automaticPage.nextPageToken&&<div className="ss-email-auto-actions">
   <button type="button" disabled={automaticPage.loading} onClick={()=>{void loadMore();}}>
    {automaticPage.loading?'Loading…':'Load more conversations'}</button>
  </div>}
  {automaticPage.error&&<p className="ss-email-error" role="alert">{automaticPage.error}</p>}
  {error&&<p className="ss-email-error" role="alert">{error}</p>}
  {account&&selected&&shownDetails&&<div className="ss-email-record-detail">
   <h3>{shownDetails.summary.subject}</h3>
   {shownDetails.messages.map(message=><article key={message.id} className="ss-email-message">
    <strong>{message.from}</strong><small>{new Date(message.date).toLocaleString()}</small>
    <pre>{message.text||'(No plain text content)'}</pre>
   </article>)}
  </div>}
  <p className="connections-record-helper">Automatic matches are live from Gmail; linked emails are
   browser-local references. Neither logs an Activity nor confirms Quote delivery.</p>
 </RecordCard>;
}
