import {useRef,type PointerEvent} from 'react';

/** Touch gestures are confined to the drag strip, never the form's scroll
 * content, so scrolling notes and dropdowns cannot accidentally dismiss. */
export function MobileSheetGrabber({onDismiss}:{onDismiss:()=>void}){
 const start=useRef<{y:number;pointerId:number}|null>(null);
 const down=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.pointerType!=='touch')return;
  start.current={y:event.clientY,pointerId:event.pointerId};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const up=(event:PointerEvent<HTMLDivElement>)=>{
  const point=start.current;start.current=null;
  if(point?.pointerId===event.pointerId&&event.clientY-point.y>75)onDismiss();
 };
 return <div className="sales-sheet-grabber" aria-hidden="true"
  onPointerDown={down} onPointerUp={up}
  onPointerCancel={()=>{start.current=null;}}>
   <span/>
  </div>;
}
