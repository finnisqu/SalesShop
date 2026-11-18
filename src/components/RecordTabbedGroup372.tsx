import {useRef,useState,type ReactNode} from 'react';
import type {CrmFieldTarget} from '../services/crmFieldBlueprint352b';
import {useAuthStore} from '../store/authStore';
import {useDismissibleDetails} from './useDismissibleDetails';
import {readPersonalCrmLayoutDefaults} from '../services/crmPersonalViewDefaults381';
import {personalRecordTabPresentation} from '../services/crmPersonalRecordTabs382';
import './personal-record-tabs382.css';
import {RecordTabToolbar} from './RecordTabToolbar';

export interface RecordPanelTab {
 id:string;label:string;content:ReactNode;count?:number;tools?:ReactNode;
 /** A custom toolbar, or a nested panel that renders its own shared toolbar. */
 toolbar?:{label?:string;meta?:ReactNode;actions?:ReactNode};internalToolbar?:boolean;
}
/** One panel per record region instead of a tall stack of full-height cards.
 * Mounted content is kept intact within the selected tab; no CRM state is copied.
 */
export function RecordTabbedGroup372({title,items,initialTab,showTitle=false,personalTarget}:{
 title:string;items:readonly RecordPanelTab[];initialTab?:string;showTitle?:boolean;
 /** Applies only to the left record tabs. All content remains accessible. */
 personalTarget?:CrmFieldTarget;
}){
 const [current,setCurrent]=useState(initialTab??items[0]?.id??'');
 const hiddenMenuRef=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(hiddenMenuRef);
 const mode=useAuthStore(state=>state.mode);
 const organizationId=useAuthStore(state=>state.organizationId);
 const userId=useAuthStore(state=>state.user?.id);
 const profile=personalTarget&&typeof window!=='undefined'?readPersonalCrmLayoutDefaults(
  key=>window.localStorage.getItem(key),{mode,organizationId,userId}):null;
 const presentation=personalTarget?personalRecordTabPresentation(items,personalTarget,profile):
  {shown:[...items],hidden:[] as RecordPanelTab[]};
 const selected=items.find(item=>item.id===current)??presentation.shown[0]??items[0];
 if(!selected)return null;
 const selectedHidden=presentation.hidden.some(item=>item.id===selected.id);
 const visibleTabs=selectedHidden?[...presentation.shown,selected]:presentation.shown;
 return <section className="connections-record-panel ss-record-tabbed-panel">
  <header className="ss-record-tabbed-header">
   {showTitle&&<h2 className="ss-record-panel-title">{title}</h2>}
   <nav className="ss-record-panel-tabs" role="tablist" aria-label={title+' sections'}>
  {visibleTabs.map(item=><button type="button" key={item.id} role="tab"
    aria-selected={selected.id===item.id}
    className={selected.id===item.id?'is-active':''}
    onClick={()=>setCurrent(item.id)}>
    {item.label}{item.count!==undefined&&<small>{item.count}</small>}
  </button>)}
   </nav>
   {presentation.hidden.length>0&&<details ref={hiddenMenuRef} className="ss-record-hidden-sections">
    <summary aria-label="More record sections">More <small>{presentation.hidden.length}</small></summary>
    <div className="ss-record-hidden-sections-menu" role="group"
     aria-label="Hidden record sections">
     {presentation.hidden.map(item=><button type="button" key={item.id}
      aria-current={selected.id===item.id?'page':undefined}
      onClick={()=>{
       setCurrent(item.id);
       hiddenMenuRef.current?.removeAttribute('open');
      }}>{item.label}{item.count!==undefined?' · '+item.count:''}</button>)}
    </div>
   </details>}
   {selected.tools&&<div className="ss-record-tab-tools">{selected.tools}</div>}
  </header>
  <div className="connections-record-panel-body">
   <div className="ss-record-tabbed-body" role="tabpanel" aria-label={selected.label}>
    {!selected.internalToolbar&&<RecordTabToolbar label={selected.toolbar?.label??selected.label}
      meta={selected.toolbar?.meta??(selected.count!==undefined?selected.count+' linked':undefined)}
      actions={selected.toolbar?.actions}/>}
    {selected.content}
   </div>
  </div>
 </section>;
}
