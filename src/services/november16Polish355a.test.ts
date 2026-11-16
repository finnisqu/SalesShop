import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const load=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
describe('November 16 screenshot polish #355a',()=>{
 it('positions calendar before first paint and distinguishes weekend dates',()=>{
  const s=load('components/SalesCalendarLauncher.tsx');
  const css=load('components/sales-calendar.css');
  expect(s).toContain("visibility:'hidden'");
  expect(s).toContain('if(!open)placement();setOpen(value=>!value)');
  expect(s).toContain("getDay()===6)?' is-weekend'");
  expect(css).toContain('.sales-calendar-day.is-weekend:not(.is-selected)');
  expect(css).toContain('.sales-calendar-popover:not(.is-inline) .sales-calendar-day');
 });
 it('filters lay out as full-width form fields, not nested absolute popovers',()=>{
  const css=load('components/quote-library-filters.css');
  expect(css).toContain('.ss-worktable-filter-panel .qmb-library-extra-filters-content');
  expect(css).toContain('position:static!important');
  expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
 });
 it('mobile and zoom-safe headers share one layout gate',()=>{
  expect(load('App.tsx')).toContain("import './workspace-zoom-fixes.css'");
  expect(load('workspace-zoom-fixes.css')).toContain('max-width:1599px');
 });
 it('Task reschedule stays available but unobtrusive',()=>{
  const s=load('components/TaskPreviewDueControls.tsx');
  expect(s).toContain('<summary>Reschedule…</summary>');
  expect(s).toContain('isProtectedBidTask(task)');
 });
});
