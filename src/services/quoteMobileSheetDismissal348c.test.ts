import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
 quoteSheetSwipeShouldClose,quoteSheetSwipeCanStart,quoteSheetBackdropShouldClose,
} from './quoteMobileSheetDismissal';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Batch 348c — mobile Quote sheet dismissal and focus',()=>{
 it('accepts one intentional downward swipe without changing the closing threshold',()=>{
  expect(quoteSheetSwipeShouldClose({x:40,y:120},{x:44,y:206},false)).toBe(true);
  expect(quoteSheetSwipeShouldClose({x:40,y:120},{x:44,y:205},false)).toBe(true);
  expect(quoteSheetSwipeShouldClose({x:40,y:120},{x:44,y:204},false)).toBe(false);
  expect(quoteSheetSwipeShouldClose({x:40,y:120},{x:41,y:40},false)).toBe(false);
 });
 it('rejects horizontal swipes, keyboard use and cancelled or malformed gestures',()=>{
  expect(quoteSheetSwipeShouldClose({x:0,y:0},{x:200,y:120},false)).toBe(false);
  expect(quoteSheetSwipeShouldClose({x:0,y:0},{x:65,y:100},false)).toBe(false);
  expect(quoteSheetSwipeShouldClose({x:0,y:0},{x:1,y:120},true)).toBe(false);
  expect(quoteSheetSwipeShouldClose(null,{x:1,y:120},false)).toBe(false);
  expect(quoteSheetSwipeShouldClose({x:0,y:0},null,false)).toBe(false);
  expect(quoteSheetSwipeShouldClose({x:Number.NaN,y:0},{x:0,y:120},false)).toBe(false);
 });
 it('starts only from noninteractive single-touch headers when keyboard is closed',()=>{
  const header={closest:()=>null} as unknown as Element;
  const button={closest:()=>({})} as unknown as Element;
  expect(quoteSheetSwipeCanStart(header,false,1)).toBe(true);
  expect(quoteSheetSwipeCanStart(header,false,2)).toBe(false);
  expect(quoteSheetSwipeCanStart(header,true,1)).toBe(false);
  expect(quoteSheetSwipeCanStart(button,false,1)).toBe(false);
  expect(quoteSheetSwipeCanStart(null,false,1)).toBe(false);
 });
 it('dismisses an active keyboard on first backdrop tap, not the entire sheet',()=>{
  expect(quoteSheetBackdropShouldClose(true,true)).toBe(false);
  expect(quoteSheetBackdropShouldClose(true,false)).toBe(true);
  expect(quoteSheetBackdropShouldClose(false,true)).toBe(true);
  expect(quoteSheetBackdropShouldClose(false,false)).toBe(true);
 });
 it('guards all three Quote detail sheets against gesture cancellation and backdrop edits',()=>{
  for(const file of [
   'src/components/QuoteQuickAreaSummary.tsx',
   'src/components/QuoteCompactTakeoffs.tsx',
   'src/components/QuoteAreaQuickPanel.tsx',
  ]){
   const contents=source(file);
   expect(contents).toContain('quoteSheetSwipeCanStart(');
   expect(contents).toContain('quoteSheetSwipeShouldClose(');
   expect(contents).toContain('quoteSheetBackdropShouldClose(');
   expect(contents).toContain('onTouchCancel={()=>{sheetSwipeStart.current=null;}}');
   expect(contents).toContain("document.documentElement.dataset.ssMobileKeyboard==='open'");
  }
 });
 it('lets Material/Sink menus consume their first Escape before the parent dialog',()=>{
  const dismissible=source('src/lib/useDismissibleLayer.ts');
  const catalog=source('src/components/TakeoffCatalogPickers.tsx');
  expect(dismissible).toContain("event.target.closest('.qtl-combobox')");
  expect(dismissible).toContain("catalogPicker?.querySelector('.qtl-combobox-menu')");
  expect(catalog).toContain("event.key==='Escape'&&open");
  expect(catalog).toContain('event.stopPropagation();setOpen(false)');
 });
 it('restores focus to the launching editable cell without stealing newly opened modal focus',()=>{
  const focus=source('src/lib/useQuoteSheetFocusReturn.ts');
  expect(focus).toContain('target?.isConnected');
  expect(focus).toContain('focused===document.body||sheet.current?.contains(focused)');
  expect(focus).toContain('target.focus({preventScroll:true})');
  expect(source('src/components/QuoteQuickAreaSummary.tsx'))
   .toContain('useQuoteSheetFocusReturn(input)');
  expect(source('src/components/QuoteCompactTakeoffs.tsx'))
   .toContain('useQuoteSheetFocusReturn(ref)');
 });
});
