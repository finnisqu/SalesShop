import {useRef} from 'react';
import {useDismissibleDetails} from './useDismissibleDetails';

/** Draft status is a compact launcher, never a destructive one-click action.
 * Deletion reuses the existing Quote library's guarded confirmation dialog. */
export function QuoteDraftStatusMenu372({label,onDelete,onCopy,onDocuments}:{
 label:string;onDelete:()=>void;onCopy:()=>void;onDocuments:()=>void;
}){
 const ref=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(ref);
 const run=(action:()=>void)=>{ref.current?.removeAttribute('open');action();};
 return <details className="qmb-draft-status-menu" ref={ref}>
  <summary className="qmb-editor-status" role="button"
   aria-label={'Quote '+label+' options'} title="Draft options">
   {label} <span aria-hidden="true">⌄</span>
  </summary>
  <div className="qmb-draft-status-popover" role="group" aria-label="Quote draft options">
   <button type="button" onClick={()=>run(onDocuments)}>Back to documents</button>
   <button type="button" onClick={()=>run(onCopy)}>Make independent copy…</button>
   <div className="qmb-draft-status-divider"/>
   <button type="button" className="is-danger" onClick={()=>run(onDelete)}>
    Delete this Quote draft…
   </button>
   <small>Deletion requires confirmation and is available only for eligible, never-issued drafts.</small>
  </div>
 </details>;
}
