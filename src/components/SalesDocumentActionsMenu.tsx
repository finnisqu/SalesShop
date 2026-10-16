import {useRef} from 'react';
import type {Quote} from '../types/quote';
import {quoteCanCreateRevision} from '../services/quoteIntegrity';
import '../sales-document-workspace.css';

export function SalesDocumentActionsMenu({quote,canManage,canIssue,canDelete,
  onCopy,onDelete,onArchive,onRevise}:{
  quote:Quote;canManage:boolean;canIssue:boolean;canDelete:boolean;
  onCopy:()=>void;onDelete:()=>void;onArchive:()=>void;onRevise:()=>void;
}){
  const ref=useRef<HTMLDetailsElement>(null);
  const run=(fn:()=>void)=>{ref.current?.removeAttribute('open');fn();};
  return <details ref={ref} className="sales-document-rail-actions">
    <summary role="button" aria-label="Document options" title="Document options">⋯</summary>
    <div className="sales-document-rail-menu">
      {canManage&&<>
        <button type="button" onClick={()=>run(onCopy)}>Make independent copy…</button>
        <button type="button" onClick={()=>run(onArchive)}>Archive document…</button>
        {canDelete&&<button type="button" className="is-danger" onClick={()=>run(onDelete)}>Delete draft…</button>}
      </>}
      {canIssue&&quoteCanCreateRevision(quote)&&!quote.archivedAt&&
        <button type="button" onClick={()=>run(onRevise)}>Create next revision</button>}
      <small>Changes save automatically. Copy and delete require confirmation.</small>
    </div>
  </details>;
}
