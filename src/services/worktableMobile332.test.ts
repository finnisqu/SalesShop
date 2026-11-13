import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const src=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
describe('Batch 332d — mobile worktable chrome and scrolling',()=>{
 it('connects viewport placement to Filters, Actions and Columns',()=>{
  const chrome=src('components/WorktableChrome.tsx');
  const records=src('components/ConnectionsTable.tsx');
  expect(chrome.match(/useViewportBoundDetails\(ref\)/g)).toHaveLength(2);
  expect(records).toContain('useViewportBoundDetails(columnsMenuRef)');
  const helper=src('components/useViewportBoundDetails.ts');
  expect(helper).toContain('if(!menu.open)return');
  expect(helper).toContain("document.addEventListener('scroll',outsideScroll,true)");
  expect(helper).toContain("menu.removeEventListener('toggle',toggle)");
  const style=src('worktable-chrome.css');
  expect(style).toContain('transform:translateX(var(--ss-worktable-menu-shift-x,0px))');
  expect(style).toContain('[data-worktable-side="above"]');
  expect(src('connections-table.css')).toContain('.connections-columns-menu[data-worktable-side="above"]');
 });
 it('does not introduce a clipping toolbar scroll parent for mobile menus',()=>{
  const style=src('worktable-chrome.css');
  expect(style).toContain('overscroll-behavior-x:contain');
  expect(style).toContain('-webkit-overflow-scrolling:touch');
  expect(style).toContain('scrollbar-width:thin');
  expect(style).toContain('min-height:44px');
  expect(style).toContain('.catalog-card-filter.ss-worktable-filter-menu>summary');
  expect(style).toContain('.ss-worktable-filter-panel .catalog-card-reset');
  expect(style).toContain('.catalog-section-tags .catalog-pagination-extras .connections-columns-menu>summary');
  expect(style).toContain('white-space:normal;\n  overflow-wrap:anywhere;');
  expect(style).toContain('.connections-grid-toolbar .connections-toolbar-controls{\n  flex-wrap:wrap;');
 });
 it('keeps Catalog pagination on one flexible phone row with full-width extras beneath',()=>{
  const style=src('worktable-chrome.css');
  expect(style).toContain('@media(max-width:520px){');
  expect(style).toContain('.catalog-pagination .ss-worktable-pagination{');
  expect(style).toContain('flex:1 1 100%;');
  expect(style).toContain('.catalog-pagination .catalog-pagination-extras{');
  expect(style).toContain('justify-content:flex-start;');
  const paging=src('components/CatalogPagination.tsx');
  expect(paging).toContain('<WorktablePagination');
  expect(paging).toContain('catalog-pagination-extras');
 });
});
