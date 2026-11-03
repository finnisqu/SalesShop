import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {usePersonalTaskStore,taskScope,normalizedTaskAssociations,type TaskAssociation,type PersonalTask,type TaskChanges,type TaskLink,type TaskPriority,type TaskPromotion,type TaskStatus,type TaskType} from '../store/personalTaskStore';
import {TaskAssociationsField} from './TaskAssociationsField';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import {taskDuePresetDate,type TaskDuePreset} from '../services/taskSchedule';
import {ConnectionsTable,type ConnectionColumn,type ConnectionTableRow} from './ConnectionsTable';
import '../tasks-table.css';
import {useQuoteStore} from '../store/quoteStore';
import {useCrmStore} from '../store/crmStore';
import {useNotebookStore} from '../store/notebookStore';
import {useAuthStore} from '../store/authStore';
import {useNavigationStore} from '../store/navigationStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import '../tasks-workspace.css';
import '../task-workflow-v2.css';
import {draftStorageKey,readSavedDraft,writeSavedDraft,clearSavedDraft} from '../services/draftRecovery';

type Filter='active'|'today'|'upcoming'|'overdue'|'scheduled'|'completed'|'all';
const defaultQueues=['Prospecting','Quotes','Deliveries','Meetings','Follow-ups','Internal'];
const taskColumns:ConnectionColumn[]=[
 {key:'name',label:'Task'},{key:'type',label:'Type'},{key:'priority',label:'Priority'},
 {key:'status',label:'Status'},{key:'queue',label:'Queue'},
 {key:'start',label:'Start on'},{key:'due',label:'Due'},
 {key:'related',label:'Related records'},{key:'updated',label:'Updated'}];
const priorities:TaskPriority[]=['low','normal','high','urgent'];
const types:TaskType[]=['todo','call','email','meeting','follow-up'];
const statusOptions:TaskStatus[]=['open','in-progress','waiting','completed','canceled'];
const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const formatDate=(date?:string)=>date?new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Anytime';
const taskComplete=(task:PersonalTask)=>task.status==='completed'||!!task.completedAt;
const ownQueueNames=(tasks:PersonalTask[])=>tasks.filter(t=>!t.deletedAt)
  .map(t=>t.queue).filter((q):q is string=>!!q);
function condition(task:PersonalTask,today:string):'complete'|'overdue'|'scheduled'|'active'{
  if(taskComplete(task)||task.status==='canceled')return 'complete';
  if(task.dueDate&&task.dueDate<today)return 'overdue';
  if(task.startDate&&task.startDate>today)return 'scheduled';
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
type TaskEditorRecovery={
 title:string;type:TaskType;priority:TaskPriority;status:TaskStatus;
 dueDate:string;startDate:string;dueTime:string;reminderAt:string;
 queue:string;notes:string;selectedLinks:TaskAssociation[];
};
type ActiveTaskDraft={kind:'new'|'existing';id?:string};
export function TaskEditor({initial,onCancel,onSave}:{
  initial:Partial<PersonalTask>|TaskPromotion;onCancel:()=>void;onSave:(changes:TaskChanges&{title:string})=>void;
}){
  // A promotion draft is a subset of the ordinary task editor fields.
  // Use one typed draft shape so optional properties remain correctly typed.
  const auth=useAuthStore.getState();
  const initialTaskId='id'in initial&&typeof initial.id==='string'?initial.id:null;
  const scopeKey=draftStorageKey('task:'+(initialTaskId??'new'),auth.mode,auth.organizationId,auth.user?.id);
  const activeKey=draftStorageKey('task:active',auth.mode,auth.organizationId,auth.user?.id);
  const recovered=useMemo(()=>readSavedDraft<TaskEditorRecovery>(scopeKey),[scopeKey]);
  const draft:Partial<PersonalTask>=initial;
  const [title,setTitle]=useState(recovered?.title??draft.title??'');
  const [type,setType]=useState<TaskType>(recovered?.type??draft.type??'todo');
  const [priority,setPriority]=useState<TaskPriority>(recovered?.priority??draft.priority??'normal');
  const [status,setStatus]=useState<TaskStatus>(recovered?.status??draft.status??'open');
  const [dueDate,setDueDate]=useState(recovered?.dueDate??draft.dueDate??'');
  const [startDate,setStartDate]=useState(recovered?.startDate??draft.startDate??'');
  const [dueTime,setDueTime]=useState(recovered?.dueTime??draft.dueTime??'');
  const [reminderAt,setReminderAt]=useState(recovered?.reminderAt??reminderValue(draft.reminderAt));
  const [queue,setQueue]=useState(recovered?.queue??draft.queue??'');
  const [notes,setNotes]=useState(recovered?.notes??draft.notes??'');
  const [selectedLinks,setSelectedLinks]=useState<TaskAssociation[]>(()=>recovered?.selectedLinks??normalizedTaskAssociations(initial));
  // Every form change is durable locally before submission. No unsaved task is sent to cloud.
  useEffect(()=>{
   writeSavedDraft(scopeKey,{title,type,priority,status,dueDate,startDate,dueTime,reminderAt,queue,notes,selectedLinks});
   writeSavedDraft<ActiveTaskDraft>(activeKey,{
    kind:initialTaskId?'existing':'new',
    id:initialTaskId??undefined,
   });
  },[scopeKey,activeKey,title,type,priority,status,dueDate,startDate,dueTime,reminderAt,queue,notes,selectedLinks]);
  const close=()=>{clearSavedDraft(activeKey);onCancel();};
  const discard=()=>{clearSavedDraft(scopeKey);close();};
  const sourceLabel=initial.sourceLabel;
  const suggestionScope=usePersonalTaskStore(s=>s.scope);
  const suggestionTasks=usePersonalTaskStore(s=>s.tasks);
  const commonQueues=Array.from(new Set([...defaultQueues,
    ...suggestionTasks.filter(task=>!!suggestionScope&&task.workspaceScope===suggestionScope&&!task.deletedAt)
      .map(task=>task.queue).filter((q):q is string=>!!q)])).sort();
  const quotes=useQuoteStore(s=>s.quotes);
  const authMode=useAuthStore(s=>s.mode),authUserId=useAuthStore(s=>s.user?.id);
  const companies=useCrmStore(s=>s.companies),contacts=useCrmStore(s=>s.contacts);
  const deals=useCrmStore(s=>s.projects),pages=useNotebookStore(s=>s.entries);
  const associations=[
    ...quotes.filter(q=>!q.archivedAt&&(authMode!=='cloud'||q.ownerUserId===authUserId)).map(q=>({key:'quote:'+q.id,linked:{type:'quote',id:q.id} as TaskLink,label:'Quote · '+q.title})),
    ...deals.map(d=>({key:'project:'+d.id,linked:{type:'project',id:d.id} as TaskLink,label:'Deal · '+d.name})),
    ...companies.map(c=>({key:'company:'+c.id,linked:{type:'company',id:c.id} as TaskLink,label:'Company · '+c.name})),
    ...contacts.map(c=>({key:'contact:'+c.id,linked:{type:'contact',id:c.id} as TaskLink,label:'Person · '+c.name})),
    ...pages.map(p=>({key:'notebook:'+p.id,linked:{type:'notebook',id:p.id} as TaskLink,label:'Notebook · '+p.title})),
  ];
  const [sourceText]=useState(initial.sourceText);
  const [sourceObjectId]=useState(initial.sourceObjectId);
  const submit=(event:FormEvent)=>{event.preventDefault();if(!title.trim())return;
    onSave({title:title.trim(),type,priority,status,startDate:startDate||undefined,dueDate:dueDate||undefined,
      dueTime:dueDate?dueTime||undefined:undefined,reminderAt:normalizeLocalReminder(reminderAt),
      notes,queue,associations:selectedLinks,
      linked:selectedLinks[0]?{type:selectedLinks[0].type,id:selectedLinks[0].id}:undefined,
      sourceLabel:selectedLinks[0]?.label??sourceLabel,sourceText,sourceObjectId});
    clearSavedDraft(scopeKey);clearSavedDraft(activeKey);
  };
  return <div className="tasks-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
    <form className="tasks-editor" role="dialog" aria-modal="true" aria-label={'Edit task '+(title||'new')}
      onSubmit={submit}>
      <header><strong>{'id'in initial?'Edit task':'New task'}</strong>
        <button type="button" aria-label="Close task editor" onClick={close}>×</button></header>
      <label>Task title<input autoFocus required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder="What needs to happen?"/></label>
      {sourceText&&<p className="tasks-editor-source">Promoted from Notebook · Original text preserved</p>}
      <TaskAssociationsField options={associations.map(item=>({...item,
        linked:{...item.linked,label:item.label}}))} value={selectedLinks} onChange={setSelectedLinks}/>
      <div className="tasks-editor-grid">
        <label>Type<select value={type} onChange={e=>setType(e.target.value as TaskType)}>
          {types.map(t=><option key={t} value={t}>{t==='todo'?'To-do':t==='follow-up'?'Follow-up':t[0].toUpperCase()+t.slice(1)}</option>)}</select></label>
        <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as TaskPriority)}>
          {priorities.map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
        <label>Status<select value={status} onChange={e=>setStatus(e.target.value as TaskStatus)}>
          {statusOptions.map(x=><option value={x} key={x}>{x==='in-progress'?'In progress':x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
        <label>Queue / category<input list="tasks-queue-choices" value={queue} maxLength={80}
          placeholder="e.g. Quotes" onChange={e=>setQueue(e.target.value)}/>
          <datalist id="tasks-queue-choices">{commonQueues.map(q=><option key={q} value={q}/>)}</datalist>
          <small className="tasks-editor-due-hint">Choose an existing queue or type a new name.</small>
        </label>
        <label>Start on<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
          <small className="tasks-editor-due-hint">When you plan to begin; blank means available now.</small></label>
        <label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
          <small className="tasks-editor-due-hint">Deadline, not the date the task becomes visible.</small></label>
        <label>Due time<input type="time" disabled={!dueDate} value={dueTime} onChange={e=>setDueTime(e.target.value)}/></label>
        <label className="tasks-editor-full">Reminder (in-app only)<input type="datetime-local" value={reminderAt}
          onChange={e=>setReminderAt(e.target.value)}/></label>
      </div>
      <label>Notes<textarea rows={3} maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)}
        placeholder="Context, next steps, or call notes…"/></label>
      <p className="tasks-editor-due-hint">Unsaved changes are kept on this device if you close or reload SalesShop.</p>
      <footer><button type="button" onClick={discard}>Discard draft</button>
       <button type="button" onClick={close}>Close</button>
       <button type="submit" className="tasks-primary">Save task</button></footer>
    </form>
  </div>;
}

export function TasksWorkspace(){
  const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),orgId=useAuthStore(s=>s.organizationId);
  const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
  const scope=taskScope(mode,orgId,userId);
  const previousScope=useRef(scope);
  useEffect(()=>{
   if(previousScope.current===scope)return;
   previousScope.current=scope;
   setEditing(null);setViewingId(null);
  },[scope]);
  const tasks=usePersonalTaskStore(s=>s.tasks),storedScope=usePersonalTaskStore(s=>s.scope);
  const syncStatus=usePersonalTaskStore(s=>s.syncStatus);
  const syncError=usePersonalTaskStore(s=>s.syncError);
  const load=usePersonalTaskStore(s=>s.load),create=usePersonalTaskStore(s=>s.createTask);
  const update=usePersonalTaskStore(s=>s.updateTask),complete=usePersonalTaskStore(s=>s.complete);
  const reopen=usePersonalTaskStore(s=>s.reopen),remove=usePersonalTaskStore(s=>s.remove);
  const [queueFilter,setQueueFilter]=useState('all');
  const nav=useNavigationStore();
  const [editing,setEditing]=useState<PersonalTask|TaskPromotion|null>(null);
  const [viewingId,setViewingId]=useState<string|null>(null);
  const [filter,setFilter]=useState<Filter>('active');
  const [search,setSearch]=useState('');
  const today=localDay();
  useEffect(()=>{
    const launch=()=>{
      let pending=false;
      try{
       pending=window.sessionStorage.getItem('salesshop-create-task-v1')==='1';
       if(pending)window.sessionStorage.removeItem('salesshop-create-task-v1');
      }catch{/* optional browser storage */}
      if(pending){setViewingId(null);setEditing({title:''});}
    };
    launch();
    window.addEventListener('salesshop:create-task',launch);
    return()=>window.removeEventListener('salesshop:create-task',launch);
  },[]);

  useEffect(()=>load(scope),[scope,load]);
  const own=(!rolePreview&&scope&&storedScope===scope)?tasks.filter(t=>!t.deletedAt):[];
  const queues=Array.from(new Set(ownQueueNames(own))).sort();
  const viewing=own.find(task=>task.id===viewingId)??null;
  // Reopen an in-progress editor after the browser discards and restores its tab.
  useEffect(()=>{
    if(!scope||storedScope!==scope||editing||viewingId||rolePreview)return;
    const activeKey=draftStorageKey('task:active',mode,orgId,userId);
    const pending=readSavedDraft<ActiveTaskDraft>(activeKey);
    if(!pending)return;
    if(pending.kind==='new')setEditing({title:''});
    else {
      const current=tasks.find(t=>t.id===pending.id&&!t.deletedAt&&t.workspaceScope===scope);
      if(current)setEditing(current);
    }
  },[scope,storedScope,tasks,mode,orgId,userId,rolePreview,viewingId]);
  const counts=useMemo(()=>({
    active:own.filter(t=>condition(t,today)!=='complete').length,
    today:own.filter(t=>condition(t,today)!=='complete'&&
      (!t.startDate||t.startDate<=today)&&(!t.dueDate||t.dueDate<=today)).length,
    upcoming:own.filter(t=>condition(t,today)!=='complete'&&!!t.dueDate&&t.dueDate>today).length,
    overdue:own.filter(t=>condition(t,today)==='overdue').length,
    scheduled:own.filter(t=>condition(t,today)==='scheduled').length,
    completed:own.filter(t=>condition(t,today)==='complete').length,
    all:own.length,
  }),[own,today]);
  const visible=useMemo(()=>own.filter(t=>{
    const state=condition(t,today),finished=state==='complete';
    if(filter==='active'&&finished)return false;
    if(filter==='today'&&(finished||(t.startDate&&t.startDate>today)||
      (t.dueDate&&t.dueDate>today)))return false;
    if(filter==='upcoming'&&(finished||!t.dueDate||t.dueDate<=today))return false;
    if(filter==='overdue'&&state!=='overdue')return false;
    if(filter==='scheduled'&&state!=='scheduled')return false;
    if(filter==='completed'&&!finished)return false;
    if(queueFilter!=='all'&&(t.queue??'')!==queueFilter)return false;
    return (t.title+' '+(t.notes??'')+' '+(t.sourceLabel??'')+' '+
      (t.associations??[]).map(x=>x.label??'').join(' ')+' '+(t.queue??'')).toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b)=>{
    const aDone=taskComplete(a),bDone=taskComplete(b);
    if(aDone!==bDone)return aDone?1:-1;
    const weight=(p?:TaskPriority)=>({urgent:0,high:1,normal:2,low:3})[p??'normal'];
    return (a.dueDate??'9999').localeCompare(b.dueDate??'9999')||
      weight(a.priority)-weight(b.priority)||b.updatedAt.localeCompare(a.updatedAt);
  }),[own,filter,search,queueFilter,today]);
  // Calendar navigation is preview-first, with editing explicitly chosen from the preview.
  useEffect(()=>{
   const show=()=>{
    let id='';
    try{id=window.sessionStorage.getItem('salesshop-open-task-id-v1')||'';}
    catch{/* unavailable storage */}
    const task=own.find(item=>item.id===id);
    if(!task)return;
    try{window.sessionStorage.removeItem('salesshop-open-task-id-v1');}catch{/* best effort */}
    setViewingId(task.id);
   };
   show();
   window.addEventListener('salesshop:open-calendar-task',show);
   return()=>window.removeEventListener('salesshop:open-calendar-task',show);
  },[own]);
  const taskTableRows:ConnectionTableRow[]=visible.map(task=>({
    id:task.id,name:task.title,
    values:{name:task.title,type:task.type||'todo',priority:task.priority||'normal',
      status:task.status||'open',queue:task.queue||'',start:task.startDate?formatDate(task.startDate):'',
      due:task.dueDate?formatDate(task.dueDate):'',
      related:normalizedTaskAssociations(task).map(link=>link.label||link.type).join(' · '),
      updated:new Date(task.updatedAt).toLocaleDateString()},
    sortValues:{due:task.dueDate??'9999-12-31',start:task.startDate??'',
      updated:task.updatedAt,priority:({urgent:0,high:1,normal:2,low:3})[task.priority??'normal']},
  }));
  const openSource=(link:TaskLink)=>{
    const {id,type}=link;
    if(type==='notebook')nav.openNotebookPage(id);
    if(type==='quote')nav.openQuote(id);
    if(type==='project')nav.openProject(id);
    if(type==='company')nav.openCompany(id);
    if(type==='contact')nav.openPerson(id);
  };
  const quickDue=(id:string,preset:TaskDuePreset)=>{
    const task=own.find(item=>item.id===id);
    if(!task||taskComplete(task)||task.status==='canceled')return;
    const date=taskDuePresetDate(today,preset);
    // Keep an existing due-time when moving a deadline; clearing the date also clears its time.
    update(id,{dueDate:date,dueTime:date?task.dueTime:undefined});
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
      <div className="tasks-header-actions"><SalesCalendarLauncher compact />
       <button type="button" className="tasks-primary" onClick={()=>setEditing({title:''})} disabled={!scope}>+ New task</button></div>
    </header>
    <div className="tasks-summary" aria-label="Task counts">
      {([['active','All open'],['today','Today'],['upcoming','Upcoming'],['overdue','Overdue'],['scheduled','Start later'],['completed','Completed']] as const).map(([key,label])=>
        <button key={key} type="button" onClick={()=>setFilter(key)} className={filter===key?'is-selected':''}>
          <strong>{counts[key]}</strong><span>{label}</span>
        </button>)}
    </div>
    <div className="tasks-tools">
      <input type="search" aria-label="Search tasks" placeholder="Search tasks, notes, queues…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="tasks-filter-row" role="group" aria-label="Task status filter">
        {(['active','today','upcoming','overdue','scheduled','completed','all'] as const).map(key=>
          <button key={key} type="button" aria-pressed={filter===key}
            className={filter===key?'is-selected':''} onClick={()=>setFilter(key)}>{
              key==='active'?'All open':key==='all'?'All history':key==='scheduled'?'Start later':
              key[0].toUpperCase()+key.slice(1)}</button>)}
      </div>
      <label className="tasks-queue-filter">Queue
        <select aria-label="Filter task queue" value={queueFilter} onChange={e=>setQueueFilter(e.target.value)}>
          <option value="all">All queues</option>
          {queues.map(q=><option key={q} value={q}>{q}</option>)}
        </select>
      </label>
    </div>
    <p className="tasks-view-description">A due date never hides a task from All open. “Start later” is for tasks you don't plan to work on yet.</p>
    {!scope&&<p className="tasks-state">Your personal Tasks workspace will load after you sign in to a company.</p>}
    {scope&&<div className="tasks-table-container">
      <ConnectionsTable tableKey="tasks" columns={taskColumns} rows={taskTableRows}
        onOpen={id=>{const selected=visible.find(task=>task.id===id);if(selected)setViewingId(selected.id);}}
        onTaskDuePreset={quickDue}
        onTaskToggleComplete={(id,finished)=>finished?reopen(id):complete(id)}
        onBulkComplete={items=>items.forEach(item=>{
          if(own.some(task=>task.id===item.id&&!taskComplete(task)))complete(item.id);
        })}/>
    </div>}
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
              <span>{isDone?'Completed':task.status==='canceled'?'Canceled':task.status==='in-progress'?'In progress':task.status==='waiting'?'Waiting':state==='scheduled'?'Scheduled':'Open'}</span>
              {task.queue&&<span>Queue: {task.queue}</span>}
              {task.startDate&&<span>Start {formatDate(task.startDate)}</span>}
              {reminderDue&&<span className="is-overdue">Reminder due</span>}
            </div>
            {task.notes&&<p>{task.notes}</p>}
            {task.sourceText&&<blockquote>{task.sourceText.slice(0,260)}</blockquote>}
            {normalizedTaskAssociations(task).map(link=>
              <button key={link.type+':'+link.id} type="button" className="tasks-source"
                onClick={()=>openSource(link)}>Open {link.label??link.type} ↗</button>)}
            {isDone&&task.completedAt&&<small>Completed {new Date(task.completedAt).toLocaleString()}</small>}
          </div>
          <div className="tasks-row-actions">
            <select className="tasks-quick-due" defaultValue="" aria-label={'Quick due date for '+task.title}
              disabled={state==='complete'} onChange={event=>{
                const preset=event.currentTarget.value as TaskDuePreset|'';
                if(preset)quickDue(task.id,preset);
                event.currentTarget.value='';
              }}>
              <option value="">Due date…</option><option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option><option value="next-week">In 7 days</option>
              <option value="clear">Clear due date</option>
            </select>
            {state==='complete'&&<button type="button" onClick={()=>reopen(task.id)}>Reopen</button>}
            <button type="button" onClick={()=>setEditing(task)}>Edit</button>
            <button type="button" onClick={()=>{if(window.confirm('Permanently delete this task record?'))remove(task.id);}}>Delete</button>
          </div>
        </article>;
      })}
    </section>}
    <footer className="tasks-footer">
      {mode==='cloud'
        ?syncStatus==='saved'?'✓ Tasks saved privately to cloud'
          :syncStatus==='pending'?'Cloud save pending · also saved on this device'
          :syncStatus==='loading'?'Loading your private cloud task history…'
          :syncStatus==='error'?'Cloud task sync failed · local records preserved: '+(syncError??'Retry by reopening Tasks')
          :'Personal tasks saved on this device'
        :'Personal tasks saved on this device'}
      {' · '}Reminder dates are tracked in SalesShop. Background emails and push alerts are not enabled.
    </footer>
    {viewing&&<div className="tasks-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setViewingId(null);}}>
      <section className="tasks-preview-card" role="dialog" aria-modal="true" aria-label={'Task '+viewing.title}>
       <header><div><small>TASK · QUICK VIEW</small><h2>{viewing.title}</h2></div>
        <button type="button" aria-label="Close task preview" onClick={()=>setViewingId(null)}>×</button></header>
       <div className="tasks-preview-body">
        <div className="tasks-preview-meta">
         <span>{viewing.type??'To-do'}</span><span>{viewing.status??'open'}</span>
         <span>{viewing.priority??'normal'} priority</span>
         {viewing.queue&&<span>{viewing.queue}</span>}
        </div>
        <dl>
         <div><dt>Due</dt><dd>{viewing.dueDate?formatDate(viewing.dueDate)+(viewing.dueTime?' · '+viewing.dueTime:''):'No due date'}</dd></div>
         {viewing.startDate&&<div><dt>Start</dt><dd>{formatDate(viewing.startDate)}</dd></div>}
        </dl>
        {viewing.notes&&<p className="tasks-preview-notes">{viewing.notes}</p>}
        {!!normalizedTaskAssociations(viewing).length&&<div className="tasks-preview-related">
         <strong>Related records</strong>{normalizedTaskAssociations(viewing).map(link=>
          <button key={link.type+':'+link.id} type="button" onClick={()=>{setViewingId(null);openSource(link);}}>
           {link.label??link.type} ↗</button>)}
        </div>}
       </div>
       <footer>
        <button type="button" onClick={()=>setViewingId(null)}>Close</button>
        <button type="button" onClick={()=>{taskComplete(viewing)?reopen(viewing.id):complete(viewing.id);setViewingId(null);}}>
         {taskComplete(viewing)?'Reopen task':'Mark complete'}</button>
        <button type="button" className="tasks-primary" onClick={()=>{setViewingId(null);setEditing(viewing);}}>Edit task</button>
       </footer>
      </section>
     </div>}
    {editing&&<TaskEditor key={'id'in editing?editing.id:editing.title+'new'} initial={editing} onCancel={()=>setEditing(null)} onSave={save}/>}
  </main>;
}
