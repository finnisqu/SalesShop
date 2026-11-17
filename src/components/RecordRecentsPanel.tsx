import {useState,type ReactNode} from 'react';
import {RecordCard} from './RecordPageLayout';

/** One right-column Recents panel for quotes, activities and relationship history.
 * Existing record navigation and permission checks remain in their original content.
 */
export function RecordRecentsPanel({quotes,activities,quoteCount,activityCount,history,historyCount}:{
 quotes:ReactNode;activities:ReactNode;quoteCount:number;activityCount:number;
 history?:ReactNode;historyCount?:number;
}){
 const [tab,setTab]=useState<'quotes'|'activities'|'history'>('quotes');
 const tabs=[
  {id:'quotes' as const,label:'Quotes',count:quoteCount},
  {id:'activities' as const,label:'Activities',count:activityCount},
  ...(history!==undefined?[{id:'history' as const,label:'History',count:historyCount}]:[])
 ];
 const selected=tabs.some(item=>item.id===tab)?tab:'quotes';
 return <RecordCard title="Recents" extra={<div className="ss-record-recents-tabs"
  role="tablist" aria-label="Recent record activity">
  {tabs.map(item=><button key={item.id} type="button" role="tab"
   aria-selected={selected===item.id}
   className={selected===item.id?'is-active':''} onClick={()=>setTab(item.id)}>
   {item.label} {item.count!==undefined&&<span>{item.count}</span>}
  </button>)}
 </div>}>
  <div role="tabpanel" aria-label={'Recent '+selected} className="ss-record-recents-body">
   {selected==='quotes'?quotes:selected==='activities'?activities:history}
  </div>
 </RecordCard>;
}
