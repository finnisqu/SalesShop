import {useEffect,useState} from 'react';
import {TaskEditor} from './TasksWorkspace';
import {usePersonalTaskStore,taskScope,normalizedTaskAssociations,
 type PersonalTask,type TaskChanges,type TaskType,type TaskAssociation,type TaskLink} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNavigationStore} from '../store/navigationStore';

export interface CalendarTaskRequest {
 mode:'create'|'preview'|'edit';id?:string;dueDate?:string;
 type?:TaskType;title?:string;associations?:TaskAssociation[];
}
export function requestTaskModal(detail:CalendarTaskRequest){
 window.dispatchEvent(new CustomEvent<CalendarTaskRequest>('salesshop:task-modal',{detail}));
}
/** Globally mounted editor; Home and Calendar remain visible underneath the modal. */
export function TaskModalHost(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const scope=taskScope(mode,org,userId);
 const storedScope=usePersonalTaskStore(s=>s.scope);
 const tasks=usePersonalTaskStore(s=>s.tasks);
 const create=usePersonalTaskStore(s=>s.createTask);
 const update=usePersonalTaskStore(s=>s.updateTask);
 const complete=usePersonalTaskStore(s=>s.complete);
 const reopen=usePersonalTaskStore(s=>s.reopen);
 const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
 const nav=useNavigationStore();
 const [request,setRequest]=useState<CalendarTaskRequest|null>(null);
 useEffect(()=>{
  const receive=(event:Event)=>{
   const detail=(event as CustomEvent<CalendarTaskRequest>).detail;
   if((detail.mode==='preview'||detail.mode==='edit')&&!detail.id)return;
   setRequest(detail);
  };
  window.addEventListener('salesshop:task-modal',receive);
  return()=>window.removeEventListener('salesshop:task-modal',receive);
 },[]);
 useEffect(()=>{setRequest(null);},[scope]);
 if(!request||!scope||storedScope!==scope||previewRole)return null;
 const task=request.mode==='preview'?tasks.find(t=>t.id===request.id&&!t.deletedAt):null;
 const editTarget=request.mode==='create'?{
  title:request.title??'',dueDate:request.dueDate,type:request.type??'todo',
  associations:request.associations??[],
 }:request.mode==='preview'?null:tasks.find(t=>t.id===request.id&&!t.deletedAt);
 const close=()=>setRequest(null);
 const save=(changes:TaskChanges&{title:string})=>{
  if(request.mode==='create')create(changes.title,changes);
  else if(request.id)update(request.id,changes);
  close();
 };
 const openLink=(link:TaskLink)=>{
  close();
  switch(link.type){
   case 'project':nav.openProject(link.id);break;
   case 'quote':nav.openQuote(link.id);break;
   case 'company':nav.openCompany(link.id);break;
   case 'contact':nav.openPerson(link.id);break;
   case 'notebook':nav.openNotebookPage(link.id);break;
  }
 };
 return editTarget?<TaskEditor
  key={request.mode+':'+(request.id??request.dueDate??'new')}
  initial={editTarget} onCancel={close} onSave={save}
 />:task?<div className="tasks-dialog-backdrop" onMouseDown={event=>{
    if(event.target===event.currentTarget)close();
   }}>
    <section className="tasks-preview-card" role="dialog" aria-modal="true"
     aria-label={'Task '+task.title}>
     <header><div><small>TASK · QUICK VIEW</small><h2>{task.title}</h2></div>
      <button type="button" aria-label="Close task preview" onClick={close}>×</button></header>
     <div className="tasks-preview-body">
      <div className="tasks-preview-meta">
       <span>{task.type==='follow-up'?'Follow-up':task.type??'To-do'}</span>
       <span>{task.status??'open'}</span><span>{task.priority??'normal'} priority</span>
       {task.sourceObjectId?.startsWith('deal-submit:')&&<span>Bid submission</span>}
      </div>
      <dl><div><dt>Due</dt><dd>{task.dueDate||'No due date'}{task.dueTime?' · '+task.dueTime:''}</dd></div></dl>
      {task.notes&&<p className="tasks-preview-notes">{task.notes}</p>}
      {normalizedTaskAssociations(task).length>0&&<div className="tasks-preview-related">
       <strong>Related records</strong>
       {normalizedTaskAssociations(task).map(link=><button type="button"
        key={link.type+':'+link.id} onClick={()=>openLink(link)}>
         {link.label??link.type} ↗</button>)}
      </div>}
     </div>
     <footer>
      <button type="button" onClick={close}>Close</button>
      <button type="button" onClick={()=>{
       if(task.status==='completed')reopen(task.id);else complete(task.id);
       close();
      }}>{task.status==='completed'?'Reopen':'Mark complete'}</button>
      <button type="button" className="tasks-primary"
       onClick={()=>setRequest({mode:'edit',id:task.id})}>Edit task</button>
     </footer>
    </section>
   </div>:null;
}
