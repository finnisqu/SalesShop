import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import type {Company,Contact,Project} from '../types/crm';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useDealPeopleStore,dealPeopleScope} from '../store/dealPeopleStore';
import {useGmailSessionStore,validGmailToken} from '../store/gmailSession359a';
import {useEmailThreadLinkStore} from '../store/emailThreadLinkStore359a';
import {emailWorkspaceScope,type EmailTarget,type EmailTargetKind} from '../services/emailThreadLinks359a';
import {gmailClientId,gmailThreadDetails,
 type GmailThreadDetails,type GmailThreadSummary} from '../services/gmailRead359a';
import {emailTargetSuggestions} from '../services/emailThreadMatching359a';
import {classifyGmailTriage,filterGmailTriage,gmailTriageCounts,
 mayNeedGmailReplyReview,type GmailTriageFilter} from '../services/gmailTriage367';
import {currentGmailReviewDecision,readGmailReviewDecisions,
 saveGmailReviewDecisions,withGmailReviewDecision,
 type GmailReviewDecision,type GmailReviewKind} from '../services/gmailReview368';
import {canEditTeamArea} from '../services/teamDepartments';
import {useNavigationStore} from '../store/navigationStore';
import {EmailPersonCreate362} from './EmailPersonCreate362';
import {EmailActivityLogger363} from './EmailActivityLogger363';
import './email-workspace.css';

export function EmailWorkspace({contacts,deals,companies}:{
 contacts:readonly Contact[];deals:readonly Project[];companies:readonly Company[];
}){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const expectedScope=emailWorkspaceScope(mode,org,user);
 const sessionScope=useGmailSessionStore(s=>s.scope);
 const mailbox=useGmailSessionStore(s=>s.mailbox),status=useGmailSessionStore(s=>s.status);
 const loading=useGmailSessionStore(s=>s.loading),error=useGmailSessionStore(s=>s.error);
 const threads=useGmailSessionStore(s=>s.threads),nextPage=useGmailSessionStore(s=>s.nextPageToken);
 const connect=useGmailSessionStore(s=>s.connect),disconnect=useGmailSessionStore(s=>s.disconnect);
 const searchGmail=useGmailSessionStore(s=>s.search);
 const linkScope=useEmailThreadLinkStore(s=>s.scope);
 const storedLinks=useEmailThreadLinkStore(s=>s.links);
 const linkThread=useEmailThreadLinkStore(s=>s.link),unlinkThread=useEmailThreadLinkStore(s=>s.unlink);
 const dealPeople=useDealPeopleStore(s=>s.links),dealPeopleStoreScope=useDealPeopleStore(s=>s.scope);
 const [query,setQuery]=useState('newer_than:90d');
 const [triageFilter,setTriageFilter]=useState<GmailTriageFilter|'aside'>('all');
 const [reviewStorage,setReviewStorage]=useState<{
  identity:string|null;decisions:GmailReviewDecision[]
 }>({identity:null,decisions:[]});
 const requestVersion=useRef(0);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [selectedTarget,setSelectedTarget]=useState('');
 const [details,setDetails]=useState<GmailThreadDetails|null>(null);
 const [detailError,setDetailError]=useState('');
 const [detailsLoading,setDetailsLoading]=useState(false);
 const [notice,setNotice]=useState('');
 const openPerson=useNavigationStore(s=>s.openPerson),openDeal=useNavigationStore(s=>s.openProject);
 const canWrite=!!expectedScope&&!perspective&&canEditTeamArea(role,department,'crm');
 const ready=!!expectedScope&&!perspective&&expectedScope===sessionScope&&expectedScope===linkScope;
 const connected=ready&&!!validGmailToken(expectedScope);
 const links=ready?storedLinks:[];
 const reviewIdentity=connected&&expectedScope&&mailbox?
  expectedScope+'|'+mailbox.toLowerCase():null;
 const reviewDecisions=reviewStorage.identity===reviewIdentity?reviewStorage.decisions:[];
 const current=threads.find(t=>t.id===activeId);
 const triage=useMemo(()=>classifyGmailTriage(threads,contacts,mailbox),
  [threads,contacts,mailbox]);
 const triageCounts=useMemo(()=>{
  const count=gmailTriageCounts(triage);
  const active=triage.filter(item=>item.reviewReply&&
   !currentGmailReviewDecision(item.thread,reviewDecisions)).length;
  const aside=triage.filter(item=>item.reviewReply&&
   !!currentGmailReviewDecision(item.thread,reviewDecisions)).length;
  return {...count,review:active,aside};
 },[triage,reviewDecisions]);
 const shownTriage=useMemo(()=>{
  if(triageFilter==='aside')return triage.filter(item=>item.reviewReply&&
   !!currentGmailReviewDecision(item.thread,reviewDecisions));
  if(triageFilter==='review')return triage.filter(item=>item.reviewReply&&
   !currentGmailReviewDecision(item.thread,reviewDecisions));
  return filterGmailTriage(triage,triageFilter);
 },[triage,triageFilter,reviewDecisions]);
 const directLinks=dealPeopleStoreScope===dealPeopleScope(mode,org)?dealPeople:[];
 const suggestions=useMemo(()=>current?
  emailTargetSuggestions(current,contacts,deals,directLinks):[],
  [current,contacts,deals,directLinks]);
 const targets=useMemo<EmailTarget[]>(()=>[
  ...contacts.map(p=>({kind:'person' as const,id:p.id,title:p.name||p.email||'Unnamed Person'})),
  ...deals.map(d=>({kind:'deal' as const,id:d.id,title:d.name})),
 ],[contacts,deals]);
 const targetByKey=useMemo(()=>new Map(targets.map(t=>[t.kind+':'+t.id,t])),[targets]);
 const activeLinks=links.filter(row=>row.mailbox===mailbox&&row.threadId===activeId&&
  targetByKey.has(row.targetKind+':'+row.targetId));
 useEffect(()=>{
  if(!reviewIdentity||!expectedScope||!mailbox){
   setReviewStorage({identity:null,decisions:[]});return;
  }
  setReviewStorage({identity:reviewIdentity,
   decisions:readGmailReviewDecisions(expectedScope,mailbox)});
 },[reviewIdentity,expectedScope,mailbox]);
 // Changing Gmail identity invalidates all currently displayed mail and metadata.
 useEffect(()=>{
  requestVersion.current+=1;
  setActiveId(null);setDetails(null);setDetailError('');setSelectedTarget('');setNotice('');
  setTriageFilter('all');
 },[mailbox,expectedScope]);
 const connectInbox=async()=>{
  setNotice('');
  try{
   await connect();
   await useGmailSessionStore.getState().search(query);
  }catch{/* The session store explains the OAuth denial or setup problem. */}
 };
 const findThreads=(event:FormEvent)=>{
  event.preventDefault();
  if(!connected)return;
  requestVersion.current+=1;
  setActiveId(null);setDetails(null);setDetailError('');
  void searchGmail(query);
 };
 const changeTriage=(next:GmailTriageFilter|'aside')=>{
  if(next===triageFilter)return;
  requestVersion.current+=1;
  setTriageFilter(next);setActiveId(null);setDetails(null);
  setDetailError('');setDetailsLoading(false);setSelectedTarget('');
 };
 const saveReview=(thread:GmailThreadSummary,kind:GmailReviewKind|null)=>{
  const access=validGmailToken(expectedScope);
  const live=useGmailSessionStore.getState();
  if(!connected||!access||!expectedScope||!mailbox||
   access.mailbox!==mailbox||live.scope!==expectedScope||
   !threads.some(item=>item.id===thread.id&&item.date===thread.date)){
   setNotice('Reconnect Gmail or refresh the conversation before changing its review status.');
   return;
  }
  if(kind!==null&&!mayNeedGmailReplyReview(thread,mailbox)){
   setNotice('This conversation is no longer flagged for reply review.');return;
  }
  try{
   const existing=readGmailReviewDecisions(expectedScope,mailbox);
   const next=withGmailReviewDecision(existing,thread,kind);
   saveGmailReviewDecisions(expectedScope,mailbox,next);
   setReviewStorage({identity:reviewIdentity,decisions:next});
   setNotice(kind==='reviewed'?'Conversation marked reviewed until a new message arrives.':
    kind==='snoozed'?'Reply review snoozed for three days (no notification scheduled).':
    'Conversation returned to reply review.');
   if(activeId===thread.id&&((triageFilter==='review'&&kind!==null)||
     (triageFilter==='aside'&&kind===null))){
    requestVersion.current+=1;setActiveId(null);setDetails(null);
    setDetailError('');setDetailsLoading(false);
   }
  }catch(e){
   setNotice(e instanceof Error?e.message:'Could not save the review choice.');
  }
 };
 const showThread=async(id:string)=>{
  const request=++requestVersion.current;
  setActiveId(id);setDetails(null);setDetailError('');setDetailsLoading(true);
  setSelectedTarget('');
  const session=validGmailToken(expectedScope);
  if(!session){
   setDetailsLoading(false);setDetailError('Reconnect Gmail to read this conversation.');return;
  }
  try{
   const result=await gmailThreadDetails(session.token,id);
   if(request===requestVersion.current&&validGmailToken(expectedScope)?.token===session.token&&
    useGmailSessionStore.getState().scope===expectedScope)setDetails(result);
  }catch(e){
   if(request===requestVersion.current)
    setDetailError(e instanceof Error?e.message:'Could not read this conversation.');
  }finally{
   if(request===requestVersion.current)setDetailsLoading(false);
  }
 };
 const applyLink=()=>{
  if(!canWrite||!connected||!mailbox||!current)return;
  const target=targetByKey.get(selectedTarget);
  if(!target){setNotice('Select a CRM Person or Deal before linking.');return;}
  try{
   linkThread({mailbox,threadId:current.id,targetKind:target.kind,targetId:target.id});
   setNotice('Conversation linked to '+target.title+'. This did not log an email Activity.');
   setSelectedTarget('');
  }catch(e){setNotice(e instanceof Error?e.message:'Could not link conversation.');}
 };
 const unlink=(id:string)=>{
  if(!canWrite||!window.confirm('Unlink this Gmail thread from the CRM record? The message stays in Gmail.'))return;
  try{unlinkThread(id);setNotice('Email link removed from SalesShop.');}
  catch(e){setNotice(e instanceof Error?e.message:'Could not unlink conversation.');}
 };
 const followTarget=(target:EmailTarget)=>{
  if(target.kind==='person')openPerson(target.id);else openDeal(target.id);
 };
 return <section className="ss-email-workspace" aria-label="Connected Email">
  <header className="ss-email-heading">
   <div><small>EMAIL · CONNECTED GMAIL</small><h2>Connected Email</h2>
    <p>Match Gmail conversations to CRM People, create follow-up Tasks, and explicitly log Activities.</p></div>
   <span>Gmail · read-only</span>
  </header>
  {!gmailClientId&&<div className="ss-email-state">
   <strong>Google OAuth setup required</strong>
   <p>Configure <code>VITE_GOOGLE_GMAIL_CLIENT_ID</code> in Cloudflare and authorize
    SalesShop's JavaScript origin in Google Cloud. No email account is accessed yet.</p>
   <a target="_blank" rel="noopener noreferrer"
    href="https://github.com/finnisqu/SalesShop/blob/main/docs/product/gmail-connection-359a.md">Google Gmail setup guide ↗</a>
  </div>}
  {!expectedScope&&<div className="ss-email-state">
   Sign in to a real SalesShop organization to connect a personal Gmail account.
  </div>}
  <div className="ss-email-toolbar">
   <div className="ss-email-connection">
    <span>{connected?'Connected: '+mailbox:status==='connecting'?'Connecting to Google…':'No Gmail connected'}</span>
    {connected?<button type="button" onClick={()=>{disconnect();setNotice('Gmail disconnected for this session.');}}>
     Disconnect</button>:<button type="button" disabled={!ready||!gmailClientId||status==='connecting'}
     onClick={()=>{void connectInbox();}}>Connect Gmail</button>}
   </div>
   {connected&&<form onSubmit={findThreads} className="ss-email-search">
    <label htmlFor="ss-email-query">Gmail search</label>
    <input id="ss-email-query" value={query} maxLength={180}
     onChange={e=>setQuery(e.target.value)} placeholder="from:customer@example.com or newer_than:90d"/>
    <button type="submit" disabled={loading}>Search</button>
   </form>}
  </div>
  {error&&<p className="ss-email-error" role="alert">{error}</p>}
  {notice&&<p className="ss-email-notice" role="status">{notice}</p>}
  {connected&&<div className="ss-email-content">
   <div className="ss-email-threads" role="region" aria-label="Gmail search results">
    <h3>Conversations <small>{shownTriage.length} shown · {threads.length} loaded</small></h3>
    <div className="ss-email-triage-tabs" role="group" aria-label="Email triage filters">
     {([{id:'all',title:'All',count:triageCounts.all},
       {id:'review',title:'Review replies',count:triageCounts.review},
       {id:'aside',title:'Set aside',count:triageCounts.aside},
       {id:'known',title:'Existing People',count:triageCounts.known},
       {id:'new',title:'Unknown participants',count:triageCounts.new}] as const).map(item=>
      <button type="button" key={item.id} className="ss-email-triage-tab"
       aria-pressed={triageFilter===item.id} onClick={()=>changeTriage(item.id)}>
       {item.title} <small>{item.count}</small>
      </button>)}
    </div>
    <p className="ss-email-triage-note">
     Filters apply to loaded conversations only. Review replies is a preliminary
     sender/date hint, not proof a message is unanswered. Open a thread to verify.
     Reviewed suggestions return if a new message arrives; snoozed ones return after
     three days. These choices are browser-local, not reminder notifications.
    </p>
    {loading&&!threads.length&&<p>Reading Gmail…</p>}
    {!loading&&!threads.length&&<p className="ss-email-empty">No conversations match. Try another search.</p>}
    {!loading&&threads.length>0&&!shownTriage.length&&
     <p className="ss-email-empty">No loaded conversations match this filter. Try All or load more.</p>}
    {shownTriage.map(({thread:t,people,unknownAddresses,reviewReply})=>{
     const linked=links.filter(l=>l.threadId===t.id&&l.mailbox===mailbox).length;
     const reviewDecision=reviewReply?currentGmailReviewDecision(t,reviewDecisions):null;
     return <div key={t.id} className="ss-email-thread-row">
      <button type="button" className={'ss-email-thread'+(activeId===t.id?' is-selected':'')}
       aria-pressed={activeId===t.id} onClick={()=>{void showThread(t.id);}}>
       <strong>{t.subject}</strong>
       <span>{t.from}</span>
       <small>{new Date(t.date).toLocaleDateString()} · {t.messageCount} messages
        {linked?' · '+linked+' linked':''}</small>
       <small className="ss-email-triage-thread-meta">
        {people.length?'In CRM: '+people.slice(0,2).map(p=>p.name||p.email).join(', ')+
         (people.length>2?' +'+(people.length-2):''):'No matching Person'}
        {unknownAddresses.length?' · '+unknownAddresses.length+
         (unknownAddresses.length===1?' unknown participant':' unknown participants'):''}
        {reviewReply?' · '+(reviewDecision?reviewDecision.kind==='reviewed'?'Reviewed':
         'Snoozed until '+new Date(reviewDecision.until!).toLocaleDateString():'Review reply'):''}
       </small>
       <p>{t.snippet}</p>
      </button>
      {reviewReply&&<div className="ss-email-triage-row-actions" aria-label="Review conversation">
       {reviewDecision?<button type="button" disabled={!connected} onClick={()=>saveReview(t,null)}>
        Resume review</button>:<>
        <button type="button" disabled={!connected} onClick={()=>saveReview(t,'reviewed')}>
         Mark reviewed</button>
        <button type="button" disabled={!connected} onClick={()=>saveReview(t,'snoozed')}>
         Snooze 3 days</button>
       </>}
      </div>}
     </div>;
    })}
    {nextPage&&<button type="button" disabled={loading} className="ss-email-more"
      onClick={()=>{void searchGmail(query,nextPage);}}>Load more conversations</button>}
   </div>
   <section className="ss-email-detail" aria-label="Selected conversation">
    {!activeId&&<div className="ss-email-empty">Choose a conversation to read messages and link it to a record.</div>}
    {current&&<><div className="ss-email-detail-heading">
     <h3>{current.subject}</h3><small>{current.messageCount} message(s) · {current.participants.join(', ')}</small>
    </div>
    {detailsLoading&&<p>Loading conversation…</p>}
    {detailError&&<p role="alert" className="ss-email-error">{detailError}</p>}
    {details&&<div className="ss-email-messages">
     {details.messages.map(message=><article key={message.id} className="ss-email-message">
      <div><strong>{message.from}</strong><small>{new Date(message.date).toLocaleString()}</small></div>
      <small>To: {message.to||'Not provided'}</small>
      <pre>{message.text||'(No plain text message content)'}</pre>
     </article>)}
    </div>}
    <div className="ss-email-associations">
     <h4>Linked CRM records</h4>
     {activeLinks.length?activeLinks.map(item=>{
      const target=targetByKey.get(item.targetKind+':'+item.targetId);
      if(!target)return null;
      return <div key={item.id}>
       <button type="button" onClick={()=>followTarget(target)}>{target.title} ↗</button>
       {canWrite&&<button type="button" aria-label={'Unlink '+target.title}
        onClick={()=>unlink(item.id)}>Unlink</button>}
      </div>;
     }):<p>Not linked. Suggestions below are never linked automatically.</p>}
     {canWrite&&<div className="ss-email-link-controls">
      <label htmlFor="ss-email-target">Link to</label>
      <select id="ss-email-target" value={selectedTarget}
       onChange={e=>setSelectedTarget(e.target.value)}>
       <option value="">Choose Person or Deal</option>
       {suggestions.length>0&&<optgroup label="Suggested matches">
        {suggestions.map(s=><option key={s.kind+':'+s.id} value={s.kind+':'+s.id}>
         {s.title} · {s.reason}</option>)}
       </optgroup>}
       <optgroup label="All People">
        {targets.filter(t=>t.kind==='person').map(t=><option key={t.kind+':'+t.id}
         value={t.kind+':'+t.id}>{t.title}</option>)}
       </optgroup>
       <optgroup label="All Deals">
        {targets.filter(t=>t.kind==='deal').map(t=><option key={t.kind+':'+t.id}
         value={t.kind+':'+t.id}>{t.title}</option>)}
       </optgroup>
      </select>
      <button type="button" disabled={!selectedTarget} onClick={applyLink}>Link conversation</button>
     </div>}
    </div>
    {canWrite&&mailbox&&details?.summary.id===current.id&&
     <EmailActivityLogger363 key={current.id+'|'+mailbox+'|logger'}
      details={details} mailbox={mailbox} scope={expectedScope}
      contacts={contacts} companies={companies} deals={deals}
      suppressReplyHint={!!current&&!!currentGmailReviewDecision(current,reviewDecisions)}/>}
    {canWrite&&mailbox&&<EmailPersonCreate362
     key={current.id+'|'+mailbox} thread={current} mailbox={mailbox} contacts={contacts}
     companies={companies} scope={expectedScope} canWrite={canWrite}
     onCreated={openPerson} onOpen={openPerson}/>}
    </>}
   </section>
  </div>}
  <footer className="ss-email-disclaimer">
   Automatically matched Gmail conversations are NOT CRM Activities. Use Log email Activity only
   when you want to record a message; Create follow-up Task works independently. Message bodies and
   access tokens are not saved to CRM. Manual thread links are browser-local; saved Activities and
   private follow-up Tasks use normal SalesShop storage. Gmail stays read-only.
  </footer>
 </section>;
}
