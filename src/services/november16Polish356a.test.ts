import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Screenshot polish #356a',()=>{
 it('keeps the desktop header in one row rather than 126px of two rows',()=>{
  const css=read('workspace-zoom-fixes.css');
  expect(css).toContain('--ss-workspace-header-height:82px!important');
  expect(css).toContain('grid-template-rows:minmax(0,1fr)!important');
  expect(css).not.toContain('grid-row:2!important');
 });
 it('uses a real two-column grid in Quote Filters, not display:contents',()=>{
  const css=read('components/quote-library-filters.css');
  expect(css).toContain('.qmb-quote-filter-layout');
  expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))!important');
  expect(read('components/QuoteLibraryFilterControls.tsx')).toContain('Dates use delivery');
 });
 it('places the Settings header before, not inside, its sidebar grid',()=>{
  const page=read('components/CompanySettings.tsx');
  expect(page.indexOf('<WorkspaceHeader title="Settings"')).toBeLessThan(
   page.indexOf('<div className="settings-layout">'));
 });
 it('styles Deal form advanced select/input fields with themed app tokens',()=>{
  const css=read('components/board-quick-create-mobile.css');
  expect(css).toContain('.board-create-extra-grid select');
  expect(css).toContain('background:var(--ss-theme-card);color:var(--ss-theme-ink)');
 });
 it('uses an icon Today shortcut, scrollbars and one Quick View footer row',()=>{
  expect(read('components/SalesCalendarLauncher.tsx')).toContain('title="Move task to today"');
  expect(read('scrollbar-theme.css')).toContain('scrollbar-color:var(--ss-theme-border) var(--ss-theme-base)');
  expect(read('quick-view-action-row.css')).toContain('flex-wrap:nowrap!important');
  expect(read('App.tsx')).toContain("import './quick-view-action-row.css'");
 });
});
