import {useState,type ReactNode} from 'react';
import {RecordCard} from './RecordPageLayout';

/** Shared center-column Quotes/Activities recents with familiar header tabs. */
export function RecordRecentsPanel({quotes,activities,quoteCount,activityCount}:{
 quotes:ReactNode;activities:ReactNode;quoteCount:number;activityCount:number;
}){
 const [tab,setTab]=useState<'quotes'|'activities'>('quotes');
 return <RecordCard title="Recents" extra={<div className="ss-record-recents-tabs"
  role="tablist" aria-label="Recent record activity">
  <button type="button" role="tab" aria-selected={tab==='quotes'}
    className={tab==='quotes'?'is-active':''} onClick={()=>setTab('quotes')}>
    Quotes <span>{quoteCount}</span>
  </button>
  <button type="button" role="tab" aria-selected={tab==='activities'}
    className={tab==='activities'?'is-active':''} onClick={()=>setTab('activities')}>
    Activities <span>{activityCount}</span>
  </button>
 </div>}>
  <div role="tabpanel" aria-label={'Recent '+tab} className="ss-record-recents-body">
   {tab==='quotes'?quotes:activities}
  </div>
 </RecordCard>;
}
