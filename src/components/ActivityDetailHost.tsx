import {useEffect,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {useNavigationStore} from '../store/navigationStore';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import type {ActivityMetadata} from '../types/crm';
import './sales-calendar.css';

const toInput=(text:string)=>{
 const date=new Date(text),pad=(n:number)=>String(n).padStart(2,'0');
 return Number.isFinite(date.getTime())
  ?[date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-')+
   'T'+pad(date.getHours())+':'+pad(date.getMinutes()):'';
};
const display=(date:string)=>new Date(date).toLocaleString(undefined,{
 month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
export function requestActivityDetail(id:string){
 window.dispatchEvent(new CustomEvent('salesshop:show-activity',{detail:{id}}));
}
/** Global Activity detail survives navigation/drawer closure, and provides
 * links to the exact related CRM records. Automated history stays read-only. */
export function ActivityDetailHost(){
 const [id,setId]=useState<string|null>(null);
 const [editing,setEditing]=useState(false),[confirmVoid,setConfirmVoid]=useState(false);
 const [error,setError]=useState('');
 const [summary,setSummary]=useState(''),[notes,setNotes]=useState('');
 const [method,setMethod]=useState<NonNullable<ActivityMetadata['interactionMethod']>>('call');
 const [occurred,setOccurred]=useState('');
 const activity=useCrmStore(s=>s.activities.find(a=>a.id===id));
 const companies=useCrmStore(s=>s.companies),people=useCrmStore(s=>s.contacts),
  deals=useCrmStore(s=>s.projects);
 const update=useCrmStore(s=>s.updateManualActivity),
  voidActivity=useCrmStore(s=>s.voidManualActivity);
 const quotes=useQuoteStore(s=>s.quotes);
 const mode=useAuthStore(s=>s.mode),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment),user=useAuthStore(s=>s.user?.id);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const nav=useNavigationStore();
 const personalScope=usePersonalTaskStore(s=>s.scope);
 const tasks=usePersonalTaskStore(s=>s.tasks);
 const relevantTasks=tasks.filter(t=>personalScope&&t.workspaceScope===personalScope&&
  !t.deletedAt&&t.sourceLabel==='CRM Activity'&&t.sourceObjectId===id);
 const openTask=(taskId:string)=>{
  close();
  try{window.sessionStorage.setItem('salesshop-open-task-id-v1',taskId);}catch{/* optional */}
  nav.setView('tasks');
  window.dispatchEvent(new Event('salesshop:open-calendar-task'));
 };
 const quote=quotes.find(q=>q.id===activity?.quoteId&&(!q.archivedAt||mode==='local'));
 const editable=!!activity&&!activity.metadata?.voidedAt&&
  ['manual-touchpoint','notebook-touchpoint'].includes(activity.type)&&
  !perspective&&(mode==='local'||canEditTeamArea(role,department,'crm'))&&
  (!activity.quoteId||mode==='local'||quote?.ownerUserId===user);
 useEffect(()=>{
  const show=(event:Event)=>{
   const detail=(event as CustomEvent<{id:string}>).detail;
   if(!detail?.id)return;
   const next=useCrmStore.getState().activities.find(a=>a.id===detail.id);
   if(!next)return;
   setId(next.id);setEditing(false);setConfirmVoid(false);setError('');
   setSummary(next.summary);setNotes(next.metadata?.notes??'');
   setMethod(next.metadata?.interactionMethod??'call');setOccurred(toInput(next.occurredAt));
  };
  window.addEventListener('salesshop:show-activity',show);
  return()=>window.removeEventListener('salesshop:show-activity',show);
 },[]);
 if(!activity||!id)return null;
 const close=()=>{setId(null);setEditing(false);setConfirmVoid(false);};
 const open=(type:'company'|'contact'|'project'|'quote',recordId:string)=>{
  close();
  if(type==='company')nav.openCompany(recordId);
  if(type==='contact')nav.openPerson(recordId);
  if(type==='project')nav.openProject(recordId);
  if(type==='quote')nav.openQuote(recordId);
 };
 const save=(event:FormEvent)=>{
  event.preventDefault();setError('');
  if(!summary.trim())return setError('Enter a short summary.');
  const date=new Date(occurred);
  if(!occurred||!Number.isFinite(date.getTime()))return setError('Enter a valid date/time.');
  if(!update(id,{summary,notes,interactionMethod:method,occurredAt:date.toISOString()}))
   return setError('This interaction could not be corrected.');
  setEditing(false);
 };
 const link=(type:'company'|'contact'|'project'|'quote',recordId:string|undefined,title:string)=>{
  if(!recordId)return null;
  return <button type="button" key={type+recordId} className="sales-activity-detail-link"
   onClick={()=>open(type,recordId)}><strong>{title}</strong><span aria-hidden="true">›</span></button>;
 };
 return createPortal(<div className="sales-activity-backdrop"
  onPointerDown={e=>{if(e.target===e.currentTarget)close();}}>
  <section role="dialog" aria-modal="true" className="sales-activity-dialog sales-activity-detail"
   aria-label="Activity details"
   onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
   <header><div><small>CRM · {activity.type==='manual-touchpoint'?'Logged interaction':'Activity'}</small>
      <h2>Activity details</h2></div><button type="button" aria-label="Close Activity details"
       onClick={close}>×</button></header>
   <div className="sales-activity-form-body">
    {editing?<form id="sales-activity-edit-form" onSubmit={save} className="sales-activity-correction">
      <label>Summary<input autoFocus value={summary} maxLength={240} onChange={e=>setSummary(e.target.value)}/></label>
      <label>Method<select value={method} onChange={e=>setMethod(e.target.value as typeof method)}>
       <option value="call">Call</option><option value="email">Email</option>
       <option value="text">Text</option><option value="video-call">Video call</option>
       <option value="in-person">In person</option>
      </select></label>
      <label>When<input type="datetime-local" value={occurred} onChange={e=>setOccurred(e.target.value)}/></label>
      <label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5} maxLength={5000}/></label>
      {error&&<p role="alert">{error}</p>}
     </form>:<>
      <div className="sales-activity-facts">
       <strong>{activity.summary}</strong>
       <span>{display(activity.occurredAt)}</span>
       <span>{(activity.metadata?.interactionMethod??activity.type).replaceAll('-',' ')}</span>
       {activity.metadata?.editedAt&&<small>Corrected {display(activity.metadata.editedAt)}</small>}
      </div>
      {activity.metadata?.notes&&<div className="sales-activity-full-notes">{activity.metadata.notes}</div>}
      {!activity.metadata?.notes&&<p className="sales-activity-note">No additional notes.</p>}
      <section className="sales-activity-related"><h3>Related records</h3>
       {link('contact',activity.contactId,people.find(p=>p.id===activity.contactId)?.name??'Person')}
       {link('company',activity.companyId,companies.find(c=>c.id===activity.companyId)?.name??'Company')}
       {link('project',activity.projectId,deals.find(d=>d.id===activity.projectId)?.name??'Deal')}
       {activity.quoteId&&quote&&link('quote',quote.id,quote.title||'Quote')}
       {!activity.contactId&&!activity.companyId&&!activity.projectId&&!activity.quoteId&&
        <p className="sales-activity-note">No linked CRM records.</p>}
      </section>
      {relevantTasks.length>0&&<section className="sales-activity-related">
       <h3>My follow-up Tasks</h3>
       {relevantTasks.map(task=><button type="button" key={task.id}
         className="sales-activity-detail-link" onClick={()=>openTask(task.id)}>
        <strong>{task.title}</strong><small>{task.dueDate?'Due '+task.dueDate:'No due date'}</small>
        <span aria-hidden="true">›</span></button>)}
      </section>}
      <p className="sales-activity-note">Shared CRM history · this is not a private note.</p>
     </>}
    {confirmVoid&&<p role="alert" className="sales-activity-void-warning">
      Void this interaction? It will disappear from active calendar/history lists, but
      its record will remain for audit purposes.
    </p>}
   </div>
   <footer>
    {editing?<><button type="button" onClick={()=>setEditing(false)}>Cancel</button>
     <button type="submit" form="sales-activity-edit-form">Save correction</button></>:
     <>{editable&&<button type="button" onClick={()=>setEditing(true)}>Correct entry</button>}
      {editable&&<button type="button" className="is-danger" onClick={()=>{
       if(!confirmVoid){setConfirmVoid(true);return;}
       if(voidActivity(id))close();
       else setError('Could not void this entry.');
      }}>{confirmVoid?'Confirm void':'Void entry'}</button>}
      <button type="button" onClick={close}>Done</button></>}
   </footer>
  </section>
 </div>,document.body);
}
