import {useState} from 'react';
import type {NotebookEntry} from '../types/notebook';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useNotebookStore} from '../store/notebookStore';
import {openNotebookCalendarDate} from '../services/notebookDaily';
import {requestTaskModal} from '../services/taskModalEvents';
import '../notebook-linked-agenda.css';

/** A companion block outside the editable paper canvas; added items never
 * resize or reposition ink, rich text or object coordinates. */
export function NotebookLinkedAgenda({entry}:{entry:NotebookEntry}){
 const [expanded,setExpanded]=useState(true);
 const loadedTasks=usePersonalTaskStore(s=>s.tasks);
 const loadedScope=usePersonalTaskStore(s=>s.scope);
 const mode=useAuthStore(s=>s.mode);
 const orgId=useAuthStore(s=>s.organizationId);
 const userId=useAuthStore(s=>s.user?.id);
 const activeScope=taskScope(mode,orgId,userId);
 // Task storage rehydrates separately from Notebook. Never render a previous
 // user's task details while a workspace/account transition is in progress.
 const tasksReady=!!activeScope&&loadedScope===activeScope;
 const tasks=tasksReady?loadedTasks:[];
 const removeAgendaItem=useNotebookStore(s=>s.deleteAgendaItem);
 const agenda=entry.agendaItems??[];
 if(entry.isPostItInbox)return null;
 return <aside className="notebook-linked-agenda" aria-label={'Linked agenda for '+entry.title}>
  <div className="notebook-linked-agenda-head">
   <button type="button" className="notebook-linked-agenda-collapse"
    aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
    <span aria-hidden="true">{expanded?'▾':'▸'}</span>
    <strong>Linked Agenda</strong><small>{agenda.length} items</small>
   </button>
   <button type="button" className="notebook-linked-agenda-add" onClick={()=>
    openNotebookCalendarDate({entryId:entry.id})}>+ Calendar date</button>
  </div>
  {expanded&&<div className="notebook-linked-agenda-content">
   {agenda.length===0?<p>Highlight Notebook text and choose Add to calendar or Create task.
    Linked items will appear here without changing your page layout.</p>
    :agenda.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(item=>{
      const task=item.taskId?tasks.find(t=>t.id===item.taskId&&!t.deletedAt):undefined;
      return <div className="notebook-linked-agenda-row" key={item.id}>
       <button className="notebook-linked-agenda-item" type="button"
        disabled={item.kind==='task'&&!task}
        onClick={()=>item.kind==='calendar-date'
         ?openNotebookCalendarDate({entryId:entry.id,itemId:item.id})
         :task?requestTaskModal({mode:'preview',id:task.id})
         :undefined}>
        <span className={'notebook-linked-agenda-indicator is-'+item.kind} aria-hidden="true"/>
        <span className="notebook-linked-agenda-copy"><strong>{item.title}</strong>
         <small>{item.kind==='calendar-date'
           ?(item.annual?'Annual · ':'')+item.date+(item.time?' · '+item.time:'')
           :task?(task.status==='completed'?'Completed · ':
             task.status==='canceled'?'Canceled · ':'Task · ')+(task.dueDate||'No deadline')
            :tasksReady?'Linked Task unavailable':'Loading linked Task…'}</small>
         {item.sourceText&&<small className="notebook-linked-agenda-source">
          From: {item.sourceText.slice(0,135)}</small>}
        </span>
        <span aria-hidden="true">›</span>
       </button>
       {item.kind==='task'&&tasksReady&&<button type="button" className="notebook-linked-agenda-unlink"
        title="Remove Notebook link (keeps the Task)"
        aria-label={'Remove Notebook link to '+item.title}
        onClick={()=>removeAgendaItem(entry.id,item.id)}>×</button>}
      </div>;
    })}
  </div>}
 </aside>;
}
