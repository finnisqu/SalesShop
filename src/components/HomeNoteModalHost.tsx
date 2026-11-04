import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNotebookStore} from '../store/notebookStore';
import {draftStorageKey,readSavedDraft,writeSavedDraft,clearSavedDraft} from '../services/draftRecovery';
import {homeNotes,homeNoteTitle,openHomeNote,type HomeNote,type HomeNoteRequest} from '../services/homeNotes';
import {requestTaskModal} from '../services/taskModalEvents';
import '../tasks-workspace.css';
import '../home-notes.css';

function NoteDialog({note,onClose}:{note?:HomeNote;onClose:()=>void}){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const create=useNotebookStore(s=>s.createGlobalPostIt);
 const update=useNotebookStore(s=>s.updateTextObject);
 const remove=useNotebookStore(s=>s.deleteObject);
 const draftKey=draftStorageKey('home-note:'+(note?.objectId??'new'),mode,org,userId);
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
   if(!detail||!(detail.mode==='create'||(detail.mode==='preview'&&detail.objectId)))return;
   setRequest(detail);
  };
  window.addEventListener('salesshop:home-note',listener);
  return()=>window.removeEventListener('salesshop:home-note',listener);
 },[]);
 useEffect(()=>setRequest(null),[mode,org,userId]);
 if(!request||preview||!hydrated)return null;
 const note=request.mode==='preview'?notes.find(item=>item.objectId===request.objectId):undefined;
 if(request.mode==='preview'&&!note)return null;
 return <NoteDialog key={note?.objectId??'new'} note={note} onClose={()=>setRequest(null)}/>;
}
