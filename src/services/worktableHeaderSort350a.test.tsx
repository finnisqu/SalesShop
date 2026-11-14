import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {WorktableSortButton} from '../components/WorktableChrome';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const sinks=()=>source('src/components/CatalogSinksWorktable.tsx');
const other=()=>source('src/components/CatalogOtherWorktable.tsx');
const materials=()=>source('src/components/MaterialsWorkspace.tsx');
const rates=()=>source('src/components/RatesWorkspace.tsx');

describe('Batch 350a — accessible sortable Catalog headings',()=>{
 it('uses one semantic button with a stable accessible name and visual sort direction',()=>{
  const idle=renderToStaticMarkup(<WorktableSortButton label="Customer price"
   active={false} onSort={()=>{}}/>);
  const asc=renderToStaticMarkup(<WorktableSortButton label="Customer price"
   active onSort={()=>{}}/>);
  const desc=renderToStaticMarkup(<WorktableSortButton label="Customer price"
   active direction="descending" onSort={()=>{}}/>);
  for(const html of [idle,asc,desc]){
   expect(html).toContain('type="button"');
   expect(html).toContain('class="ss-worktable-sort-button"');
   expect(html).toContain('aria-label="Sort by Customer price"');
   expect(html).toContain('aria-hidden="true"');
   expect(html).toContain('Customer price</span>');
  }
  expect(idle).toContain('↕');
  expect(asc).toContain('↑');
  expect(desc).toContain('↓');
 });
 it('makes five Sinks and five OTHER columns clickable with matching aria-sort state',()=>{
  for(const table of [sinks(),other()]){
   expect((table.match(/<WorktableSortButton /g)||[]).length).toBe(5);
   for(const name of ['brand','name','category','cost','price']){
    expect(table).toContain("active={sort==='"+name+"'} onSort={()=>chooseSort('"+name+"')}");
    expect(table).toContain("sort==='"+name+"'?'ascending':undefined");
   }
   expect(table).toContain("const chooseSort=(next:typeof sort)=>{setExpanded(null);setSort(next);};");
   expect(table).toContain('onChange={event=>chooseSort(event.target.value as typeof sort)}');
  }
 });
 it('makes Materials headers clickable while preserving stock sort and two cost directions',()=>{
  const table=materials();
  expect((table.match(/<WorktableSortButton /g)||[]).length).toBe(4);
  expect(table).toContain('onSort={()=>chooseSort(\'brand\')}');
  expect(table).toContain('onSort={()=>chooseSort(\'name\')}');
  expect(table).toContain('onSort={()=>chooseSort(\'type\')}');
  expect(table).toContain("onSort={()=>chooseSort(sort==='cost-asc'?'cost-desc':'cost-asc')}");
  expect(table).toContain("aria-sort={sort==='cost-asc'?'ascending':sort==='cost-desc'?'descending':undefined}");
  expect(table).toContain('const chooseSort=(next:MaterialSort)=>{setExpandedMaterialId(null);setSort(next);};');
  expect(table).toContain("setQuery('');clearFilters();setSort('stock-brand')");
 });
 it('sorts Rates item/category/cost/price/effective with correct direction and safe editing',()=>{
  const table=rates();
  expect((table.match(/<WorktableSortButton /g)||[]).length).toBe(5);
  expect(table).toContain("onSort={()=>chooseRateSort('name')}");
  expect(table).toContain("onSort={()=>chooseRateSort('category')}");
  expect(table).toContain("onSort={()=>chooseRateSort('cost-asc')}");
  expect(table).toContain("onSort={()=>chooseRateSort(rateSort==='sell-asc'?'sell-desc':'sell-asc')}");
  expect(table).toContain("onSort={()=>chooseRateSort('effective-desc')}");
  expect(table).toContain("aria-sort={rateSort==='effective-desc'?'descending':undefined}");
  expect(table).toContain('setExpandedRateId(null);setExpandedLevelId(null);setRateSort(next);');
 });
 it('preserves shared round-table, filters and accessibility rather than creating bespoke menus',()=>{
  for(const table of [sinks(),other(),materials(),rates()]){
   expect(table).toContain('<WorktableSurface ');
   expect(table).toContain('<WorktableFilterMenu');
   expect(table).toContain("from './WorktableChrome'");
  }
  const code=source('src/components/WorktableChrome.tsx');
  expect(code).toContain('export function WorktableSortButton');
  expect(code).toContain("aria-label={'Sort by '+label}");
  expect(code).toContain("title={active?'Sorted by '+label:'Sort by '+label}");
  const css=source('src/worktable-chrome.css');
  expect(css).toContain('.ss-worktable-sort-button:focus-visible');
  expect(css).toContain('outline:2px solid var(--ss-theme-accent)');
  expect(css).toContain('.ss-worktable-sort-indicator');
  expect(css).toContain('background:var(--ss-worktable-head-fill)!important');
 });
});
