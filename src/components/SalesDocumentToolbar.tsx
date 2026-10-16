import type {Quote} from '../types/quote';
import '../sales-document-workspace.css';

/** Autosave metadata only. Edit/Preview remain in document navigation,
 * while document commands now live beside Undo and Redo in the left rail. */
export function SalesDocumentSaveStatus({quote,cloudMode}:{quote:Quote;cloudMode:boolean}){
  const changed=Number.isFinite(new Date(quote.updatedAt).getTime())
    ?new Date(quote.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})
    :undefined;
  return <span className="sales-document-save-status" role="status"
    title={cloudMode
      ?'Changes save to this device first. Cloud synchronization is separate.'
      :'Document changes are automatically saved on this device.'}>
    <span aria-hidden="true">✓</span> Saved on device{changed?' · '+changed:''}
  </span>;
}
