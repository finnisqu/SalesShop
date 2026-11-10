import type {Quote} from '../types/quote';
import {useQuoteCloudStatusStore} from '../store/quoteCloudStatusStore';
import {CLOUD_DOCUMENT_RETRY_EVENT} from '../data/cloudAwareStorage';
import '../sales-document-workspace.css';
import '../sales-document-cloud-save.css';

/** Autosave metadata only. Edit/Preview remain in document navigation,
 * while document commands now live beside Undo and Redo in the left rail. */
export function SalesDocumentSaveStatus({quote,cloudMode,compact=false}:{quote:Quote;cloudMode:boolean;compact?:boolean}){
  const status=useQuoteCloudStatusStore(state=>state.status);
  const error=useQuoteCloudStatusStore(state=>state.message);
  const changed=Number.isFinite(new Date(quote.updatedAt).getTime())
    ?new Date(quote.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})
    :undefined;
  const label=cloudMode
    ?status==='saved'?'Saved to cloud'
      :status==='pending'?'Cloud save pending'
      :status==='syncing'?'Saving to cloud…'
      :status==='error'?'Cloud save failed · Draft kept on device'
      :'Saved on device · Cloud status unknown'
    :'Saved on device';
  const compactLabel=cloudMode
    ?status==='saved'?'Cloud'
      :status==='pending'?'Pending'
      :status==='syncing'?'Saving…'
      :status==='error'?'Save failed'
      :'Offline'
    :'Device';
  return <span className={'sales-document-save-status'+(cloudMode?' is-cloud-'+status:'')} role="status"
    aria-label={compact?label:undefined}
    title={cloudMode?(error??label):'Document changes are automatically saved on this device.'}>
    <span aria-hidden="true">{cloudMode&&status==='error'?'!':cloudMode&&status!=='saved'?'◷':'✓'}</span>
    {compact?compactLabel:label}{changed&&!compact?' · '+changed:''}
    {cloudMode&&status==='error'&&<button type="button" aria-label="Retry saving quote to cloud"
      title="Retry cloud save" onClick={()=>window.dispatchEvent(new Event(CLOUD_DOCUMENT_RETRY_EVENT))}>Retry</button>}
  </span>;
}
