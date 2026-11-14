import {useEffect,type RefObject} from 'react';
import {PHONE_LAYOUT_QUERY} from './mobileViewport';
import {quoteSheetCatalogMenuPlacement} from '../services/quoteSheetFieldVisibility';

/** Clamp Material/Sink suggestions to the actual visible *sheet* scrollport.
 * When the keyboard hides the space below an input, open upwards if the
 * catalog menu is absolutely positioned relative to its combobox. */
export function useMobileQuoteCatalogMenuViewport(
 root:RefObject<HTMLDivElement|null>,open:boolean,refreshKey:string,
){
 useEffect(()=>{
  if(!open||!window.matchMedia(PHONE_LAYOUT_QUERY).matches)return;
  const container=root.current;
  const scrollport=container?.closest<HTMLElement>(
   '.qqs-panel-body,.qqt-panel-body,.qmb-quick-area-body');
  const menu=container?.querySelector<HTMLElement>('.qtl-combobox-menu');
  const trigger=container?.querySelector<HTMLInputElement>('input[role="combobox"]');
  if(!menu||!trigger||!scrollport)return;
  let frame=0;
  const position=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    if(!menu.isConnected||!trigger.isConnected)return;
    const visual=window.visualViewport;
    const top=visual?.offsetTop??0;
    const bottom=top+(visual?.height??window.innerHeight);
    const field=trigger.getBoundingClientRect();
    const body=scrollport.getBoundingClientRect();
    // Static-flow menus cannot flip upward and must use below-space sizing.
    const absolute=window.getComputedStyle(menu).position==='absolute';
    const placement=quoteSheetCatalogMenuPlacement(
     field.top,field.bottom,body.top,body.bottom,top,bottom,absolute);
    const above=placement.side==='above';
    menu.style.maxHeight=placement.maxHeight+'px';
    menu.style.overflowY='auto';
    if(above){
     menu.style.top='auto';
     menu.style.bottom='calc(100% + 4px)';
    }else{
     menu.style.removeProperty('top');
     menu.style.removeProperty('bottom');
    }
   });
  };
  position();
  const visual=window.visualViewport;
  visual?.addEventListener('resize',position);
  visual?.addEventListener('scroll',position);
  window.addEventListener('resize',position);
  scrollport.addEventListener('scroll',position,{passive:true});
  return()=>{
   cancelAnimationFrame(frame);
   visual?.removeEventListener('resize',position);
   visual?.removeEventListener('scroll',position);
   window.removeEventListener('resize',position);
   scrollport.removeEventListener('scroll',position);
   menu.style.removeProperty('max-height');
   menu.style.removeProperty('overflow-y');
   menu.style.removeProperty('top');
   menu.style.removeProperty('bottom');
  };
 },[root,open,refreshKey]);
}
