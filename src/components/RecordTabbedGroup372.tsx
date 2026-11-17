import {useState,type ReactNode} from 'react';

export interface RecordPanelTab {
 id:string;label:string;content:ReactNode;count?:number;tools?:ReactNode;
}
/** One panel per record region instead of a tall stack of full-height cards.
 * Mounted content is kept intact within the selected tab; no CRM state is copied.
 */
export function RecordTabbedGroup372({title,items,initialTab,showTitle=false}:{
 title:string;items:readonly RecordPanelTab[];initialTab?:string;showTitle?:boolean;
}){
 const [current,setCurrent]=useState(initialTab??items[0]?.id??'');
 const selected=items.find(item=>item.id===current)??items[0];
 if(!selected)return null;
 return <section className="connections-record-panel ss-record-tabbed-panel">
  <header className="ss-record-tabbed-header">
   {showTitle&&<h2 className="ss-record-panel-title">{title}</h2>}
   <nav className="ss-record-panel-tabs" role="tablist" aria-label={title+' sections'}>
  {items.map(item=><button type="button" key={item.id} role="tab"
    aria-selected={selected.id===item.id}
    className={selected.id===item.id?'is-active':''}
    onClick={()=>setCurrent(item.id)}>
    {item.label}{item.count!==undefined&&<small>{item.count}</small>}
  </button>)}
   </nav>
   {selected.tools&&<div className="ss-record-tab-tools">{selected.tools}</div>}
  </header>
  <div className="connections-record-panel-body">
   <div className="ss-record-tabbed-body" role="tabpanel" aria-label={selected.label}>
    {selected.content}
   </div>
  </div>
 </section>;
}
