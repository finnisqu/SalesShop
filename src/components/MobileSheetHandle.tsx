import {useEffect,useRef,type PointerEvent} from 'react';
import {MOBILE_SHEET_MEDIA_QUERY,mobileSheetViewportGeometry} from '../lib/mobileSheetViewport';
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
 const handleRef=useRef<HTMLDivElement>(null);
 // Scope visual viewport coordinates to this portal's own backdrop. Never
 // change root CSS variables or another simultaneously mounted dialog.
 useEffect(()=>{
  const backdrop=handleRef.current?.closest<HTMLElement>('.ss-mobile-sheet-backdrop');
  if(!backdrop)return;
  const visual=window.visualViewport;
  const measure=()=>{
   const view=mobileSheetViewportGeometry({
    viewportHeight:window.innerHeight,
    visualHeight:visual?.height,
    visualTop:visual?.offsetTop,
   });
   backdrop.style.setProperty('--ss-mobile-visual-top',view.top+'px');
   backdrop.style.setProperty('--ss-mobile-visual-height',view.height+'px');
  };
  measure();
  visual?.addEventListener('resize',measure);
  visual?.addEventListener('scroll',measure);
  window.addEventListener('resize',measure);
  return()=>{
   visual?.removeEventListener('resize',measure);
   visual?.removeEventListener('scroll',measure);
   window.removeEventListener('resize',measure);
   backdrop.style.removeProperty('--ss-mobile-visual-top');
   backdrop.style.removeProperty('--ss-mobile-visual-height');
   const drag=dragging.current;
   if(drag){drag.sheet.style.transform='';drag.sheet.style.transition='';dragging.current=null;}
  };
 },[]);
 useEffect(()=>{
  if(!disabled||!dragging.current)return;
  dragging.current.sheet.style.transform='';
  dragging.current.sheet.style.transition='';
  dragging.current=null;
 },[disabled]);
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
  if(disabled||event.button!==0||!window.matchMedia(MOBILE_SHEET_MEDIA_QUERY).matches||
     document.documentElement.dataset.ssMobileKeyboard==='open'||event.pointerType==='mouse')return;
  const sheet=event.currentTarget.closest<HTMLElement>('.ss-mobile-sheet');
  if(!sheet)return;
  dragging.current={pointerId:event.pointerId,originY:event.clientY,distance:0,sheet};
  event.currentTarget.setPointerCapture(event.pointerId);
  sheet.style.transition='none';
 };
 const move=(event:PointerEvent<HTMLDivElement>)=>{
  const drag=dragging.current;
  if(!drag||drag.pointerId!==event.pointerId)return;
  if(disabled||document.documentElement.dataset.ssMobileKeyboard==='open'){
   dragging.current=null;reset(drag.sheet);return;
  }
  drag.distance=Math.max(0,event.clientY-drag.originY);
  drag.sheet.style.transform='translate3d(0,'+Math.min(240,drag.distance)+'px,0)';
 };
 const finish=(event:PointerEvent<HTMLDivElement>,cancelled:boolean)=>{
  const drag=dragging.current;
  if(!drag||drag.pointerId!==event.pointerId)return;
  dragging.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))
   event.currentTarget.releasePointerCapture(event.pointerId);
  if(shouldCloseMobileSheet(drag.distance,cancelled||
     document.documentElement.dataset.ssMobileKeyboard==='open',disabled)){
   onClose();
   // A parent can decline a close while another operation is pending.
   // Never leave the still-mounted sheet permanently translated down.
   window.requestAnimationFrame(()=>{
    if(drag.sheet.isConnected)reset(drag.sheet);
   });
  }else reset(drag.sheet);
 };
 return <div ref={handleRef} className={'ss-mobile-sheet-handle'+(disabled?' is-disabled':'')} aria-hidden="true"
  onPointerDown={down} onPointerMove={move}
  onPointerUp={event=>finish(event,false)}
  onPointerCancel={event=>finish(event,true)}
  onLostPointerCapture={event=>finish(event,true)}>
  <span/>
 </div>;
}
