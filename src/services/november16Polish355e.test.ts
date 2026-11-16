import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const load=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
describe('Nov 16 final header/date guard #355e',()=>{
 it('overrides absolute Records tab centering at high desktop zoom',()=>{
  const css=load('workspace-zoom-fixes.css');
  expect(css).toContain('@media(min-width:1400px) and (max-width:1599px)');
  expect(css).toContain(':has(>.ss-workspace-header__tabs>.records-section-nav)');
  expect(css).toContain('grid-template-rows:minmax(0,1fr)!important');
  expect(css).toContain('height:82px!important');
 });
 it('keeps date numbers separate from multiple badges',()=>{
  const css=load('components/sales-calendar.css');
  expect(css).toContain('min-height:70px!important');
  expect(css).toContain('min-height:68px!important');
 });
 it('uses actual selected Settings tab and clearer follow-up menu name',()=>{
  expect(load('components/CompanySettings.tsx')).toContain('selected={tab}');
  expect(load('components/QuotesMobileBeta.tsx')).toContain("label:'Customer follow-ups'");
 });
});
