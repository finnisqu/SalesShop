import {useRef} from 'react';
import type {Quote} from '../types/quote';
import {displayQuoteNumber} from '../types/quote';
import {salesDocumentTemplate,salesTemplateLabel} from '../services/salesDocumentTemplates';
import {quoteCanCreateRevision} from '../services/quoteIntegrity';
import '../sales-document-workspace.css';

export function SalesDocumentToolbar({quote,onLibrary,onBuild,onDetails,onPreview,onDuplicate,
  onCreateRevision,canCreateRevision,canDuplicate,cloudMode}:{
  quote:Quote;
  onLibrary:()=>void;onBuild:()=>void;onDetails:()=>void;onPreview:()=>void;
  onDuplicate:()=>void;onCreateRevision:()=>void;canCreateRevision:boolean;
  canDuplicate:boolean;
  cloudMode:boolean;
}){
  const menu=useRef<HTMLDetailsElement>(null);
  const closeThen=(cb:()=>void)=>{menu.current?.removeAttribute('open');cb();};
  const changed=Number.isFinite(new Date(quote.updatedAt).getTime())
    ?new Date(quote.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})
    :undefined;
  const template=salesDocumentTemplate(quote);
  const canRevise=canCreateRevision&&quoteCanCreateRevision(quote)&&!quote.archivedAt;
  return <div className="sales-document-toolbar" role="toolbar" aria-label="Document actions">
    <div className="sales-document-toolbar-meta">
      <strong>{salesTemplateLabel(template)}</strong>
      <span>{displayQuoteNumber(quote)} · Rev {quote.revision}</span>
      <span className="sales-document-save-status" role="status"
        title={cloudMode
          ?'Changes are saved to this device first. Cloud synchronization occurs separately.'
          :'Document changes are automatically saved on this device.'}>
        <span aria-hidden="true">✓</span> Saved on device{changed?' · '+changed:''}
      </span>
    </div>
    <div className="sales-document-toolbar-actions">
      <button type="button" onClick={onBuild} title="Return to the document editor">Edit</button>
      <button type="button" aria-label="View customer document" onClick={onPreview} title="View exactly what the customer sees">Preview</button>
      <details ref={menu} className="sales-document-actions-menu">
        <summary aria-label="More document actions">More <span aria-hidden="true">⌄</span></summary>
        <div className="sales-document-actions-popover">
          <button type="button" onClick={()=>closeThen(onDetails)}>Customer, project & revisions</button>
          {canDuplicate&&<button type="button" onClick={()=>closeThen(onDuplicate)}>Make independent copy</button>}
          {canRevise&&<button type="button" onClick={()=>closeThen(onCreateRevision)}>
            Create next revision
          </button>}
          <button type="button" onClick={()=>closeThen(onLibrary)}>Back to document library</button>
          <small>{quote.history.length} frozen revision{quote.history.length===1?'':'s'} · Current status: {quote.status}</small>
        </div>
      </details>
    </div>
  </div>;
}
