import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WorktableSelectPageCheckbox,WorktablePagination} from '../components/WorktableChrome';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 338 — shared worktable accessibility and mobile parity',()=>{
 it('announces a partially selected page as mixed rather than unchecked',()=>{
  const html=renderToStaticMarkup(
   <WorktableSelectPageCheckbox label="Select all sinks on this page"
    allSelected={false} someSelected={true} onChange={()=>{}}/>);
  expect(html).toContain('type="checkbox"');
  expect(html).toContain('aria-label="Select all sinks on this page"');
  expect(html).toContain('aria-checked="mixed"');
  const chrome=src('components/WorktableChrome.tsx');
  expect(chrome).toContain('ref.current.indeterminate=mixed');
  expect(chrome).toContain('onChange={event=>onChange(event.target.checked)}');
 });
 it('announces fully selected and empty pages correctly',()=>{
  const full=renderToStaticMarkup(
   <WorktableSelectPageCheckbox label="Select all Records" allSelected
    someSelected onChange={()=>{}}/>);
  expect(full).toContain('aria-checked="true"');
  expect(full).toMatch(/checked=""/);
  const empty=renderToStaticMarkup(
   <WorktableSelectPageCheckbox label="Select all Records" allSelected={false}
    someSelected={false} disabled onChange={()=>{}}/>);
  expect(empty).toContain('aria-checked="false"');
  expect(empty).toContain('disabled=""');
  expect(empty).not.toContain('aria-checked="mixed"');
 });
 it('gives page counts a human-readable live announcement',()=>{
  const html=renderToStaticMarkup(<WorktablePagination label="Tasks" total={83}
   page={2} pageSize={50} onPageChange={()=>{}} onPageSizeChange={()=>{}}/>);
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('Page 2 of 2');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('Previous Tasks page');
  expect(html).toContain('Next Tasks page');
 });
 it('uses the same partial-selection primitive in Records and Sinks/OTHER',()=>{
  const records=src('components/ConnectionsTable.tsx');
  const sinks=src('components/CatalogSinksWorktable.tsx');
  const other=src('components/CatalogOtherWorktable.tsx');
  for(const table of [records,sinks,other]){
   expect(table).toContain('<WorktableSelectPageCheckbox');
   expect(table).toContain('scope="col"');
   expect(table).toContain('<WorktableSurface');
  }
  expect(records).toContain('someSelected={someOnPage}');
  expect(records).toContain('allSelected={allOnPage}');
  expect(records).not.toContain('selectPageRef');
  for(const table of [sinks,other]){
   expect(table).toContain('someSelected={selectedIds.length>0}');
   expect(table).toContain('allSelected={pageSelection.allSelected}');
   expect(table).toContain('disabled={!paged');
   expect(table).toContain('onChange={checked=>pageSelection.selectPage(checked)}');
  }
 });
 it('keeps conditional Catalog row checkbox cells syntactically closed',()=>{
  // An unclosed {selecting&&...} in the OTHER row previously broke the
  // entire Cloudflare TypeScript build (TS2657 / TS1005).
  const sinks=src('components/CatalogSinksWorktable.tsx');
  const other=src('components/CatalogOtherWorktable.tsx');
  expect(sinks).toContain(
   'onChange={event=>pageSelection.selectRow(model.id,event.target.checked)}/></td>}');
  expect(other).toContain(
   'onChange={event=>pageSelection.selectRow(item.id,event.target.checked)}/></td>}');
  for(const table of [sinks,other]){
   expect(table).toContain('colSpan={selecting?8:7}');
   expect(table).toContain('<WorktableSelectPageCheckbox');
  }
 });
 it('announces current Catalog sort with the proper column semantics',()=>{
  const sinks=src('components/CatalogSinksWorktable.tsx');
  const other=src('components/CatalogOtherWorktable.tsx');
  for(const state of ['brand','name','category']){
   const file=state==='brand'?'brand':'name';
   expect(sinks).toContain("sort==='"+state+"'?'ascending':undefined");
   expect(other).toContain("sort==='"+state+"'?'ascending':undefined");
   expect(file).toBeTruthy();
  }
  expect(other).toContain("sort==='cost'?'ascending':undefined");
  expect(other).toContain("sort==='price'?'ascending':undefined");
 });
 it('retains the shared darker header, visible focus and touch-friendly checkboxes',()=>{
  const chrome=src('worktable-chrome.css');
  expect(chrome).toContain('--ss-worktable-head-fill:color-mix');
  expect(chrome).toContain('.ss-worktable-visually-hidden');
  expect(chrome).toContain('.ss-worktable-surface');
  expect(chrome).toContain('.catalog-product-select-cell');
  expect(chrome).toContain('accent-color:var(--ss-theme-accent)');
  expect(chrome).toContain('width:26px;height:26px');
  expect(chrome).toContain('font-size:16px');
  expect(chrome).toContain(':focus-visible');
  expect(chrome).toContain('min-height:44px');
  // No new clipping surface or separate vertical scrolling list was introduced.
  expect(chrome).toContain('overflow-x:auto;overflow-y:visible');
  expect(chrome).not.toContain('table thead th::before');
 });
});
