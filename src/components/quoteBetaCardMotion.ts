import {useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';

/** Track the pointer on document, NOT the React row being reordered.
 * Moving an element with pointer capture can drop move/up events, leaving the
 * lifted card stuck. The ghost follows the pointer independently of DOM moves.
 * Targets are insertion slots (before/after a sibling), including after last. */
export function useQuoteBetaCardDrag(
  move:(source:string,target:string,after?:boolean)=>void,
){
  const [dragging,setDragging]=useState<string|null>(null);
  const active=useRef<{
    id:string;pointerId:number;row:HTMLElement;ghost:HTMLDivElement;
    initialY:number;initialX:number;clean:()=>void;
  }|null>(null);
  const moveRef=useRef(move);
  moveRef.current=move;
  const clear=()=>{
    const state=active.current;
    if(!state)return;
    active.current=null;
    state.clean();
    state.row.classList.remove('is-drag-source');
    state.ghost.remove();
    document.body.classList.remove('qmb-card-dragging');
    setDragging(null);
  };
  const onPointerDown=(id:string,event:ReactPointerEvent<HTMLButtonElement>)=>{
    if(event.button!==0||active.current)return;
    const row=event.currentTarget.closest<HTMLElement>('[data-qmb-sort-row]');
    if(!row)return;
    event.preventDefault();event.stopPropagation();
    const rect=row.getBoundingClientRect();
    const ghost=document.createElement('div');
    ghost.className='qmb qmb-drag-ghost';
    ghost.setAttribute('aria-hidden','true');
    ghost.style.pointerEvents='none';
    const sourceRoot=row.closest<HTMLElement>('.qmb');
    if(sourceRoot){
      const tokens=['--qmb-card','--qmb-ink','--qmb-border',
        '--qmb-accent','--qmb-tint','--qmb-muted'];
      const computed=getComputedStyle(sourceRoot);
      tokens.forEach(token=>ghost.style.setProperty(token,computed.getPropertyValue(token)));
    }
    const copy=row.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
    copy.removeAttribute('data-qmb-sort-row');
    ghost.appendChild(copy);
    ghost.style.position='fixed';
    ghost.style.left=rect.left+'px';
    ghost.style.top=rect.top+'px';
    ghost.style.width=rect.width+'px';
    ghost.style.zIndex='2800';
    document.body.appendChild(ghost);
    row.classList.add('is-drag-source');
    document.body.classList.add('qmb-card-dragging');
    const initialX=event.clientX,initialY=event.clientY;
    let previousSlot='';
    const onMove=(e:globalThis.PointerEvent)=>{
      const held=active.current;
      if(!held||e.pointerId!==held.pointerId)return;
      e.preventDefault();
      held.ghost.style.transform='translate3d('+
        (e.clientX-initialX)+'px,'+(e.clientY-initialY)+'px,0) scale(1.02)';
      const parent=held.row.parentElement;
      if(!parent)return;
      const rows=Array.from(parent.querySelectorAll<HTMLElement>(':scope > [data-qmb-sort-row]'));
      const others=rows.filter(el=>el!==held.row);
      if(!others.length)return;
      const index=others.filter(el=>{
        const box=el.getBoundingClientRect();
        return e.clientY>box.top+box.height/2;
      }).length;
      const current=rows.indexOf(held.row);
      if(index===current){previousSlot='';return;}
      const target=others[Math.min(index,others.length-1)];
      if(!target?.dataset.qmbSortRow)return;
      const after=index===others.length;
      const slot=target.dataset.qmbSortRow+':'+after;
      if(slot===previousSlot)return;
      previousSlot=slot;
      moveRef.current(id,target.dataset.qmbSortRow,after);
    };
    const end=(e:globalThis.PointerEvent)=>{
      if(e.pointerId===active.current?.pointerId)clear();
    };
    const cancel=()=>clear();
    document.addEventListener('pointermove',onMove,{passive:false});
    document.addEventListener('pointerup',end);
    document.addEventListener('pointercancel',end);
    window.addEventListener('blur',cancel);
    const clean=()=>{
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerup',end);
      document.removeEventListener('pointercancel',end);
      window.removeEventListener('blur',cancel);
    };
    active.current={id,pointerId:event.pointerId,row,ghost,initialY,initialX,clean};
    setDragging(id);
  };
  const onPointerMove=(_id:string,_event:ReactPointerEvent<HTMLButtonElement>)=>{};
  const onPointerEnd=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    if(active.current?.pointerId===event.pointerId)clear();
  };
  return {dragging,clear,onPointerDown,onPointerMove,onPointerEnd};
}

/** FLIP the cards around the lifted card when a provisional order changes.
 * Respects reduced-motion preferences and avoids a reflow jump on mobile. */
export function useQuoteBetaCardReflow<T extends HTMLElement=HTMLDivElement>(ids:string[]){
  const listRef=useRef<T|null>(null);
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
        !row.classList.contains('is-drag-source')&&current.height){
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
