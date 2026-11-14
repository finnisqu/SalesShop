import {useEffect,type RefObject} from 'react';
import {PHONE_LAYOUT_QUERY} from './mobileViewport';
import {quoteSheetFieldScrollDelta} from '../services/quoteSheetFieldVisibility';

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
    // Never call scrollIntoView here: it may also scroll the quote editor or
    // document behind a portal-mounted modal. Only its own sheet body moves.
    const body=active.closest<HTMLElement>(
      '.qqs-panel-body,.qqt-panel-body,.qmb-quick-area-body');
    if(!body||!sheet.contains(body))return;
    const visual=window.visualViewport;
    const top=visual?.offsetTop??0;
    const bottom=top+(visual?.height??window.innerHeight);
    const bounds=active.getBoundingClientRect();
    const scrollport=body.getBoundingClientRect();
    const shift=quoteSheetFieldScrollDelta(
      bounds.top,bounds.bottom,scrollport.top,scrollport.bottom,top,bottom,64);
    if(!shift)return;
    const maximum=Math.max(0,body.scrollHeight-body.clientHeight);
    body.scrollTop=Math.max(0,Math.min(maximum,body.scrollTop+shift));
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
