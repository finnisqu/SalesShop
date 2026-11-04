import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {TaskAssociationsField} from './TaskAssociationsField';
import {usePersonalTaskStore,taskScope,normalizedTaskAssociations,
 type TaskAssociation,type TaskLink} from '../store/personalTaskStore';
import {completedTaskActivityId,taskActivityMethod,type ActivityComposerRequest}
 from '../services/taskActivityWorkflow';
import {localDateKey} from '../services/salesCalendar';
import {draftStorageKey,readSavedDraft,writeSavedDraft,clearSavedDraft} from '../services/draftRecovery';
import './sales-calendar.css';

type Method='email'|'call'|'text'|'video-call'|'in-person';
interface ActivityDraft {
 open:boolean;method:Method;notes:string;occurred:string;links:TaskAssociation[];
 createFollowUp?:boolean;followUpDate?:string;workflowTaskId?:string|null;
}
const methods:ReadonlyArray<{id:Method;label:string}>=[
 {id:'call',label:'Call'},{id:'email',label:'Email'},
 {id:'text',label:'Text'},{id:'video-call',label:'Video call'},
 {id:'in-person',label:'In person'},
];
/** Explicit vector artwork renders identically across Apple, Android and desktop,
 * unlike Unicode symbols that vary by system font. */
function ActivityMethodIcon({method}:{method:Method}){
 return <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
   stroke="currentColor" strokeWidth="1.85" strokeLinecap="round"
   strokeLinejoin="round" aria-hidden="true">
  {method==='call'?<path d="M5 3h3l2.1 5.2-2.3 2.1a16 16 0 0 0 6 6l2.1-2.3L21 16v3.1a2 2 0 0 1-2.2 2C10.6 20.4 3.6 13.4 3 5.2A2 2 0 0 1 5 3Z"/>:
   method==='email'?<><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></>:
   method==='text'?<path d="M20.5 16a3 3 0 0 1-3 3H9l-5.5 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v10ZM7 9h10M7 13h7"/>:
   method==='video-call'?<><rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3"/></>:
   <><circle cx="9" cy="7.5" r="3"/><path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2M17 6a3 3 0 0 1 0 6M19 15a5 5 0 0 1 2.5 4.5"/></>}
 </svg>;
}
const tomorrowKey=()=>{
 const date=new Date();date.setDate(date.getDate()+1);return localDateKey(date);
};
const dateTimeLocal=()=>{
 const now=new Date();return localDateKey(now)+'T'+[now.getHours(),now.getMinutes()]
  .map(n=>String(n).padStart(2,'0')).join(':');
};
const primaryName=(associations:TaskAssociation[])=>{
 const person=associations.find(x=>x.type==='contact');
 return (person??associations[0])?.label?.replace(/^(Quote|Deal|Company|Person) · /,'');
};
interface ActivityLauncherProps {label?:string;compact?:boolean;tile?:boolean;headless?:boolean;}
/** Scope the form component by account so drafts cannot leak across company/user switches. */
export function QuickActivityLauncher(props:ActivityLauncherProps){
 const mode=useAuthStore(s=>s.mode),orgId=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const draftKey=draftStorageKey('activity',mode,orgId,userId);
 return <ActivityLauncherInner key={draftKey??'no-account'} {...props} draftKey={draftKey}/>;
}
function ActivityLauncherInner({label='Log Activity',compact=false,tile=false,headless=false,draftKey}:
 ActivityLauncherProps&{draftKey:string|null}){
 const mode=useAuthStore(s=>s.mode),role=useAuthStore(s=>s.teamRole);
 const department=useAuthStore(s=>s.teamDepartment);
 const currentUser=useAuthStore(s=>s.user?.id);
 const saved=useMemo(()=>readSavedDraft<ActivityDraft>(draftKey),[draftKey]);
 const [open,setOpen]=useState(()=>saved?.open??false);
 const [method,setMethod]=useState<Method>(()=>saved?.method??'call');
 const [notes,setNotes]=useState(()=>saved?.notes??'');
 const [occurred,setOccurred]=useState(()=>saved?.occurred??dateTimeLocal());
 const [links,setLinks]=useState<TaskAssociation[]>(()=>saved?.links??[]);
 const [createFollowUp,setCreateFollowUp]=useState(()=>saved?.createFollowUp??false);
 const [followUpDate,setFollowUpDate]=useState(()=>saved?.followUpDate??tomorrowKey());
 const [workflowTaskId,setWorkflowTaskId]=useState<string|null>(()=>saved?.workflowTaskId??null);
 const [error,setError]=useState('');
 const storedTaskScope=usePersonalTaskStore(s=>s.scope);
 const addTask=usePersonalTaskStore(s=>s.createTask);
 const completeTask=usePersonalTaskStore(s=>s.complete);
 const [saving,setSaving]=useState(false);
 const orgId=useAuthStore(s=>s.organizationId);
 useEffect(()=>{
  if(!draftKey)return;
  // Save even while hidden so a browser tab discard or automatic reload cannot lose the form.
  if(open||notes.trim()||links.length)
   writeSavedDraft(draftKey,{open,method,notes,occurred,links,createFollowUp,followUpDate,workflowTaskId});
 },[draftKey,open,method,notes,occurred,links,createFollowUp,followUpDate,workflowTaskId]);
 useEffect(()=>{
  const openForDate=(event:Event)=>{
   const request=(event as CustomEvent<ActivityComposerRequest>).detail??{};
   const day=request.date;
   if(request.taskId){
    const tasks=usePersonalTaskStore.getState();
    const current=tasks.tasks.find(t=>t.id===request.taskId&&!t.deletedAt);
    if(tasks.scope!==taskScope(mode,orgId,currentUser)||!current||
       current.status==='completed'||current.status==='canceled'){
     setError('This task is no longer available for completion.');return;
    }
    if((notes.trim()||links.length||workflowTaskId)&&
      !window.confirm('Replace your unfinished Activity draft with this task-linked interaction?'))return;
    setWorkflowTaskId(current.id);
    setMethod(taskActivityMethod(current));
    setLinks(normalizedTaskAssociations(current).filter(link=>link.type!=='notebook'));
    setNotes('');setOccurred(dateTimeLocal());
    setCreateFollowUp(false);setFollowUpDate(tomorrowKey());
    setError('');
   }else{
    // Normal Home/Calendar logging must never complete a previously selected task.
    if(request.associations?.length){
     if((notes.trim()||links.length||workflowTaskId)&&
      !window.confirm('Replace your unfinished Activity draft with this related-record interaction?'))return;
     setLinks(request.associations);setNotes('');setMethod('call');
     setCreateFollowUp(false);setFollowUpDate(tomorrowKey());
     setOccurred(dateTimeLocal());
    }else if(workflowTaskId&&
      !window.confirm('Start a separate Activity instead of finishing your task-linked draft?'))return;
    setWorkflowTaskId(null);
    if(day&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&day<=localDateKey(new Date()))
      setOccurred(day+'T'+dateTimeLocal().slice(11));
   }
   setOpen(true);
  };
  window.addEventListener('salesshop:open-activity',openForDate);
  return()=>window.removeEventListener('salesshop:open-activity',openForDate);
 },[mode,orgId,currentUser,notes,links,workflowTaskId]);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const companies=useCrmStore(s=>s.companies),contacts=useCrmStore(s=>s.contacts);
 const projects=useCrmStore(s=>s.projects);
 const record=useCrmStore(s=>s.recordActivity);
 const quotes=useQuoteStore(s=>s.quotes);
 const permitted=!perspective&&(mode==='local'||canEditTeamArea(role,department,'crm'));
 const options=useMemo(()=>[
  ...contacts.map(c=>({key:'contact:'+c.id,linked:{type:'contact' as const,id:c.id,label:'Person · '+c.name},label:'Person · '+c.name})),
  ...companies.map(c=>({key:'company:'+c.id,linked:{type:'company' as const,id:c.id,label:'Company · '+c.name},label:'Company · '+c.name})),
  ...projects.map(d=>({key:'project:'+d.id,linked:{type:'project' as const,id:d.id,label:'Deal · '+d.name},label:'Deal · '+d.name})),
  ...quotes.filter(q=>!q.archivedAt&&(mode!=='cloud'||q.ownerUserId===currentUser))
    .map(q=>({key:'quote:'+q.id,linked:{type:'quote' as const,id:q.id,label:'Quote · '+q.title},label:'Quote · '+q.title})),
 ],[contacts,companies,projects,quotes,mode,currentUser]);
 const close=()=>{setOpen(false);setError('');};
 const discard=()=>{
  clearSavedDraft(draftKey);
  setMethod('call');setNotes('');setLinks([]);setOccurred(dateTimeLocal());
  setCreateFollowUp(false);setFollowUpDate(tomorrowKey());
  setWorkflowTaskId(null);
  close();
 };
 const addLinks=(items:TaskAssociation[])=>{
  // The normalized columns keep the primary link of each kind, while metadata
  // retains every explicitly linked person, deal, company and quote.
  const seen=new Set<string>();
  setLinks(items.filter(link=>{
   const key=link.type+':'+link.id;
   if(seen.has(key))return false;
   seen.add(key);return true;
  }));
 };
 const submit=(event:FormEvent)=>{
  event.preventDefault();
  if(saving)return;
  setError('');
  if(!permitted)return setError('Your role cannot log shared CRM interactions.');
  const person=primaryName(links);
  const fallback=methods.find(x=>x.id===method)?.label||'Interaction';
  if(!links.some(link=>link.type!=='notebook'))return setError('Link at least one person, company, deal, or quote.');
  const timestamp=new Date(occurred);
  if(!occurred||!Number.isFinite(timestamp.getTime()))return setError('Choose a valid date and time.');
  if(timestamp.getTime()>Date.now()+60000)return setError('Completed interactions cannot be dated in the future. Create a task or follow-up instead.');
  if(createFollowUp&&(!/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)||followUpDate<localDateKey(new Date())))
   return setError('Choose today or a future date for the follow-up task.');
  if(createFollowUp&&storedTaskScope!==taskScope(mode,orgId,currentUser))
   return setError('Your personal tasks are still loading; please try saving again.');
  const privateScope=taskScope(mode,orgId,currentUser);
  const taskState=usePersonalTaskStore.getState();
  const workflowTask=workflowTaskId?taskState.tasks.find(t=>t.id===workflowTaskId&&!t.deletedAt):null;
  if(workflowTaskId&&(!workflowTask||taskState.scope!==privateScope||
    workflowTask.status==='completed'||workflowTask.status==='canceled'))
   return setError('The linked task has changed. Reopen its Quick View and try again.');
  const find=(kind:TaskLink['type'])=>links.find(link=>link.type===kind)?.id;
  const personId=find('contact'),dealId=find('project'),quoteId=find('quote');
  const contact=contacts.find(c=>c.id===personId),deal=projects.find(d=>d.id===dealId);
  const quote=quotes.find(q=>q.id===quoteId);
  const activityId=workflowTaskId
   ?completedTaskActivityId(workflowTaskId,privateScope??'local:user'):undefined;
  const existing=activityId?useCrmStore.getState().activities.find(a=>a.id===activityId):undefined;
  // A browser discard between logging and Task completion can retry without
  // making two Activities for the same completion.
  setSaving(true);
  try{
  const loggedId=existing?.id??record({id:activityId,
   type:'manual-touchpoint',summary:fallback+' with '+(person||'related record'),
   companyId:find('company')||contact?.companyId||deal?.companyId||quote?.companyId,
   contactId:personId,projectId:dealId||quote?.projectId,quoteId,
   occurredAt:timestamp.toISOString(),
   metadata:{source:'manual',interactionMethod:method,
    relatedRecords:links.filter(link=>link.type!=='notebook').map(link=>({
     type:link.type as 'contact'|'company'|'project'|'quote',id:link.id,label:link.label,
    })),
    notes:notes.trim().slice(0,5000)||undefined,
    completedTaskId:workflowTaskId??undefined}});
  if(createFollowUp){
   const already=usePersonalTaskStore.getState().tasks.some(t=>
    !t.deletedAt&&t.sourceObjectId==='activity-followup:'+loggedId);
   if(!already){
   const created=addTask('Follow up · '+(person||'related record'),{
    type:'follow-up',dueDate:followUpDate,priority:'normal',status:'open',
    queue:'Follow-ups',associations:links,
    sourceObjectId:'activity-followup:'+loggedId,
    notes:'Follow-up from '+fallback.toLowerCase()+' on '+localDateKey(timestamp)+
     (notes.trim()?' · '+notes.trim().slice(0,300):''),
   });
   if(!created)throw new Error('Activity was logged, but the follow-up could not be created. Retry to finish safely.');
   }
  }
  if(workflowTaskId)completeTask(workflowTaskId);
  clearSavedDraft(draftKey);
  setMethod('call');setNotes('');setOccurred(dateTimeLocal());
  setCreateFollowUp(false);setFollowUpDate(tomorrowKey());
  setWorkflowTaskId(null);setLinks([]);close();
  }catch(error){
   setError(error instanceof Error?error.message:'Could not finish this activity. Please retry.');
  }finally{setSaving(false);}
 };
 if(!permitted)return null;
 return <>
  {!headless&&<button type="button" className={'sales-log-launcher'+(compact?' is-compact':'')+(tile?' is-tile':'')}
   onClick={()=>{setOpen(true);}}>
   {tile&&<span aria-hidden="true">◉</span>}{tile?<><strong>{label}</strong><small>Call, email or meeting</small></>:label}
  </button>}
  {open&&createPortal(<div className="sales-activity-backdrop" onPointerDown={e=>{
    if(e.target===e.currentTarget)close();
   }}>
   <form role="dialog" aria-modal="true" aria-label="Log Activity" className="sales-activity-dialog"
    onSubmit={submit} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
    <header><div><small>CRM · Completed interaction</small><h2>{workflowTaskId?'Log & complete task':'Log Activity'}</h2></div>
      <button type="button" onClick={close} aria-label="Close Log Activity">×</button></header>
    <div className="sales-activity-form-body">
     {workflowTaskId&&<p className="sales-activity-task-context">
      <strong>Task-linked interaction</strong>
      <span>Saving this Activity will mark the original task complete. Related records are prefilled; schedule another follow-up below if needed.</span>
     </p>}
     <div className="sales-activity-methods" role="group" aria-label="Interaction method">
      {methods.map(item=><button type="button" key={item.id} aria-pressed={method===item.id}
       onClick={()=>setMethod(item.id)}>
       <span className="sales-activity-method-icon"><ActivityMethodIcon method={item.id}/></span>
       {item.label}</button>)}
     </div>
     <label>When<input type="datetime-local" max={dateTimeLocal()} value={occurred}
      onChange={e=>setOccurred(e.target.value)} required/></label>
      <TaskAssociationsField options={options} value={links} onChange={addLinks}/>
     <label>Notes (optional)
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
       maxLength={5000} placeholder="Key details, questions, next steps…"/></label>
     <section className="sales-activity-follow-up">
      <label><input type="checkbox" checked={createFollowUp}
       onChange={e=>setCreateFollowUp(e.target.checked)}/>
       <span><strong>Create a follow-up task</strong>
        <small>Carry these same CRM links into a scheduled task.</small></span></label>
      {createFollowUp&&<label className="sales-activity-follow-date">
       Follow up on<input type="date" min={localDateKey(new Date())}
        value={followUpDate} onChange={e=>setFollowUpDate(e.target.value)} required/>
      </label>}
     </section>
     <p className="sales-activity-note">Unsaved details are recovered on this device if SalesShop reloads. Saving logs the interaction to CRM history; it doesn't send a message.</p>
     {error&&<p role="alert" className="sales-activity-error">{error}</p>}
    </div>
    <footer>
     <button type="button" onClick={discard} disabled={saving} title="Erase this unsaved activity draft">Discard draft</button>
     <button type="button" onClick={close} disabled={saving}>Close</button>
     <button type="submit" disabled={saving}>{saving?'Saving…':workflowTaskId?'Log & complete task':'Save activity'}</button>
    </footer>
   </form>
  </div>,document.body)}
 </>;
}
