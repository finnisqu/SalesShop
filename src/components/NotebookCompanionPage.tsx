import {useState} from 'react';
import type {Editor} from '@tiptap/react';
import {Toolbar} from './Toolbar';
import {TextEditor} from './TextEditor';
import {DrawingCanvas} from './DrawingCanvas';
import {NotebookObjectLayer} from './NotebookObjectLayer';
import {NotebookLinkedAgenda} from './NotebookLinkedAgenda';
import {useNotebookStore} from '../store/notebookStore';
import type {NotebookEntry} from '../types/notebook';

export function NotebookCompanionPage({entry,onMakePrimary,onClose,onFocus,active}:{
 entry:NotebookEntry;onMakePrimary:()=>void;onClose:()=>void;
 onFocus:()=>void;active:boolean;
}){
 const [editor,setEditor]=useState<Editor|null>(null);
 const renameEntry=useNotebookStore(s=>s.renameEntry);
 return <section data-notebook-pane="right"
   className={`notebook-companion notebook-editable-pane ${active?'is-focused-pane':''}`}
   aria-label={'Right Notebook page: '+entry.title} onPointerDownCapture={onFocus} onFocusCapture={onFocus}>
   <div className="notebook-companion-header">
     <span><small>RIGHT PAGE · EDITABLE</small><strong>{entry.title||'Untitled page'}</strong></span>
     <div><button type="button" onClick={onMakePrimary} title="Swap left and right pages">⇄ Swap</button>
       <button type="button" onClick={onClose} aria-label="Close right page" title="Close right page">×</button>
     </div>
   </div>
   <Toolbar key={'right-toolbar-'+entry.id} entry={entry} editor={editor} enableShortcuts splitMode activePane={active}/>
   <div className="notebook-companion-scroll">
     <article className={`paper-sheet paper-${entry.paperStyle} tone-${entry.tone} texture-${entry.texture}`}>
       <div className="paper-edge" aria-hidden="true"/>
       <header className="paper-heading">
         <input className="paper-title" value={entry.title}
           onChange={event=>renameEntry(entry.id,event.target.value)}
           aria-label="Right Notebook page title"/>
         <div className="paper-meta-line">
           {new Date(entry.updatedAt).toLocaleDateString()} · Right editing pane
         </div>
       </header>
       <div className="paper-writing-surface">
         <TextEditor key={'right-text-'+entry.id} entry={entry} onEditorReady={setEditor}/>
         <DrawingCanvas key={'right-ink-'+entry.id} entry={entry} activePane={active}/>
         <NotebookObjectLayer key={'right-objects-'+entry.id} entry={entry} activePane={active}/>
       </div>
     </article>
     <NotebookLinkedAgenda key={'agenda-'+entry.id} entry={entry}/>
   </div>
 </section>;
}
