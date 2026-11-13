import {useEffect,useRef,type RefObject} from 'react';

/**
 * Consistent native-details behavior across workspace action menus.
 * Outside pointer clicks dismiss without stealing focus; Escape dismisses
 * and returns focus to the menu's own summary control.
 */
export function useDismissibleDetails(ref:RefObject<HTMLDetailsElement|null>){
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{
   const menu=ref.current;
   if(menu?.open&&!menu.contains(event.target as Node))menu.open=false;
  };
  const escape=(event:KeyboardEvent)=>{
   const menu=ref.current;
   // A menu should only handle Escape from its own focused descendants.
   // Otherwise one keypress closes every open dropdown on the page.
   if(event.key!=='Escape'||event.defaultPrevented||!menu?.open||
     !menu.contains(event.target as Node))return;
   event.preventDefault();
   event.stopPropagation();
   menu.open=false;
   menu.querySelector<HTMLElement>('summary')?.focus();
  };
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('keydown',escape,true);
  return()=>{
   document.removeEventListener('pointerdown',outside,true);
   document.removeEventListener('keydown',escape,true);
  };
 },[ref]);
}

/** The same dismissal contract for controlled, non-details More popovers. */
export function useDismissiblePopover(
 ref:RefObject<HTMLElement|null>,open:boolean,onDismiss:()=>void,
 triggerSelector='button[aria-expanded]'
){
 const latest=useRef(onDismiss);
 latest.current=onDismiss;
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{
   if(ref.current&&!ref.current.contains(event.target as Node))latest.current();
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||event.defaultPrevented||
      !ref.current?.contains(event.target as Node))return;
   event.preventDefault();
   event.stopPropagation();
   latest.current();
   ref.current?.querySelector<HTMLElement>(triggerSelector)?.focus();
  };
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('keydown',escape,true);
  return()=>{
   document.removeEventListener('pointerdown',outside,true);
   document.removeEventListener('keydown',escape,true);
  };
 },[ref,open,triggerSelector]);
}
