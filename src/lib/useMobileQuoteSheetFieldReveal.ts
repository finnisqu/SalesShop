import {useEffect,type RefObject} from 'react';
import {PHONE_LAYOUT_QUERY} from './mobileViewport';
import {quoteSheetFieldNeedsReveal} from '../services/quoteSheetFieldVisibility';

/** Keep the active Area/Takeoff sheet field within Safari's visual viewport
 * as the on-screen keyboard opens, without moving the entire quote document. */
export function useMobileQuoteSheetFieldReveal(ref:RefObject<HTMLElement|null>){
 useEffect(()=>{
  const sheet=ref.current;
  if(!sheet)return;
  const media=window.matchMedia(PHONE_LAYOUT_QUERY);
  let frame=0;
  const reveal=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    if(!media.matches)return;
    const active=document.activeElement;
    if(!(active instanceof HTMLElement)||!sheet.contains(active)||
       !active.matches('input:not([type="checkbox"]),textarea,select,[contenteditable="true"]'))
      return;
    const visual=window.visualViewport;
    if(!visual)return;
    const top=visual.offsetTop;
    const bottom=top+visual.height;
    const bounds=active.getBoundingClientRect();
    if(quoteSheetFieldNeedsReveal(bounds.top,bounds.bottom,top,bottom,64))
      active.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
   });
  };
  sheet.addEventListener('focusin',reveal);
  window.visualViewport?.addEventListener('resize',reveal);
  window.visualViewport?.addEventListener('scroll',reveal);
  return()=>{
   sheet.removeEventListener('focusin',reveal);
   window.visualViewport?.removeEventListener('resize',reveal);
   window.visualViewport?.removeEventListener('scroll',reveal);
   cancelAnimationFrame(frame);
  };
 },[ref]);
}
