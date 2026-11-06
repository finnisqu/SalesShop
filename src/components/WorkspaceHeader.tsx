import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useDismissibleDetails} from './useDismissibleDetails';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';
import '../workspace-header-standard.css';

/** Shared top-level workspace chrome. Stable slots across all six workspaces. */
export interface MobileWorkspaceTab{value:string;label:string}
export function WorkspaceHeader({title,help,tabs,more,search,primary,className='',
 mobileTabs,mobileTabValue,onMobileTabChange}:{
 title:string;help?:ReactNode;tabs?:ReactNode;more?:ReactNode;search?:ReactNode;primary?:ReactNode;className?:string;
 mobileTabs?:readonly MobileWorkspaceTab[];mobileTabValue?:string;onMobileTabChange?:(value:string)=>void;
}){
 const [searchOpen,setSearchOpen]=useState(false);
 const searchPanelRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(searchOpen)searchPanelRef.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});
 },[searchOpen]);
 return <header className={'ss-workspace-header '+className}>
  <div className="ss-workspace-header__intro">{help ? <div className="ss-workspace-title-row"><h1>{title}</h1>{help}</div> : <h1>{title}</h1>}</div>
  <div className="ss-workspace-header__tabs">{tabs}</div>
  {mobileTabs&&mobileTabs.length>0&&<div className="ss-workspace-header__mobile-nav">
   <select aria-label={title+' sections'} value={mobileTabValue??mobileTabs[0].value}
    onChange={e=>onMobileTabChange?.(e.target.value)}>
    {mobileTabs.map(tab=><option value={tab.value} key={tab.value}>{tab.label}</option>)}
   </select>
  </div>}
  <div className="ss-workspace-header__tools">
   <div className="ss-workspace-header__more">{more}</div>
   <div className={'ss-workspace-header__search'+(searchOpen?' is-open':'')}>
    {search&&<button type="button" className="ss-workspace-header__search-toggle"
     onClick={()=>setSearchOpen(open=>!open)}
     aria-expanded={searchOpen} aria-label={searchOpen?'Close '+title+' search':'Search '+title}>
     <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>
     </svg>
    </button>}
    <div ref={searchPanelRef} className="ss-workspace-header__search-popover">{search}</div>
   </div>
   <div className="ss-workspace-header__primary">{primary}</div>
  </div>
 </header>;
}
export interface WorkspaceMoreItem{label:string;onClick:()=>void;active?:boolean;disabled?:boolean}
export function WorkspaceMoreMenu({items,label='More'}:{items:readonly WorkspaceMoreItem[];label?:string}){
 const ref=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(ref);
 return <details className="ss-workspace-more" ref={ref}>
  <summary aria-label={label+' menu'}>{label} <WorkspaceChromeIcon name="more"/></summary>
  <div className="ss-workspace-more__menu" role="group" aria-label={label+' options'}>
   {items.map((item,index)=><button type="button" key={index} disabled={item.disabled}
    aria-pressed={item.active===undefined?undefined:item.active}
    onClick={()=>{ref.current?.removeAttribute('open');item.onClick();}}>{item.label}</button>)}
  </div>
 </details>;
}
