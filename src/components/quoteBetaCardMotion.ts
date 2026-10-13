import {useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';

/** A lifting pointer interaction shared by Area and General charge cards.
 * The drag handle captures the pointer while the entire card row follows it.
 * Only a threshold-crossing changes the draft ordering. */
export function useQuoteBetaCardDrag(move:(source:string,target:string)=>void){
  const [dragging,setDragging]=useState<string|null>(null);
  const active=useRef<{id:string;pointerId:number;row:HTMLElement;handle:HTMLButtonElement;
    wrapper:HTMLDivElement;startY:number;startTop:number;startX:number;startLeft:number;
  }|null>(null);
  const moveRef=useRef(move);
  moveRef.current=move;
  const clear=()=>{
    const held=active.current;
    if(held){
      held.row.classList.remove('is-drag-source');
      held.wrapper.remove();
      try{
        if(held.handle.hasPointerCapture(held.pointerId))
          held.handle.releasePointerCapture(held.pointerId);
      }catch{ /* capture can be released by a view change */ }
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
    // Drag a floating *copy*. The real row stays in the list as a placeholder.
    // This prevents the captured pointer from being repositioned by React
    // when a row crosses another row's midpoint.
    const wrapper=document.createElement('div');
    wrapper.className='qmb qmb-drag-ghost';
    wrapper.setAttribute('aria-hidden','true');
    const root=row.closest<HTMLElement>('.qmb');
    if(root){
      const computed=getComputedStyle(root);
      for(const token of ['--qmb-card','--qmb-ink','--qmb-border','--qmb-accent','--qmb-tint','--qmb-muted']){
        wrapper.style.setProperty(token,computed.getPropertyValue(token));
      }
    }
    const copy=row.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    copy.removeAttribute('data-qmb-sort-row');
    wrapper.appendChild(copy);
    wrapper.style.width=rect.width+'px';
    wrapper.style.left=rect.left+'px';
    wrapper.style.top=rect.top+'px';
    document.body.appendChild(wrapper);
    row.classList.add('is-drag-source');
    active.current={id,pointerId:event.pointerId,row,handle,wrapper,
      startY:event.clientY,startTop:rect.top,startX:event.clientX,startLeft:rect.left};
    handle.setPointerCapture(event.pointerId);
    setDragging(id);
  };
  const onPointerMove=(id:string,event:ReactPointerEvent<HTMLButtonElement>)=>{
    const held=active.current;
    if(!held||held.id!==id||held.pointerId!==event.pointerId)return;
    event.preventDefault();
    const deltaY=event.clientY-held.startY;
    const deltaX=event.clientX-held.startX;
    held.wrapper.style.transform='translate3d('+deltaX+'px,'+deltaY+'px,0) scale(1.025)';
    const parent=held.row.parentElement;
    if(!parent)return;
    const all=Array.from(parent.querySelectorAll<HTMLElement>(':scope > [data-qmb-sort-row]'));
    const others=all.filter(item=>item!==held.row);
    if(!others.length)return;
    let insertion=0;
    for(const other of others){
      const rect=other.getBoundingClientRect();
      if(event.clientY>rect.top+rect.height/2)insertion++;
    }
    const sourceIndex=all.indexOf(held.row);
    if(sourceIndex===insertion)return;
    const target=others[Math.min(insertion,others.length-1)].dataset.qmbSortRow;
    if(target)moveRef.current(id,target);
  };
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
