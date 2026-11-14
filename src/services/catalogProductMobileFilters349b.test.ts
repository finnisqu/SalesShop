import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {catalogProductFilterChips,type CatalogProductFilterState} from './catalogProductFilterChips';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const make=()=>({
 localQuery:'',headerQuery:'',category:'all',categoryLabel:'All',
 includeArchived:false,sort:'brand',defaultSort:'brand',sortLabel:'Brand / name',
 clearLocalQuery:vi.fn(),clearHeaderQuery:vi.fn(),clearCategory:vi.fn(),
 clearArchived:vi.fn(),clearSort:vi.fn(),
} satisfies CatalogProductFilterState);

describe('Batch 349b — mobile Sinks and OTHER worktable filter parity',()=>{
 it('starts without active filters at the default view',()=>{
  const options=make();
  expect(catalogProductFilterChips(options)).toEqual([]);
 });
 it('keeps Catalog header search and worktable Find separate even with identical words',()=>{
  const options={...make(),headerQuery:'Polished',localQuery:'Polished'};
  const chips=catalogProductFilterChips(options);
  expect(chips.map(chip=>chip.key)).toEqual(['header-search','worktable-search']);
  expect(chips.map(chip=>chip.label)).toEqual(['Catalog: Polished','Find: Polished']);
  chips[0].onRemove();
  expect(options.clearHeaderQuery).toHaveBeenCalledTimes(1);
  expect(options.clearLocalQuery).not.toHaveBeenCalled();
  chips[1].onRemove();
  expect(options.clearLocalQuery).toHaveBeenCalledTimes(1);
 });
 it('trims visible search terms and retains multiword phrases',()=>{
  const options={...make(),headerQuery:'  Calacatta polished  ',localQuery:'  ADA vanity  '};
  expect(catalogProductFilterChips(options).map(chip=>chip.label))
   .toEqual(['Catalog: Calacatta polished','Find: ADA vanity']);
  expect(catalogProductFilterChips({...options,headerQuery:' ',localQuery:''})).toEqual([]);
 });
 it('gives category, archived and sorting separate, individually removable chips',()=>{
  const options={...make(),category:'vanity',categoryLabel:'Bathroom / vanity',
   includeArchived:true,sort:'price',sortLabel:'Customer price · low first'};
  const chips=catalogProductFilterChips(options);
  expect(chips.map(chip=>chip.key)).toEqual(['category','archived','sort']);
  expect(chips.map(chip=>chip.label)).toEqual([
   'Type: Bathroom / vanity','Including archived','Sort: Customer price · low first',
  ]);
  chips.forEach(chip=>chip.onRemove());
  expect(options.clearCategory).toHaveBeenCalledOnce();
  expect(options.clearArchived).toHaveBeenCalledOnce();
  expect(options.clearSort).toHaveBeenCalledOnce();
  expect(options.clearLocalQuery).not.toHaveBeenCalled();
 });
 it('counts all five distinct constraints consistently with filter controls',()=>{
  const options={...make(),localQuery:'bowl',headerQuery:'stainless',
   category:'kitchen',categoryLabel:'Kitchen',includeArchived:true,
   sort:'cost',sortLabel:'Cost · low first'};
  expect(catalogProductFilterChips(options)).toHaveLength(5);
  expect(new Set(catalogProductFilterChips(options).map(x=>x.key)).size).toBe(5);
 });
 it('uses the same active chips and reset contract in both Sinks and OTHER',()=>{
  for(const path of [
   'src/components/CatalogSinksWorktable.tsx',
   'src/components/CatalogOtherWorktable.tsx',
  ]){
   const table=source(path);
   expect(table).toContain('catalogProductFilterChips({');
   expect(table).toContain('localQuery:query,headerQuery:externalQuery');
   expect(table).toContain("clearHeaderQuery:()=>onClearExternalQuery?.()");
   expect(table).toContain('const activeFilterCount=filterChips.length;');
   expect(table).toContain('className="catalog-product-mobile-filters"');
   expect(table).toContain('<MobileCatalogActiveFilters items={filterChips} onClear={resetCatalogView}/>');
   expect(table).toContain('onReset={resetCatalogView}');
  }
  const css=source('src/catalog-product-worktable.css');
  expect(css).toContain('.catalog-product-mobile-filters{display:none;min-width:0;}');
  expect(css).toContain('overflow-x:auto;overscroll-behavior-x:contain;');
 });
});
