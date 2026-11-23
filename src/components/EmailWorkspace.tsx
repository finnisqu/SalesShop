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
import {gmailAddressesInDetails395,gmailAddressFindings395,
 gmailThreadWithAddresses395,gmailEvidenceLabel395}
 from '../services/gmailBodyDiscovery395';
import {classifyGmailTriage,filterGmailTriage,gmailTriageCounts,
 mayNeedGmailReplyReview,type GmailTriageFilter} from '../services/gmailTriage367';
import {currentGmailReviewDecision,readGmailReviewDecisions,
 saveGmailReviewDecisions,withGmailReviewDecision,withBulkGmailReviewDecisions,
 type GmailReviewDecision,type GmailReviewKind} from '../services/gmailReview368';
import {canEditTeamArea} from '../services/teamDepartments';
import {useNavigationStore} from '../store/navigationStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useCrmStore} from '../store/crmStore';
import {rememberRecordsSection} from './RecordsSectionNav';
import {localDateKey} from '../services/salesCalendar';
import {gmailActivitySourceKey} from '../services/gmailActivity363';
import {gmailTriageWorkStatus,gmailTriageTaskLabel,
 type GmailTriageWorkStatus} from '../services/gmailTriageWork369';
import {DEFAULT_GMAIL_REVIEW_RULES,GMAIL_REVIEW_MIN_DAYS,GMAIL_REVIEW_MAX_DAYS,
 loadGmailReviewRules,storeGmailReviewRules,type GmailReviewRules}
 from '../services/gmailTriagePrefs370';
import {EmailPersonCreate362} from './EmailPersonCreate362';
import {EmailLinkPicker395} from './EmailLinkPicker395';
import {EmailActivityLogger363} from './EmailActivityLogger363';
import {GmailConnectionChecks388} from './GmailConnectionChecks388';
import './email-workspace.css';

function gmailBodyKey395(thread:GmailThreadSummary):string{
 return thread.latestMessageId??thread.messageCount+'|'+thread.date;
}
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
 const connectPersistent=useGmailSessionStore(s=>s.connectPersistent);
 const disconnectSaved=useGmailSessionStore(s=>s.disconnectSaved);
 const persistent=useGmailSessionStore(s=>s.persistent);
 const persistentConfigured=useGmailSessionStore(s=>s.persistentConfigured);
 const restoring=useGmailSessionStore(s=>s.restoring);
 const needsReconnect=useGmailSessionStore(s=>s.needsReconnect);
 const connectWithRedirect=useGmailSessionStore(s=>s.connectWithRedirect);
 const searchGmail=useGmailSessionStore(s=>s.search);
 const linkScope=useEmailThreadLinkStore(s=>s.scope);
 const storedLinks=useEmailThreadLinkStore(s=>s.links);
 const linkThread=useEmailThreadLinkStore(s=>s.link),unlinkThread=useEmailThreadLinkStore(s=>s.unlink);
 const dealPeople=useDealPeopleStore(s=>s.links),dealPeopleStoreScope=useDealPeopleStore(s=>s.scope);
 const [query,setQuery]=useState('newer_than:90d');
 const [triageFilter,setTriageFilter]=useState<GmailTriageFilter|'aside'|'followups'>('all');
 const [ruleStorage,setRuleStorage]=useState<{
  identity:string|null;rules:GmailReviewRules
 }>({identity:null,rules:{...DEFAULT_GMAIL_REVIEW_RULES}});
 const [messageFingerprints,setMessageFingerprints]=useState<{
  identity:string|null;
  rows:Record<string,{messageId:string;fingerprint:string}>;
 }>({identity:null,rows:{}});
 const [reviewStorage,setReviewStorage]=useState<{
  identity:string|null;decisions:GmailReviewDecision[]
 }>({identity:null,decisions:[]});
 const requestVersion=useRef(0);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [selectedTarget,setSelectedTarget]=useState('');
 const [details,setDetails]=useState<GmailThreadDetails|null>(null);
 const [personSeed,setPersonSeed]=useState('');
 const [bodyDiscovery,setBodyDiscovery]=useState<{
  identity:string|null;byId:Record<string,{key:string;addresses:string[]}>;
 }>({identity:null,byId:{}});
 const [bodyScan,setBodyScan]=useState({working:false,done:0,total:0});
 const bodyScanEpoch=useRef(0);
 const [detailError,setDetailError]=useState('');
 const [detailsLoading,setDetailsLoading]=useState(false);
 const [notice,setNotice]=useState('');
 const [emailAction,setEmailAction]=useState<'task'|'log'|'person'|'link'|null>(null);
 useEffect(()=>{
  if(!emailAction)return;
  const dismiss=(event:PointerEvent)=>{
   const target=event.target;
   if(target instanceof Element&&!target.closest('.ss-email-action-toolbar,.ss-email-action-popover'))
    setEmailAction(null);
  };
  document.addEventListener('pointerdown',dismiss);
  return()=>document.removeEventListener('pointerdown',dismiss);
 },[emailAction]);
 const openPerson=useNavigationStore(s=>s.openPerson),openDeal=useNavigationStore(s=>s.openProject);
 const canWrite=!!expectedScope&&!perspective&&canEditTeamArea(role,department,'crm');
 const ready=!!expectedScope&&!perspective&&expectedScope===sessionScope&&expectedScope===linkScope;
 const connected=ready&&!!validGmailToken(expectedScope);
 const links=ready?storedLinks:[];
 const reviewIdentity=connected&&expectedScope&&mailbox?
  expectedScope+'|'+mailbox.toLowerCase():null;
 const reviewDecisions=reviewStorage.identity===reviewIdentity?reviewStorage.decisions:[];
 const reviewRules=ruleStorage.identity===reviewIdentity
  ?ruleStorage.rules:DEFAULT_GMAIL_REVIEW_RULES;
 const taskRows=usePersonalTaskStore(s=>s.tasks);
 const taskStoreScope=usePersonalTaskStore(s=>s.scope);
 const crmActivities=useCrmStore(s=>s.activities);
 const crmHydrated=useCrmStore(s=>s.hydrated);
 const userTaskScope=taskScope(mode,org,user);
 const workIdentity=reviewIdentity&&org?reviewIdentity+'|'+org:null;
 const workReady=!!workIdentity&&!!userTaskScope&&taskStoreScope===userTaskScope&&crmHydrated;
 const matchedFingerprints=messageFingerprints.identity===workIdentity?messageFingerprints.rows:{};
 const threadWork=useMemo(()=>{
  const result=new Map<string,GmailTriageWorkStatus>();
  if(!workReady)return result;
  for(const thread of threads){
   const match=matchedFingerprints[thread.id];
   if(!match||!thread.latestMessageId||match.messageId!==thread.latestMessageId)continue;
   result.set(thread.id,gmailTriageWorkStatus(match.fingerprint,taskRows,crmActivities));
  }
  return result;
 },[threads,matchedFingerprints,taskRows,crmActivities,workReady]);
 const discoveryIdentity=expectedScope&&mailbox?expectedScope+'|'+mailbox:null;
 const matchingThreads=useMemo(()=>threads.map(thread=>{
  const cache=bodyDiscovery.identity===discoveryIdentity?
   bodyDiscovery.byId[thread.id]:undefined;
  return cache?.key===gmailBodyKey395(thread)?
   gmailThreadWithAddresses395(thread,cache.addresses.map(address=>({address}))):thread;
 }),[threads,bodyDiscovery,discoveryIdentity]);
 const current=matchingThreads.find(t=>t.id===activeId);
 const findings=useMemo(()=>details&&current&&mailbox&&
  details.summary.id===current.id&&
  gmailBodyKey395(details.summary)===gmailBodyKey395(current)?
  gmailAddressFindings395(details,contacts,mailbox):[],
  [details,current,contacts,mailbox]);
 const knownFindings=findings.filter(item=>item.people.length>0);
 const triage=useMemo(()=>{
  // Quoted historical addresses help identify People, but must NOT turn an
  // automated builder-platform notification into an inferred reply obligation.
  const headerOnly=classifyGmailTriage(threads,contacts,mailbox,Date.now(),reviewRules);
  const matched=classifyGmailTriage(matchingThreads,contacts,mailbox,Date.now(),reviewRules);
  return matched.map((item,index)=>({...item,reviewReply:headerOnly[index]?.reviewReply??false}));
 },[threads,matchingThreads,contacts,mailbox,reviewRules]);
 const triageCounts=useMemo(()=>{
  const count=gmailTriageCounts(triage);
  const active=triage.filter(item=>item.reviewReply&&
   !threadWork.get(item.thread.id)?.alreadyHandled&&
   !currentGmailReviewDecision(item.thread,reviewDecisions)).length;
  const aside=triage.filter(item=>item.reviewReply&&
   !!currentGmailReviewDecision(item.thread,reviewDecisions)).length;
  const followups=triage.filter(item=>threadWork.get(item.thread.id)?.outstanding).length;
  return {...count,review:active,aside,followups};
 },[triage,reviewDecisions,threadWork]);
 const shownTriage=useMemo(()=>{
  if(triageFilter==='aside')return triage.filter(item=>item.reviewReply&&
   !!currentGmailReviewDecision(item.thread,reviewDecisions));
  if(triageFilter==='followups')return triage.filter(item=>
   !!threadWork.get(item.thread.id)?.outstanding);
  if(triageFilter==='review')return triage.filter(item=>item.reviewReply&&
   !threadWork.get(item.thread.id)?.alreadyHandled&&
   !currentGmailReviewDecision(item.thread,reviewDecisions));
  return filterGmailTriage(triage,triageFilter);
 },[triage,triageFilter,reviewDecisions,threadWork]);
 const directLinks=dealPeopleStoreScope===dealPeopleScope(mode,org)?dealPeople:[];
 const suggestions=useMemo(()=>{
  if(!current)return [];
  const original=threads.find(item=>item.id===current.id);
  const headerKeys=new Set(original?
   emailTargetSuggestions(original,contacts,deals,directLinks)
    .map(item=>item.kind+':'+item.id):[]);
  return emailTargetSuggestions(current,contacts,deals,directLinks).map(item=>
   headerKeys.has(item.kind+':'+item.id)?item:{
    ...item,reason:'Possible match from quoted/forwarded content — confirm before linking',
   });
 },[current,threads,contacts,deals,directLinks]);
 const targets=useMemo<EmailTarget[]>(()=>[
  ...contacts.map(p=>({kind:'person' as const,id:p.id,title:p.name||p.email||'Unnamed Person'})),
  ...deals.map(d=>({kind:'deal' as const,id:d.id,title:d.name})),
 ],[contacts,deals]);
 const targetByKey=useMemo(()=>new Map(targets.map(t=>[t.kind+':'+t.id,t])),[targets]);
 const activeLinks=links.filter(row=>row.mailbox===mailbox&&row.threadId===activeId&&
  targetByKey.has(row.targetKind+':'+row.targetId));
 useEffect(()=>{
  setMessageFingerprints({identity:null,rows:{}});
  if(!workIdentity||!expectedScope||!org||!mailbox||!connected)return;
  const candidates=threads.filter(t=>!!t.latestMessageId);
  if(!candidates.length){setMessageFingerprints({identity:workIdentity,rows:{}});return;}
  let canceled=false;
  void Promise.all(candidates.map(async thread=>({
   threadId:thread.id,messageId:thread.latestMessageId!,
   fingerprint:await gmailActivitySourceKey(org,mailbox,thread.latestMessageId!),
  }))).then(items=>{
   if(canceled||validGmailToken(expectedScope)?.mailbox!==mailbox||
      useGmailSessionStore.getState().scope!==expectedScope)return;
   const rows:Record<string,{messageId:string;fingerprint:string}>={};
   for(const item of items)rows[item.threadId]={
    messageId:item.messageId,fingerprint:item.fingerprint,
   };
   setMessageFingerprints({identity:workIdentity,rows});
  }).catch(()=>{
   if(!canceled)setMessageFingerprints({identity:workIdentity,rows:{}});
  });
  return ()=>{canceled=true;};
 },[workIdentity,expectedScope,org,mailbox,connected,threads]);
 useEffect(()=>{
  if(!reviewIdentity||!expectedScope||!mailbox){
   setRuleStorage({identity:null,rules:{...DEFAULT_GMAIL_REVIEW_RULES}});return;
  }
  setRuleStorage({identity:reviewIdentity,
   rules:loadGmailReviewRules(expectedScope,mailbox)});
 },[reviewIdentity,expectedScope,mailbox]);
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
  ++bodyScanEpoch.current;
  setBodyDiscovery({identity:null,byId:{}});
  setBodyScan({working:false,done:0,total:0});
  setPersonSeed('');
  setActiveId(null);setDetails(null);setDetailError('');setSelectedTarget('');setNotice('');
  setTriageFilter('all');
 },[mailbox,expectedScope]);
 // The token popup is the primary connection because it works without the
 // optional server-side redirect secret. Keep redirect as an explicit fallback.
 const connectRedirect=async()=>{
  setNotice('');
  await connectWithRedirect();
 };
 const connectPopup=async()=>{
  setNotice('');
  try{
   if(useGmailSessionStore.getState().persistentConfigured){
    // Persistent GIS code popup is selected only after the Worker readiness
    // check has completed. Never await a network probe before requestCode().
    await connectPersistent();
   }else{
    // Preserve the proven temporary token popup as a safe fallback while
    // #396 secrets and staged SQL are not enabled on the Worker.
    await connect();
    await useGmailSessionStore.getState().search(query);
   }
  }catch{/* The Gmail session store displays the authorization failure. */}
 };
 const disconnectAccount=async()=>{
  try{
   if(persistent){
    await disconnectSaved();
   }else disconnect();
   setNotice('Gmail authorization disconnected.');
  }catch(e){
   setNotice(e instanceof Error?e.message:'Could not disconnect Gmail.');
  }
 };
 const runSearch=(searchQuery:string)=>{
  if(!connected||loading)return;
  ++bodyScanEpoch.current;
  setBodyScan({working:false,done:0,total:0});
  setQuery(searchQuery);
  requestVersion.current+=1;
  setActiveId(null);setDetails(null);setDetailError('');setDetailsLoading(false);
  setSelectedTarget('');
  void searchGmail(searchQuery);
 };
 const findThreads=(event:FormEvent)=>{
  event.preventDefault();
  runSearch(query);
 };
 const updateReviewRules=(change:Partial<GmailReviewRules>)=>{
  const session=validGmailToken(expectedScope);
  if(!session||!expectedScope||!mailbox||session.mailbox!==mailbox||
   !reviewIdentity){setNotice('Reconnect Gmail before changing your review settings.');return;}
  try{
   const next=storeGmailReviewRules(expectedScope,mailbox,{...reviewRules,...change});
   setRuleStorage({identity:reviewIdentity,rules:next});
   setNotice('Personal Gmail review settings saved in this browser.');
  }catch(error){
   setNotice(error instanceof Error?error.message:'Could not save Gmail settings.');
  }
 };
 const changeTriage=(next:GmailTriageFilter|'aside'|'followups')=>{
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
  if(kind!==null&&(!mayNeedGmailReplyReview(thread,mailbox,Date.now(),reviewRules)||
   (reviewRules.knownOnly&&!triage.some(item=>item.thread.id===thread.id&&
    item.people.length>0)))){
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
 const bulkReview=(kind:GmailReviewKind)=>{
  if(!connected||loading||triageFilter!=='review'||!expectedScope||!mailbox||
   !reviewIdentity)return;
  const candidates=shownTriage.filter(item=>item.reviewReply&&
   !threadWork.get(item.thread.id)?.alreadyHandled&&
   !currentGmailReviewDecision(item.thread,reviewDecisions));
  if(!candidates.length)return;
  if(candidates.length>400){
   setNotice('Too many conversations loaded for one batch. Narrow your Gmail search first.');return;
  }
  const title=kind==='reviewed'?'Mark reviewed':'Snooze for 3 days';
  if(!window.confirm(title+' for '+candidates.length+
    ' visible conversation(s)? This will only change your private SalesShop review list.'))return;
  const active=validGmailToken(expectedScope),live=useGmailSessionStore.getState();
  if(!active||active.mailbox!==mailbox||live.scope!==expectedScope||
   candidates.some(item=>!live.threads.some(row=>row.id===item.thread.id&&
    row.date===item.thread.date))){
   setNotice('Gmail data changed. Search again before using batch review actions.');return;
  }
  try{
   const next=withBulkGmailReviewDecisions(
    readGmailReviewDecisions(expectedScope,mailbox),candidates.map(item=>item.thread),
    kind,Date.now());
   saveGmailReviewDecisions(expectedScope,mailbox,next);
   setReviewStorage({identity:reviewIdentity,decisions:next});
   setNotice(kind==='reviewed'?
    candidates.length+' visible conversations marked reviewed.':
    candidates.length+' visible conversations snoozed for three days (no reminders scheduled).');
   requestVersion.current+=1;
   setActiveId(null);setDetails(null);setDetailError('');setDetailsLoading(false);
  }catch(error){
   setNotice(error instanceof Error?error.message:'Could not save batch review choices.');
  }
 };
 const showThread=async(id:string)=>{
  const request=++requestVersion.current;
  setActiveId(id);setDetails(null);setDetailError('');setDetailsLoading(true);setEmailAction(null);
  setSelectedTarget('');setPersonSeed('');
  const session=validGmailToken(expectedScope);
  if(!session){
   setDetailsLoading(false);setDetailError('Reconnect Gmail to read this conversation.');return;
  }
  try{
   const result=await gmailThreadDetails(session.token,id);
   if(request===requestVersion.current&&validGmailToken(expectedScope)?.token===session.token&&
    useGmailSessionStore.getState().scope===expectedScope){
    setDetails(result);
    const thread=threads.find(t=>t.id===id);
    if(thread&&gmailBodyKey395(thread)===gmailBodyKey395(result.summary)&&
     discoveryIdentity){
     const addresses=gmailAddressesInDetails395(result,session.mailbox)
      .map(item=>item.address);
     setBodyDiscovery(previous=>({
      identity:discoveryIdentity,byId:{
       ...(previous.identity===discoveryIdentity?previous.byId:{}),
       [id]:{key:gmailBodyKey395(thread),addresses},
      },
     }));
    }
   }
  }catch(e){
   if(request===requestVersion.current)
    setDetailError(e instanceof Error?e.message:'Could not read this conversation.');
  }finally{
   if(request===requestVersion.current)setDetailsLoading(false);
  }
 };
 const scanLoadedBodies=async()=>{
  const session=validGmailToken(expectedScope);
  if(!session||!discoveryIdentity||bodyScan.working||!threads.length)return;
  const pending=threads.filter(thread=>{
   const cache=bodyDiscovery.identity===discoveryIdentity?
    bodyDiscovery.byId[thread.id]:undefined;
   return cache?.key!==gmailBodyKey395(thread);
  });
  if(!pending.length){setNotice('Loaded conversations have already been scanned.');return;}
  const epoch=++bodyScanEpoch.current;
  setBodyScan({working:true,done:0,total:pending.length});
  let completed=0,failed=0;
  for(let i=0;i<pending.length;i+=2){
   const batch=await Promise.all(pending.slice(i,i+2).map(async thread=>{
    try{return {thread,details:await gmailThreadDetails(session.token,thread.id)};}
    catch{return {thread,details:null};}
   }));
   if(bodyScanEpoch.current!==epoch||
    validGmailToken(expectedScope)?.token!==session.token||
    useGmailSessionStore.getState().scope!==expectedScope)return;
   const found:Record<string,{key:string;addresses:string[]}>={};
   for(const item of batch){
    if(!item.details||
     gmailBodyKey395(item.details.summary)!==gmailBodyKey395(item.thread)){
     failed++;continue;
    }
    found[item.thread.id]={
     key:gmailBodyKey395(item.thread),
     addresses:gmailAddressesInDetails395(item.details,session.mailbox)
      .map(address=>address.address),
    };
   }
   setBodyDiscovery(previous=>({
    identity:discoveryIdentity,byId:{
     ...(previous.identity===discoveryIdentity?previous.byId:{}),...found,
    },
   }));
   completed+=batch.length;
   setBodyScan({working:true,done:completed,total:pending.length});
  }
  setBodyScan({working:false,done:completed,total:pending.length});
  setNotice('Checked '+(completed-failed)+' loaded conversation(s) for quoted addresses.'+
   (failed?' '+failed+' could not be read.':'')+
   ' Matches remain private to this browser session.');
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
 const openTasks=()=>{
  rememberRecordsSection('tasks');
  useNavigationStore.getState().setView('dashboard');
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
    <span>{connected?'Connected: '+mailbox+(persistent?' · Auto-renewing':' · Session only'):
     restoring?'Checking saved Gmail connection…':
     status==='connecting'?'Waiting for Google authorization…':
     needsReconnect?'Gmail needs reconnection':'No Gmail connected'}</span>
    {connected?<button type="button" onClick={()=>{void disconnectAccount();}}>
     Disconnect</button>:<>
     <button type="button" disabled={!ready||!gmailClientId||status==='connecting'||restoring}
      title={persistentConfigured?'Connect Gmail with saved authorization':
       'Connect Gmail with a temporary Google popup'}
      onClick={()=>{void connectPopup();}}>Connect Gmail</button>
     <button type="button" disabled={!ready||!gmailClientId||status==='connecting'||restoring}
      title="Alternative full-page OAuth redirect (requires Cloudflare Worker configuration)"
      onClick={()=>{void connectRedirect();}}>Try redirect instead</button>
    </>}
   </div>
   {connected&&<>
    <form onSubmit={findThreads} className="ss-email-search">
     <label htmlFor="ss-email-query">Gmail search</label>
     <input id="ss-email-query" value={query} maxLength={180}
      onChange={e=>setQuery(e.target.value)} placeholder="from:customer@example.com or newer_than:90d"/>
     <button type="submit" disabled={loading}>Search</button>
    </form>
    <div className="ss-email-shortcuts">
     <label htmlFor="ss-email-quick-search">Quick searches</label>
     <select id="ss-email-quick-search" value="" disabled={loading}
      onChange={event=>{if(event.target.value)runSearch(event.target.value);}}>
      <option value="">Choose a Gmail search…</option>
      <option value="newer_than:7d">Last 7 days</option>
      <option value="newer_than:30d">Last 30 days</option>
      <option value="newer_than:90d">Last 90 days</option>
      <option value="in:sent newer_than:90d">Sent in last 90 days</option>
     </select>
    </div>
    <details className="ss-email-review-settings">
     <summary>Review settings</summary>
     <div className="ss-email-review-settings-fields">
      <label>Review messages older than
       <select value={reviewRules.minDays} onChange={event=>
        updateReviewRules({minDays:Number(event.target.value)})}>
        {GMAIL_REVIEW_MIN_DAYS.map(days=><option value={days} key={days}>
         {days} {days===1?'day':'days'}</option>)}
       </select>
      </label>
      <label>And newer than
       <select value={reviewRules.maxDays} onChange={event=>
        updateReviewRules({maxDays:Number(event.target.value)})}>
        {GMAIL_REVIEW_MAX_DAYS.map(days=><option value={days} key={days}>
         {days} days</option>)}
       </select>
      </label>
      <label className="ss-email-review-known-only">
       <input type="checkbox" checked={reviewRules.knownOnly}
        onChange={event=>updateReviewRules({knownOnly:event.target.checked})}/>
       Only suggest replies involving existing CRM People
      </label>
     </div>
     <p>Personal browser preferences for this Gmail mailbox. No email logging,
      notifications, automatic Tasks, or Gmail changes.</p>
    </details>
   </>}
  </div>
  {error&&<div className="ss-email-error" role="alert">
   <strong>Gmail connection not completed</strong>
   <p>{error}</p>
   <small>When persistent storage is enabled, the Google popup uses server-side
    OAuth and encrypted, per-user refresh credentials. Otherwise it uses the
    temporary browser popup. The legacy redirect requires a separate Worker
    OAuth configuration. No messages were imported on this failed attempt.</small>
  </div>}
  {error&&<GmailConnectionChecks388/>}
  {notice&&<p className="ss-email-notice" role="status">{notice}</p>}
  {connected&&<div className="ss-email-content">
   <div className="ss-email-threads" role="region" aria-label="Gmail search results">
    <h3>Conversations <small>{shownTriage.length} shown · {threads.length} loaded</small></h3>
    <div className="ss-email-body-scan">
     <button type="button" disabled={bodyScan.working||loading||!connected||!threads.length}
      onClick={()=>{void scanLoadedBodies();}}>
      {bodyScan.working?'Checking messages…':'Find People in message contents'}
     </button>
     <small>{bodyScan.working?
      bodyScan.done+' / '+bodyScan.total+' conversations checked':
      'Optional: checks loaded message bodies and forwarded chains for known CRM People. Gmail stays read-only.'}</small>
    </div>
    <div className="ss-email-triage-tabs" role="group" aria-label="Email triage filters">
     {([{id:'all',title:'All',count:triageCounts.all},
       {id:'review',title:'Review replies',count:triageCounts.review},
       {id:'followups',title:'Follow-ups',count:triageCounts.followups},
       {id:'aside',title:'Set aside',count:triageCounts.aside},
       {id:'known',title:'Existing People',count:triageCounts.known},
       {id:'new',title:'Unknown participants',count:triageCounts.new}] as const).map(item=>
      <button type="button" key={item.id} className="ss-email-triage-tab"
       aria-pressed={triageFilter===item.id} onClick={()=>changeTriage(item.id)}>
       {item.title} <small>{item.count}</small>
      </button>)}
    </div>
    <details className="ss-email-filter-hints"><summary>About filters</summary><p className="ss-email-triage-note">
     Filters cover loaded conversations only. Reply review: {reviewRules.minDays}–{reviewRules.maxDays}
     days old{reviewRules.knownOnly?', existing CRM People only':''}. These are
     candidate replies, not confirmed unanswered messages. Tasks, reviewed and snoozed
     conversations stay in their separate views.
    </p></details>
    <div className="ss-email-list-columns" aria-hidden="true"><span>Subject</span><span>Correspondents</span><span>Date</span></div>
    <div className="ss-email-thread-list" role="list">
    {triageFilter==='review'&&shownTriage.length>1&&
     <details className="ss-email-bulk-triage">
      <summary>Batch actions · {shownTriage.length} visible</summary>
      <div>
       <button type="button" disabled={loading} onClick={()=>bulkReview('reviewed')}>
        Mark visible reviewed</button>
       <button type="button" disabled={loading} onClick={()=>bulkReview('snoozed')}>
        Snooze visible 3 days</button>
      </div>
      <small>Confirmation required. Only loaded conversations currently shown in Review replies.</small>
     </details>}
    {loading&&!threads.length&&<p>Reading Gmail…</p>}
    {!loading&&!threads.length&&<p className="ss-email-empty">No conversations match. Try another search.</p>}
    {!loading&&threads.length>0&&!shownTriage.length&&
     <p className="ss-email-empty">No loaded conversations match this filter. Try All or load more.</p>}
    {shownTriage.map(({thread:t,people,unknownAddresses,reviewReply})=>{
     const linked=links.filter(l=>l.threadId===t.id&&l.mailbox===mailbox).length;
     const reviewDecision=reviewReply?currentGmailReviewDecision(t,reviewDecisions):null;
     const work=threadWork.get(t.id);
     return <div key={t.id} className="ss-email-thread-row" role="listitem">
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
         'Snoozed until '+new Date(reviewDecision.until!).toLocaleDateString():
         work?.alreadyHandled?'Follow-up tracked':'Review reply'):''}
        {work?.task?' · '+gmailTriageTaskLabel(work.task,localDateKey(new Date())):''}
        {work?.activity?' · Activity logged':''}
       </small>
       <p>{t.snippet}</p>
      </button>
      {(reviewReply||work?.task)&&
       <div className="ss-email-triage-row-actions" aria-label="Review conversation">
        {work?.task&&<button type="button" onClick={openTasks}>View in Tasks</button>}
        {reviewReply&&(reviewDecision?
         <button type="button" disabled={!connected} onClick={()=>saveReview(t,null)}>
          Resume review</button>:!work?.alreadyHandled?<>
          <button type="button" disabled={!connected} onClick={()=>saveReview(t,'reviewed')}>
           Mark reviewed</button>
          <button type="button" disabled={!connected} onClick={()=>saveReview(t,'snoozed')}>
           Snooze 3 days</button>
         </>:null)}
       </div>}
     </div>;
    })}
    {nextPage&&<button type="button" disabled={loading} className="ss-email-more"
      onClick={()=>{void searchGmail(query,nextPage);}}>Load more conversations</button>}
    </div>
   </div>
   <section className="ss-email-detail" aria-label="Selected conversation">
    {!activeId&&<div className="ss-email-empty">Choose a conversation to read messages and link it to a record.</div>}
    {current&&<><div className="ss-email-detail-heading">
     <h3>{current.subject}</h3><small>{current.messageCount} message(s) · {current.participants.join(', ')}</small>
    </div>
    {details?.summary.id===current.id&&<div className="ss-email-found-addresses">
     {knownFindings.length>0&&<div className="ss-email-known-people">
      <strong>Recognized People in this conversation</strong>
      <div>{knownFindings.flatMap(item=>item.people.map(person=>
       <button type="button" key={item.address+'|'+person.id}
        title={item.address+' · '+gmailEvidenceLabel395(item.evidence)}
        onClick={()=>openPerson(person.id)}>
        {person.name||person.email} <small>{item.address}</small>
       </button>))}</div>
     </div>}
     <details>
      <summary>Detected email addresses · {findings.length}</summary>
      <p>Includes Reply-To and quoted or forwarded content. These addresses may
       belong to third parties or be outdated; no links or People are created automatically.</p>
      <div className="ss-email-found-list">
       {findings.map(item=><div key={item.address}>
        <span><strong>{item.address}</strong>
         <small>{gmailEvidenceLabel395(item.evidence)}
          {item.people.length?' · Existing CRM Person':' · Not in CRM'}</small>
        </span>
        {item.people.length?item.people.map(person=><button type="button" key={person.id}
         onClick={()=>openPerson(person.id)}>Open {person.name||'Person'}</button>):
         canWrite&&<button type="button" onClick={()=>{
          setPersonSeed(item.address);setEmailAction('person');
         }}>+ Create Person</button>}
       </div>)}
       {!findings.length&&<p>No usable external email addresses detected.</p>}
      </div>
     </details>
    </div>}
    <div className="ss-email-action-toolbar" role="toolbar" aria-label="Gmail CRM actions">
     <span>CRM actions</span>
     {([['task','New task'],['log','Log Activity'],['person','Create Person'],['link','Link record']] as const).map(([id,label])=>
      <button type="button" key={id} disabled={!canWrite||((id==='task'||id==='log')&&details?.summary.id!==current.id)}
       aria-expanded={emailAction===id} aria-pressed={emailAction===id}
       onClick={()=>{
        if(id==='person')setPersonSeed('');
        setEmailAction(emailAction===id?null:id);
       }}>{label}</button>)}
    </div>
    {emailAction&&<div className="ss-email-action-popover" role="dialog" aria-modal="false"
     aria-label={'Email '+emailAction+' actions'}
     onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setEmailAction(null);}}}>
     <header><strong>{emailAction==='task'?'Follow-up task':emailAction==='log'?'Log email Activity':
      emailAction==='person'?'Create CRM Person':'Linked records'}</strong>
      <button type="button" aria-label="Close email actions" onClick={()=>setEmailAction(null)}>×</button></header>
     <div className="ss-email-action-content">
      {emailAction==='link'?<>
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
      <EmailLinkPicker395
       key={current.id+'|'+mailbox} thread={current}
       details={details?.summary.id===current.id?details:null}
       mailbox={mailbox??''} scope={expectedScope}
       contacts={contacts} companies={companies} deals={deals}
       suggestions={suggestions} selectedTarget={selectedTarget}
       onSelect={setSelectedTarget} onOpenPerson={openPerson} canWrite={canWrite}/>
      <button type="button" disabled={!selectedTarget} onClick={applyLink}>
       Link conversation</button>
     </div>}
    </div>
    
      </>:emailAction==='person'?<>
{canWrite&&mailbox&&<EmailPersonCreate362
     key={current.id+'|'+mailbox+'|'+personSeed} thread={current}
     details={details?.summary.id===current.id?details:null}
     initialAddress={personSeed||undefined}
     mailbox={mailbox} contacts={contacts}
     companies={companies} scope={expectedScope} canWrite={canWrite}
     onCreated={id=>{setNotice('Person created in CRM. You can continue working in this email.');setEmailAction(null);setPersonSeed('');}} onOpen={openPerson}/>}

      </>:<>
{canWrite&&mailbox&&details?.summary.id===current.id&&
     <EmailActivityLogger363 key={current.id+'|'+mailbox+'|logger'}
      details={details} mailbox={mailbox} scope={expectedScope}
      contacts={contacts} companies={companies} deals={deals}
      suppressReplyHint={!!current&&(
       !!currentGmailReviewDecision(current,reviewDecisions)||
       !!threadWork.get(current.id)?.alreadyHandled||
       (reviewRules.knownOnly&&!triage.some(item=>item.thread.id===current.id&&item.people.length>0)))}
      reviewRules={reviewRules} defaultLogOpen={emailAction==='log'}/>}
    
      </>}
     </div>
    </div>}
    {detailsLoading&&<p>Loading conversation…</p>}
    {detailError&&<p role="alert" className="ss-email-error">{detailError}</p>}
    {details&&<div className="ss-email-messages">
     {details.messages.map(message=><article key={message.id} className="ss-email-message">
      <div><strong>{message.from}</strong><small>{new Date(message.date).toLocaleString()}</small></div>
      <small>To: {message.to||'Not provided'}</small>
      <pre>{message.text||'(No plain text message content)'}</pre>
     </article>)}
    </div>}
    </>}
   </section>
  </div>}
  <details className="ss-email-disclaimer"><summary>Email privacy and storage</summary><p>
   Automatically matched Gmail conversations are NOT CRM Activities. Use Log email Activity only
   when you want to record a message; Create follow-up Task works independently. Message bodies and
   access tokens are not saved to CRM. Manual thread links are browser-local; saved Activities and
   private follow-up Tasks use normal SalesShop storage. Gmail stays read-only.
  </p></details>
 </section>;
}
