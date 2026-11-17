import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

describe('SalesShop responsive width tiers #379',()=>{
 const css=read('workspace-viewport-tiers379.css');
 it('overrides the old forced desktop row after all legacy shell styles',()=>{
  const app=read('main.tsx');
  expect(app.indexOf("import './workspace-viewport-tiers379.css'"))
   .toBeGreaterThan(app.indexOf("import './workspace-header-parity.css'"));
  expect(css).toContain('grid-template-rows:48px 46px!important');
  expect(css).toContain('grid-column:1/-1!important;grid-row:2!important');
  expect(css).toContain('height:116px!important');
 });
 it('defines distinct wide/compact/tablet/mobile boundaries and keeps header actions visible',()=>{
  expect(css).toContain('min-width:761px) and (max-width:1439px)');
  expect(css).toContain('min-width:761px) and (max-width:1023px)');
  expect(css).toContain('min-width:980px) and (max-width:1439px)');
  expect(css).toContain('min-width:761px) and (max-width:979px)');
  expect(css).toContain('ss-workspace-header__search.is-open');
  expect(css).toContain('ss-workspace-header__search-toggle');
  expect(css).toContain('overflow-x:auto!important');
 });
 it('prevents Recents appearing only below the left CRM panel',()=>{
  expect(css).toContain('>.connections-record-related');
  expect(css).toContain('grid-column:1/-1!important');
  expect(css).toContain('grid-template-columns:minmax(0,1fr)!important');
 });
 it('preserves Google popup compatibility through static asset headers',()=>{
  const headers=read('../public/_headers');
  expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin-allow-popups');
 });
});
