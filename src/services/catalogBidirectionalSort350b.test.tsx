import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {WorktableHorizontalHint} from '../components/WorktableChrome';
import {compareCatalogVariantPrice,type CatalogVariantPriceRecord} from './catalogVariantPriceSort';
import {catalogProductFilterChips,type CatalogProductFilterState} from './catalogProductFilterChips';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const item=(name:string,cost?:number,price?:number,active=true):CatalogVariantPriceRecord=>({
 name,variants:[{id:name,active,default:true,internalCost:cost,sellPrice:price}],
});
const catalog=['src/components/CatalogSinksWorktable.tsx','src/components/CatalogOtherWorktable.tsx'];

describe('Batch 350b — Catalog Sinks/OTHER bidirectional sorting and phone discoverability',()=>{
 it('sorts priced active default variants high-to-low while blanks remain last',()=>{
  const rows=[item('Blank'),item('Mid',40,80),item('Highest',100,150),
   item('Retired',1,1,false),item('Low',0,0),item('Invalid',NaN,Infinity)];
  expect([...rows].sort((a,b)=>compareCatalogVariantPrice(a,b,'cost','descending')).map(r=>r.name))
   .toEqual(['Highest','Mid','Low','Blank','Invalid','Retired']);
  expect([...rows].sort((a,b)=>compareCatalogVariantPrice(a,b,'price','descending')).map(r=>r.name))
   .toEqual(['Highest','Mid','Low','Blank','Invalid','Retired']);
 });
 it('retains ascending behavior, exact zero pricing, and stable alphabetical blank ties',()=>{
  const rows=[item('Z blank'),item('Price B',20,60),item('Price A',0,10),item('A blank')];
  expect([...rows].sort((a,b)=>compareCatalogVariantPrice(a,b,'cost')).map(r=>r.name))
   .toEqual(['Price A','Price B','A blank','Z blank']);
  expect([...rows].sort((a,b)=>compareCatalogVariantPrice(a,b,'cost','ascending')).map(r=>r.name))
   .toEqual(['Price A','Price B','A blank','Z blank']);
  expect([...rows].sort((a,b)=>compareCatalogVariantPrice(a,b,'cost','descending')).map(r=>r.name))
   .toEqual(['Price B','Price A','A blank','Z blank']);
  expect(rows[2].variants[0].internalCost).toBe(0);
 });
 it('shows a removable sort chip for descending even on the default field',()=>{
  const reset=()=>{};
  const base:CatalogProductFilterState={
   localQuery:'',headerQuery:'',category:'all',categoryLabel:'All',
   includeArchived:false,sort:'brand',defaultSort:'brand',sortLabel:'Brand / name',
   sortDirection:'ascending',
   clearLocalQuery:reset,clearHeaderQuery:reset,clearCategory:reset,
   clearArchived:reset,clearSort:reset,
  };
  expect(catalogProductFilterChips(base)).toEqual([]);
  const down=catalogProductFilterChips({...base,sortDirection:'descending'});
  expect(down).toHaveLength(1);
  expect(down[0].key).toBe('sort');
  expect(down[0].label).toBe('Sort: Brand / name ↓');
  expect(down[0].onRemove).toBe(reset);
  expect(catalogProductFilterChips({...base,sort:'price',sortLabel:'Customer price',
   sortDirection:'descending'}).map(c=>c.label)).toEqual(['Sort: Customer price ↓']);
 });
 it('shares sortable header direction and a dedicated direction selector on both worktables',()=>{
  for(const path of catalog){
   const table=source(path);
   expect((table.match(/<WorktableSortButton /g)||[]).length).toBe(5);
   for(const field of ['brand','name','category','cost','price']){
    expect(table).toContain("aria-sort={sort==='"+field+"'?sortDirection:undefined}");
    expect(table).toContain("active={sort==='"+field+"'} direction={sortDirection} onSort={()=>chooseSort('"+field+"',true)}");
   }
   expect(table).toContain("current==='ascending'?'descending':'ascending'");
   expect(table).toContain("sort==='cost'||sort==='price'?compareCatalogVariantPrice(a,b,sort,sortDirection)");
   expect(table).toContain("const sortMultiplier=sortDirection==='descending'?-1:1;");
   expect(table).toContain('sortDirection,');
   expect(table).toContain('onChange={event=>chooseSortDirection(event.target.value as CatalogSortDirection)}');
   expect(table).toContain('<option value="ascending">Ascending</option><option value="descending">Descending</option>');
  }
 });
 it('resets the expanded row, direction and page selection when the sort changes',()=>{
  for(const path of catalog){
   const table=source(path);
   expect(table).toContain('setExpanded(null);\n  setSortDirection(');
   expect(table).toContain("setSortDirection('ascending');");
   expect(table).toContain('clearSort:()=>{setExpanded(null);');
   expect(table).toContain('sort,sortDirection]');
   expect(table).toContain('sort,sortDirection,pagination.page,pagination.pageSize,selecting]');
   expect(table).toContain('const activeFilterCount=filterChips.length;');
  }
 });
 it('provides a readable but unobtrusive swipe hint outside the scroll region',()=>{
  const html=renderToStaticMarkup(<WorktableHorizontalHint label="Sinks"/>);
  expect(html).toContain('class="ss-worktable-horizontal-hint"');
  expect(html).toContain('Swipe sideways to view more Sinks columns');
  expect(html).toContain('aria-hidden="true"');
  for(const path of catalog){
   const s=source(path);
   expect(s).toContain('<WorktableHorizontalHint label=');
   expect(s.indexOf('<WorktableHorizontalHint label=')).toBeLessThan(s.indexOf('<WorktableSurface className="rates-reference-table-wrap catalog-product-scroll"'));
   expect(s).toContain('label="'+(path.includes('Sinks')?'Sinks':'OTHER')+'"');
  }
  const css=source('src/worktable-chrome.css');
  expect(css).toContain('.ss-worktable-horizontal-hint{');
  expect(css).toContain('display:none;margin:0;padding:6px 10px;');
  expect(css).toContain('.catalog-product-scroll{');
  expect(css).toContain('overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;');
 });
});
