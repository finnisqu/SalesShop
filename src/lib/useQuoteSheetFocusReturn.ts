import {useEffect,useRef,type RefObject} from 'react';

/** Restore focus to the worksheet cell that opened a temporary Quote sheet.
 * Do not steal it from a newly opened dialog during a sheet handoff. */
export function useQuoteSheetFocusReturn(sheet:RefObject<HTMLElement|null>){
 const origin=useRef<HTMLElement|null>(
  typeof document!=='undefined'&&document.activeElement instanceof HTMLElement
   ?document.activeElement:null);
 useEffect(()=>()=>{
  const target=origin.current;
  const focused=document.activeElement;
  if(target?.isConnected&&(focused===document.body||sheet.current?.contains(focused)))
   target.focus({preventScroll:true});
 },[sheet]);
}
