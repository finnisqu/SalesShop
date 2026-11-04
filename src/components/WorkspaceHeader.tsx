import {useEffect,useRef,type ReactNode} from 'react';
import '../workspace-header-standard.css';

/** Shared top-level workspace chrome. Stable slots across all six workspaces. */
export function WorkspaceHeader({title,tabs,more,search,primary,className=''}:{
 title:string;tabs?:ReactNode;more?:ReactNode;search?:ReactNode;primary?:ReactNode;className?:string;
}){
 return <header className={'ss-workspace-header '+className}>
  <div className="ss-workspace-header__intro"><h1>{title}</h1></div>
  <div className="ss-workspace-header__tabs">{tabs}</div>
  <div className="ss-workspace-header__tools">
   <div className="ss-workspace-header__more">{more}</div>
   <div className="ss-workspace-header__search">{search}</div>
   <div className="ss-workspace-header__primary">{primary}</div>
  </div>
 </header>;
}
export interface WorkspaceMoreItem{label:string;onClick:()=>void;active?:boolean;disabled?:boolean}
export function WorkspaceMoreMenu({items,label='More'}:{items:readonly WorkspaceMoreItem[];label?:string}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{
   if(ref.current?.open&&!ref.current.contains(event.target as Node))ref.current.open=false;
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&ref.current?.open){
    ref.current.open=false;ref.current.querySelector('summary')?.focus();
   }
  };
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 return <details className="ss-workspace-more" ref={ref}>
  <summary aria-label={label+' menu'}>{label} <span aria-hidden="true">⋯</span></summary>
  <div className="ss-workspace-more__menu" role="group" aria-label={label+' options'}>
   {items.map((item,index)=><button type="button" key={index} disabled={item.disabled}
    aria-pressed={item.active===undefined?undefined:item.active}
    onClick={()=>{ref.current?.removeAttribute('open');item.onClick();}}>{item.label}</button>)}
  </div>
 </details>;
}
