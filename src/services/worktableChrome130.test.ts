import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {worktablePageRange,WORKTABLE_PAGE_SIZES,DEFAULT_WORKTABLE_PAGE_SIZE}
 from '../components/WorktableChrome';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch #130 — common Records/Catalog worktable chrome',()=>{
 it('shares pagination math and 25/50/100 page sizes across Catalog and Records',()=>{
  expect(WORKTABLE_PAGE_SIZES).toEqual([25,50,100]);
  expect(DEFAULT_WORKTABLE_PAGE_SIZE).toBe(50);
  expect(worktablePageRange(0,1,50)).toEqual({
   page:1,pageCount:1,start:0,end:0,first:0,last:0,
  });
  expect(worktablePageRange(83,2,50)).toEqual({
   page:2,pageCount:2,start:50,end:83,first:51,last:83,
  });
  expect(worktablePageRange(83,999,50).page).toBe(2);
  const catalog=src('components/CatalogPagination.tsx');
  expect(catalog).toContain('const catalogPageRange=worktablePageRange');
  expect(catalog).toContain('<WorktablePagination');
  const records=src('components/ConnectionsTable.tsx');
  expect(records).toContain('!catalogPagination&&<WorktablePagination');
  expect(records).not.toContain('<footer className="connections-grid-pagination">');
 });
 it('groups all Records and Quotes filters in shared dismissible menus',()=>{
  const records=src('components/Connections.tsx');
  const table=src('components/ConnectionsTable.tsx');
  const quotes=src('components/QuotesMobileBeta.tsx');
  const quoteFilters=src('components/QuoteLibraryFilterControls.tsx');
  expect(table).toContain('toolbarFilters?:ReactNode;');
  expect(table).toContain('<WorktableFilterMenu activeCount={filterCount}');
  expect(records).toContain('toolbarFilters={companyFilterControl}');
  expect(records).toContain('toolbarFilters={dealPipelineControl}');
  expect(records).toContain('toolbarFilters={<div className="connections-activity-filters"');
  expect(quotes).toContain('toolbarFilters={<>{documentTypeControl}{sharedLibraryControls}</>}');
  expect(quoteFilters).not.toContain('<details className="qmb-library-extra-filters">');
  const chrome=src('components/WorktableChrome.tsx');
  expect(chrome).toContain('useDismissibleDetails(ref)');
 });
 it('shares the same filter trigger across all five Catalog tabs',()=>{
  for(const name of ['MaterialsWorkspace','CatalogSinksWorktable',
   'CatalogOtherWorktable','RatesWorkspace','CatalogTagsWorkspace']){
   expect(src('components/'+name+'.tsx')).toContain('<WorktableFilterMenu');
  }
  const styles=src('worktable-chrome.css');
  expect(styles).toContain('.ss-worktable-filter-panel');
  expect(styles).toContain('position:static!important');
  expect(styles).toContain('max-height:min(70dvh,540px)');
 });
 it('applies the same rounded, darker-header surface to Quotes, Records and Catalog',()=>{
  const table=src('components/ConnectionsTable.tsx');
  const styles=src('worktable-chrome.css');
  expect(table).toContain('<WorktableSurface className="connections-table-scroll"');
  expect(styles).toContain('--ss-worktable-corner:12px');
  expect(styles).toContain('--ss-worktable-head-fill:');
  for(const name of ['MaterialsWorkspace','RatesWorkspace',
   'CatalogSinksWorktable','CatalogOtherWorktable']){
   expect(src('components/'+name+'.tsx')).toContain('ss-worktable-surface');
  }
 });
 it('shares the same light tab capsule and label scale across Records and Catalog',()=>{
  const nav=src('components/RecordsSectionNav.tsx');
  const catalog=src('components/CatalogWorkspace.tsx');
  const css=src('workspace-tab-nav.css');
  const app=src('App.tsx');
  expect(nav).toContain('records-section-nav ss-header-tab-pill');
  expect(nav).toContain('items={additional} asTab');
  expect(catalog).toContain('catalog-foundation-tabs ss-header-tab-pill');
  expect(css).toContain('--ss-header-pill-shell:color-mix(in srgb,var(--ss-theme-card) 94%,white 6%)');
  expect(css).toContain('--ss-header-pill-tab:color-mix(in srgb,var(--ss-theme-tint) 92%,black 8%)');
  expect(css).toContain('--ss-header-pill-active:color-mix(in srgb,var(--ss-theme-tint) 80%,black 20%)');
  expect(css).toContain('background:var(--ss-header-pill-shell)!important');
  expect(css).toContain('background:var(--ss-header-pill-tab)!important');
  expect(css).toContain('background:var(--ss-header-pill-active)!important');
  expect(css).toContain('font:750 11px/1.2');
  expect(css).toContain('border-left:0!important');
  expect(css).toContain('.ss-workspace-more.is-tab[open]>summary');
  expect(app).toContain("import './workspace-tab-nav.css'");
 });
 it('keeps the global account dropdown above page headers without elevating the idle bar',()=>{
  const styles=src('account-menu.css');
  const app=src('App.tsx');
  expect(styles).toContain('.sales-app>.app-header:has(.app-profile-trigger[aria-expanded="true"])');
  expect(styles).toContain('z-index:240!important');
  expect(styles).toContain('overflow:visible!important');
  expect(app).toContain('<AccountMenu />');
  expect(app).toContain('<WorkspaceHeader title="Notebook"');
 });
 it('keeps Suppliers on the same Catalog and Records chrome',()=>{
  const suppliers=src('components/SuppliersWorkspace.tsx');
  expect(suppliers).toContain('toolbarFilters={<label className="supplier-status-filter">');
  expect(suppliers).toContain('<CatalogPagination label="Suppliers"');
  expect(suppliers).toContain('<WorktableFilterMenu activeCount=');
  expect(suppliers).toContain('<WorktableSurface className="supplier-directory-table-scroll"');
  const chrome=src('worktable-chrome.css');
  expect(chrome).toContain('.ss-worktable-filter-menu:not([open])>.ss-worktable-filter-panel');
  expect(chrome).toContain('.qmb-library-mobile-filters .ss-worktable-filter-panel');
  expect(chrome).toContain('.ss-worktable-surface.connections-table-scroll');
 });
 it('labels the auxiliary Records directories inside the shared toolbar',()=>{
  const table=src('components/ConnectionsTable.tsx');
  const styles=src('worktable-chrome.css');
  for(const label of ['Suppliers','Notebook Pages','Activity History','Our Organization']){
   expect(table).toContain("'"+label+"'");
  }
  expect(table).toContain('MORE_DIRECTORY_TITLES[tableKey]');
  expect(table).toContain('connections-grid-title');
  expect(styles).toContain('.connections-grid-title');
 });
 it('clips frozen headers inside the table and never masks the toolbar',()=>{
  const styles=src('worktable-chrome.css');
  expect(styles).not.toContain('.ss-worktable-surface table thead th::before');
  expect(styles).not.toContain('bottom:100%;height:48px');
  expect(styles).toContain('clip-path:inset(0 round var(--ss-worktable-corner))');
  expect(styles).toContain('position:sticky;top:0;z-index:3');
  expect(styles).toContain('.connections-grid-shell>.connections-grid-toolbar');
  expect(styles).toContain('position:relative;z-index:5');
 });
 it('keeps paging in the top toolbar while preserving mobile worktable behavior',()=>{
  const table=src('components/ConnectionsTable.tsx');
  const css=src('worktable-chrome.css');
  const app=src('App.tsx');
  expect(table).toContain('const toolbar=(');
  expect(table.indexOf('<WorktablePagination')).toBeLessThan(table.indexOf('<WorktableSurface'));
  expect(table).toContain('connections-mobile-bulk-pages');
  expect(css).toContain('.catalog-section-host.catalog-reference-layout .catalog-pagination.materials-page-controls');
  expect(app).toContain("import './worktable-chrome.css'");
 });
});
