import {useEffect,useRef,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useNotebookStore} from '../store/notebookStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useAuthStore} from '../store/authStore';
import {agendaTitle,notebookToday,validNotebookDay,type NotebookCalendarRequest} from '../services/notebookDaily';
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
 const addStandalone=useNotebookStore(s=>s.addStandaloneCalendarDate);
 const update=useNotebookStore(s=>s.updateAgendaItem);
 const remove=useNotebookStore(s=>s.deleteAgendaItem);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const mode=useAuthStore(s=>s.mode),orgId=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 useEffect(()=>{
  const listener=(event:Event)=>{
   const detail=(event as CustomEvent<NotebookCalendarRequest>).detail;
   if(!detail||(!detail.entryId&&!detail.standalone))return;
   const page=detail.entryId?useNotebookStore.getState().entries.find(e=>e.id===detail.entryId):undefined;
   if(detail.entryId&&!page)return;
   const item=page?.agendaItems?.find(a=>a.id===detail.itemId&&a.kind==='calendar-date');
   submitting.current=false;
   setRequest({...detail,standalone:detail.standalone||page?.isCalendarInbox===true});
   setTitle(item?.title??agendaTitle(detail.selectedText??''));
   setDate(item?.date??detail.date??notebookToday());
   setTime(item?.time??'');setAnnual(item?.annual??false);setError('');
  };
  window.addEventListener('salesshop:notebook-calendar-date',listener);
  return()=>window.removeEventListener('salesshop:notebook-calendar-date',listener);
 },[]);
 useEffect(()=>setRequest(null),[mode,orgId,userId]);
 if(!request||!hydrated||preview)return null;
 const page=request.entryId?entries.find(e=>e.id===request.entryId):undefined;
 if(!page&&!request.standalone)return null;
 const current=page?.agendaItems?.find(item=>item.id===request.itemId);
 const submit=(event:FormEvent)=>{
  event.preventDefault();
  if(submitting.current)return;
  submitting.current=true;
  if(!title.trim()||!validNotebookDay(date)){
   setError('Enter a title and valid date.');submitting.current=false;return;
  }
  if(current&&page){
   update(page.id,current.id,{title:title.trim(),date,time:time||undefined,annual});
  }else if(request.standalone){
   const created=addStandalone({title:title.trim(),date,time:time||undefined,annual});
   if(!created){setError('Could not add this calendar entry.');submitting.current=false;return;}
  }else if(page){
   const created=add(page.id,{kind:'calendar-date',title:title.trim(),date,
    sourceText:request.selectedText??'',time:time||undefined,annual});
   if(!created){setError('Could not add this date to the Notebook.');submitting.current=false;return;}
  }else{setError('Calendar entry is unavailable.');submitting.current=false;return;}
  setRequest(null);
 };
 return createPortal(<div className="tasks-dialog-backdrop notebook-agenda-modal-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)setRequest(null);}}>
  <form className="tasks-editor notebook-agenda-date-modal" role="dialog"
   aria-modal="true" aria-label={current?'Edit calendar date':'Add to calendar'}
   onSubmit={submit}>
   <header><div><small>{request.standalone?'HOME · CALENDAR ENTRY':'LINKED AGENDA · CALENDAR DATE'}</small>
    <strong>{current?'Edit calendar date':'Add to calendar'}</strong></div>
    <button type="button" aria-label="Close" onClick={()=>setRequest(null)}>×</button></header>
   {request.selectedText&&<p className="notebook-agenda-source">
    From {page?.title??'Notebook'}: “{request.selectedText.slice(0,210)}”</p>}
   <label>Title<input autoFocus maxLength={240} required value={title}
    onChange={e=>setTitle(e.target.value)}/></label>
   <div className="notebook-agenda-two">
    <label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Time (optional)<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
   </div>
   <label className="notebook-agenda-checkbox"><input type="checkbox" checked={annual}
    onChange={e=>setAnnual(e.target.checked)}/>
    Repeat yearly (birthdays, anniversaries)</label>
   <p className="notebook-agenda-hint">
    {request.standalone?'This stays on your calendar, not your Tasks list. You can edit it from the date in Home.':
      'Calendar dates appear on Home without becoming overdue Tasks. The original Notebook passage stays where you wrote it.'}
   </p>
   {error&&<p role="alert" className="notebook-agenda-error">{error}</p>}
   <footer>
    {current&&page&&<button type="button" onClick={()=>{
     const message=request.standalone?'Remove this calendar entry?':
      'Remove this date from your calendar? The Notebook text will remain.';
     if(window.confirm(message)){remove(page.id,current.id);setRequest(null);}
    }}>Remove date</button>}
    <button type="button" onClick={()=>setRequest(null)}>Cancel</button>
    <button type="submit" className="tasks-primary">{current?'Save changes':'Add to calendar'}</button>
   </footer>
  </form>
 </div>,document.body);
}
