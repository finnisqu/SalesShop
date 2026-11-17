import {useEffect,useState} from 'react';
import {useNotebookStore} from '../store/notebookStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import type {NotebookEntry} from '../types/notebook';
import './record-notebook-inline374.css';
import {RecordTabToolbar} from './RecordTabToolbar';

export const inlineRecordNotebookPrefix='page_record_inline_';

/** Compact pages contain ONLY escaped text: no rich content is ever overwritten
 * by this editor. Pages containing ink, objects or arbitrary HTML open in Notebook.
 */
export function isInlineRecordTextPage(entry:NotebookEntry):boolean{
 return entry.id.startsWith(inlineRecordNotebookPrefix)&&
  !entry.strokes.length&&!entry.objects.length&&
  /^<p>(?:.|\n)*<\/p>$/.test(entry.contentHtml);
}
export function encodeInlineRecordText(text:string):string{
 const safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 return '<p>'+safe.replace(/\r\n?/g,'\n').replace(/\n/g,'<br/>')+'</p>';
}
export function decodeInlineRecordText(html:string):string{
 return html.replace(/^<p>/,'').replace(/<\/p>$/,'')
  .replace(/<br\s*\/?>/gi,'\n')
  .replace(/&#39;/g,"'").replace(/&quot;/g,'"')
  .replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
}

type RecordKind='company'|'person'|'deal';
export function RecordNotebookPanel374({kind,id,title,onOpenPage}:{
 kind:RecordKind;id:string;title:string;onOpenPage:(pageId:string)=>void;
}){
 const entries=useNotebookStore(s=>s.entries),hydrated=useNotebookStore(s=>s.hydrated);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const create=useNotebookStore(s=>s.createRecordLinkedEntry);
 const update=useNotebookStore(s=>s.updateContent);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [draft,setDraft]=useState('');
 const [error,setError]=useState('');
 const linked=entries.filter(entry=>!entry.hidden&&
  (kind==='person'?entry.context?.contactId===id:
   kind==='company'?entry.context?.companyId===id:entry.context?.projectId===id))
  .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const selected=linked.find(entry=>entry.id===selectedId)??linked[0];
 const editable=!!selected&&isInlineRecordTextPage(selected);
 useEffect(()=>{
  setDraft(selected&&isInlineRecordTextPage(selected)?decodeInlineRecordText(selected.contentHtml):'');
 },[selected?.id,kind,id]);
 const createPage=()=>{
  setError('');
  const pageId=create({kind,id,title});
  if(!pageId){setError('Notebook is unavailable. Try again after your pages load.');return;}
  setSelectedId(pageId);
  setDraft('');
 };
 const edit=(value:string)=>{
  if(!selected||!editable||preview)return;
  setDraft(value);
  // Same Notebook entry and store method as the full editor.
  // A user can switch tabs immediately without losing unsaved keystrokes.
  update(selected.id,encodeInlineRecordText(value));
 };
 return <section className="ss-record-inline-notebook" aria-label={title+' Notebook pages'}>
  <RecordTabToolbar label="Notebook" meta={linked.length+' linked '+(linked.length===1?'page':'pages')}
   actions={<button type="button" disabled={!hydrated||!!preview} onClick={createPage}
    aria-label={'Create Notebook page for '+title}>+ Page</button>}/>
  {error&&<small role="alert" className="ss-record-inline-notebook-error">{error}</small>}
  {linked.length>0&&<nav className="ss-record-inline-notebook-pages" aria-label="Linked Notebook pages">
   {linked.map(page=><button key={page.id} type="button"
    aria-pressed={selected?.id===page.id} onClick={()=>setSelectedId(page.id)}
    title={page.title}>
    <span>{page.title}</span>
    <small>{new Date(page.updatedAt).toLocaleDateString()}</small>
   </button>)}
  </nav>}
  {!selected?<p className="connections-record-empty">Create a page to take notes here.
   It will also appear in Notebook, named after this record.</p>:
   editable?<div className="ss-record-inline-notebook-editor">
    <label htmlFor={'ss-record-note-'+id}>Notes · {selected.title}</label>
    <textarea id={'ss-record-note-'+id} value={draft} onChange={e=>edit(e.target.value)}
     disabled={!!preview} rows={10} maxLength={30000}
     placeholder="Type notes here… Saved to Notebook automatically."/>
    <div className="ss-record-inline-notebook-editor-foot">
     <small>Saved to Notebook as you type</small>
     <button type="button" onClick={()=>onOpenPage(selected.id)}>Open full page</button>
    </div>
   </div>:<div className="ss-record-inline-notebook-rich">
    <p>Rich Notebook pages are edited in Notebook to preserve their formatting and objects.</p>
    <button type="button" onClick={()=>onOpenPage(selected.id)}>Open {selected.title}</button>
   </div>}
 </section>;
}
