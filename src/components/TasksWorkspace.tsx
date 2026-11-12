import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {usePersonalTaskStore,taskScope,normalizedTaskAssociations,type TaskAssociation,type PersonalTask,type TaskChanges,type TaskLink,type TaskPriority,type TaskPromotion,type TaskStatus,type TaskType,type TaskSubtask,subtaskProgress,normalizedSubtasks,
 isProtectedBidTask,bidTaskDealId} from '../store/personalTaskStore';
import {TaskAssociationsField} from './TaskAssociationsField';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import {TaskPreviewDueControls} from './TaskPreviewDueControls';
import {taskDuePresetDate,type TaskDuePreset} from '../services/taskSchedule';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {canEditTeamArea} from '../services/teamDepartments';
import {ConnectionsTable,type ConnectionColumn,type ConnectionTableRow} from './ConnectionsTable';
import {WorkspaceHeader,WorkspaceMoreMenu} from './WorkspaceHeader';
import {WorkspaceHelp} from './WorkspaceHelp';
import {WorkspaceLoadingState} from './WorkspaceLoadingState';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';
import {TrashIcon,PencilIcon} from './TrashIcon';
import {ExternalQuoteBackfillDialog} from './ExternalQuoteBackfillDialog';
import {PreviewPanelHeading,PreviewPanelClose,PreviewPanelActions} from './PreviewPanelChrome';
import {RecordEditField,RecordFormFeedback,RECORD_CHANGE_APPLIED_MESSAGE,type RecordFormNotice} from './RecordFormFeedback';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {MobileSheetHandle} from './MobileSheetHandle';
import type {TaskBulkChange} from './TaskBulkEditDialog';
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
 dueDateResponsibility?:'internal'|'external'|'neutral';dueDateChangeReason?:string;
 queue:string;notes:string;selectedLinks:TaskAssociation[];subtasks:TaskSubtask[];newSubtask?:string;
};
type ActiveTaskDraft={kind:'new'|'existing';id?:string;draftIdentity?:string};
export function TaskEditor({initial,onCancel,onSave}:{
  initial:Partial<PersonalTask>|TaskPromotion;onCancel:()=>void;onSave:(changes:TaskChanges&{title:string})=>void;
}){
  // A promotion draft is a subset of the ordinary task editor fields.
  // Use one typed draft shape so optional properties remain correctly typed.
  const auth=useAuthStore.getState();
  const initialTaskId='id'in initial&&typeof initial.id==='string'?initial.id:null;
  const initialLinks=normalizedTaskAssociations(initial);
  // Separate contextual new-task drafts from a user's general new-task draft.
  const draftIdentity=initialTaskId??('draftIdentity' in initial&&typeof initial.draftIdentity==='string'
   ?initial.draftIdentity:initialLinks.length
   ?'new:context:'+initialLinks[0].type+':'+initialLinks[0].id:'new');
  const scopeKey=draftStorageKey('task:'+draftIdentity,auth.mode,auth.organizationId,auth.user?.id);
  const activeKey=draftStorageKey('task:active',auth.mode,auth.organizationId,auth.user?.id);
  const recovered=useMemo(()=>readSavedDraft<TaskEditorRecovery>(scopeKey),[scopeKey]);
  const draft:Partial<PersonalTask>=initial;
  const [title,setTitle]=useState(recovered?.title??draft.title??'');
  const [type,setType]=useState<TaskType>(initialTaskId
   ?recovered?.type??draft.type??'todo'
   :draft.type??recovered?.type??'todo');
  const [priority,setPriority]=useState<TaskPriority>(recovered?.priority??draft.priority??'normal');
  const [status,setStatus]=useState<TaskStatus>(recovered?.status??draft.status??'open');
  const [dueDate,setDueDate]=useState(initialTaskId
   ?recovered?.dueDate??draft.dueDate??''
   :draft.dueDate??recovered?.dueDate??'');
  const [dueDateResponsibility,setDueDateResponsibility]=useState<'internal'|'external'|'neutral'>(
    recovered?.dueDateResponsibility??draft.dueDateResponsibility??'neutral');
  const [dueDateChangeReason,setDueDateChangeReason]=useState(recovered?.dueDateChangeReason??draft.dueDateChangeReason??'');
  const [startDate,setStartDate]=useState(recovered?.startDate??draft.startDate??'');
  const [dueTime,setDueTime]=useState(recovered?.dueTime??draft.dueTime??'');
  const [reminderAt,setReminderAt]=useState(recovered?.reminderAt??reminderValue(draft.reminderAt));
  const [showReminder,setShowReminder]=useState(Boolean(recovered?.reminderAt??draft.reminderAt));
  const [queue,setQueue]=useState(recovered?.queue??draft.queue??'');
  const [notes,setNotes]=useState(recovered?.notes??draft.notes??'');
  const [subtasks,setSubtasks]=useState<TaskSubtask[]>(()=>normalizedSubtasks(
    recovered?.subtasks??draft.subtasks));
  const [newSubtask,setNewSubtask]=useState(recovered?.newSubtask??'');
  const addSubtask=()=>{
    const text=newSubtask.trim();
    if(!text||subtasks.length>=60)return;
    setSubtasks(old=>[...old,{id:'sub_'+crypto.randomUUID(),title:text.slice(0,180),completed:false}]);
    setNewSubtask('');
  };
  const [formError,setFormError]=useState('');
  const [selectedLinks,setSelectedLinks]=useState<TaskAssociation[]>(()=>recovered?.selectedLinks??normalizedTaskAssociations(initial));
  // Every form change is durable locally before submission. No unsaved task is sent to cloud.
  useEffect(()=>{
   writeSavedDraft(scopeKey,{title,type,priority,status,dueDate,dueDateResponsibility,dueDateChangeReason,startDate,dueTime,reminderAt,queue,notes,selectedLinks,subtasks,newSubtask});
   writeSavedDraft<ActiveTaskDraft>(activeKey,{
    kind:initialTaskId?'existing':'new',
    id:initialTaskId??undefined,
    draftIdentity:initialTaskId?undefined:draftIdentity,
   });
  },[scopeKey,activeKey,title,type,priority,status,dueDate,dueDateResponsibility,dueDateChangeReason,startDate,dueTime,reminderAt,queue,notes,selectedLinks,subtasks,newSubtask]);
  const close=()=>{clearSavedDraft(activeKey);onCancel();};
  const editorRef=useDismissibleLayer<HTMLFormElement>(true,close);
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
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!title.trim()){setFormError('Enter a task title.');return;}
    setFormError('');
    try{
      const pending=newSubtask.trim().slice(0,180);
      const savedSubtasks=pending&&subtasks.length<60?
        [...subtasks,{id:'sub_'+crypto.randomUUID(),title:pending,completed:false}]:subtasks;
      onSave({title:title.trim(),type,priority,status,startDate:startDate||undefined,dueDate:dueDate||undefined,
        dueTime:dueDate?dueTime||undefined:undefined,reminderAt:normalizeLocalReminder(reminderAt),
        dueDateResponsibility,dueDateChangeReason:dueDateChangeReason.trim()||undefined,
        notes,queue,subtasks:savedSubtasks,associations:selectedLinks,
        linked:selectedLinks[0]?{type:selectedLinks[0].type,id:selectedLinks[0].id}:undefined,
        sourceLabel:selectedLinks[0]?.label??sourceLabel,sourceText,sourceObjectId});
      clearSavedDraft(scopeKey);clearSavedDraft(activeKey);
    }catch(reason){setFormError(reason instanceof Error?reason.message:'Unable to apply task changes. Draft preserved.');}
  };
  return <div className="tasks-dialog-backdrop ss-mobile-sheet-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)close();}}>
    <form ref={editorRef} className="tasks-editor ss-mobile-sheet" role="dialog" aria-modal="true" aria-label={'Edit task '+(title||'new')}
      noValidate onChange={()=>setFormError('')} onSubmit={submit}>
      <MobileSheetHandle onClose={close}/>
      <header><strong>{'id'in initial?'Edit task':'New task'}</strong>
        <PreviewPanelClose label="Close task editor" onClose={close} initialFocus={false}/></header>
      <div className="tasks-editor-scroll ss-mobile-sheet-body">
      <RecordEditField label="Task title" required error={formError==='Enter a task title.'?formError:undefined}>
        {control=><input {...control} autoFocus={typeof window!=='undefined'&&window.matchMedia('(min-width:761px)').matches}
          data-dialog-initial-focus={typeof window!=='undefined'&&window.matchMedia('(min-width:761px)').matches?'true':undefined}
          maxLength={240}
          value={title} onChange={e=>setTitle(e.target.value)} placeholder="What needs to happen?"/>}
      </RecordEditField>
      {sourceText&&<p className="tasks-editor-source">Promoted from Notebook · Original text preserved</p>}
      <TaskAssociationsField options={associations.map(item=>({...item,
        linked:{...item.linked,label:item.label}}))} value={selectedLinks} onChange={setSelectedLinks}/>
      <section className="tasks-editor-section">
       <div className="tasks-editor-section-heading"><strong>Details</strong></div>
       <div className="tasks-editor-grid">
        <label>Type<select value={type} onChange={e=>setType(e.target.value as TaskType)}>
         {types.map(t=><option key={t} value={t}>{t==='todo'?'To-do':t==='follow-up'?'Follow-up':t[0].toUpperCase()+t.slice(1)}</option>)}</select></label>
        <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as TaskPriority)}>
         {priorities.map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
        <label>Status<select value={status} onChange={e=>setStatus(e.target.value as TaskStatus)}>
         {statusOptions.filter(x=>!isProtectedBidTask(initial)||('submissionConfirmedAt'in initial&&Boolean(initial.submissionConfirmedAt))||x!=='completed').map(x=>
          <option value={x} key={x}>{x==='in-progress'?'In progress':x[0].toUpperCase()+x.slice(1)}</option>)}
        </select></label>
        <label>Queue / category<input list="tasks-queue-choices" value={queue} maxLength={80}
         placeholder="e.g. Quotes" onChange={e=>setQueue(e.target.value)}/>
         <datalist id="tasks-queue-choices">{commonQueues.map(q=><option key={q} value={q}/>)}</datalist>
        </label>
       </div>
      </section>
      {isProtectedBidTask(initial)&&<p className="tasks-bid-guard-help" role="note">
       Bid submission completion is recorded through confirmed Quote delivery or an external quote submission, not the Task status selector.
      </p>}
      <section className="tasks-editor-section">
       <div className="tasks-editor-section-heading"><strong>Schedule</strong>
        <small>Leave Start blank if available now.</small></div>
       <div className="tasks-editor-grid tasks-editor-date-grid">
        <label>Start on<input type="date" value={startDate} title="Optional start date"
         onChange={e=>setStartDate(e.target.value)}/></label>
        <label>Current due date<input type="date" value={dueDate} title="Task deadline"
         disabled={isProtectedBidTask(initial)}
         onChange={e=>setDueDate(e.target.value)}/></label>
        <label>Due time<input type="time" disabled={!dueDate} value={dueTime}
         onChange={e=>setDueTime(e.target.value)}/></label>
        {initialTaskId&&<label>Original due date
         <input type="text" readOnly value={draft.originalDueDate??'Not previously recorded'}/></label>}
        {!isProtectedBidTask(initial)&&<>
         <label>Deadline responsibility<select value={dueDateResponsibility}
           onChange={e=>setDueDateResponsibility(e.target.value as 'internal'|'external'|'neutral')}>
           <option value="neutral">Unassigned / no team fault</option>
           <option value="external">Client / external dependency</option>
           <option value="internal">Our team</option>
         </select></label>
         <label>Reschedule reason<input maxLength={500} value={dueDateChangeReason}
           onChange={e=>setDueDateChangeReason(e.target.value)} placeholder="Optional explanation"/></label>
        </>}
       </div>
       <button type="button" className="tasks-editor-reminder-toggle"
        aria-expanded={showReminder} onClick={()=>setShowReminder(value=>!value)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round" aria-hidden="true">
         <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg> {showReminder?'Hide reminder':'Add / edit reminder'}
        {reminderAt&&<small>Set</small>}
       </button>
       {showReminder&&<label className="tasks-editor-reminder-label">
        Reminder (in-app only)<input type="datetime-local" value={reminderAt}
         onChange={e=>setReminderAt(e.target.value)}/>
       </label>}
      </section>
      <section className="tasks-editor-section tasks-subtasks-section" aria-label="Subtasks">
       <div className="tasks-editor-section-heading"><strong>Subtasks</strong>
        <small>{subtasks.length?subtasks.filter(s=>s.completed).length+' of '+subtasks.length+' completed':
         'Simple checklist — no separate dates or assignments'}</small></div>
       <div className="tasks-subtask-list">
        {subtasks.map(subtask=><div className="tasks-subtask-row" key={subtask.id}>
         <input type="checkbox" checked={subtask.completed}
          aria-label={'Complete '+subtask.title}
          onChange={e=>setSubtasks(rows=>rows.map(item=>item.id===subtask.id?
           {...item,completed:e.target.checked}:item))}/>
         <input type="text" aria-label="Subtask name" maxLength={180}
          value={subtask.title} onChange={e=>setSubtasks(rows=>rows.map(item=>
           item.id===subtask.id?{...item,title:e.target.value}:item))}/>
         <button type="button" title="Remove subtask" aria-label={'Remove '+subtask.title}
          onClick={()=>setSubtasks(rows=>rows.filter(item=>item.id!==subtask.id))}>×</button>
        </div>)}
       </div>
       <div className="tasks-subtask-add">
        <input value={newSubtask} maxLength={180} placeholder="Add a checklist item…"
          aria-label="New subtask"
          onChange={e=>setNewSubtask(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addSubtask();}}}/>
        <button type="button" disabled={!newSubtask.trim()||subtasks.length>=60}
          onClick={addSubtask}>+ Add</button>
       </div>
       {subtasks.length>0&&<p className="tasks-subtask-help">
        The parent task completes automatically when all checklist items are checked.
        Unchecking one reopens it.</p>}
      </section>
      <label className="tasks-editor-notes">Notes<textarea rows={2} maxLength={5000}
       value={notes} onChange={e=>setNotes(e.target.value)}
       placeholder="Context or next steps…"/></label>
      <p className="tasks-editor-due-hint">Unsaved changes are kept on this device if you close or reload SalesShop.</p>
      <RecordFormFeedback notice={formError&&formError!=='Enter a task title.'?{kind:'error',message:formError}:null}/>
      </div>
      <PreviewPanelActions className="ss-record-editor-actions ss-mobile-sheet-actions"><button type="button" onClick={discard}>Discard draft</button>
       <button type="button" onClick={close}>Close</button>
       <button type="submit" className="tasks-primary">Save task</button></PreviewPanelActions>
    </form>
  </div>;
}

export function TasksWorkspace({embedded=false,externalQuery=''}:{embedded?:boolean;externalQuery?:string}={}){
  const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),orgId=useAuthStore(s=>s.organizationId);
  const teamRole=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
  const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
  const canLog=!rolePreview&&(mode==='local'||canEditTeamArea(teamRole,department,'crm'));
  const scope=taskScope(mode,orgId,userId);
  const previousScope=useRef(scope);
  const tasks=usePersonalTaskStore(s=>s.tasks),storedScope=usePersonalTaskStore(s=>s.scope);
  const syncStatus=usePersonalTaskStore(s=>s.syncStatus);
  const syncError=usePersonalTaskStore(s=>s.syncError);
  const load=usePersonalTaskStore(s=>s.load),create=usePersonalTaskStore(s=>s.createTask);
  const update=usePersonalTaskStore(s=>s.updateTask),complete=usePersonalTaskStore(s=>s.complete);
  const reopen=usePersonalTaskStore(s=>s.reopen),remove=usePersonalTaskStore(s=>s.remove);
  const [queueFilter,setQueueFilter]=useState('all');
  const nav=useNavigationStore();
  const quotes=useQuoteStore(s=>s.quotes);
  const [editing,setEditing]=useState<PersonalTask|TaskPromotion|null>(null);
  const [taskNotice,setTaskNotice]=useState<RecordFormNotice|null>(null);
  const [viewingId,setViewingId]=useState<string|null>(null);
  const [externalDealId,setExternalDealId]=useState<string|null>(null);
  const hasTaskOverlay=Boolean(editing||viewingId||externalDealId);
  useModalScrollLock(hasTaskOverlay);
  useEffect(()=>{
   if(previousScope.current===scope)return;
   previousScope.current=scope;
   setEditing(null);setViewingId(null);setExternalDealId(null);setTaskNotice(null);
  },[scope]);
  const [filter,setFilter]=useState<Filter>(()=>{
  try{
   const target=sessionStorage.getItem('salesshop-records-task-filter-v1');
   if(target==='overdue'||target==='active'){
    sessionStorage.removeItem('salesshop-records-task-filter-v1');
    return target;
   }
  }catch{/* optional browser storage */}
  return 'active';
 });
  const [search,setSearch]=useState('');
  const searchTerm=embedded?externalQuery:search;
  const [taskToolbarHost,setTaskToolbarHost]=useState<HTMLDivElement|null>(null);
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
  const viewingDealId=viewing?(bidTaskDealId(viewing)??
    normalizedTaskAssociations(viewing).find(link=>link.type==='project')?.id??null):null;
  const viewingQuote=viewing?quotes.find(quote=>!quote.archivedAt&&
    (mode!=='cloud'||quote.ownerUserId===userId)&&
    (quote.projectId===viewingDealId||
      normalizedTaskAssociations(viewing).some(link=>link.type==='quote'&&link.id===quote.id))):undefined;
  const previewRef=useDismissibleLayer<HTMLElement>(Boolean(viewing),()=>setViewingId(null));
  // Reopen an in-progress editor after the browser discards and restores its tab.
  useEffect(()=>{
    if(!scope||storedScope!==scope||editing||viewingId||rolePreview)return;
    const activeKey=draftStorageKey('task:active',mode,orgId,userId);
    const pending=readSavedDraft<ActiveTaskDraft>(activeKey);
    if(!pending)return;
    if(pending.kind==='new')setEditing({title:'',draftIdentity:pending.draftIdentity});
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
      (t.associations??[]).map(x=>x.label??'').join(' ')+' '+(t.queue??'')).toLowerCase().includes(searchTerm.trim().toLowerCase());
  }).sort((a,b)=>{
    const aDone=taskComplete(a),bDone=taskComplete(b);
    if(aDone!==bDone)return aDone?1:-1;
    const weight=(p?:TaskPriority)=>({urgent:0,high:1,normal:2,low:3})[p??'normal'];
    return (a.dueDate??'9999').localeCompare(b.dueDate??'9999')||
      weight(a.priority)-weight(b.priority)||b.updatedAt.localeCompare(a.updatedAt);
  }),[own,filter,searchTerm,queueFilter,today]);
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
      subtaskRemaining:String(subtaskProgress(task).remaining),
      protectedBid:isProtectedBidTask(task)&&!task.submissionConfirmedAt?'1':'0',
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
    if(!task||taskComplete(task)||task.status==='canceled'||isProtectedBidTask(task))return;
    const date=taskDuePresetDate(today,preset);
    // Keep an existing due-time when moving a deadline; clearing the date also clears its time.
    update(id,{dueDate:date,dueTime:date?task.dueTime:undefined});
  };
  const save=(changes:TaskChanges&{title:string})=>{
    if(!scope)throw new Error('Task workspace is unavailable. Keep this draft and try again.');
    if(editing&&'id'in editing)update(editing.id,changes);
    else{
      const created=create(changes.title,changes);
      if(!created)throw new Error('Unable to add this task. Your draft is preserved.');
    }
    setEditing(null);
    setTaskNotice({kind:'applied',message:RECORD_CHANGE_APPLIED_MESSAGE});
  };
  if(rolePreview)return <main className="tasks-workspace"><h1>Tasks</h1><p>Personal tasks are not shown in role preview.</p></main>;
  return <main className={"tasks-workspace"+(embedded?" is-records-embedded":"")} aria-label="SalesShop tasks">
    {!embedded&&<WorkspaceHeader title="Tasks" help={<WorkspaceHelp page="tasks" section={filter}/>} className="tasks-header"
      mobileTabs={[
       {value:'active',label:'Open'},{value:'completed',label:'Completed'},
      ]} mobileTabValue={filter} onMobileTabChange={value=>setFilter(value as typeof filter)}
      tabs={<nav className="tasks-header-tabs" aria-label="Task views">
       {([['active','Open'],['completed','Completed']] as const).map(([key,label])=>
         <button type="button" key={key} className={filter===key?'active':''}
           aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}
      </nav>}
      more={<WorkspaceMoreMenu items={[
        {section:'Due date filters',label:'Due today',onClick:()=>setFilter('today'),active:filter==='today'},
        {label:'Upcoming tasks',onClick:()=>setFilter('upcoming'),active:filter==='upcoming'},
        {label:'Overdue tasks',onClick:()=>setFilter('overdue'),active:filter==='overdue'},
        {label:'Start later',onClick:()=>setFilter('scheduled'),active:filter==='scheduled'},
        {section:'History',label:'All history',onClick:()=>setFilter('all'),active:filter==='all'},
        {section:'Related workspaces',label:'Activity history',onClick:()=>{
          try{window.sessionStorage.setItem('salesshop-open-activity-history-v1','1');}catch{}
          nav.setView('dashboard');window.dispatchEvent(new Event('salesshop:open-activity-history'));
        }},
      ]}/>}
      search={<input type="search" aria-label="Search tasks" placeholder="Search tasks…"
        value={search} onChange={event=>setSearch(event.target.value)}/>}
      primary={<button type="button" className="tasks-primary" onClick={()=>setEditing({title:''})}
        disabled={!scope}>+ Task</button>}
    />}
    <div className="tasks-directory-content">
    <RecordFormFeedback notice={taskNotice} className="tasks-save-feedback"/>
    {embedded&&<nav className="tasks-records-mobile-tabs tasks-records-tabs" aria-label="Task status on mobile">
      {([['active','Open'],['completed','Completed']] as const).map(([key,label])=>
       <button type="button" key={key} aria-pressed={filter===key}
        className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}
    </nav>}
    {!embedded&&<section className="tasks-directory-controls" aria-label="Task directory controls">
      <p className="tasks-directory-caption">{visible.length} {visible.length===1?'task':'tasks'} · {counts.active} open · {counts.today} due today · {counts.overdue} overdue</p>
      <div className="tasks-toolbar-slot" ref={setTaskToolbarHost}/>
      <div className="tasks-mobile-controls">
        <div className="tasks-summary" aria-label="Task counts">
          {([['active','All open'],['today','Today'],['upcoming','Upcoming'],['overdue','Overdue'],['scheduled','Start later'],['completed','Completed']] as const).map(([key,label])=>
            <button key={key} type="button" onClick={()=>setFilter(key)} aria-pressed={filter===key}
              className={filter===key?'is-selected':''}>
              <strong>{counts[key]}</strong><span>{label}</span>
            </button>)}
        </div>
        <div className="tasks-tools">
          <SalesCalendarLauncher compact/>
          <label className="tasks-queue-filter">Queue
            <select aria-label="Filter task queue" value={queueFilter} onChange={e=>setQueueFilter(e.target.value)}>
              <option value="all">All queues</option>
              {queues.map(q=><option key={q} value={q}>{q}</option>)}
            </select>
          </label>
        </div>
      </div>
    </section>}
    {!scope&&<p className="tasks-state">Your personal Tasks workspace will load after you sign in to a company.</p>}
    {scope&&storedScope!==scope&&<WorkspaceLoadingState title="Loading Tasks"
      detail="Opening your personal task list for this workspace…" />}
    {scope&&storedScope===scope&&<div className="tasks-table-container">
      <ConnectionsTable tableKey="tasks" columns={taskColumns} rows={taskTableRows}
        toolbarTarget={embedded?undefined:taskToolbarHost}
        toolbarControls={<>
          {embedded&&<nav className="tasks-records-tabs" aria-label="Task status">
            {([['active','Open'],['completed','Completed']] as const).map(([key,label])=>
             <button type="button" key={key} aria-pressed={filter===key} className={filter===key?'active':''}
              onClick={()=>setFilter(key)}>{label}</button>)}
          </nav>}
          <details className="tasks-overview-menu">
            <summary>Overview <WorkspaceChromeIcon name="chevron-down"/></summary>
            <div className="tasks-summary" aria-label="Task counts">
              {([['active','All open'],['today','Today'],['upcoming','Upcoming'],['overdue','Overdue'],['scheduled','Start later'],['completed','Completed']] as const).map(([key,label])=>
              <button key={key} type="button" onClick={event=>{
                setFilter(key);event.currentTarget.closest('details')?.removeAttribute('open');
              }} aria-pressed={filter===key} className={filter===key?'is-selected':''}>
                <strong>{counts[key]}</strong><span>{label}</span>
              </button>)}
            </div>
          </details>
          <SalesCalendarLauncher compact/>
          <label className="tasks-queue-filter">Queue
            <select aria-label="Filter task queue" value={queueFilter} onChange={e=>setQueueFilter(e.target.value)}>
              <option value="all">All queues</option>
              {queues.map(q=><option key={q} value={q}>{q}</option>)}
            </select>
          </label>
        </>}
        onOpen={id=>{const selected=visible.find(task=>task.id===id);if(selected)setViewingId(selected.id);}}
        onTaskDelete={id=>{
          if(!own.some(item=>item.id===id))return;
          if(window.confirm('Delete this task? It will disappear from Tasks and Agenda.'))remove(id);
        }}
        onBulkTaskDelete={async items=>{
          const store=usePersonalTaskStore.getState();
          if(!scope||store.scope!==scope)throw new Error('Task workspace changed. Select tasks again.');
          const eligible=new Set(store.tasks.filter(t=>t.workspaceScope===scope&&!t.deletedAt).map(t=>t.id));
          if(items.some(item=>!eligible.has(item.id)))throw new Error('Some selected tasks are no longer available.');
          items.forEach(item=>remove(item.id));
          setTaskNotice({kind:'applied',message:items.length+' tasks deleted.'});
        }}
        onTaskDuePreset={quickDue}
        onTaskToggleComplete={(id,finished)=>{
          const task=own.find(item=>item.id===id);
          if(task&&!finished&&isProtectedBidTask(task)&&!task.submissionConfirmedAt)return;
          if(finished)reopen(id);else complete(id);
        }}
        onBulkComplete={items=>{
          const protectedCount=items.filter(item=>own.some(task=>task.id===item.id&&isProtectedBidTask(task)&&!task.submissionConfirmedAt)).length;
          items.forEach(item=>{
           if(own.some(task=>task.id===item.id&&!taskComplete(task)&&(!isProtectedBidTask(task)||Boolean(task.submissionConfirmedAt))))complete(item.id);
          });
          if(protectedCount)setTaskNotice({kind:'error',
            message:protectedCount+' bid submission task(s) require confirmed Quote delivery or a recorded external quote.'});
        }}
        onBulkTaskProperty={async(items,change:TaskBulkChange)=>{
          const current=usePersonalTaskStore.getState();
          if(!scope||current.scope!==scope)throw new Error('Task workspace changed. Reopen Tasks before editing.');
          const found=new Set(current.tasks.filter(t=>t.workspaceScope===scope&&!t.deletedAt).map(t=>t.id));
          if(items.some(item=>!found.has(item.id)))throw new Error('Some tasks changed since selection. Refresh and select again.');
          for(const item of items)update(item.id,change);
        }}/>
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
            disabled={!isDone&&isProtectedBidTask(task)&&!task.submissionConfirmedAt}
            onChange={()=>isDone?reopen(task.id):complete(task.id)}/></label>
          <div className="tasks-row-body">
            <div className="tasks-row-top"><button type="button" className="tasks-row-title"
              onClick={()=>setViewingId(task.id)} aria-label={'Preview task '+task.title}>{task.title}</button>
              <span className={'tasks-priority is-'+(task.priority??'normal')}>{task.priority??'normal'}</span></div>
            <div className="tasks-row-meta"><span>{task.type==='todo'||!task.type?'To-do':task.type}</span>
              <span className={'tasks-due-label'+(state==='overdue'?' is-overdue':'')}>{task.dueDate?'Due '+formatDate(task.dueDate)+(task.dueTime?' · '+task.dueTime:''):'No due date'}</span>
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
            <label className="tasks-mobile-priority">Priority
              <select aria-label={'Priority for '+task.title}
                value={task.priority??'normal'} disabled={isDone||task.status==='canceled'}
                onChange={event=>update(task.id,{priority:event.currentTarget.value as TaskPriority})}>
                {priorities.map(level=><option key={level} value={level}>{level[0].toUpperCase()+level.slice(1)}</option>)}
              </select>
            </label>
            <button type="button" className="tasks-mobile-today"
              disabled={isDone||task.status==='canceled'}
              aria-label={(task.dueDate===today?'Clear due-today date for ':'Set due date to today for ')+task.title}
              onClick={()=>quickDue(task.id,task.dueDate===today?'clear':'today')}>
              {task.dueDate===today?'Clear today':'Due today'}
            </button>
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
            <button type="button" className="tasks-row-delete"
              onClick={()=>{if(window.confirm('Delete this task? It will be removed from Tasks and Agenda.'))remove(task.id);}}>
              <TrashIcon/> Delete</button>
            <button type="button" className="tasks-mobile-more"
              aria-label={'More options for '+task.title}
              onClick={()=>setViewingId(task.id)}>…</button>
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
    </div>
    {viewing&&<div className="tasks-dialog-backdrop ss-mobile-sheet-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)setViewingId(null);}}>
      <section ref={previewRef} className="tasks-preview-card ss-mobile-sheet" role="dialog" aria-modal="true" aria-label={'Task '+viewing.title}>
       <MobileSheetHandle onClose={()=>setViewingId(null)}/>
       <header><PreviewPanelHeading eyebrow="TASK · QUICK VIEW" title={viewing.title}/>
        <PreviewPanelClose label="Close task preview" onClose={()=>setViewingId(null)}/></header>
       <div className="tasks-preview-body ss-mobile-sheet-body">
        <div className="tasks-preview-meta">
         <span>{viewing.type??'To-do'}</span><span>{viewing.status??'open'}</span>
         <span>{viewing.priority??'normal'} priority</span>
         {viewing.queue&&<span>{viewing.queue}</span>}
        </div>
        <dl>
         <div><dt>Due</dt><dd>{viewing.dueDate?formatDate(viewing.dueDate)+(viewing.dueTime?' · '+viewing.dueTime:''):'No due date'}</dd></div>
         {viewing.originalDueDate&&<div><dt>Original due</dt><dd>{formatDate(viewing.originalDueDate)}</dd></div>}
         {viewing.dueDateResponsibility==='external'&&<div><dt>Deadline shift</dt><dd>External dependency</dd></div>
         {viewing.startDate&&<div><dt>Start</dt><dd>{formatDate(viewing.startDate)}</dd></div>}
        </dl>
        <TaskPreviewDueControls task={viewing} onUpdate={update}/>
        {Boolean(viewing.dueDateHistory?.length)&&<details className="task-deadline-history">
         <summary>Deadline history · {viewing.dueDateHistory?.length} change(s)</summary>
         <ul>{viewing.dueDateHistory?.map((change,index)=><li key={index}>
          {change.from||'Unscheduled'} → {change.to||'Unscheduled'}
          {' · '}{change.responsibility==='external'?'External dependency':
            change.responsibility==='internal'?'Our team':'No fault assigned'}
          {change.reason?' · '+change.reason:''}
         </li>)}</ul>
        </details>
        {viewing.notes&&<p className="tasks-preview-notes">{viewing.notes}</p>}
        {normalizedSubtasks(viewing.subtasks).length>0&&<section className="tasks-preview-subtasks" aria-label="Subtasks">
         <strong>Checklist · {subtaskProgress(viewing).done}/{subtaskProgress(viewing).total}</strong>
         {normalizedSubtasks(viewing.subtasks).map(item=><label key={item.id}
           className={item.completed?'is-done':''}>
           <input type="checkbox" checked={item.completed} aria-label={'Complete '+item.title}
             onChange={e=>update(viewing.id,{subtasks:normalizedSubtasks(viewing.subtasks).map(row=>
               row.id===item.id?{...row,completed:e.target.checked}:row)})}/>
           <span>{item.title}</span>
         </label>)}
        </section>}
        {!!normalizedTaskAssociations(viewing).length&&<div className="tasks-preview-related">
         <strong>Related records</strong>{normalizedTaskAssociations(viewing).map(link=>
          <button key={link.type+':'+link.id} type="button" onClick={()=>{setViewingId(null);openSource(link);}}>
           {link.label??link.type} ↗</button>)}
        </div>}
       </div>
       <PreviewPanelActions className="ss-mobile-sheet-actions tasks-preview-action-groups">
        <div className="tasks-preview-actions-left">
         <button type="button" className="tasks-preview-delete" onClick={()=>{
          if(!window.confirm('Delete this task? It will be removed from your Tasks and Agenda.'))return;
          remove(viewing.id);setViewingId(null);
         }}><TrashIcon/> Delete</button>
         <button type="button" className="tasks-primary tasks-preview-edit"
          onClick={()=>{setViewingId(null);setEditing(viewing);}}>
          <PencilIcon/> Edit</button>
        </div>
        <div className="tasks-preview-actions-right">
         {isProtectedBidTask(viewing)&&!viewing.submissionConfirmedAt?<>
          {viewingDealId&&<button type="button" onClick={()=>{
            setViewingId(null);nav.openProject(viewingDealId);
          }}>Open linked Deal ↗</button>}
          {viewingQuote&&<button type="button" onClick={()=>{
            setViewingId(null);nav.openQuote(viewingQuote.id);
          }}>Open linked Quote ↗</button>}
          {canLog&&<button type="button" className="tasks-flow-action"
           onClick={()=>{setViewingId(null);setExternalDealId(bidTaskDealId(viewing));}}>
           Record external quote</button>}
          <button type="button" disabled
           title="Completion requires confirmed customer delivery or a recorded external submission">
           Complete · quote required</button>
         </>:<>
          {viewingQuote&&<button type="button" onClick={()=>{
            setViewingId(null);nav.openQuote(viewingQuote.id);
          }}>Open linked Quote ↗</button>}
          <button type="button" disabled={!taskComplete(viewing)&&subtaskProgress(viewing).remaining>0}
           title={!taskComplete(viewing)&&subtaskProgress(viewing).remaining>0?'Complete the checklist first':undefined}
           onClick={()=>{taskComplete(viewing)?reopen(viewing.id):complete(viewing.id);setViewingId(null);}}>
           {taskComplete(viewing)?'Reopen task':'Complete'}</button>
          {canLog&&!taskComplete(viewing)&&viewing.status!=='canceled'&&subtaskProgress(viewing).remaining===0&&
           <button type="button" className="tasks-flow-action" onClick={()=>{
            setViewingId(null);openActivityComposer({taskId:viewing.id});
           }}>Complete + Log Activity</button>}
         </>}
        </div>
       </PreviewPanelActions>
      </section>
     </div>}
    {editing&&<TaskEditor key={'id'in editing?editing.id:editing.title+'new'} initial={editing} onCancel={()=>setEditing(null)} onSave={save}/>}
    {externalDealId&&<ExternalQuoteBackfillDialog key={externalDealId}
      initialDealId={externalDealId} onClose={()=>setExternalDealId(null)}
      onRecorded={()=>setExternalDealId(null)}/>}
  </main>;
}
