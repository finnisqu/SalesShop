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
  // Preserve the original Catalog hierarchy: light capsule, clear tabs,
  // and a single softly filled active tab rather than six separate chips.
  expect(css).toContain('background:var(--ss-theme-card)!important;overflow:visible!important');
  expect(css).toContain('background:transparent!important;box-shadow:none!important');
  expect(css).toContain('background:var(--ss-theme-tint)!important');
  expect(css).not.toContain('--ss-header-pill-tab:');
  expect(css).toContain('height:36px!important;min-height:36px!important');
  expect(css).toContain('padding:7px 9px!important');
  // Records needs an explicit selected selector; the generic idle-tab
  // selector also matches More, increasing :is() specificity.
  expect(css).toContain('.records-section-nav-tabs.ss-section-tabs>.ss-section-tab.active');
  expect(css).toContain('box-shadow:inset 0 -2px var(--ss-theme-accent)!important');
  // No custom hover styling; default controls remain unchanged.
  expect(css).not.toContain('.ss-section-tab:not(.active):hover');
  expect(css).not.toContain('.ss-workspace-more.is-tab:not([open])>summary:hover');
  expect(css).toContain('font:750 11px/1.2');
  expect(css).toContain('border-left:0!important');
  expect(css).toContain('.ss-workspace-more.is-tab[open]>summary');
  expect(app).toContain("import './workspace-tab-nav.css'");
 });
 it('places Quotes Views/Actions in the worktable rather than the shared centered header',()=>{
  const quotes=src('components/QuotesMobileBeta.tsx');
  const chrome=src('components/WorktableChrome.tsx');
  const styles=src('worktable-chrome.css');
  const header=src('workspace-header-parity.css');
  expect(quotes).toContain('className="qmb-library-workspace-header"');
  // The Quotes header must be a sibling of the document editor, like the
  // other Records headers. Keeping it inside qmb-desktop-main let that inner
  // workspace subtly influence the centered tab group's placement.
  const frameIndex=quotes.indexOf("    <div className={'qmb-desktop-frame'");
  const headerIndex=quotes.indexOf('className="qmb-library-workspace-header"',frameIndex);
  const mainIndex=quotes.indexOf('<div className="qmb-desktop-main">',frameIndex);
  expect(frameIndex).toBeGreaterThan(-1);
  expect(headerIndex).toBeGreaterThan(frameIndex);
  expect(mainIndex).toBeGreaterThan(headerIndex);
  expect(quotes).toContain("{page==='library'&&");
  // All Records sections, including Quotes, use the SAME desktop
  // navigation placement. Centering Quotes alone did not match Deals.
  const navCss=src('workspace-tab-nav.css');
  expect(navCss).toContain('.sales-app:is(.view-dashboard,.view-quotes)');
  expect(navCss).toContain('.ss-workspace-header:has(>.ss-workspace-header__tabs>.records-section-nav)');
  expect(navCss).toContain('grid-column:1 / -1!important');
  expect(navCss).toContain('position:absolute!important');
  expect(navCss).toContain('inset:0!important');
  expect(navCss).toContain('pointer-events:none');
  expect(navCss).toContain('>.ss-workspace-header__tabs>.records-section-nav{\n  pointer-events:auto;');
  expect(navCss).not.toContain('left:50%!important');
  expect(navCss).not.toContain('/* Quotes: center the Records tabs against the ENTIRE desktop header.');
  expect(quotes).not.toContain('more={<WorkspaceMoreMenu compact label="Quote actions"');
  expect(quotes).toContain('tabs={<RecordsSectionNav selected="quotes"');
  expect(quotes).toContain('toolbarControls={renderLibraryToolbarMenus()}');
  expect(quotes).toContain('<WorktableActionMenu label="Views"');
  expect(quotes).toContain('<WorktableActionMenu label="Actions"');
  expect(quotes).toContain("label:'Documents',active:!followUpsTab");
  expect(quotes).toContain("label:'Follow-ups',active:followUpsTab");
  expect(quotes).toContain("label:'Detailed Editor'");
  expect(quotes).toContain("label:'Record external quote'");
  expect(quotes).toContain("disabled:!canManageLibrary");
  expect(quotes).not.toContain("label:'Clear search and filters'");
  expect(quotes).toContain('onClear={resetLibraryFilters}');
  expect(quotes).toContain('className="qmb-followups-return-toolbar"');
  expect(quotes).toContain('onClick={()=>setFollowUpsTab(false)}>← Documents');
  expect(quotes).toContain('toolbarFilters={<>{documentTypeControl}{sharedLibraryControls}</>}');
  expect(quotes).not.toContain('value="follow-ups">Follow-ups</option>');
  expect(header).not.toContain('Quotes is a Records view with an additional action-More');
  expect(chrome).toContain('export function WorktableActionMenu');
  expect(chrome).toContain('useDismissibleDetails(ref)');
  expect(chrome).toContain("ref.current?.removeAttribute('open')");
  expect(styles).toContain('.ss-worktable-action-menu:not([open])>.ss-worktable-action-panel');
  expect(styles).toContain('.qmb-library-mobile-filters');
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
 it('keeps rounded frozen headers opaque without masking toolbar controls',()=>{
  const styles=src('worktable-chrome.css');
  expect(styles).not.toContain('.ss-worktable-surface table thead th::before');
  expect(styles).not.toContain('bottom:100%;height:48px');
  expect(styles).toContain('clip-path:inset(0 round var(--ss-worktable-corner))');
  expect(styles).toContain('.ss-worktable-surface table thead{\n position:sticky;top:0;z-index:3;\n background:var(--ss-theme-card)');
  expect(styles).toContain('isolation:isolate');
  expect(styles).toContain('.ss-worktable-surface table thead th{\n position:relative;top:auto;z-index:auto;');
  // The rounded corner cutouts must show the page canvas, not the cream
  // card backing that looked like body cells leaking through in WARM.
  expect(styles).toContain('.ss-worktable-surface.connections-table-scroll table thead{\n background:var(--ss-theme-canvas);');
  expect(styles).not.toContain('.ss-worktable-surface table thead th::before');
  expect(styles).toContain('.connections-grid-shell>.connections-grid-toolbar');
  expect(styles).toContain('position:relative;z-index:5');
 });
 it('places Records top spacing outside the scroll viewport so rows cannot leak into the header gap',()=>{
  const shell=src('workspace-scroll-shell-parity.css');
  const surface=src('workspace-surface-parity.css');
  expect(shell).toContain('margin-top:var(--ss-workspace-content-top,14px)');
  expect(shell).toContain('padding-top:0!important');
  expect(shell).toContain('padding:0 0 32px');
  expect(surface).toContain('--ss-workspace-content-top:14px');
  // Never mask the table heading upward: that previously obscured Filters
  // and other toolbar controls.
  expect(src('worktable-chrome.css')).not.toContain('table thead th::before');
 });
 it('offers native and external quotes as equal Quick Create paths without duplicating the recorder',()=>{
  const quick=src('components/QuickCreate.tsx');
  const css=src('quick-create.css');
  const quotes=src('components/QuotesMobileBeta.tsx');
  expect(quick).toContain('<strong>New SalesShop Quote</strong>');
  expect(quick).toContain('<strong>Record External Quote</strong>');
  expect(quick).toContain('onClick={openDocumentPicker}');
  expect(quick).toContain('onClick={startExternalQuote}');
  expect(quick).toContain("canEditTeamArea(teamRole,department,'crm')");
  expect(quick).toContain('<ExternalQuoteBackfillDialog');
  expect(quick).toContain("initialDealId={context?.kind==='deal'?context.id:undefined}");
  expect(css).toContain('.quick-create-options.ss-mobile-sheet-body>.quick-create-option-primary');
  expect(quotes).toContain('onRecordExternal={canRecordExternal?()=>');
 });
 it('turns pinned Records into direct task and bulk-edit selections',()=>{
  const table=src('components/ConnectionsTable.tsx');
  expect(table).toContain('onBulkTask(pins)');
  expect(table).toContain('setSelected(pins.map(row=>row.id))');
  expect(table).toContain('setBulkEditing(true)');
  expect(table).toContain('Bulk edit pins');
  expect(table).toContain('Select pinned');
  expect(table).toContain("['companies','people','deals'].includes(tableKey)");
 });
 it('keeps Tasks count and status controls inside the standard worktable rather than a second row',()=>{
  const tasks=src('components/TasksWorkspace.tsx');
  const strip=src('workspace-table-control-strip.css');
  const table=src('components/ConnectionsTable.tsx');
  expect(tasks).toContain('<div className="tasks-toolbar-slot"');
  expect(tasks).not.toContain('<p className="tasks-directory-caption">');
  expect(tasks).toContain('toolbarTarget={embedded?undefined:taskToolbarHost}');
  expect(tasks).toContain('className="tasks-summary"');
  expect(strip).not.toContain('.tasks-directory-controls .tasks-directory-caption');
  expect(table).toContain('connections-grid-meta');
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
