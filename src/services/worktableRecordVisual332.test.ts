import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const themes=read('appearance-themes.css');
function themeBlock(name:string){
 const head=':root[data-sales-theme="'+name+'"] {';
 const start=themes.indexOf(head);
 if(start<0)throw new Error('Missing theme: '+name);
 return themes.slice(start, themes.indexOf('}',start));
}
function rgb(hex:string){
 const clean=hex.replace('#','');
 const numbers=clean.length===3?clean.split('').map(c=>parseInt(c+c,16)):
 [0,2,4].map(i=>parseInt(clean.slice(i,i+2),16));
 return numbers;
}
function paletteColor(block:string,token:string){
 const match=block.match(new RegExp('--ss-theme-'+token+':(#[\\da-fA-F]{3,8})'));
 if(!match)throw new Error('Missing palette '+token);
 return rgb(match[1]);
}
function luminance(c:number[]){
 const linear=c.map(value=>{
  const fraction=value/255;
  return fraction<=.04045?fraction/12.92:((fraction+.055)/1.055)**2.4;
 });
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
function headingContrast(name:string){
 const p=themeBlock(name);
 const tint=paletteColor(p,'tint'),border=paletteColor(p,'border');
 // Same 62/38 sRGB mixture as the canonical Worktable header fill.
 const header=tint.map((v,i)=>.62*v+.38*border[i]);
 const a=luminance(header),b=luminance(paletteColor(p,'ink'));
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

describe('Batch 332f — worktable and Record visual contracts',()=>{
 it('retains readable, token-driven table headers in LIGHT, WARM and DARK themes',()=>{
  const css=read('worktable-chrome.css');
  expect(css).toContain('--ss-worktable-head-fill:color-mix(in srgb,var(--ss-theme-tint) 62%,var(--ss-theme-border) 38%)');
  expect(css).toContain('background:var(--ss-worktable-head-fill)!important');
  expect(css).toContain('color:var(--ss-theme-ink)');
  for(const name of ['light','warm','dark']){
   const block=themeBlock(name);
   for(const token of ['canvas','base','card','tint','border','ink']){
    expect(block).toContain('--ss-theme-'+token+':');
   }
   expect(headingContrast(name)).toBeGreaterThanOrEqual(4.5);
  }
 });
 it('keeps the same rounded Worktable surface and mobile overflow across directories',()=>{
  const css=read('worktable-chrome.css');
  const chrome=read('components/WorktableChrome.tsx');
  const catalog=read('catalog-product-worktable.css');
  expect(css).toContain('--ss-worktable-corner:12px');
  expect(css).toContain('border-radius:var(--ss-worktable-corner)');
  expect(css).toContain('clip-path:inset(0 round var(--ss-worktable-corner))');
  expect(css).toContain('overflow-x:auto;overflow-y:visible');
  expect(css).toContain('overscroll-behavior-x:contain');
  expect(chrome).toContain("ss-worktable-surface '+className");
  expect(catalog).toContain('height:var(--ss-workbook-row-height,51px)');
 });
 it('keeps mobile record actions compact and preserves shared Unlink protections',()=>{
  const record=read('record-page-refinement.css');
  const layout=read('components/RecordPageLayout.tsx');
  const tasks=read('components/RecordTasksPanel.tsx');
  const people=read('components/DealPersonRelationships.tsx');
  expect(record).toContain('grid-template-columns:minmax(0,1fr) auto');
  expect(record).toContain('width:auto;min-width:0;min-height:34px;');
  expect(record).toContain('min-width:42px;min-height:42px;cursor:pointer');
  expect(record).toContain('.ss-record-actions-menu>summary{min-height:44px;min-width:44px}');
  expect(tasks).toContain('!isProtectedBidTask(task)');
  expect(people).toContain('editing&&manager.editable&&<RecordUnlinkButton');
  expect(layout).toContain('recordJumpScrollBehavior(reducedMotion)');
 });
});
