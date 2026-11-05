import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {normalizeWorkbookTableDensity,getWorkbookTableDensity,WORKBOOK_TABLE_DENSITY_KEY} from './workbookTableDensity';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Shared workbook table density and regression guard',()=>{
 it('defaults to the current comfortable row size and ignores invalid stored values',()=>{
  expect(normalizeWorkbookTableDensity('comfortable')).toBe('comfortable');
  expect(normalizeWorkbookTableDensity('compact')).toBe('compact');
  expect(normalizeWorkbookTableDensity('garbage')).toBe('comfortable');
  expect(normalizeWorkbookTableDensity(null)).toBe('comfortable');
  if(typeof window==='undefined')expect(getWorkbookTableDensity()).toBe('comfortable');
  expect(WORKBOOK_TABLE_DENSITY_KEY).toBe('salesshop-workbook-density-v1');
 });
 it('stores a single preference, synchronizing across workspaces and browser tabs',()=>{
  const density=read('services/workbookTableDensity.ts');
  expect(density).toContain("window.localStorage.setItem(WORKBOOK_TABLE_DENSITY_KEY,next)");
  expect(density).toContain("document.documentElement.dataset.ssWorkbookDensity=value");
  expect(density).toContain("window.addEventListener('storage',onStorage)");
  expect(density).toContain("window.dispatchEvent(new Event(EVENT))");
  expect(density).toContain('useSyncExternalStore<WorkbookTableDensity>(');
 });
 it('makes the preference available in Connections, Tasks and Quotes tables as well as Catalog',()=>{
  const connections=read('components/ConnectionsTable.tsx');
  const catalog=read('components/CatalogWorkspace.tsx');
  const tasks=read('components/TasksWorkspace.tsx');
  const quotes=read('components/QuotesMobileBeta.tsx');
  expect(connections).toContain("const [density,setDensity]=useWorkbookTableDensity();");
  expect(connections).toContain('connections-density-setting');
  expect(connections).toContain('Row spacing · all workbooks');
  expect(connections).toContain("onClick={()=>setDensity('compact')}");
  expect(connections).toContain("onClick={()=>setDensity('comfortable')}");
  expect(catalog).toContain('const [tableDensity,setTableDensity]=useWorkbookTableDensity();');
  expect(catalog).toContain("label:tableDensity==='compact'?'Use comfortable table rows':'Use compact table rows'");
  expect(tasks).toContain('tableKey="tasks"');
  expect(quotes).toContain('tableKey="documents"');
 });
 it('honors mixed selection, accessible sort state, and shared action behavior',()=>{
  const table=read('components/ConnectionsTable.tsx');
  expect(table).toContain('selectPageRef.current.indeterminate=someOnPage&&!allOnPage');
  expect(table).toContain('ref={selectPageRef}');
  expect(table).toContain("aria-sort={sort.key===col.key?");
  expect(table).toContain('aria-label="Select all on page"');
  expect(table).toContain('connections-grid-pagination');
  expect(table).toContain('onBulkEdit');
  expect(table).toContain('onBulkTaskProperty');
  expect(table).toContain('createPortal(toolbar,toolbarTarget)');
 });
 it('centralizes table geometry but excludes the quote takeoff editor controls',()=>{
  const css=read('workbook-table-foundation.css');
  const main=read('main.tsx');
  const core=read('connections-table.css');
  const supplier=read('design-system/workspace-visual-system-v2.css');
  expect(css).toContain('--ss-workbook-row-height:51px');
  expect(css).toContain('--ss-workbook-row-height:41px');
  expect(css).toContain('[data-ss-workbook-density="compact"]');
  for(const selector of ['.connections-data-table','.rates-reference-table','.supplier-directory-table']){
   expect(css).toContain(selector);
  }
  expect(css).not.toContain('.qwt-');
  expect(css).toContain('scrollbar-gutter:stable');
  expect(core).toContain('padding:var(--ss-workbook-cell-pad-y,8px) 11px');
  expect(supplier).toContain('text-align:left;padding:var(--ss-workbook-cell-pad-y,11px) 13px');
  expect(main.indexOf("import './workbook-table-foundation.css'"))
    .toBeGreaterThan(main.indexOf("import './workspace-table-control-strip.css'"));
 });
});
