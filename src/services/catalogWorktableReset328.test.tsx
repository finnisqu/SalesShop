import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 328 — shared Catalog reset semantics',()=>{
 const paths=[
  'components/MaterialsWorkspace.tsx',
  'components/CatalogSinksWorktable.tsx',
  'components/CatalogOtherWorktable.tsx',
  'components/RatesWorkspace.tsx',
 ];
 it('makes every Catalog filter menu use the exact same reset component',()=>{
  const reset=source('components/CatalogFilterReset.tsx');
  expect(reset).toContain('disabled={activeCount<=0}');
  expect(reset).toContain('Reset filters &amp; sort');
  for(const path of paths){
   const contents=source(path);
   expect(contents).toContain("import {CatalogFilterReset} from './CatalogFilterReset'");
   expect(contents).toContain('<CatalogFilterReset activeCount=');
   expect(contents).toContain('onReset={resetCatalogView}');
   expect(contents).toContain('onClearExternalQuery?.()');
  }
 });
 it('clears local filters without touching the pinned variant comparison boards',()=>{
  const materials=source(paths[0]),sinks=source(paths[1]),other=source(paths[2]),rates=source(paths[3]);
  expect(materials).toContain("setQuery('');clearFilters();setSort('stock-brand')");
  expect(sinks).toContain("setQuery('');setCategory('all');setShowInactive(false);setSort('brand')");
  expect(other).toContain("setQuery('');setCategory('all');setShowInactive(false);setSort('category')");
  expect(rates).toContain("setQuery('');selectCategory('all');clearReferenceFilters()");
  expect(rates).toContain("setRateSort('category')");
  for(const path of paths){
   const block=source(path).split('const resetCatalogView=()=>{')[1]?.split('};')[0];
   expect(block).toBeTruthy();
   expect(block).not.toContain('setPins(');
   expect(block).not.toContain('setPinnedKeys(');
  }
 });
 it('reaches the shared Catalog page search and preserves top-level navigation',()=>{
  const catalog=source('components/CatalogWorkspace.tsx');
  expect((catalog.match(/onClearExternalQuery=\{\(\)=>setCatalogSearch\(''\)\}/g)||[]).length).toBe(4);
  expect(catalog).toContain("onSelect={next=>{setCatalogSearch('');setSection(next);}}");
  const css=source('catalog-product-worktable.css');
  expect(css).toContain('.catalog-card-reset:disabled');
  expect(css).toContain('min-height:38px');
 });
});
