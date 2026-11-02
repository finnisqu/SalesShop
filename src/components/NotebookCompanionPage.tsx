import {TextEditor} from './TextEditor';
import {DrawingCanvas} from './DrawingCanvas';
import {NotebookObjectLayer} from './NotebookObjectLayer';
import type {NotebookEntry} from '../types/notebook';

export function NotebookCompanionPage({entry,onMakePrimary,onClose}:{
 entry:NotebookEntry;onMakePrimary:()=>void;onClose:()=>void;
}){
 return <section className="notebook-companion" aria-label={'Companion Notebook page: '+entry.title}>
   <header className="notebook-companion-header">
     <span><small>SECOND PAGE · READ-ONLY PREVIEW</small><strong>{entry.title||'Untitled page'}</strong></span>
     <div><button type="button" onClick={onMakePrimary} title="Switch this page into the editable primary pane">
       Edit page ↔</button>
       <button type="button" onClick={onClose} aria-label="Close second page" title="Close second page">×</button>
     </div>
   </header>
   <div className="notebook-companion-scroll">
     <article className={`paper-sheet paper-${entry.paperStyle} tone-${entry.tone} texture-${entry.texture}`}>
       <div className="paper-edge" aria-hidden="true"/>
       <header className="paper-heading">
         <h2 className="notebook-companion-page-title">{entry.title||'Untitled page'}</h2>
         <div className="paper-meta-line">{new Date(entry.updatedAt).toLocaleDateString()} · Reference page</div>
       </header>
       <div className="paper-writing-surface">
         <TextEditor key={'companion-text-'+entry.id} entry={entry} readOnly/>
         <DrawingCanvas key={'companion-ink-'+entry.id} entry={entry}/>
         <NotebookObjectLayer key={'companion-objects-'+entry.id} entry={entry} readOnly/>
       </div>
     </article>
   </div>
 </section>;
}
