import {useEffect,useState} from 'react';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {MobileSheetHandle} from './MobileSheetHandle';
import {PreviewPanelHeading,PreviewPanelClose,PreviewPanelActions} from './PreviewPanelChrome';
import {TrashIcon,PencilIcon} from './TrashIcon';
import {ExternalQuoteBackfillDialog} from './ExternalQuoteBackfillDialog';
import {TaskEditor} from './TasksWorkspace';
import {usePersonalTaskStore,taskScope,normalizedTaskAssociations,
 type TaskChanges,type TaskLink,normalizedSubtasks,subtaskProgress,isProtectedBidTask,bidTaskDealId} from '../store/personalTaskStore';
import type {CalendarTaskRequest} from '../services/taskModalEvents';
export {requestTaskModal} from '../services/taskModalEvents';
export type {CalendarTaskRequest} from '../services/taskModalEvents';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNavigationStore} from '../store/navigationStore';
import {useQuoteStore} from '../store/quoteStore';
import {RecordPreviewDrawer,type PreviewRecord} from './RecordPreviewDrawer';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {canEditTeamArea} from '../services/teamDepartments';
import {useNotebookStore} from '../store/notebookStore';
import {homeNotes,openHomeNote} from '../services/homeNotes';
import {notebookToday} from '../services/notebookDaily';

/** Globally mounted editor; Home and Calendar remain visible underneath the modal. */
export function TaskModalHost(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),
  teamRole=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const scope=taskScope(mode,org,userId);
 const storedScope=usePersonalTaskStore(s=>s.scope);
 const tasks=usePersonalTaskStore(s=>s.tasks);
 const create=usePersonalTaskStore(s=>s.createTask);
 const update=usePersonalTaskStore(s=>s.updateTask);
 const complete=usePersonalTaskStore(s=>s.complete);
 const reopen=usePersonalTaskStore(s=>s.reopen);
 const remove=usePersonalTaskStore(s=>s.remove);
 const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
 const canLog=mode==='local'||canEditTeamArea(teamRole,department,'crm');
 const nav=useNavigationStore();
 const quotes=useQuoteStore(s=>s.quotes);
 const notebookEntries=useNotebookStore(s=>s.entries);
 const [request,setRequest]=useState<CalendarTaskRequest|null>(null);
 const [linkedPreview,setLinkedPreview]=useState<PreviewRecord|null>(null);
 const [externalDealId,setExternalDealId]=useState<string|null>(null);
 useModalScrollLock(Boolean(request||linkedPreview||externalDealId));
 const previewRef=useDismissibleLayer<HTMLElement>(
  request?.mode==='preview',()=>setRequest(null));
 useEffect(()=>{
  const receive=(event:Event)=>{
   const detail=(event as CustomEvent<CalendarTaskRequest>).detail;
   if((detail.mode==='preview'||detail.mode==='edit')&&!detail.id)return;
   setRequest(detail);
  };
  window.addEventListener('salesshop:task-modal',receive);
  return()=>window.removeEventListener('salesshop:task-modal',receive);
 },[]);
 useEffect(()=>{setRequest(null);setLinkedPreview(null);setExternalDealId(null);},[scope]);
 if((!request&&!linkedPreview&&!externalDealId)||!scope||storedScope!==scope||previewRole)return null;
 const task=request?.mode==='preview'?tasks.find(t=>t.id===request.id&&!t.deletedAt):null;
 const linkedDealId=task?.sourceObjectId?.startsWith('deal-submit:')
  ?task.sourceObjectId.slice('deal-submit:'.length)
  :task?.linked?.type==='project'?task.linked.id:null;
 const relatedQuote=task?quotes.find(quote=>!quote.archivedAt&&
  (mode!=='cloud'||quote.ownerUserId===userId)&&
  (quote.projectId===linkedDealId||normalizedTaskAssociations(task)
   .some(link=>link.type==='quote'&&link.id===quote.id))):undefined;
 const editTarget=request?.mode==='create'?{
  title:request.title??'',dueDate:request.dueDate,type:request.type??'todo',
  associations:request.associations??[],notes:request.notes,
  ...(request.agendaSource?{draftIdentity:'notebook-agenda:'+request.agendaSource.entryId}:{}),
  ...(request.noteSource?{
   sourceObjectId:'home-note:'+request.noteSource.objectId,
   draftIdentity:'home-note:'+request.noteSource.objectId,
   ...(request.noteSource.mode==='keep'?{
    sourceText:request.notes?.slice(0,2000),sourceLabel:'Home Note',
   }:{}),
  }:{}),
 }:request?.mode==='edit'?tasks.find(t=>t.id===request.id&&!t.deletedAt):null;
 const close=()=>setRequest(null);
 const recordExternal=()=>{
  const dealId=task?bidTaskDealId(task):null;
  if(!dealId)return;
  close();setExternalDealId(dealId);
 };
 const save=(changes:TaskChanges&{title:string})=>{
  if(request?.mode==='create'){
   const newId=create(changes.title,changes);
   if(!newId)return; // Never remove a note without a Task.
   if(request.agendaSource){
    const {entryId,sourceText}=request.agendaSource;
    if(useNotebookStore.getState().entries.some(e=>e.id===entryId))
     useNotebookStore.getState().addAgendaItem(entryId,{
      kind:'task',taskId:newId,title:changes.title,sourceText,
      date:changes.dueDate??notebookToday(),
     });
   }
   if(request.noteSource?.mode==='convert'){
    const {entryId,objectId}=request.noteSource;
    const entry=useNotebookStore.getState().entries.find(e=>e.id===entryId&&e.isPostItInbox);
    const note=entry?.objects.find(o=>o.type==='post-it'&&o.id===objectId);
    // A concurrently edited note is preserved rather than discarded.
    if(note?.type==='post-it'&&note.text===request.notes)
     useNotebookStore.getState().deleteObject(entryId,objectId);
   }
  }else if(request?.id)update(request.id,changes);
  close();
 };
 const openLink=(link:TaskLink)=>{
  close();
  if(link.type==='notebook'){nav.openNotebookPage(link.id);return;}
  setLinkedPreview({kind:link.type==='contact'?'person':
   link.type==='project'?'deal':link.type==='company'?'company':'quote',id:link.id});
 };
 return <>{editTarget?<TaskEditor
  key={(request?.mode??'create')+':'+(request?.id??request?.dueDate??'new')}
  initial={editTarget} onCancel={close} onSave={save}
 />:task?<div className="tasks-dialog-backdrop ss-mobile-sheet-backdrop" onPointerDown={event=>{
    if(event.target===event.currentTarget)close();
   }}>
    <section ref={previewRef} className="tasks-preview-card ss-mobile-sheet" role="dialog" aria-modal="true"
     aria-label={'Task '+task.title}>
     <MobileSheetHandle onClose={close}/>
     <header className="ss-unified-preview-header">
       <PreviewPanelHeading eyebrow="TASK · QUICK VIEW" title={task.title}/>
       <PreviewPanelClose onClose={close} label="Close task preview"/>
      </header>
     <div className="tasks-preview-body ss-mobile-sheet-body">
      <div className="tasks-preview-meta">
       <span>{task.type==='follow-up'?'Follow-up':task.type??'To-do'}</span>
       <span>{task.status??'open'}</span><span>{task.priority??'normal'} priority</span>
       {task.sourceObjectId?.startsWith('deal-submit:')&&<span>Bid submission</span>}
      </div>
      <dl><div><dt>Due</dt><dd>{task.dueDate||'No due date'}{task.dueTime?' · '+task.dueTime:''}</dd></div></dl>
      {task.notes&&<p className="tasks-preview-notes">{task.notes}</p>}
      {normalizedSubtasks(task.subtasks).length>0&&<section className="tasks-preview-subtasks"
       aria-label="Subtasks">
        <strong>Checklist · {subtaskProgress(task).done}/{subtaskProgress(task).total}</strong>
        {normalizedSubtasks(task.subtasks).map(item=><label key={item.id}
         className={item.completed?'is-done':''}>
          <input type="checkbox" checked={item.completed} disabled={Boolean(task.deletedAt)}
           onChange={e=>update(task.id,{subtasks:normalizedSubtasks(task.subtasks).map(sub=>
            sub.id===item.id?{...sub,completed:e.target.checked}:sub)})}/>
          <span>{item.title}</span>
        </label>)}
       </section>}
      {normalizedTaskAssociations(task).length>0&&<div className="tasks-preview-related">
       <strong>Related records</strong>
       {normalizedTaskAssociations(task).map(link=><button type="button"
        key={link.type+':'+link.id} onClick={()=>openLink(link)}>
         {link.label??link.type} ↗</button>)}
      </div>}
     </div>
     <PreviewPanelActions className="ss-mobile-sheet-actions tasks-preview-action-groups">
      <div className="tasks-preview-actions-left">
       <button type="button" className="tasks-preview-delete" onClick={()=>{
        if(!window.confirm('Delete this task? It will be removed from your Tasks and Agenda.'))return;
        remove(task.id);close();
       }}><TrashIcon/> Delete</button>
       <button type="button" className="tasks-preview-edit tasks-primary"
        onClick={()=>setRequest({mode:'edit',id:task.id})}>
        <PencilIcon/> Edit</button>
      </div>
      <div className="tasks-preview-actions-right">
       {isProtectedBidTask(task)&&!task.submissionConfirmedAt?<>
        {relatedQuote&&<button type="button" onClick={()=>{
         close();nav.openQuote(relatedQuote.id);
        }}>Open linked Quote ↗</button>}
        {canLog&&<button type="button" className="tasks-flow-action"
          onClick={recordExternal}>Record external quote</button>}
        <button type="button" disabled
          title="Requires confirmed customer delivery or a recorded external submission">Complete · quote required</button>
       </>:<>
        {task.sourceObjectId?.startsWith('home-note:')&&
          homeNotes(notebookEntries).some(note=>
           note.objectId===task.sourceObjectId?.slice('home-note:'.length))&&
           <button type="button" onClick={()=>{
            close();openHomeNote({mode:'preview',
             objectId:task.sourceObjectId!.slice('home-note:'.length)});
           }}>Open source note</button>}
        {relatedQuote&&<button type="button" onClick={()=>{
         close();nav.openQuote(relatedQuote.id);
        }}>Open linked Quote ↗</button>}
        <button type="button" disabled={task.status!=='completed'&&subtaskProgress(task).remaining>0}
         title={task.status!=='completed'&&subtaskProgress(task).remaining>0?'Complete the checklist first':undefined}
         onClick={()=>{
          if(task.status==='completed')reopen(task.id);else complete(task.id);
          close();
         }}>{task.status==='completed'?'Reopen task':'Complete'}</button>
        {canLog&&task.status!=='completed'&&task.status!=='canceled'&&subtaskProgress(task).remaining===0&&
         <button type="button" className="tasks-flow-action" onClick={()=>{
          close();openActivityComposer({taskId:task.id});
         }}>Complete + Log Activity</button>}
       </>}
      </div>
     </PreviewPanelActions>
    </section>
   </div>:null}
   {linkedPreview&&<RecordPreviewDrawer record={linkedPreview}
    onClose={()=>setLinkedPreview(null)} onSelect={setLinkedPreview}/>}
   {externalDealId&&<ExternalQuoteBackfillDialog key={externalDealId}
    initialDealId={externalDealId} onClose={()=>setExternalDealId(null)}
    onRecorded={()=>setExternalDealId(null)}/>}
  </>;
}
