import {useState} from 'react';

/** One consistent, explicitly confirmed Unlink action for CRM associations,
 * private Tasks and direct Deal–Person relationships. Each caller decides
 * whether a relationship is editable and supplies its own safe mutation. */
export function RecordUnlinkButton({ariaLabel,confirmation,onUnlink,disabled=false}:{
 ariaLabel:string;confirmation:string;onUnlink:()=>void|Promise<void>;disabled?:boolean;
}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const unlink=async()=>{
  if(disabled||busy||!window.confirm(confirmation))return;
  setError('');setBusy(true);
  try{await onUnlink();}
  catch(reason){setError(reason instanceof Error?reason.message:'Could not unlink this record.');}
  finally{setBusy(false);}
 };
 return <span className="ss-record-unlink-control">
  <button type="button" className="ss-record-unlink-button"
   disabled={disabled||busy} aria-label={ariaLabel}
   title="Remove link, keep linked records and history"
   onClick={()=>void unlink()}>{busy?'Unlinking…':'Unlink'}</button>
  {error&&<small role="alert" className="ss-record-unlink-error">{error}</small>}
 </span>;
}
