import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {placeWorktableMenu} from '../components/useViewportBoundDetails';
import {RecordInlineProperty} from '../components/RecordInlineProperty';
import {recordInlineScrollDelta} from './recordInlineViewport';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const menu={
 panelLeft:15,panelRight:350,triggerTop:80,triggerBottom:125,
 viewportLeft:0,viewportTop:0,viewportWidth:390,viewportHeight:780,
};

describe('Batch 342b — narrow Record editors and viewport-safe popovers',()=>{
 it('keeps horizontal menu placement stable in normal and panned viewports',()=>{
  expect(placeWorktableMenu({...menu,panelLeft:-170,panelRight:165}).shiftX).toBe(182);
  expect(placeWorktableMenu({...menu,panelLeft:260,panelRight:560}).shiftX).toBe(-182);
  expect(placeWorktableMenu({...menu,viewportLeft:75,viewportTop:120,
   viewportWidth:280,viewportHeight:350,panelLeft:25,panelRight:305,
   triggerTop:190,triggerBottom:230}).shiftX).toBe(62);
 });
 it('never forces popovers underneath a keyboard when less than 40px is available',()=>{
  const close=placeWorktableMenu({...menu,triggerTop:62,triggerBottom:77,
   viewportHeight:105});
  expect(close.side).toBe('above');
  expect(close.maxHeight).toBe(43);
  const noRoom=placeWorktableMenu({...menu,triggerTop:10,triggerBottom:85,
   viewportHeight:96});
  expect(noRoom.maxHeight).toBe(0);
  expect(noRoom.side).toBe('below');
 });
 it('aligns legacy oversized menus to the visible left edge before measuring',()=>{
  const position=placeWorktableMenu({...menu,panelLeft:340,panelRight:720,
   viewportWidth:320});
  expect(position.shiftX).toBe(-328);
  const layout=source('components/useViewportBoundDetails.ts');
  expect(layout).toContain("if(viewportWidth<240)panel.style.minWidth='0px'");
  expect(layout).toContain("panel.style.removeProperty('min-width')");
  expect(layout).toContain("panel.style.maxWidth=usableWidth+'px'");
  expect(layout).toContain("panel.style.setProperty('--ss-worktable-menu-shift-x','0px')");
  expect(layout).toContain("window.visualViewport?.addEventListener('resize',position");
 });
 it('computes keyboard occlusion correctly for Record fields',()=>{
  expect(recordInlineScrollDelta({top:470,bottom:512},{top:0,height:500})).toBe(36);
  expect(recordInlineScrollDelta({top:6,bottom:30},{top:0,height:500})).toBe(-6);
  expect(recordInlineScrollDelta({top:120,bottom:150},{top:0,height:500})).toBe(0);
  expect(recordInlineScrollDelta({top:460,bottom:495},{top:50,height:400})).toBe(69);
  expect(recordInlineScrollDelta({top:0,bottom:20},{top:0,height:0})).toBe(0);
  expect(recordInlineScrollDelta({top:NaN,bottom:20},{top:0,height:500})).toBe(0);
 });
 it('only scrolls the focused inline input on phone layouts and tears down listeners',()=>{
  const editor=source('components/RecordInlineProperty.tsx');
  expect(editor).toContain("window.matchMedia?.(MOBILE_SHEET_MEDIA_QUERY).matches");
  expect(editor).toContain("formRef.current?.querySelector<HTMLInputElement|HTMLSelectElement>('input,select')");
  expect(editor).toContain('if(document.activeElement!==control)return;');
  expect(editor).toContain('const delta=recordInlineScrollDelta(rect,{');
  expect(editor).toContain("if(parent)parent.scrollTop+=delta;");
  expect(editor).toContain("else window.scrollBy({top:delta,behavior:'auto'})");
  expect(editor).toContain("visual?.addEventListener('resize',ensureVisible)");
  expect(editor).toContain("visual?.removeEventListener('resize',ensureVisible)");
  expect(editor).toContain("window.cancelAnimationFrame(frame)");
  expect(editor).toContain('<form ref={formRef} className="ss-record-inline-editor"');
 });
 it('preserves accessible editing triggers and phone-sized Save and Cancel controls',()=>{
  const html=renderToStaticMarkup(<RecordInlineProperty label="Company name"
   value="Brightstone" onSave={()=>{}}/>);
  expect(html).toContain('aria-label="Edit Company name"');
  expect(html).toContain('Brightstone');
  const css=source('record-page-refinement.css');
  expect(css).toContain('.ss-record-inline-property.is-editing{scroll-margin-block:12px 104px}');
  expect(css).toContain('.ss-record-inline-editor{gap:7px;align-items:stretch}');
  expect(css).toContain('flex:0 0 44px;min-height:44px');
  expect(css).toContain('font-size:16px;min-height:44px');
  expect(css).toContain('scroll-margin-block:12px 104px');
 });
});
