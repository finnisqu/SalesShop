import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {MobileSheetHandle,shouldCloseMobileSheet} from '../components/MobileSheetHandle';
import {MOBILE_SHEET_MEDIA_QUERY,mobileSheetViewportGeometry} from '../lib/mobileSheetViewport';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 342 — keyboard-safe shared phone bottom sheets',()=>{
 it('tracks the actual visual viewport instead of the keyboard-obscured layout height',()=>{
  expect(mobileSheetViewportGeometry({viewportHeight:844,visualHeight:844,visualTop:0}))
   .toEqual({top:0,height:844});
  expect(mobileSheetViewportGeometry({viewportHeight:844,visualHeight:470,visualTop:0}))
   .toEqual({top:0,height:470});
  expect(mobileSheetViewportGeometry({viewportHeight:844,visualHeight:470,visualTop:40}))
   .toEqual({top:40,height:470});
  expect(mobileSheetViewportGeometry({viewportHeight:390,visualHeight:295,visualTop:20}))
   .toEqual({top:20,height:295});
 });
 it('clamps malformed viewport measurements rather than generating invalid CSS sizes',()=>{
  expect(mobileSheetViewportGeometry({viewportHeight:800,visualHeight:0,visualTop:-10}))
   .toEqual({top:0,height:800});
  expect(mobileSheetViewportGeometry({viewportHeight:800,visualHeight:Number.NaN,visualTop:15}))
   .toEqual({top:0,height:800});
  expect(mobileSheetViewportGeometry({viewportHeight:800,visualHeight:300,visualTop:900}))
   .toEqual({top:500,height:300});
  expect(mobileSheetViewportGeometry({viewportHeight:0,visualHeight:null}))
   .toEqual({top:0,height:1});
 });
 it('uses the same portrait and short-landscape criteria in JS and shared sheet CSS',()=>{
  expect(MOBILE_SHEET_MEDIA_QUERY).toBe(
   '(max-width:760px), (orientation:landscape) and (max-height:520px) and (pointer:coarse)');
  const css=source('components/mobile-sheet.css');
  expect(css).toContain('@media'+MOBILE_SHEET_MEDIA_QUERY+'{');
  expect(css).toContain('top:var(--ss-mobile-visual-top,0px)!important');
  expect(css).toContain('height:var(--ss-mobile-visual-height,100dvh)!important');
  expect(css).toContain('.ss-mobile-sheet:focus-within .ss-mobile-sheet-body');
  expect(css).toContain('scroll-padding-bottom:80px');
  expect(css).toContain('padding-bottom:max(12px,env(safe-area-inset-bottom))!important');
 });
 it('keeps viewport listeners and CSS variables scoped to one active modal backdrop',()=>{
  const handle=source('components/MobileSheetHandle.tsx');
  expect(handle).toContain(".closest<HTMLElement>('.ss-mobile-sheet-backdrop')");
  expect(handle).toContain("backdrop.style.setProperty('--ss-mobile-visual-top',view.top+'px')");
  expect(handle).toContain("backdrop.style.setProperty('--ss-mobile-visual-height',view.height+'px')");
  expect(handle).toContain("backdrop.style.removeProperty('--ss-mobile-visual-top')");
  expect(handle).toContain("backdrop.style.removeProperty('--ss-mobile-visual-height')");
  expect(handle).toContain("visual?.addEventListener('resize',measure)");
  expect(handle).toContain("visual?.addEventListener('scroll',measure)");
  expect(handle).toContain("visual?.removeEventListener('resize',measure)");
  expect(handle).toContain("visual?.removeEventListener('scroll',measure)");
  expect(handle).toContain("window.removeEventListener('resize',measure)");
 });
 it('does not dismiss on a cancelled drag, during keyboard use or while disabled',()=>{
  expect(shouldCloseMobileSheet(87,false,false)).toBe(false);
  expect(shouldCloseMobileSheet(88,false,false)).toBe(true);
  expect(shouldCloseMobileSheet(250,true,false)).toBe(false);
  expect(shouldCloseMobileSheet(250,false,true)).toBe(false);
  const handle=source('components/MobileSheetHandle.tsx');
  expect(handle).toContain("document.documentElement.dataset.ssMobileKeyboard==='open'");
  expect(handle).toContain("event.pointerType==='mouse'");
  expect(handle).toContain('onPointerCancel={event=>finish(event,true)}');
  expect(handle).toContain('onLostPointerCapture={event=>finish(event,true)}');
  expect(handle).toContain('if(drag.sheet.isConnected)reset(drag.sheet)');
 });
 it('renders the shared grip without requiring a browser window during SSR',()=>{
  const markup=renderToStaticMarkup(<MobileSheetHandle onClose={()=>{}}/>);
  expect(markup).toContain('ss-mobile-sheet-handle');
  expect(markup).toContain('aria-hidden="true"');
  const disabled=renderToStaticMarkup(<MobileSheetHandle onClose={()=>{}} disabled/>);
  expect(disabled).toContain('is-disabled');
 });
});
