import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNotebookStore} from '../store/notebookStore';
import {draftStorageKey,readSavedDraft,writeSavedDraft,clearSavedDraft} from '../services/draftRecovery';
import {homeNotes,homeNoteTitle,type HomeNote,type HomeNoteRequest} from '../services/homeNotes';
import {requestTaskModal} from '../services/taskModalEvents';
import {useNavigationStore} from '../store/navigationStore';
import {notebookToday,notebookPlainText} from '../services/notebookDaily';
import '../tasks-workspace.css';
import '../home-notes.css';

function NoteDialog({note,onClose}:{note?:HomeNote;onClose:()=>void}){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const create=useNotebookStore(s=>s.createGlobalPostIt);
 const update=useNotebookStore(s=>s.updateTextObject);
 const remove=useNotebookStore(s=>s.deleteObject);
 const draftKey=draftStorageKey('home-note:'+(note?.objectId??'new'),mode,org,userId);
 const [original]=useState(note?.text);
 const [editing,setEditing]=useState(!note);
 const [text,setText]=useState(()=>readSavedDraft<{text:string}>(draftKey)?.text??note?.text??'');
 const [error,setError]=useState('');
 useEffect(()=>{
  if(editing)writeSavedDraft(draftKey,{text});
 },[draftKey,text,editing]);
 const save=(event:FormEvent)=>{
  event.preventDefault();
  const value=text.trim().slice(0,5000);
  if(!value){setError('Write something before saving your note.');return;}
  if(note){
   const existing=homeNotes(useNotebookStore.getState().entries)
    .find(item=>item.objectId===note.objectId&&item.entryId===note.entryId);
   if(!existing){setError('This note was removed. Close and refresh Notes.');return;}
   if(existing.text!==original){
    setError('This note changed elsewhere. Close and reopen it before saving.');return;
   }
   update(note.entryId,note.objectId,value);
  }else{
   const id=create();
   const inbox=useNotebookStore.getState().entries.find(entry=>entry.isPostItInbox&&
    entry.objects.some(item=>item.id===id&&item.type==='post-it'));
   if(!inbox){setError('Could not create your note. Please try again.');return;}
   update(inbox.id,id,value);
  }
  clearSavedDraft(draftKey);onClose();
 };
 const discard=()=>{
  clearSavedDraft(draftKey);setError('');
  if(note){setText(note.text);setEditing(false);}else onClose();
 };
 const taskFromNote=(action:'keep'|'convert')=>{
  if(!note)return;
  onClose();
  requestTaskModal({
   mode:'create',title:homeNoteTitle(note.text),notes:note.text.slice(0,5000),
   associations:[{type:'notebook',id:note.entryId,label:'Notebook · Post-its'}],
   noteSource:{entryId:note.entryId,objectId:note.objectId,mode:action},
  });
 };
 const deleteNote=()=>{
  if(!note||!window.confirm('Delete this private note? You can undo it in Notebook.'))return;
  remove(note.entryId,note.objectId);clearSavedDraft(draftKey);onClose();
 };
 return <div className="tasks-dialog-backdrop home-note-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section className="tasks-preview-card home-note-card" role="dialog" aria-modal="true"
   aria-label={editing?(note?'Edit note':'New note'):'Note preview'}>
   <header><div><small>PRIVATE · NOTEBOOK NOTE</small>
    <h2>{note?homeNoteTitle(note.text):'New note'}</h2></div>
    <button type="button" aria-label="Close note" onClick={onClose}>×</button></header>
   {editing?<form className="home-note-editor" id="home-note-form" onSubmit={save}>
    <label htmlFor="home-note-text">Note</label>
    <textarea id="home-note-text" autoFocus rows={7} value={text} maxLength={5000}
     placeholder="Something worth remembering…"
     onChange={event=>{setText(event.target.value);setError('');}}/>
    <p>Just a note for now. It won't create a Task or add a calendar deadline.</p>
    {error&&<p className="home-note-error" role="alert">{error}</p>}
   </form>:<div className="tasks-preview-body home-note-read">
    <p className="tasks-preview-notes">{note?.text||'This note is empty.'}</p>
    <small>Updated {note?new Date(note.updatedAt).toLocaleString():'—'} · Private to your Notebook</small>
   </div>}
   <footer className="home-note-actions">
    {editing?<><button type="button" onClick={discard}>{note?'Cancel edits':'Discard'}</button>
      <button className="tasks-primary" type="submit" form="home-note-form">Save note</button></>:
     <><button type="button" onClick={deleteNote}>Delete</button>
      <button type="button" onClick={()=>{setText(readSavedDraft<{text:string}>(draftKey)?.text??note?.text??'');setEditing(true);}}>
       Edit</button>
      <button type="button" onClick={()=>taskFromNote('keep')}>Create task & keep note</button>
      <button type="button" className="tasks-primary" onClick={()=>taskFromNote('convert')}>
       Convert to task</button></>}
   </footer>
  </section>
 </div>;
}

/** Daily pages stay full Notebook pages. Quick capture only APPENDS text;
 * editing the whole rich document happens in the existing Notebook editor. */
function DailyNoteDialog({entryId,onClose}:{entryId?:string;onClose:()=>void}){
 const mode=useAuthStore(s=>s.mode),orgId=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const today=notebookToday();
 const page=useNotebookStore(s=>s.entries.find(e=>e.id===entryId));
 const append=useNotebookStore(s=>s.appendDailyCapture);
 const nav=useNavigationStore(s=>s.openNotebookPage);
 const draftKey=draftStorageKey('daily-note:'+today,mode,orgId,userId);
 const [editing,setEditing]=useState(!entryId);
 const [text,setText]=useState(()=>readSavedDraft<{text:string}>(draftKey)?.text??'');
 const [error,setError]=useState('');
 useEffect(()=>{
  if(editing)writeSavedDraft(draftKey,{text});
 },[draftKey,text,editing]);
 const save=(event:FormEvent)=>{
  event.preventDefault();const value=text.trim();
  if(!value){setError('Write a note before saving.');return;}
  if(entryId&&!useNotebookStore.getState().entries.some(e=>e.id===entryId)){
   setError('This Notebook page was removed. Reopen Home Notes.');return;
  }
  // New captures belong to today's page; older pages are edited in Notebook
  // so a late capture never silently changes the wrong day's journal.
  const targetDate=page?.dailyDate??today;
  const id=append(targetDate,value);
  if(!id){setError('Could not save your daily note. Please retry.');return;}
  clearSavedDraft(draftKey);setText('');onClose();
 };
 const openFull=()=>{
  if(!page)return;
  onClose();nav(page.id);
 };
 return <div className="tasks-dialog-backdrop home-note-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section className="tasks-preview-card home-note-card" role="dialog" aria-modal="true"
   aria-label={page?'Daily Notebook Quick View':'Capture daily note'}>
   <header><div><small>PRIVATE · DAILY NOTEBOOK</small>
    <h2>{page?.title??'Today’s notes'}</h2></div>
    <button type="button" aria-label="Close daily note" onClick={onClose}>×</button></header>
   {editing?<form className="home-note-editor" id="daily-note-form" onSubmit={save}>
    <label htmlFor="daily-note-text">Add a thought</label>
    <textarea id="daily-note-text" rows={7} autoFocus maxLength={10000}
     value={text} placeholder="Something worth remembering…"
     onChange={event=>{setText(event.target.value);setError('');}}/>
    <p>{page
      ?'Adds to this daily page without replacing its rich text, drawings or layout.'
      :'A daily Notebook page is created only when you save your first thought today.'}</p>
    {error&&<p role="alert" className="home-note-error">{error}</p>}
   </form>:<div className="tasks-preview-body home-note-read">
    <p className="tasks-preview-notes">{notebookPlainText(page?.contentHtml??'')||'No written text yet.'}</p>
    {page?.agendaItems?.length?<div className="home-note-daily-agenda">
      <strong>Linked Agenda</strong>
      {page.agendaItems.map(item=><span key={item.id}>{item.title} · {item.date}</span>)}
     </div>:null}
    <small>{page?'Updated '+new Date(page.updatedAt).toLocaleString():'—'}</small>
   </div>}
   <footer className="home-note-actions">
    {editing?<><button type="button" onClick={onClose}>Close</button>
      {page&&<button type="button" onClick={openFull}>Open in Notebook</button>}
      <button className="tasks-primary" type="submit" form="daily-note-form">Save note</button></>:
     <><button type="button" onClick={onClose}>Close</button>
       <button type="button" onClick={()=>setEditing(true)}>Add thought</button>
       <button className="tasks-primary" type="button" onClick={openFull}>Open in Notebook</button></>}
   </footer>
  </section>
 </div>;
}

/** A single global note Quick View works from Home and from a linked Task. */
export function HomeNoteModalHost(){
 const [request,setRequest]=useState<HomeNoteRequest|null>(null);
 const entries=useNotebookStore(s=>s.entries),hydrated=useNotebookStore(s=>s.hydrated);
 const notes=useMemo(()=>homeNotes(entries),[entries]);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 useEffect(()=>{
  const listener=(event:Event)=>{
   const detail=(event as CustomEvent<HomeNoteRequest>).detail;
   if(!detail||!(detail.mode==='create'||(detail.mode==='preview'&&(detail.objectId||detail.entryId))))return;
   setRequest(detail);
  };
  window.addEventListener('salesshop:home-note',listener);
  return()=>window.removeEventListener('salesshop:home-note',listener);
 },[]);
 useEffect(()=>setRequest(null),[mode,org,userId]);
 if(!request||preview||!hydrated)return null;
 if(request.mode==='create'||request.entryId){
  const entry=request.entryId?entries.find(e=>e.id===request.entryId&&!!e.dailyDate):undefined;
  if(request.entryId&&!entry)return null;
  return <DailyNoteDialog key={entry?.id??'today'} entryId={entry?.id}
   onClose={()=>setRequest(null)}/>;
 }
 const note=request.mode==='preview'?notes.find(item=>item.objectId===request.objectId):undefined;
 if(!note)return null;
 // Legacy Post-its are retained and can be edited or converted as before.
 return <NoteDialog key={note.objectId} note={note} onClose={()=>setRequest(null)}/>;
}
