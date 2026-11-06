import {useEffect} from 'react';

/**
 * Lock background scroll while a modal is visible. Multiple temporary panels
 * can overlap (for example a CRM preview opening a task editor); reference
 * counting ensures the first lock is restored only after the final panel closes.
 */
interface LockState{count:number;overflow:string;overscrollBehavior:string}
const locks=new WeakMap<HTMLElement,LockState>();

function acquire(element:HTMLElement){
 const previous=locks.get(element);
 if(previous){
  previous.count+=1;
  return;
 }
 locks.set(element,{
  count:1,
  overflow:element.style.overflow,
  overscrollBehavior:element.style.overscrollBehavior,
 });
 element.style.overflow='hidden';
 element.style.overscrollBehavior='none';
}
function release(element:HTMLElement){
 const previous=locks.get(element);
 if(!previous)return;
 if(--previous.count>0)return;
 element.style.overflow=previous.overflow;
 element.style.overscrollBehavior=previous.overscrollBehavior;
 locks.delete(element);
}

export function useModalScrollLock(open:boolean){
 useEffect(()=>{
  if(!open)return;
  const found=[
   document.documentElement,
   document.body,
   ...Array.from(document.querySelectorAll<HTMLElement>(
    '.sales-app .role-perspective-content,.sales-app.view-tasks .tasks-workspace')),
  ];
  const elements=Array.from(new Set(found));
  elements.forEach(acquire);
  return()=>elements.forEach(release);
 },[open]);
}
