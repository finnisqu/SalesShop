import {useRef,type PointerEvent} from 'react';
import './mobile-sheet.css';

type DragState={pointerId:number;originY:number;distance:number;sheet:HTMLElement};
/** Touch-only drag handle for the shared mobile sheets.
 * Dragging 88px down closes; otherwise the sheet springs back.
 * The ordinary close button remains the keyboard-accessible way to dismiss.
 */
export function MobileSheetHandle({onClose}:{onClose:()=>void}){
 const dragging=useRef<DragState|null>(null);
 const reset=(sheet:HTMLElement)=>{
  sheet.style.transition='transform 160ms ease-out';
  sheet.style.transform='';
  window.setTimeout(()=>{
   if(sheet.isConnected)sheet.style.transition='';
  },180);
 };
 const down=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.button!==0||window.matchMedia('(min-width:761px)').matches||
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
  if(!cancelled&&drag.distance>=88){
   onClose();
  }else reset(drag.sheet);
 };
 return <div className="ss-mobile-sheet-handle" aria-hidden="true"
  onPointerDown={down} onPointerMove={move}
  onPointerUp={event=>finish(event,false)}
  onPointerCancel={event=>finish(event,true)}>
  <span/>
 </div>;
}
