import {useRef,type PointerEvent} from 'react';
import './mobile-sheet.css';

type DragState={pointerId:number;originY:number;distance:number;sheet:HTMLElement};

/** Gesture threshold is shared with the mobile interaction regression suite. */
export function shouldCloseMobileSheet(distance:number,cancelled:boolean,disabled:boolean){
 return !cancelled&&!disabled&&Number.isFinite(distance)&&distance>=88;
}
/** Touch-only drag handle for the shared mobile sheets.
 * Dragging 88px down closes; otherwise the sheet springs back.
 * The ordinary close button remains the keyboard-accessible way to dismiss.
 */
export function MobileSheetHandle({onClose,disabled=false}:{onClose:()=>void;disabled?:boolean}){
 const dragging=useRef<DragState|null>(null);
 const reset=(sheet:HTMLElement)=>{
  // Inline transitions outrank our reduced-motion CSS: honor the OS setting.
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   sheet.style.transition='';
   sheet.style.transform='';
   return;
  }
  sheet.style.transition='transform 160ms ease-out';
  sheet.style.transform='';
  window.setTimeout(()=>{
   if(sheet.isConnected)sheet.style.transition='';
  },180);
 };
 const down=(event:PointerEvent<HTMLDivElement>)=>{
  if(disabled||event.button!==0||window.matchMedia('(min-width:761px)').matches||
     document.documentElement.dataset.ssMobileKeyboard==='open')return;
  const sheet=event.currentTarget.closest<HTMLElement>('.ss-mobile-sheet');
  if(!sheet)return;
  dragging.current={pointerId:event.pointerId,originY:event.clientY,distance:0,sheet};
  event.currentTarget.setPointerCapture(event.pointerId);
  sheet.style.transition='none';
 };
 const move=(event:PointerEvent<HTMLDivElement>)=>{
  const drag=dragging.current;
  if(!drag||drag.pointerId!==event.pointerId)return;
  drag.distance=Math.max(0,event.clientY-drag.originY);
  drag.sheet.style.transform='translate3d(0,'+Math.min(240,drag.distance)+'px,0)';
 };
 const finish=(event:PointerEvent<HTMLDivElement>,cancelled:boolean)=>{
  const drag=dragging.current;
  if(!drag||drag.pointerId!==event.pointerId)return;
  dragging.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))
   event.currentTarget.releasePointerCapture(event.pointerId);
  if(shouldCloseMobileSheet(drag.distance,cancelled,disabled)){
   onClose();
  }else reset(drag.sheet);
 };
 return <div className={'ss-mobile-sheet-handle'+(disabled?' is-disabled':'')} aria-hidden="true"
  onPointerDown={down} onPointerMove={move}
  onPointerUp={event=>finish(event,false)}
  onPointerCancel={event=>finish(event,true)}
  onLostPointerCapture={event=>finish(event,true)}>
  <span/>
 </div>;
}
