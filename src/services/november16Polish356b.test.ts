import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
describe('Touch-ups #356b',()=>{
 it('wraps document type and remaining controls in a full-width filter group',()=>{
  const ui=read('components/QuotesMobileBeta.tsx');
  expect(ui).toContain('className="qmb-quote-filter-layout"');
  expect(ui).toContain('toolbarFilters={<div className="qmb-quote-filter-layout">');
  const form=read('components/QuoteLibraryFilterControls.tsx');
  expect(form).not.toContain('qmb-library-extra-filters-content');
  expect(form).toContain('Dates use delivery');
  const css=read('components/quote-library-filters.css');
  expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))!important');
 });
 it('shortens both Task Quick View footers without dropping their guarded actions',()=>{
  const a=read('components/TaskModalHost.tsx'),b=read('components/TasksWorkspace.tsx');
  for(const s of [a,b]){
   expect(s).toContain('Complete + Log');
   expect(s).toContain('Open Quote ↗');
   expect(s).toContain('Log external bid');
   expect(s).toContain('Quote required');
   expect(s).toContain('planFollowUp:true');
  }
 });
});
