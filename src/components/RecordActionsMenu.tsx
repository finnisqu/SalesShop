import {useRef,useState} from 'react';
import {useDismissibleDetails} from './useDismissibleDetails';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';

export function RecordActionsMenu({unlinking,onUnlink,onDelete,disabled=false}:{
 unlinking:boolean;onUnlink:()=>void;
 onDelete?:()=>Promise<void>;disabled?:boolean;
}){
 const ref=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(ref);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const runDelete=async()=>{
  if(!onDelete||busy)return;
  if(!window.confirm('Delete this record? Only records that pass the CRM relationship/history safety checks can be deleted. This cannot be undone.'))return;
  setBusy(true);setError('');
  try{await onDelete();ref.current?.removeAttribute('open');}
  catch(e){setError(e instanceof Error?e.message:'Unable to delete this record.');}
  finally{setBusy(false);}
 };
 return <details className="ss-record-actions-menu" ref={ref}>
  <summary aria-label="More record actions" title="More record actions" aria-haspopup="menu">
   <WorkspaceChromeIcon name="more"/>
  </summary>
  <div className="ss-record-actions-popover" role="group" aria-label="Record actions">
   <button type="button" disabled={disabled||busy} onClick={()=>{
     ref.current?.removeAttribute('open');onUnlink();
   }}>{unlinking?'Done unlinking':'Unlink connections'}</button>
   {onDelete&&<button type="button" className="is-destructive" disabled={disabled||busy}
     onClick={()=>void runDelete()}>{busy?'Checking…':'Delete record…'}</button>}
   {error&&<small role="alert" className="ss-record-menu-error">{error}</small>}
  </div>
 </details>;
}
