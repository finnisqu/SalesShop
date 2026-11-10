import {useState} from 'react';
import type {CompanyHistoryFilter,CompanyHistoryItem,CompanyHistoryTarget}
 from '../services/companyRelationshipHistory';
import {companyHistoryByFilter} from '../services/companyRelationshipHistory';
import './company-relationship-timeline.css';

const filters:ReadonlyArray<{key:CompanyHistoryFilter;label:string}>=[
 {key:'all',label:'All'},{key:'interactions',label:'Interactions'},
 {key:'quotes',label:'Quotes'},{key:'deals',label:'Deals'},{key:'tasks',label:'Tasks'},
];
function historyDate(value:string){
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{
  month:'short',day:'numeric',year:'numeric'}):value;
}
function HistoryGlyph({item}:{item:CompanyHistoryItem}){
 const name=item.category==='interaction'&&item.method==='call'?'phone':
  item.category==='interaction'&&item.method==='email'?'mail':
  item.category==='interaction'&&item.method==='text'?'message':
  item.category==='task'?'task':item.category==='deal'?'deal':
  item.category==='quote'?'quote':'system';
 return <span className={'company-history-symbol is-'+item.category} aria-hidden="true">
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
   stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
   {name==='phone'?<path d="M5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2 5 2v3a2 2 0 0 1-2 2C11 20 4 13 3 5a2 2 0 0 1 2-2Z"/>:
    name==='mail'?<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>:
    name==='message'?<path d="M21 11a8 8 0 0 1-8 8H5l2-4a8 8 0 1 1 14-4Z"/>:
    name==='task'?<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></>:
    name==='deal'?<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></>:
    name==='quote'?<><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 12h7M9 16h7"/></>:
    <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>}
  </svg>
 </span>;
}
export function CompanyRelationshipTimeline({items,compact=false,onOpenTarget}:{
 items:readonly CompanyHistoryItem[];compact?:boolean;
 onOpenTarget?:(target:CompanyHistoryTarget)=>void;
}){
 const [filter,setFilter]=useState<CompanyHistoryFilter>('all');
 const [expanded,setExpanded]=useState(false);
 const filtered=companyHistoryByFilter(items,compact?'all':filter);
 const limit=compact?4:expanded?80:9;
 const shown=filtered.slice(0,limit);
 const lastInteraction=items.find(item=>item.category==='interaction');
 const pending=items.filter(item=>item.category==='task'&&item.pending).length;
 return <div className={'company-history'+(compact?' is-compact':'')}>
  <div className="company-history-summary">
   <span>{lastInteraction?'Last interaction · '+historyDate(lastInteraction.at):'No recorded interactions'}</span>
   {pending>0&&<span>{pending} open linked {pending===1?'task':'tasks'}</span>}
  </div>
  {!compact&&<div className="company-history-filters" role="group" aria-label="Filter company relationship history">
   {filters.map(choice=><button type="button" key={choice.key}
    aria-pressed={filter===choice.key} onClick={()=>{setFilter(choice.key);setExpanded(false);}}>
    {choice.label}</button>)}
  </div>}
  <ol className="company-history-list">
   {shown.map(item=><li key={item.id}>
    <HistoryGlyph item={item}/>
    <div className="company-history-entry">
     <strong>{item.title}</strong>
     <small>{item.detail}</small>
     <time dateTime={item.at}>{historyDate(item.at)}</time>
    </div>
    {item.target&&onOpenTarget&&<button type="button" className="company-history-open"
     aria-label={'Open related '+item.target.kind+' for '+item.title}
     onClick={()=>onOpenTarget(item.target!)}>Open</button>}
   </li>)}
  </ol>
  {!shown.length&&<p className="company-history-empty">No linked history in this category yet.</p>}
  {!compact&&filtered.length>limit&&<button type="button" className="company-history-show-more"
   onClick={()=>setExpanded(true)}>Show more ({filtered.length-limit} remaining)</button>}
  {!compact&&expanded&&filtered.length>9&&<button type="button" className="company-history-show-less"
   onClick={()=>setExpanded(false)}>Show less</button>}
  {compact&&items.length>shown.length&&<small className="company-history-more">
   {items.length-shown.length} more events on the Company page
  </small>}
 </div>;
}
