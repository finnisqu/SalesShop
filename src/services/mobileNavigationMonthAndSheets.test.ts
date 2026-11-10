import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const load=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Mobile navigation, sheet and calendar consistency',()=>{
 it('navigates directly to Catalog and gives every destination a labeled icon row',()=>{
  const chrome=load('src/components/MobileAppChrome.tsx');
  const nav=load('src/lib/mobileDrawerNavigation.ts');
  const css=load('src/mobile-app-shell.css');
  expect(chrome).toContain('<MobileDestinationIcon view={item.view}/>');
  expect(chrome).toContain('mobile-app-drawer-nav-label');
  expect(chrome).not.toContain('mobile-catalog-destinations');
  expect(chrome).not.toContain('catalogExpanded');
  expect(nav).toContain("return {kind:'navigate',view}");
  expect(css).toContain('grid-template-columns:minmax(0,1fr)!important');
  expect(css).toContain('.catalog-header.ss-workspace-header');
  expect(load('src/components/CatalogWorkspace.tsx')).toContain('mobileTabs={CATALOG_SECTIONS.map');
 });
 it('shows one functional shared handle in mobile Task and Activity quick previews',()=>{
  const css=load('src/mobile-preview-sheet-parity.css');
  const task=load('src/components/TaskModalHost.tsx');
  const activity=load('src/components/CalendarActivityPreview.tsx');
  expect(css).toContain('.ss-mobile-sheet:has(> .ss-mobile-sheet-handle)>header::before');
  expect(css).toContain('display:none!important;content:none!important');
  expect(task).toContain('<MobileSheetHandle onClose={close}/>');
  expect(activity).toContain('<MobileSheetHandle onClose={close} disabled={saving}/>');
 });
 it('holds fixed height in month view when 3+ badges wrap, preserving compact week',()=>{
  const css=load('src/components/sales-calendar.css');
  expect(css).toContain('.sales-calendar-popover.is-inline:not(.is-week) .sales-calendar-grid');
  expect(css).toContain('grid-auto-rows:56px!important');
  expect(css).toContain('height:56px!important;min-height:56px!important;max-height:56px!important');
  expect(css).toContain('.sales-calendar-popover.is-week .sales-calendar-grid');
 });
});
