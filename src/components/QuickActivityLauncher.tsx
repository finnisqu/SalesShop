import {useMemo,useState,useEffect,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {TaskAssociationsField} from './TaskAssociationsField';
import {usePersonalTaskStore,taskScope,type TaskAssociation,type TaskLink,type TaskPromotion,
 type TaskChanges} from '../store/personalTaskStore';
import {TaskEditor} from './TasksWorkspace';
import {localDateKey} from '../services/salesCalendar';
import {MobileSheetGrabber} from './MobileSheetGrabber';
import './sales-calendar.css';

type Method='email'|'call'|'text'|'video-call'|'in-person';
export type ActivityContext={type:'company'|'contact'|'project'|'quote';id:string};
export function requestQuickActivity(context:ActivityContext){
 window.dispatchEvent(new CustomEvent<ActivityContext>('salesshop:quick-log-activity',{detail:context}));
}
const methods:ReadonlyArray<{id:Method;label:string;icon:string}>=[
 {id:'call',label:'Call',icon:'☎'},{id:'email',label:'Email',icon:'✉'},
 {id:'text',label:'Text',icon:'▤'},{id:'video-call',label:'Video call',icon:'▣'},
 {id:'in-person',label:'In person',icon:'⌖'},
];
const dateTimeLocal=()=>{
 const now=new Date();return localDateKey(now)+'T'+[now.getHours(),now.getMinutes()]
  .map(n=>String(n).padStart(2,'0')).join(':');
};
const primaryName=(associations:TaskAssociation[])=>{
 const person=associations.find(x=>x.type==='contact');
 return (person??associations[0])?.label?.replace(/^(Quote|Deal|Company|Person) · /,'');
};
export function QuickActivityLauncher({label='Log Activity',compact=false,tile=false,context,global=false}:{
 label?:string;compact?:boolean;tile?:boolean;context?:ActivityContext;global?:boolean;
}){
 const [open,setOpen]=useState(false);
 const [method,setMethod]=useState<Method>('call');
 const [summary,setSummary]=useState('');
 const [notes,setNotes]=useState('');
 const [occurred,setOccurred]=useState(dateTimeLocal);
 const [links,setLinks]=useState<TaskAssociation[]>([]);
 const [error,setError]=useState('');
 const [allowDifferentCompany,setAllowDifferentCompany]=useState(false);
 const [followUp,setFollowUp]=useState<TaskPromotion|null>(null);
 const [savedSuggestion,setSavedSuggestion]=useState<TaskPromotion|null>(null);
 const mode=useAuthStore(s=>s.mode),role=useAuthStore(s=>s.teamRole);
 const department=useAuthStore(s=>s.teamDepartment);
 const currentUser=useAuthStore(s=>s.user?.id);
 const org=useAuthStore(s=>s.organizationId);
 const loadTasks=usePersonalTaskStore(s=>s.load);
 const createTask=usePersonalTaskStore(s=>s.createTask);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const companies=useCrmStore(s=>s.companies),contacts=useCrmStore(s=>s.contacts);
 const projects=useCrmStore(s=>s.projects);
 const record=useCrmStore(s=>s.recordActivity);
 const quotes=useQuoteStore(s=>s.quotes);
 const permitted=!perspective&&(mode==='local'||(!!org&&!!currentUser&&canEditTeamArea(role,department,'crm')));
 const options=useMemo(()=>[
  ...contacts.map(c=>({key:'contact:'+c.id,linked:{type:'contact' as const,id:c.id,label:'Person · '+c.name},label:'Person · '+c.name})),
  ...companies.map(c=>({key:'company:'+c.id,linked:{type:'company' as const,id:c.id,label:'Company · '+c.name},label:'Company · '+c.name})),
  ...projects.map(d=>({key:'project:'+d.id,linked:{type:'project' as const,id:d.id,label:'Deal · '+d.name},label:'Deal · '+d.name})),
  ...quotes.filter(q=>!q.archivedAt&&(mode!=='cloud'||q.ownerUserId===currentUser))
    .map(q=>({key:'quote:'+q.id,linked:{type:'quote' as const,id:q.id,label:'Quote · '+q.title},label:'Quote · '+q.title})),
 ],[contacts,companies,projects,quotes,mode,currentUser]);
 const openWithContext=(selected?:ActivityContext)=>{
  const primary=selected&&options.find(item=>item.linked.type===selected.type&&item.linked.id===selected.id);
  const companyId=selected?.type==='company'?selected.id:
   selected?.type==='contact'?contacts.find(c=>c.id===selected.id)?.companyId:
   selected?.type==='project'?projects.find(d=>d.id===selected.id)?.companyId:
   selected?.type==='quote'?quotes.find(q=>q.id===selected.id)?.companyId:undefined;
  const company=companyId&&options.find(item=>item.linked.type==='company'&&item.linked.id===companyId);
  setLinks([primary?.linked,company?.linked].filter((item):item is TaskAssociation=>!!item));
  setMethod('call');setSummary('');setNotes('');setOccurred(dateTimeLocal());
  setAllowDifferentCompany(false);setError('');setSavedSuggestion(null);setOpen(true);
 };
 useEffect(()=>{
  if(!global)return;
  const handler=(event:Event)=>openWithContext((event as CustomEvent<ActivityContext>).detail);
  window.addEventListener('salesshop:quick-log-activity',handler);
  return()=>window.removeEventListener('salesshop:quick-log-activity',handler);
 },[global,options,contacts,projects,quotes]);
 const close=()=>{setOpen(false);setError('');};
 const addLinks=(items:TaskAssociation[])=>{
  // CRM activity schema stores one ID per record kind. Newest selection wins.
  const seen=new Set<TaskLink['type']>();
  setLinks([...items].reverse().filter(link=>{
   if(seen.has(link.type))return false;seen.add(link.type);return true;
  }).reverse());
 };
 const submit=(event:FormEvent)=>{
  event.preventDefault();setError('');
  if(!permitted)return setError('Your role cannot log shared CRM interactions.');
  const description=summary.trim().slice(0,240);
  const person=primaryName(links);
  const fallback=methods.find(x=>x.id===method)?.label||'Interaction';
  if(!description&&!links.length)return setError('Choose a related record or enter a short summary.');
  const timestamp=new Date(occurred);
  if(!occurred||!Number.isFinite(timestamp.getTime()))return setError('Choose a valid date and time.');
  const find=(kind:TaskLink['type'])=>links.find(link=>link.type===kind)?.id;
  const personId=find('contact'),dealId=find('project'),quoteId=find('quote');
  const contact=contacts.find(c=>c.id===personId),deal=projects.find(d=>d.id===dealId);
  const quote=quotes.find(q=>q.id===quoteId);
  const companyChoices=[find('company'),contact?.companyId,deal?.companyId,quote?.companyId]
   .filter((id):id is string=>!!id);
  if(new Set(companyChoices).size>1&&!allowDifferentCompany)
   return setError('These linked records belong to different companies. Correct the links or allow this exception.');
  const activityId=record({type:'manual-touchpoint',summary:description||(fallback+' with '+(person||'contact')),
   companyId:find('company')||contact?.companyId||deal?.companyId||quote?.companyId,
   contactId:personId,projectId:dealId||quote?.projectId,quoteId,
   occurredAt:timestamp.toISOString(),
   metadata:{source:'manual',interactionMethod:method,notes:notes.trim().slice(0,5000)||undefined}});
  if(!activityId){
   setError('Could not safely save the interaction. Your entry is preserved; check available storage and try again.');
   return;
  }
  const draft:TaskPromotion={
   title:'Follow up'+(person?' with '+person:'')+
    (description?' — '+description.slice(0,75):''),
   target:'task',associations:links,
   linked:links[0]?{type:links[0].type,id:links[0].id}:undefined,
   sourceLabel:'CRM Activity',sourceObjectId:activityId,
   sourceText:description||notes.trim().slice(0,2000),
  };
  setSavedSuggestion(draft);
  setMethod('call');setSummary('');setNotes('');setOccurred(dateTimeLocal());
  setLinks([]);close();
 };
 if(!permitted)return null;
 return <>
  {!global&&<button type="button" className={'sales-log-launcher'+(compact?' is-compact':'')+(tile?' is-tile':'')}
   onClick={()=>openWithContext(context)}>
   <span aria-hidden="true">{tile?'◉':'＋'}</span>{tile?<><strong>{label}</strong><small>Call, email or meeting</small></>:label}
  </button>}
  {savedSuggestion&&createPortal(<div className="sales-activity-success" role="status">
   <strong>Activity recorded on this device</strong>
   <button type="button" onClick={()=>{
     const scope=taskScope(mode,org,currentUser);
     if(!scope)return;
     loadTasks(scope);setFollowUp(savedSuggestion);setSavedSuggestion(null);
   }}>+ Follow-up task</button>
   <button type="button" aria-label="Dismiss follow-up suggestion" onClick={()=>setSavedSuggestion(null)}>×</button>
  </div>,document.body)}
  {followUp&&<TaskEditor key={followUp.sourceObjectId??followUp.title} initial={followUp}
    onCancel={()=>setFollowUp(null)}
    onSave={(changes:TaskChanges&{title:string})=>{
     createTask(changes.title,changes);setFollowUp(null);
    }}/>} 
  {open&&createPortal(<div className="sales-activity-backdrop" onPointerDown={e=>{
    if(e.target===e.currentTarget)close();
   }}>
   <form role="dialog" aria-modal="true" aria-label="Log Activity" className="sales-activity-dialog"
    onSubmit={submit} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
    <MobileSheetGrabber onDismiss={close}/>
    <header><div><small>CRM · Completed interaction</small><h2>Log Activity</h2></div>
      <button type="button" onClick={close} aria-label="Close Log Activity">×</button></header>
    <div className="sales-activity-form-body">
     <div className="sales-activity-methods" role="group" aria-label="Interaction method">
      {methods.map(item=><button type="button" key={item.id} aria-pressed={method===item.id}
       onClick={()=>setMethod(item.id)}>
       <span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
     </div>
     <label>When<input type="datetime-local" value={occurred} onChange={e=>setOccurred(e.target.value)} required/></label>
     <label>Summary (optional when linked)
      <input autoFocus value={summary} onChange={e=>setSummary(e.target.value)}
       placeholder="What happened?" maxLength={240}/></label>
     <TaskAssociationsField options={options} value={links} onChange={addLinks}/>
     {new Set([links.find(l=>l.type==='company')?.id,
       contacts.find(c=>c.id===links.find(l=>l.type==='contact')?.id)?.companyId,
       projects.find(d=>d.id===links.find(l=>l.type==='project')?.id)?.companyId,
       quotes.find(q=>q.id===links.find(l=>l.type==='quote')?.id)?.companyId]
       .filter(Boolean)).size>1&&<label className="sales-activity-exception">
        <input type="checkbox" checked={allowDifferentCompany}
         onChange={e=>setAllowDifferentCompany(e.target.checked)}/>
        These records belong to different companies; link intentionally.
       </label>}
     <label>Notes (optional)
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
       maxLength={5000} placeholder="Key details, questions, next steps…"/></label>
     <p className="sales-activity-note">Shared CRM history · visible to members of your company. It doesn't create a task or send an email.</p>
     {error&&<p role="alert" className="sales-activity-error">{error}</p>}
    </div>
    <footer><button type="button" onClick={close}>Cancel</button><button type="submit">Save activity</button></footer>
   </form>
  </div>,document.body)}
 </>;
}
