import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {localDateKey} from '../services/salesCalendar';
import '../home-cleanup.css';

const dayFromNow=(count:number)=>{
 const date=new Date();date.setDate(date.getDate()+count);return localDateKey(date);
};
export function TaskCleanupPanel(){
 const [open,setOpen]=useState(false);
 const [skipped,setSkipped]=useState<string[]>([]);
 const mode=useAuthStore(s=>s.mode),orgId=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const scope=taskScope(mode,orgId,userId);
 const storedScope=usePersonalTaskStore(s=>s.scope);
 const tasks=usePersonalTaskStore(s=>s.tasks);
 const update=usePersonalTaskStore(s=>s.updateTask),remove=usePersonalTaskStore(s=>s.remove);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 useEffect(()=>{
  const show=()=>{setSkipped([]);setOpen(true);};
  window.addEventListener('salesshop:open-task-cleanup',show);
  return()=>window.removeEventListener('salesshop:open-task-cleanup',show);
 },[]);
 useEffect(()=>{setOpen(false);setSkipped([]);},[scope]);
 const overdue=useMemo(()=>scope&&storedScope===scope&&!perspective?
  tasks.filter(task=>!task.deletedAt&&!!task.dueDate&&task.dueDate<localDateKey(new Date())
   &&!['completed','canceled'].includes(task.status??'open'))
   .sort((a,b)=>(a.dueDate??'').localeCompare(b.dueDate??'')):[],
  [tasks,scope,storedScope,perspective]);
 if(!open||!scope||storedScope!==scope||perspective)return null;
 const current=overdue.find(item=>!skipped.includes(item.id));
 const skip=()=>{if(current)setSkipped(previous=>[...previous,current.id]);};
 const reschedule=(date:string)=>{if(current)update(current.id,{dueDate:date,dueTime:current.dueTime});};
 return createPortal(<div className="sales-cleanup-backdrop" onPointerDown={e=>{
  if(e.target===e.currentTarget)setOpen(false);
 }}>
  <section className="sales-cleanup-dialog" role="dialog" aria-modal="true"
   aria-label="Review overdue tasks">
   <header><div><small>MY TASKS · CLEANUP</small><h2>Review overdue tasks</h2>
    <p>One at a time, without leaving Home.</p></div>
    <button type="button" aria-label="Close cleanup" onClick={()=>setOpen(false)}>×</button></header>
   {current?<div className="sales-cleanup-body">
     <span className="sales-cleanup-progress">{overdue.length} overdue · {skipped.length} skipped this pass</span>
     <h3>{current.title}</h3>
     <p>Due {current.dueDate} · {current.priority??'normal'} priority</p>
     {current.notes&&<blockquote>{current.notes.slice(0,240)}</blockquote>}
     <div className="sales-cleanup-actions">
      <strong>Move due date</strong>
      <button type="button" onClick={()=>reschedule(dayFromNow(0))}>Today</button>
      <button type="button" onClick={()=>reschedule(dayFromNow(1))}>Tomorrow</button>
      <button type="button" onClick={()=>reschedule(dayFromNow(7))}>In 7 days</button>
     </div>
    </div>:<div className="sales-cleanup-body">
      <h3>Review complete</h3>
      <p>{overdue.length===0?'No overdue tasks remain.':
       'You reviewed every overdue task available in this pass.'}</p>
     </div>}
   <footer>
     {current&&<>
      <button type="button" onClick={skip}>Skip</button>
      <button type="button" onClick={()=>update(current.id,{status:'completed'})}>Mark done</button>
      <button type="button" className="is-danger" onClick={()=>{
       if(window.confirm('Delete this task? This will remove it from your work queue.'))remove(current.id);
      }}>Delete</button>
     </>}
     <button type="button" className="is-primary" onClick={()=>setOpen(false)}>
      {current?'Finish for now':'Done'}</button>
   </footer>
  </section>
 </div>,document.body);
}
