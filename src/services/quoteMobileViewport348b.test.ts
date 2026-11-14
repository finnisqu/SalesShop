import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
 quoteSheetFieldScrollDelta,quoteSheetCatalogMenuPlacement,
} from './quoteSheetFieldVisibility';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Batch 348b — keyboard-safe Quote sheets and Catalog menus',()=>{
 it('scrolls the sheet only when the focused field is clipped by its own body or keyboard',()=>{
  expect(quoteSheetFieldScrollDelta(120,160,80,500,0,430,64)).toBe(0);
  expect(quoteSheetFieldScrollDelta(380,415,0,500,0,430,64)).toBe(49);
  expect(quoteSheetFieldScrollDelta(70,95,90,480,80,430,64)).toBe(-32);
  expect(quoteSheetFieldScrollDelta(310,340,100,330,0,700,64)).toBe(22);
 });
 it('rejects unscrollable or invalid viewport geometry without moving the Quote',()=>{
  expect(quoteSheetFieldScrollDelta(200,240,100,180,150,210,64)).toBe(0);
  expect(quoteSheetFieldScrollDelta(Number.NaN,240,0,500,0,430,64)).toBe(0);
 });
 it('opens suggestion menus above a low trigger when keyboard leaves more room above',()=>{
  expect(quoteSheetCatalogMenuPlacement(300,340,60,520,0,430))
   .toEqual({side:'above',maxHeight:228});
  expect(quoteSheetCatalogMenuPlacement(110,150,60,520,0,430))
   .toEqual({side:'below',maxHeight:268});
 });
 it('caps menus to the sheet edge, handles offset visual viewports and no-space cases',()=>{
  expect(quoteSheetCatalogMenuPlacement(100,135,0,300,60,600))
   .toEqual({side:'below',maxHeight:153});
  expect(quoteSheetCatalogMenuPlacement(70,85,0,100,0,100))
   .toEqual({side:'above',maxHeight:58});
  expect(quoteSheetCatalogMenuPlacement(70,85,0,100,150,175))
   .toEqual({side:'below',maxHeight:0});
  expect(quoteSheetCatalogMenuPlacement(40,60,0,200,0,1000))
   .toEqual({side:'below',maxHeight:128});
 });
 it('reveals only the active sheet body and keeps its top/bottom constrained',()=>{
  const hook=source('src/lib/useMobileQuoteSheetFieldReveal.ts');
  expect(hook).toContain("'.qqs-panel-body,.qqt-panel-body,.qmb-quick-area-body'");
  expect(hook).toContain('body.scrollTop=Math.max(0,Math.min(maximum,body.scrollTop+shift))');
  expect(hook).not.toContain('active.scrollIntoView(');
  expect(hook).toContain("window.visualViewport?.addEventListener('resize',reveal)");
 });
 it('positions both Catalog pickers within the visual viewport and cleans up listeners',()=>{
  const hook=source('src/lib/useMobileQuoteCatalogMenuViewport.ts');
  const picker=source('src/components/TakeoffCatalogPickers.tsx');
  expect(picker.match(/useMobileQuoteCatalogMenuViewport\(root,open,/g)).toHaveLength(2);
  expect(hook).toContain("window.getComputedStyle(menu).position==='absolute'");
  expect(hook).toContain("menu.style.bottom='calc(100% + 4px)'");
  expect(hook).toContain("scrollport.addEventListener('scroll',position,{passive:true})");
  expect(hook).toContain("scrollport.removeEventListener('scroll',position)");
  expect(hook).toContain("visual?.addEventListener('resize',position)");
  expect(hook).toContain("visual?.removeEventListener('resize',position)");
 });
});
