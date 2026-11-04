import {useEffect,useRef,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useNotebookStore} from '../store/notebookStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useAuthStore} from '../store/authStore';
import {agendaTitle,notebookToday,type NotebookCalendarRequest} from '../services/notebookDaily';
import '../notebook-linked-agenda.css';

export function NotebookCalendarDateModalHost(){
 const [request,setRequest]=useState<NotebookCalendarRequest|null>(null);
 const [title,setTitle]=useState('');
 const [date,setDate]=useState(notebookToday);
 const [time,setTime]=useState('');
 const [annual,setAnnual]=useState(false);
 const [error,setError]=useState('');
 const submitting=useRef(false);
 const entries=useNotebookStore(s=>s.entries),hydrated=useNotebookStore(s=>s.hydrated);
 const add=useNotebookStore(s=>s.addAgendaItem);
 const update=useNotebookStore(s=>s.updateAgendaItem);
 const remove=useNotebookStore(s=>s.deleteAgendaItem);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const mode=useAuthStore(s=>s.mode),orgId=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 useEffect(()=>{
  const listener=(event:Event)=>{
   const detail=(event as CustomEvent<NotebookCalendarRequest>).detail;
   if(!detail?.entryId)return;
   const page=useNotebookStore.getState().entries.find(e=>e.id===detail.entryId);
   if(!page)return;
   const item=page.agendaItems?.find(a=>a.id===detail.itemId&&a.kind==='calendar-date');
   submitting.current=false;
   setRequest(detail);
   setTitle(item?.title??agendaTitle(detail.selectedText??''));
   setDate(item?.date??detail.date??notebookToday());
   setTime(item?.time??'');setAnnual(item?.annual??false);setError('');
  };
  window.addEventListener('salesshop:notebook-calendar-date',listener);
  return()=>window.removeEventListener('salesshop:notebook-calendar-date',listener);
 },[]);
 useEffect(()=>setRequest(null),[mode,orgId,userId]);
 if(!request||!hydrated||preview)return null;
 const page=entries.find(e=>e.id===request.entryId);
 if(!page)return null;
 const current=page.agendaItems?.find(item=>item.id===request.itemId);
 const submit=(event:FormEvent)=>{
  event.preventDefault();
  if(submitting.current)return;
  submitting.current=true;
  if(!title.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
    !Number.isFinite(Date.parse(date+'T12:00:00'))){
   setError('Enter a title and valid date.');submitting.current=false;return;
  }
  if(current){
   update(page.id,current.id,{title:title.trim(),date,time:time||undefined,annual});
  }else{
   const created=add(page.id,{kind:'calendar-date',title:title.trim(),date,
    sourceText:request.selectedText??'',time:time||undefined,annual});
   if(!created){setError('Could not add this date to the Notebook.');submitting.current=false;return;}
  }
  setRequest(null);
 };
 return createPortal(<div className="tasks-dialog-backdrop notebook-agenda-modal-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)setRequest(null);}}>
  <form className="tasks-editor notebook-agenda-date-modal" role="dialog"
   aria-modal="true" aria-label={current?'Edit calendar date':'Add to calendar'}
   onSubmit={submit}>
   <header><div><small>LINKED AGENDA · CALENDAR DATE</small>
    <strong>{current?'Edit calendar date':'Add to calendar'}</strong></div>
    <button type="button" aria-label="Close" onClick={()=>setRequest(null)}>×</button></header>
   {request.selectedText&&<p className="notebook-agenda-source">
    From {page.title}: “{request.selectedText.slice(0,210)}”</p>}
   <label>Title<input autoFocus maxLength={240} required value={title}
    onChange={e=>setTitle(e.target.value)}/></label>
   <div className="notebook-agenda-two">
    <label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Time (optional)<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
   </div>
   <label className="notebook-agenda-checkbox"><input type="checkbox" checked={annual}
    disabled={date.slice(5)==='02-29'}
    onChange={e=>setAnnual(e.target.checked)}/>
    Repeat yearly (birthdays, anniversaries)</label>
   <p className="notebook-agenda-hint">Calendar dates appear on Home without becoming overdue Tasks.
    The original Notebook passage stays where you wrote it.</p>
   {error&&<p role="alert" className="notebook-agenda-error">{error}</p>}
   <footer>
    {current&&<button type="button" onClick={()=>{
     if(window.confirm('Remove this date from your calendar? The Notebook text will remain.')){
      remove(page.id,current.id);setRequest(null);
     }
    }}>Remove date</button>}
    <button type="button" onClick={()=>setRequest(null)}>Cancel</button>
    <button type="submit" className="tasks-primary">{current?'Save changes':'Add to calendar'}</button>
   </footer>
  </form>
 </div>,document.body);
}
