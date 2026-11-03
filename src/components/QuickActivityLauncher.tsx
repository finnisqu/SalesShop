import {useMemo,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {TaskAssociationsField} from './TaskAssociationsField';
import {type TaskAssociation,type TaskLink} from '../store/personalTaskStore';
import {localDateKey} from '../services/salesCalendar';
import './sales-calendar.css';

type Method='email'|'call'|'text'|'video-call'|'in-person';
const methods:ReadonlyArray<{id:Method;label:string;icon:string}>=[
 {id:'call',label:'Call',icon:'☎'},{id:'email',label:'Email',icon:'✉'},
 {id:'text',label:'Text',icon:'▤'},{id:'video-call',label:'Video call',icon:'▣'},
 {id:'in-person',label:'In person',icon:'♧'},
];
const dateTimeLocal=()=>{
 const now=new Date();return localDateKey(now)+'T'+[now.getHours(),now.getMinutes()]
  .map(n=>String(n).padStart(2,'0')).join(':');
};
const primaryName=(associations:TaskAssociation[])=>{
 const person=associations.find(x=>x.type==='contact');
 return (person??associations[0])?.label?.replace(/^(Quote|Deal|Company|Person) · /,'');
};
export function QuickActivityLauncher({label='Log Activity',compact=false}:{
 label?:string;compact?:boolean;
}){
 const [open,setOpen]=useState(false);
 const [method,setMethod]=useState<Method>('call');
 const [summary,setSummary]=useState('');
 const [notes,setNotes]=useState('');
 const [occurred,setOccurred]=useState(dateTimeLocal);
 const [links,setLinks]=useState<TaskAssociation[]>([]);
 const [error,setError]=useState('');
 const mode=useAuthStore(s=>s.mode),role=useAuthStore(s=>s.teamRole);
 const department=useAuthStore(s=>s.teamDepartment);
 const currentUser=useAuthStore(s=>s.user?.id);
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
  record({type:'notebook-touchpoint',summary:description||(fallback+' with '+(person||'contact')),
   companyId:find('company'),contactId:find('contact'),projectId:find('project'),quoteId:find('quote'),
   occurredAt:timestamp.toISOString(),
   metadata:{source:'manual',interactionMethod:method,notes:notes.trim().slice(0,5000)||undefined}});
  setMethod('call');setSummary('');setNotes('');setOccurred(dateTimeLocal());
  setLinks([]);close();
 };
 if(!permitted)return null;
 return <>
  <button type="button" className={'sales-log-launcher'+(compact?' is-compact':'')}
   onClick={()=>{setOccurred(dateTimeLocal());setOpen(true);}}>
   <span aria-hidden="true">＋</span>{label}
  </button>
  {open&&createPortal(<div className="sales-activity-backdrop" onPointerDown={e=>{
    if(e.target===e.currentTarget)close();
   }}>
   <form role="dialog" aria-modal="true" aria-label="Log Activity" className="sales-activity-dialog"
    onSubmit={submit} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
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
     <label>Notes (optional)
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
       maxLength={5000} placeholder="Key details, questions, next steps…"/></label>
     <p className="sales-activity-note">Saved to CRM activity history; this doesn't create a task or send a message.</p>
     {error&&<p role="alert" className="sales-activity-error">{error}</p>}
    </div>
    <footer><button type="button" onClick={close}>Cancel</button><button type="submit">Save activity</button></footer>
   </form>
  </div>,document.body)}
 </>;
}
