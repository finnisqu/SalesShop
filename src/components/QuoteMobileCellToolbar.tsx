import {useEffect,useRef,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {PHONE_LAYOUT_QUERY} from '../lib/mobileViewport';
import {moveQuickGridFocus,type QuickGridDirection} from '../services/quoteGridNavigation';
import './quote-mobile-cell-toolbar.css';

/** A keyboard accessory for editable Quick Quote cells. In particular, the
 * iPhone number pad has no reliable Tab/Enter key. The toolbar works on the
 * existing spreadsheet rows; it does not create a second editing model.
 */
export function QuoteMobileCellToolbar({grid}:{grid:RefObject<HTMLElement|null>}){
 const current=useRef<HTMLInputElement|null>(null);
 const [label,setLabel]=useState<string|null>(null);
 const [isPhone,setIsPhone]=useState(false);
 useEffect(()=>{
  const query=window.matchMedia(PHONE_LAYOUT_QUERY);
  const update=()=>setIsPhone(query.matches);
  update();
  query.addEventListener('change',update);
  return()=>query.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  const root=grid.current;
  if(!root||!isPhone)return;
  let pending=0;
  const focusIn=(event:FocusEvent)=>{
   const target=event.target;
   if(!(target instanceof HTMLInputElement)||
    !target.matches('[data-quick-grid-editable].is-editing'))return;
   current.current=target;
   setLabel(target.getAttribute('aria-label')||'Cell');
   scheduleReveal();
  };
  const focusOut=()=>{
   cancelAnimationFrame(pending);
   pending=requestAnimationFrame(()=>{
    const active=document.activeElement;
    if(!(active instanceof HTMLInputElement)||
       !root.contains(active)||
       !active.matches('[data-quick-grid-editable].is-editing')){
     current.current=null;setLabel(null);
    }
   });
  };
  const scheduleReveal=()=>{
   cancelAnimationFrame(pending);
   pending=requestAnimationFrame(()=>{
    const active=document.activeElement;
    if(active instanceof HTMLInputElement&&root.contains(active)&&
       active.matches('[data-quick-grid-editable].is-editing'))
     active.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
   });
  };
  root.addEventListener('focusin',focusIn);
  root.addEventListener('focusout',focusOut);
  const visual=window.visualViewport;
  visual?.addEventListener('resize',scheduleReveal);
  visual?.addEventListener('scroll',scheduleReveal);
  return()=>{
   root.removeEventListener('focusin',focusIn);
   root.removeEventListener('focusout',focusOut);
   visual?.removeEventListener('resize',scheduleReveal);
   visual?.removeEventListener('scroll',scheduleReveal);
   cancelAnimationFrame(pending);
  };
 },[grid,isPhone]);
 const advance=(direction:QuickGridDirection)=>{
  const root=grid.current;
  const active=current.current;
  if(!root||!active)return;
  if(!moveQuickGridFocus(root,active,direction,true)){
   active.blur();
   current.current=null;setLabel(null);
  }
 };
 const finish=()=>{
  current.current?.blur();
  current.current=null;
  setLabel(null);
 };
 if(!isPhone||!label||typeof document==='undefined')return null;
 return createPortal(<div className="qqt-mobile-cell-toolbar" role="toolbar"
   aria-label="Quick Quote cell editing controls">
   <span className="qqt-mobile-cell-toolbar-label" title={label}>{label}</span>
   <button type="button" onPointerDown={e=>e.preventDefault()}
    onClick={()=>advance('previous')} aria-label="Previous editable cell">‹ <span>Prev</span></button>
   <button type="button" onPointerDown={e=>e.preventDefault()}
    onClick={()=>advance('next')} aria-label="Next editable cell">Next <span aria-hidden="true">›</span></button>
   <button type="button" className="is-done" onPointerDown={e=>e.preventDefault()}
    onClick={finish}>Done</button>
  </div>,document.body);
}
