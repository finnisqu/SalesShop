import {useState} from 'react';
import type {NotebookEntry} from '../types/notebook';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import {openNotebookCalendarDate} from '../services/notebookDaily';
import {requestTaskModal} from '../services/taskModalEvents';
import '../notebook-linked-agenda.css';

/** A companion block outside the editable paper canvas; added items never
 * resize or reposition ink, rich text or object coordinates. */
export function NotebookLinkedAgenda({entry}:{entry:NotebookEntry}){
 const [expanded,setExpanded]=useState(true);
 const tasks=usePersonalTaskStore(s=>s.tasks);
 const agenda=entry.agendaItems??[];
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
      return <button className="notebook-linked-agenda-item" type="button" key={item.id}
       onClick={()=>item.kind==='calendar-date'
        ?openNotebookCalendarDate({entryId:entry.id,itemId:item.id})
        :task?requestTaskModal({mode:'preview',id:task.id})
        :undefined}>
       <span className={'notebook-linked-agenda-indicator is-'+item.kind} aria-hidden="true"/>
       <span className="notebook-linked-agenda-copy"><strong>{item.title}</strong>
        <small>{item.kind==='calendar-date'
          ?(item.annual?'Annual · ':'')+item.date+(item.time?' · '+item.time:'')
          :task?(task.status==='completed'?'Completed · ':'Task · ')+(task.dueDate||'No deadline')
           :'Linked Task unavailable'}</small>
        {item.sourceText&&<small className="notebook-linked-agenda-source">
         From: {item.sourceText.slice(0,135)}</small>}
       </span>
       <span aria-hidden="true">›</span>
      </button>;
    })}
  </div>}
 </aside>;
}
