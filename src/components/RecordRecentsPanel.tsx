import {useState,type ReactNode} from 'react';
import {RecordCard} from './RecordPageLayout';
import {RecordTabToolbar} from './RecordTabToolbar';

/** A single right-column history tab includes logged Activities and relationship events.
 * Keep the existing Activities prop for backward-compatible callers.
 */
export function RecordRecentsPanel({quotes,activities,quoteCount,activityCount,history,historyCount,quoteActions}:{
 quotes:ReactNode;activities:ReactNode;quoteCount:number;activityCount:number;
 history?:ReactNode;historyCount?:number;quoteActions?:ReactNode;
}){
 const [tab,setTab]=useState<'quotes'|'history'>('quotes');
 const historyContent=history??activities;
 return <RecordCard title="Recents" extra={<div className="ss-record-recents-tabs"
  role="tablist" aria-label="Recent record activity">
  <button type="button" role="tab" aria-selected={tab==='quotes'}
   className={tab==='quotes'?'is-active':''} onClick={()=>setTab('quotes')}>
   Quotes <span>{quoteCount}</span>
  </button>
  <button type="button" role="tab" aria-selected={tab==='history'}
   className={tab==='history'?'is-active':''} onClick={()=>setTab('history')}>
   History <span>{historyCount??activityCount}</span>
  </button>
 </div>}>
  <div role="tabpanel" aria-label={tab==='quotes'?'Recent Quotes':'Relationship and Activity History'}
   className="ss-record-recents-body">
   <RecordTabToolbar label={tab==='quotes'?'Quotes':'History'}
    meta={(tab==='quotes'?quoteCount:historyCount??activityCount)+' '+(tab==='quotes'?'linked':'events')}
    actions={tab==='quotes'?quoteActions:undefined}/>
   {tab==='quotes'?quotes:historyContent}
  </div>
 </RecordCard>;
}
