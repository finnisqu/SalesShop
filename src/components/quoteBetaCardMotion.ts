import {useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';

/** A lifting pointer interaction shared by Area and General charge cards.
 * The drag handle captures the pointer while the entire card row follows it.
 * Only a threshold-crossing changes the draft ordering. */
export function useQuoteBetaCardDrag(move:(source:string,target:string)=>void){
  const [dragging,setDragging]=useState<string|null>(null);
  const active=useRef<{id:string;pointerId:number;startY:number;startTop:number;
    row:HTMLElement;handle:HTMLButtonElement}|null>(null);
  const moveRef=useRef(move);
  moveRef.current=move;
  const clear=()=>{
    const held=active.current;
    if(held){
      held.row.classList.remove('is-dragging');
      held.row.style.removeProperty('--qmb-sort-delta');
      try{
        if(held.handle.hasPointerCapture(held.pointerId))
          held.handle.releasePointerCapture(held.pointerId);
      }catch{ /* pointer capture can be lost when a quote switches views */ }
    }
    active.current=null;
    setDragging(null);
  };
  const onPointerDown=(id:string,event:ReactPointerEvent<HTMLButtonElement>)=>{
    if(event.button!==0||active.current)return;
    const handle=event.currentTarget;
    const row=handle.closest<HTMLElement>('[data-qmb-sort-row]');
    if(!row)return;
    event.preventDefault();event.stopPropagation();
    const rect=row.getBoundingClientRect();
    active.current={id,pointerId:event.pointerId,startY:event.clientY,startTop:rect.top,row,handle};
    handle.setPointerCapture(event.pointerId);
    row.classList.add('is-dragging');
    setDragging(id);
  };
  const onPointerMove=(id:string,event:ReactPointerEvent<HTMLButtonElement>)=>{
    const held=active.current;
    if(!held||held.id!==id||held.pointerId!==event.pointerId)return;
    event.preventDefault();
    const row=held.row;
    const oldDelta=Number.parseFloat(row.style.getPropertyValue('--qmb-sort-delta'))||0;
    // The row can change its natural layout position when neighbors switch.
    // Correct for that displacement so the lifted card follows the finger.
    const naturalTop=row.getBoundingClientRect().top-oldDelta;
    const delta=held.startTop+(event.clientY-held.startY)-naturalTop;
    row.style.setProperty('--qmb-sort-delta',delta.toFixed(1)+'px');
    const parent=row.parentElement;
    if(!parent)return;
    const others=Array.from(parent.querySelectorAll<HTMLElement>('[data-qmb-sort-row]'))
      .filter(item=>item!==row);
    for(const other of others){
      const bounds=other.getBoundingClientRect();
      if(event.clientY>=bounds.top+3&&event.clientY<=bounds.bottom-3){
        const to=other.dataset.qmbSortRow;
        if(to)moveRef.current(id,to);
        break;
      }
    }
  };
  const onPointerEnd=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    if(active.current?.pointerId===event.pointerId)clear();
  };
  return {dragging,clear,onPointerDown,onPointerMove,onPointerEnd};
}

/** FLIP the cards around the lifted card when a provisional order changes.
 * Respects reduced-motion preferences and avoids a reflow jump on mobile. */
export function useQuoteBetaCardReflow(ids:string[]){
  const listRef=useRef<HTMLElement|null>(null);
  const previous=useRef(new Map<string,number>());
  useLayoutEffect(()=>{
    const list=listRef.current;
    if(!list)return;
    const rows=Array.from(list.querySelectorAll<HTMLElement>('[data-qmb-sort-row]'));
    const after=new Map<string,number>();
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(const row of rows){
      const id=row.dataset.qmbSortRow;
      if(!id)continue;
      const current=row.getBoundingClientRect();
      const moving=Number.parseFloat(row.style.getPropertyValue('--qmb-sort-delta'))||0;
      const top=current.top-moving;
      after.set(id,top);
      const from=previous.current.get(id);
      if(from!==undefined&&Math.abs(from-top)>2&&!reduceMotion&&
        !row.classList.contains('is-dragging')&&current.height){
        row.animate(
          [{transform:'translate3d(0,'+(from-top)+'px,0)'},{transform:'translate3d(0,0,0)'}],
          {duration:175,easing:'cubic-bezier(.2,.8,.2,1)'}
        );
      }
    }
    previous.current=after;
  },[ids.join('|')]);
  return listRef;
}
