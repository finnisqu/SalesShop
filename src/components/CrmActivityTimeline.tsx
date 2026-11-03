import {useState} from 'react';
import type {Activity} from '../types/crm';
import {requestActivityDetail} from './ActivityDetailHost';

const methodIcons:Record<string,string>={
 'call':'☎','email':'✉','text':'▤','video-call':'▣','in-person':'⌖',
};
const displayMethod=(item:Activity)=>{
 const method=item.metadata?.interactionMethod;
 return method?method.replaceAll('-',' '):item.type.replaceAll('-',' ');
};
/** A single CRM interaction is rendered once, even when it links a person,
 * company, deal and quote. Every row opens the original Activity itself. */
export function CrmActivityTimeline({activities,emptyMessage='No activity recorded yet.',initialLimit=5}:{
 activities:readonly Activity[];emptyMessage?:string;initialLimit?:number;
}){
 const [showAll,setShowAll]=useState(false);
 const unique=[...new Map(activities.filter(a=>!a.metadata?.voidedAt)
  .map(a=>[a.id,a])).values()]
  .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id.localeCompare(a.id));
 const visible=showAll?unique:unique.slice(0,initialLimit);
 return <>
  {visible.length?<ol className="connections-record-timeline sales-crm-activity-timeline">
   {visible.map(activity=><li key={activity.id}>
    <button type="button" className="sales-crm-activity-entry"
      aria-label={'View Activity: '+activity.summary}
      onClick={()=>requestActivityDetail(activity.id)}>
      <span className="sales-crm-activity-method" aria-hidden="true">
       {methodIcons[activity.metadata?.interactionMethod??'']??'◷'}</span>
      <span className="sales-crm-activity-description">
       <strong>{activity.summary}</strong>
       <small>{displayMethod(activity)}
        {' · '+new Date(activity.occurredAt).toLocaleString(undefined,{
         month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small>
       {activity.metadata?.notes&&<span className="sales-crm-activity-excerpt">
        {activity.metadata.notes.slice(0,120)}</span>}
      </span>
      <span className="sales-crm-activity-arrow" aria-hidden="true">›</span>
    </button>
   </li>)}
  </ol>:<p className="connections-record-empty">{emptyMessage}</p>}
  {unique.length>initialLimit&&<button type="button" className="sales-crm-activity-more"
   onClick={()=>setShowAll(value=>!value)}>
   {showAll?'Show recent only':'View all '+unique.length+' activities'}
  </button>}
 </>;
}
