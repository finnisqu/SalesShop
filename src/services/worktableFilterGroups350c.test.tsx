import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {WorktableFilterMenu,WorktableFilterSection,WorktableSurface} from '../components/WorktableChrome';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const catalog=['src/components/CatalogSinksWorktable.tsx','src/components/CatalogOtherWorktable.tsx'];

describe('Batch 350c — shared compact filter groups and mobile dismissal',()=>{
 it('renders labeled semantic filter sections within one native Filters menu',()=>{
  const html=renderToStaticMarkup(<WorktableFilterMenu activeCount={2}>
   <WorktableFilterSection title="Find"><label>Find<input type="search"/></label></WorktableFilterSection>
   <WorktableFilterSection title="Sort"><label>Order<select defaultValue="ascending">
    <option value="ascending">Ascending</option></select></label></WorktableFilterSection>
  </WorktableFilterMenu>);
  expect(html).toContain('<details');
  expect(html).toContain('aria-label="Filters · 2 active"');
  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="Find"');
  expect(html).toContain('aria-label="Sort"');
  expect(html).toContain('ss-worktable-filter-section-heading');
  expect(html).toContain('<strong class="ss-worktable-filter-section-heading">Find</strong>');
  expect(html).not.toContain('Done · View results');
 });
 it('renders optional mobile Done action without adding another scroll surface',()=>{
  const html=renderToStaticMarkup(<WorktableFilterMenu activeCount={1} mobileDone>
   <WorktableFilterSection title="Visibility">Show archived</WorktableFilterSection>
  </WorktableFilterMenu>);
  expect(html).toContain('ss-worktable-filter-panel');
  expect(html).toContain('ss-worktable-filter-done');
  expect(html).toContain('type="button"');
  expect(html).toContain('Done · View results');
  const code=source('src/components/WorktableChrome.tsx');
  expect(code).toContain('if(ref.current)ref.current.open=false;');
  expect(code).toContain("ref.current?.querySelector<HTMLElement>('summary')?.focus({preventScroll:true})");
  expect(code).toContain('useDismissibleDetails(ref);');
  expect(code).toContain('useViewportBoundDetails(ref);');
  const surface=renderToStaticMarkup(<WorktableSurface label="Other table"><table><tbody/></table></WorktableSurface>);
  expect(surface.match(/<table/g)).toHaveLength(1);
 });
 it('shares grouped Find / Visibility / Sort and the same reset in Sinks and OTHER',()=>{
  for(const path of catalog){
   const table=source(path);
   expect(table).toContain('activeCount={activeFilterCount} mobileDone>');
   expect(table).toContain('<WorktableFilterSection title="Find">');
   expect(table).toContain('<WorktableFilterSection title="Visibility">');
   expect(table).toContain('<WorktableFilterSection title="Sort">');
   expect(table).toContain('<div className="ss-worktable-filter-sort-grid">');
   expect(table).toContain('<div className="catalog-card-filter-panel">');
   expect(table).toContain('<CatalogFilterReset activeCount={activeFilterCount} onReset={resetCatalogView}/>');
   expect(table).toContain('onChange={event=>chooseSortDirection(event.target.value as CatalogSortDirection)}');
   expect(table).toContain('<WorktableSurface className="rates-reference-table-wrap catalog-product-scroll"');
   expect((table.match(/<WorktableFilterMenu /g)||[])).toHaveLength(1);
   expect((table.match(/<WorktableFilterSection title=/g)||[])).toHaveLength(3);
  }
 });
 it('adds the same nonmutating Done option to Records filtering',()=>{
  const records=source('src/components/ConnectionsTable.tsx');
  expect(records).toContain('{toolbarFilters&&<WorktableFilterMenu activeCount={filterCount} mobileDone>');
  expect(records).toContain('<WorktableSurface className="connections-table-scroll"');
  expect(records).toContain('useViewportBoundDetails(columnsMenuRef)');
  expect(records).toContain('useDismissibleDetails(columnsMenuRef)');
 });
 it('retains shared viewport clipping and native dismissal behavior',()=>{
  const bounds=source('src/components/useViewportBoundDetails.ts');
  const dismiss=source('src/components/useDismissibleDetails.ts');
  expect(bounds).toContain('placeWorktableMenu({');
  expect(bounds).toContain('panel.style.maxHeight=next.maxHeight');
  expect(bounds).toContain("menu.addEventListener('toggle',toggle)");
  expect(dismiss).toContain("document.addEventListener('pointerdown',outside,true)");
  expect(dismiss).toContain("document.addEventListener('keydown',escape,true)");
  const chrome=source('src/worktable-chrome.css');
  expect(chrome).toContain('ss-worktable-filter-section+.ss-worktable-filter-section');
  expect(chrome).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
  expect(chrome).toContain('.catalog-card-checkbox input[type=checkbox]');
  expect(chrome).toContain('accent-color:var(--ss-theme-accent)');
  expect(chrome).toContain('.ss-worktable-filter-done{display:none;}');
  expect(chrome).toContain('position:sticky;bottom:-14px;');
  expect(chrome).toContain('font-size:16px;');
  expect(chrome).toContain('overflow-x:auto;overflow-y:visible');
  expect(chrome).not.toContain('table thead th::before');
 });
});
