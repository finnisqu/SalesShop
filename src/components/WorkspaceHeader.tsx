import {useRef,type ReactNode} from 'react';
import {useDismissibleDetails} from './useDismissibleDetails';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';
import '../workspace-header-standard.css';

/** Shared top-level workspace chrome. Stable slots across all six workspaces. */
export function WorkspaceHeader({title,help,tabs,more,search,primary,className=''}:{
 title:string;help?:ReactNode;tabs?:ReactNode;more?:ReactNode;search?:ReactNode;primary?:ReactNode;className?:string;
}){
 return <header className={'ss-workspace-header '+className}>
  <div className="ss-workspace-header__intro">{help ? <div className="ss-workspace-title-row"><h1>{title}</h1>{help}</div> : <h1>{title}</h1>}</div>
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
