import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {usePersonalTaskStore,taskScope,type PersonalTask,type TaskChanges,type TaskPriority,type TaskPromotion,type TaskStatus,type TaskType} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useNavigationStore} from '../store/navigationStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import './tasks-workspace.css';

type Filter='active'|'overdue'|'scheduled'|'completed'|'all';
const priorities:TaskPriority[]=['low','normal','high','urgent'];
const types:TaskType[]=['todo','call','email','meeting','follow-up'];
const statusOptions:TaskStatus[]=['open','in-progress','waiting','completed','canceled'];
const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const formatDate=(date?:string)=>date?new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Anytime';
const taskComplete=(task:PersonalTask)=>task.status==='completed'||!!task.completedAt;
function condition(task:PersonalTask,today:string):'complete'|'overdue'|'scheduled'|'active'{
  if(taskComplete(task)||task.status==='canceled')return 'complete';
  if(task.dueDate&&task.dueDate<today)return 'overdue';
  if(task.dueDate&&task.dueDate>today)return 'scheduled';
  return 'active';
}
function normalizeLocalReminder(value:string){
  if(!value)return undefined;
  const date=new Date(value);
  return Number.isNaN(date.getTime())?undefined:date.toISOString();
}
function reminderValue(value?:string){
  if(!value)return'';
  const d=new Date(value);
  const p=(n:number)=>String(n).padStart(2,'0');
  return Number.isNaN(d.getTime())?'':[d.getFullYear(),p(d.getMonth()+1),p(d.getDate())].join('-')+'T'+p(d.getHours())+':'+p(d.getMinutes());
}
function Editor({initial,onCancel,onSave}:{
  initial:Partial<PersonalTask>|TaskPromotion;onCancel:()=>void;onSave:(changes:TaskChanges&{title:string})=>void;
}){
  const [title,setTitle]=useState(initial.title??'');
  const [type,setType]=useState<TaskType>(('type'in initial&&initial.type)||'todo');
  const [priority,setPriority]=useState<TaskPriority>(('priority'in initial&&initial.priority)||'normal');
  const [status,setStatus]=useState<TaskStatus>(('status'in initial&&initial.status)||'open');
  const [dueDate,setDueDate]=useState(('dueDate'in initial&&initial.dueDate)||'');
  const [dueTime,setDueTime]=useState(('dueTime'in initial&&initial.dueTime)||'');
  const [reminderAt,setReminderAt]=useState(reminderValue('reminderAt'in initial?initial.reminderAt:undefined));
  const [queue,setQueue]=useState(('queue'in initial&&initial.queue)||'');
  const [notes,setNotes]=useState(('notes'in initial&&initial.notes)||'');
  const [linked]=useState(initial.linked);
  const [sourceLabel]=useState(initial.sourceLabel);
  const [sourceText]=useState(initial.sourceText);
  const submit=(event:FormEvent)=>{event.preventDefault();if(!title.trim())return;
    onSave({title:title.trim(),type,priority,status,dueDate:dueDate||undefined,
      dueTime:dueDate?dueTime||undefined:undefined,reminderAt:normalizeLocalReminder(reminderAt),
      notes,queue,linked,sourceLabel,sourceText});
  };
  return <div className="tasks-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel();}}>
    <form className="tasks-editor" role="dialog" aria-modal="true" aria-label={'Edit task '+(title||'new')}
      onSubmit={submit}>
      <header><strong>{'id'in initial?'Edit task':'New task'}</strong>
        <button type="button" aria-label="Close task editor" onClick={onCancel}>×</button></header>
      <label>Task title<input autoFocus required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder="What needs to happen?"/></label>
      {sourceLabel&&<p className="tasks-editor-source">Linked to {sourceLabel}{sourceText?' · Original excerpt preserved':''}</p>}
      <div className="tasks-editor-grid">
        <label>Type<select value={type} onChange={e=>setType(e.target.value as TaskType)}>
          {types.map(t=><option key={t} value={t}>{t==='todo'?'To-do':t==='follow-up'?'Follow-up':t[0].toUpperCase()+t.slice(1)}</option>)}</select></label>
        <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as TaskPriority)}>
          {priorities.map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
        <label>Status<select value={status} onChange={e=>setStatus(e.target.value as TaskStatus)}>
          {statusOptions.map(x=><option value={x} key={x}>{x==='in-progress'?'In progress':x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
        <label>Queue / category<input value={queue} maxLength={80} placeholder="e.g. Follow-ups" onChange={e=>setQueue(e.target.value)}/></label>
        <label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
        <label>Due time<input type="time" disabled={!dueDate} value={dueTime} onChange={e=>setDueTime(e.target.value)}/></label>
        <label className="tasks-editor-full">Reminder (in-app only)<input type="datetime-local" value={reminderAt}
          onChange={e=>setReminderAt(e.target.value)}/></label>
      </div>
      <label>Notes<textarea rows={3} maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)}
        placeholder="Context, next steps, or call notes…"/></label>
      <footer><button type="button" onClick={onCancel}>Cancel</button><button type="submit" className="tasks-primary">Save task</button></footer>
    </form>
  </div>;
}

export function TasksWorkspace(){
  const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),orgId=useAuthStore(s=>s.organizationId);
  const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
  const scope=taskScope(mode,orgId,userId);
  const tasks=usePersonalTaskStore(s=>s.tasks),storedScope=usePersonalTaskStore(s=>s.scope);
  const load=usePersonalTaskStore(s=>s.load),create=usePersonalTaskStore(s=>s.createTask);
  const update=usePersonalTaskStore(s=>s.updateTask),complete=usePersonalTaskStore(s=>s.complete);
  const reopen=usePersonalTaskStore(s=>s.reopen),remove=usePersonalTaskStore(s=>s.remove);
  const promotion=usePersonalTaskStore(s=>s.promotion),beginPromotion=usePersonalTaskStore(s=>s.beginPromotion);
  const nav=useNavigationStore();
  const [editing,setEditing]=useState<PersonalTask|TaskPromotion|null>(null);
  const [filter,setFilter]=useState<Filter>('active');
  const [search,setSearch]=useState('');
  const today=localDay();
  useEffect(()=>load(scope),[scope,load]);
  useEffect(()=>{if(promotion&&scope){setEditing(promotion);beginPromotion(null);}},[promotion,beginPromotion,scope]);
  const own=(!rolePreview&&scope&&storedScope===scope)?tasks:[];
  const counts=useMemo(()=>({
    active:own.filter(t=>condition(t,today)==='active').length,
    overdue:own.filter(t=>condition(t,today)==='overdue').length,
    scheduled:own.filter(t=>condition(t,today)==='scheduled').length,
    completed:own.filter(t=>condition(t,today)==='complete').length,
    all:own.length,
  }),[own,today]);
  const visible=useMemo(()=>own.filter(t=>{
    if(filter==='active'&&!['active','overdue'].includes(condition(t,today)))return false;
    if(filter==='overdue'&&condition(t,today)!=='overdue')return false;
    if(filter==='scheduled'&&condition(t,today)!=='scheduled')return false;
    if(filter==='completed'&&condition(t,today)!=='complete')return false;
    return (t.title+' '+(t.notes??'')+' '+(t.sourceLabel??'')+' '+(t.queue??'')).toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b)=>{
    const aDone=taskComplete(a),bDone=taskComplete(b);
    if(aDone!==bDone)return aDone?1:-1;
    const weight=(p?:TaskPriority)=>({urgent:0,high:1,normal:2,low:3})[p??'normal'];
    return (a.dueDate??'9999').localeCompare(b.dueDate??'9999')||
      weight(a.priority)-weight(b.priority)||b.updatedAt.localeCompare(a.updatedAt);
  }),[own,filter,search,today]);
  const openSource=(t:PersonalTask)=>{
    if(!t.linked)return;
    const {id,type}=t.linked;
    if(type==='notebook')nav.openNotebookPage(id);
    if(type==='quote')nav.openQuote(id);
    if(type==='project')nav.openProject(id);
    if(type==='company')nav.openCompany(id);
    if(type==='contact')nav.openPerson(id);
  };
  const save=(changes:TaskChanges&{title:string})=>{
    if(!scope)return;
    if(editing&&'id'in editing)update(editing.id,changes);
    else create(changes.title,changes);
    setEditing(null);
  };
  if(rolePreview)return <main className="tasks-workspace"><h1>Tasks</h1><p>Personal tasks are not shown in role preview.</p></main>;
  return <main className="tasks-workspace" aria-label="SalesShop tasks">
    <header className="tasks-header">
      <div><span className="tasks-eyebrow">PERSONAL WORK QUEUE</span><h1>Tasks</h1>
        <p>Calls, follow-ups, reminders and work to finish. Keep completed tasks as a record.</p></div>
      <button type="button" className="tasks-primary" onClick={()=>setEditing({title:''})} disabled={!scope}>+ New task</button>
    </header>
    <div className="tasks-summary" aria-label="Task counts">
      {([['active','To do'],['overdue','Overdue'],['scheduled','Scheduled'],['completed','Completed']] as const).map(([key,label])=>
        <button key={key} type="button" onClick={()=>setFilter(key)} className={filter===key?'is-selected':''}>
          <strong>{counts[key]}</strong><span>{label}</span>
        </button>)}
    </div>
    <div className="tasks-tools">
      <input type="search" aria-label="Search tasks" placeholder="Search tasks, notes, queues…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="tasks-filter-row" role="group" aria-label="Task status filter">
        {(['active','overdue','scheduled','completed','all'] as const).map(key=>
          <button key={key} type="button" aria-pressed={filter===key}
            className={filter===key?'is-selected':''} onClick={()=>setFilter(key)}>{key==='active'?'Open':key==='all'?'All history':key[0].toUpperCase()+key.slice(1)}</button>)}
      </div>
    </div>
    {!scope&&<p className="tasks-state">Your personal Tasks workspace will load after you sign in to a company.</p>}
    {scope&&<section className="tasks-list" aria-label="Task records">
      {!visible.length&&<div className="tasks-empty"><strong>No matching tasks</strong>
        <p>Create a task here, or right-click Notebook text or an object and promote it to a task.</p></div>}
      {visible.map(task=>{
        const state=condition(task,today),isDone=taskComplete(task);
        const reminderDue=task.reminderAt&&!isDone&&Date.parse(task.reminderAt)<=Date.now();
        return <article className={'tasks-row is-'+state} key={task.id}>
          <label className="tasks-complete"><input type="checkbox" checked={isDone}
            aria-label={(isDone?'Reopen ':'Complete ')+task.title}
            onChange={()=>isDone?reopen(task.id):complete(task.id)}/></label>
          <div className="tasks-row-body">
            <div className="tasks-row-top"><strong>{task.title}</strong>
              <span className={'tasks-priority is-'+(task.priority??'normal')}>{task.priority??'normal'}</span></div>
            <div className="tasks-row-meta"><span>{task.type==='todo'||!task.type?'To-do':task.type}</span>
              <span className={state==='overdue'?'is-overdue':''}>{task.dueDate?'Due '+formatDate(task.dueDate)+(task.dueTime?' · '+task.dueTime:''):'No due date'}</span>
              <span>{isDone?'Completed':task.status==='in-progress'?'In progress':task.status==='waiting'?'Waiting':state==='scheduled'?'Scheduled':'Open'}</span>
              {task.queue&&<span>{task.queue}</span>}
              {reminderDue&&<span className="is-overdue">Reminder due</span>}
            </div>
            {task.notes&&<p>{task.notes}</p>}
            {task.sourceText&&<blockquote>{task.sourceText.slice(0,260)}</blockquote>}
            {task.linked&&<button type="button" className="tasks-source" onClick={()=>openSource(task)}>Open {task.sourceLabel??task.linked.type} ↗</button>}
            {isDone&&task.completedAt&&<small>Completed {new Date(task.completedAt).toLocaleString()}</small>}
          </div>
          <div className="tasks-row-actions">
            <button type="button" onClick={()=>setEditing(task)}>Edit</button>
            <button type="button" onClick={()=>{if(window.confirm('Permanently delete this task record?'))remove(task.id);}}>Delete</button>
          </div>
        </article>;
      })}
    </section>}
    <footer className="tasks-footer">Private personal tasks are currently saved on this device. Reminder timestamps appear in SalesShop; background emails and push alerts are not enabled.</footer>
    {editing&&<Editor key={'id'in editing?editing.id:editing.title+'new'} initial={editing} onCancel={()=>setEditing(null)} onSave={save}/>}
  </main>;
}
