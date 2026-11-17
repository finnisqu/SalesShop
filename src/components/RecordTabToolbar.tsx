import type {ReactNode} from 'react';
import './record-tab-toolbar.css';

/** Shared toolbar underneath the tab selector on CRM record pages.
 * Keep navigation tabs separate from each tab's own counts and actions. */
export function RecordTabToolbar({label,meta,actions}:{
 label:string;meta?:ReactNode;actions?:ReactNode;
}){
 return <div className="ss-record-tab-toolbar" role="group" aria-label={label+' controls'}>
  <div className="ss-record-tab-toolbar-summary">
   <strong>{label}</strong>
   {meta!==undefined&&meta!==null&&<small>{meta}</small>}
  </div>
  {actions&&<div className="ss-record-tab-toolbar-actions">{actions}</div>}
 </div>;
}
