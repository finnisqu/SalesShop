import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {catalogPageRange,DEFAULT_CATALOG_PAGE_SIZE,CATALOG_PAGE_SIZES} from '../components/CatalogPagination';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch #117 — all five Catalog worktables paginate consistently',()=>{
 it('defaults to 50 records per page with 25/50/100 options',()=>{
  expect(DEFAULT_CATALOG_PAGE_SIZE).toBe(50);
  expect([...CATALOG_PAGE_SIZES]).toEqual([25,50,100]);
 });
 it('handles empty, first, final and invalid page ranges',()=>{
  expect(catalogPageRange(0,1,50)).toEqual({page:1,pageCount:1,start:0,end:0,first:0,last:0});
  expect(catalogPageRange(1343,1,50)).toEqual({page:1,pageCount:27,start:0,end:50,first:1,last:50});
  expect(catalogPageRange(1343,27,50)).toEqual({page:27,pageCount:27,start:1300,end:1343,first:1301,last:1343});
  expect(catalogPageRange(1343,300,50).page).toBe(27);
  expect(catalogPageRange(24,-2,25).page).toBe(1);
  expect(catalogPageRange(75,2,25)).toMatchObject({first:26,last:50,pageCount:3});
  expect(catalogPageRange(30,1,9)).toMatchObject({pageCount:1,end:30});
 });
 it('uses the same shared pagination component in Materials, Sinks, Other and Rates',()=>{
  for(const name of ['MaterialsWorkspace','CatalogSinksWorktable','CatalogOtherWorktable','RatesWorkspace']){
   const content=src('components/'+name+'.tsx');
   expect(content).toContain("from './CatalogPagination'");
   expect(content).toContain('<CatalogPagination');
  }
  expect(src('components/CatalogSinksWorktable.tsx')).toContain('{pagedModels.map');
  expect(src('components/CatalogOtherWorktable.tsx')).toContain('{pagedItems.map');
  const rates=src('components/RatesWorkspace.tsx');
  expect(rates).toContain('{pagedRates.map');
  expect(rates).toContain('{pagedLevels.map');
  expect(rates.match(/\{paginationRow\}/g)?.length).toBe(2);
 });
 it('replaces Tags older footer without disturbing other CRM directory pagination',()=>{
  const tags=src('components/CatalogTagsWorkspace.tsx');
  const table=src('components/ConnectionsTable.tsx');
  expect(tags).toContain('catalogPagination catalogPaginationKey=');
  expect(table).toContain('catalogPagination?<CatalogPagination');
  expect(table).toContain('{!catalogPagination&&<footer className="connections-grid-pagination">');
  expect(table).toContain('const pages=Math.max(1,Math.ceil(sorted.length/pageSize));');
 });
 it('keeps a visible, responsive page-size control even when there are no results',()=>{
  const view=src('components/CatalogPagination.tsx');
  const css=src('catalog-product-worktable.css');
  expect(view).toContain('Showing {range.first}–{range.last} of {total}');
  expect(view).toContain('disabled={range.page<=1}');
  expect(view).toContain('disabled={range.page>=range.pageCount}');
  expect(css).toContain('Batch 117: one usable Materials-style pagination band');
  expect(css).toContain('.catalog-pagination-size');
  expect(css).toContain('.catalog-pagination-extras');
 });
});
