import type {ReactNode} from 'react';
import './quote-table-actions.css';

export type BulkIcon='copy'|'lump'|'itemize'|'hide'|'show'|'rate'|'strike'|'restore'|'move'|'delete';
export type BulkAction={id:string;label:string;icon:BulkIcon;onClick:()=>void;disabled?:boolean;danger?:boolean;active?:boolean};
function ActionIcon({name}:{name:BulkIcon}){
 const path:Record<BulkIcon,ReactNode>={
 copy:<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
 lump:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6"/></>,
 itemize:<><path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6h2M3 12h2M3 18h2"/></>,
 hide:<><path d="M3 3l18 18M10 6a10 10 0 0 1 11 6 11 11 0 0 1-3 4M7 7a12 12 0 0 0-4 5s3 6 9 6a11 11 0 0 0 3-.4"/><path d="M10 10a3 3 0 0 0 4 4"/></>,
 show:<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
 rate:<><path d="M12 2v20M17 6H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6"/></>,
 strike:<><path d="M4 12h16M7 7l10 10"/></>,
 restore:<><path d="M3 11a9 9 0 1 1 3 7M3 4v7h7"/></>,
 move:<><path d="M4 12h16M14 6l6 6-6 6"/></>,
 delete:<><path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6"/></>,
 };
 return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path[name]}</svg>;
}
/** An overlay, never a new row in the editable workbook. */
export function QuoteBulkActionPopover({count,actions,onClear,children}:{
 count:number;actions:BulkAction[];onClear:()=>void;children?:ReactNode;
}){
 if(count===0)return null;
 return <div className="qba-popover" role="toolbar" aria-label={count+' selected: bulk row actions'}>
   <span className="qba-count" aria-label={count+' rows selected'}>{count}</span>
   <div className="qba-actions">
     {actions.map(action=><button key={action.id} type="button" title={action.label}
       aria-label={action.label} aria-pressed={action.active||undefined}
       disabled={action.disabled} className={action.danger?'is-danger':''} onClick={action.onClick}>
       <ActionIcon name={action.icon}/></button>)}
     <button type="button" aria-label="Clear selection" title="Clear selection" onClick={onClear}
       className="qba-close">×</button>
   </div>
   {children}
 </div>;
}
