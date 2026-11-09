import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useDismissibleDetails} from './useDismissibleDetails';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';
import '../workspace-header-standard.css';
import '../mobile-workspace-headers.css';

export interface MobileWorkspaceTab{value:string;label:string}

export function MobileWorkspaceTabs({title,items,value,onChange}:{
 title:string;items:readonly MobileWorkspaceTab[];value:string;onChange?:(value:string)=>void;
}){
 const menuRef=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(menuRef);
 const selected=items.find(item=>item.value===value)??items[0];
 useEffect(()=>{if(menuRef.current)menuRef.current.open=false;},[value,title]);
 if(!selected)return null;
 return <details className="ss-mobile-tab-picker" ref={menuRef}>
  <summary aria-label={title+' sections, selected '+selected.label}
   aria-haspopup="menu">
   <span>{selected.label}</span><WorkspaceChromeIcon name="chevron-down"/>
  </summary>
  <div role="group" className="ss-mobile-tab-menu" aria-label={title+' sections'}>
   {items.map(item=><button type="button" key={item.value}
     className={item.value===value?'is-selected':''}
     aria-current={item.value===value?'page':undefined}
     onClick={()=>{menuRef.current?.removeAttribute('open');
       menuRef.current?.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});
       onChange?.(item.value);}}>
     <span>{item.label}</span>{item.value===value&&<span aria-hidden="true">✓</span>}
   </button>)}
  </div>
 </details>;
}

/** One shared desktop header; on phone the title lives in the global app bar.
 * The local header is exactly: selected tab | More | Search | Add. */
export function WorkspaceHeader({title,help,tabs,more,search,primary,className='',
 mobileTabs,mobileTabValue,onMobileTabChange}:{
 title:string;help?:ReactNode;tabs?:ReactNode;more?:ReactNode;search?:ReactNode;primary?:ReactNode;className?:string;
 mobileTabs?:readonly MobileWorkspaceTab[];mobileTabValue?:string;onMobileTabChange?:(value:string)=>void;
}){
 const [searchOpen,setSearchOpen]=useState(false);
 const searchPanelRef=useRef<HTMLDivElement>(null);
 const searchButtonRef=useRef<HTMLButtonElement>(null);
 const searchAreaRef=useRef<HTMLDivElement>(null);
 // Search belongs to the selected workspace tab. Closing the floating field
 // on tab changes prevents stale mobile popovers and an orphaned keyboard.
 useEffect(()=>{setSearchOpen(false);},[title,mobileTabValue]);
 useEffect(()=>{
  if(searchOpen)searchPanelRef.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});
 },[searchOpen]);
 useEffect(()=>{
  if(!searchOpen)return;
  const dismiss=(event:PointerEvent)=>{
   if(searchAreaRef.current&&!searchAreaRef.current.contains(event.target as Node))setSearchOpen(false);
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape')return;
   event.stopPropagation();setSearchOpen(false);searchButtonRef.current?.focus({preventScroll:true});
  };
  document.addEventListener('pointerdown',dismiss,true);
  document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('pointerdown',dismiss,true);
   document.removeEventListener('keydown',escape,true);};
 },[searchOpen]);
 return <header className={'ss-workspace-header '+className}>
  <div className="ss-workspace-header__intro"><h1>{title}</h1>
   {help&&<div className="ss-workspace-header__help">{help}</div>}
  </div>
  <div className="ss-workspace-header__tabs">{tabs}</div>
  {mobileTabs&&mobileTabs.length>0&&<div className="ss-workspace-header__mobile-nav">
   <MobileWorkspaceTabs title={title} items={mobileTabs} value={mobileTabValue??mobileTabs[0].value}
    onChange={onMobileTabChange}/>
  </div>}
  <div className="ss-workspace-header__tools">
   <div className="ss-workspace-header__more">{more}</div>
   <div ref={searchAreaRef} className={'ss-workspace-header__search'+(searchOpen?' is-open':'')}>
    {search&&<button ref={searchButtonRef} type="button" className="ss-workspace-header__search-toggle"
     onClick={()=>setSearchOpen(open=>!open)}
     aria-expanded={searchOpen} aria-label={searchOpen?'Close '+title+' search':'Search '+title}
     aria-haspopup="true">
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
    onClick={()=>{ref.current?.removeAttribute('open');
     ref.current?.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});
     item.onClick();}}>
     <span>{item.label}</span>
     {item.active&&<span className="ss-workspace-more__selected" aria-hidden="true">✓</span>}
    </button>)}
  </div>
 </details>;
}
