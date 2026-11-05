import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const tasks=read('components/TasksWorkspace.tsx');
const quotes=read('components/QuotesMobileBeta.tsx');
const table=read('components/ConnectionsTable.tsx');
const css=read('workspace-table-control-strip.css');
describe('Tasks and Quotes compact workbook control strip',()=>{
 it('keeps task counts, queue, date help, record controls and columns on one desktop row',()=>{
  const start=tasks.indexOf('className="tasks-compact-controls"');
  const end=tasks.indexOf("!scope&&<p",start);
  const strip=tasks.slice(start,end);
  expect(start).toBeGreaterThan(0);
  for(const name of ['tasks-summary','tasks-tools','tasks-filter-help','tasks-toolbar-slot']){
   expect(strip).toContain(name);
  }
  expect(strip).toContain('ref={setTaskToolbarHost}');
  expect(strip).toContain('aria-label="About task dates"');
  expect(tasks).toContain('toolbarTarget={taskToolbarHost}');
  expect(css).toContain('.tasks-compact-controls>.tasks-summary');
  expect(css).toContain('flex-wrap:nowrap');
  expect(css).toContain('.tasks-toolbar-slot>.connections-grid-toolbar');
 });
 it('keeps Quotes library status, heading and table tools on one row',()=>{
  const start=quotes.indexOf('className="qmb-library-compact-controls"');
  const end=quotes.indexOf('className="qmb-documents-table"',start);
  const strip=quotes.slice(start,end);
  for(const name of ['qmb-library-tools','qmb-library-results-head','qmb-library-toolbar-slot']){
   expect(strip).toContain(name);
  }
  expect(strip).toContain('ref={setDocumentToolbarHost}');
  expect(quotes).toContain('toolbarTarget={documentToolbarHost}');
  expect(css).toContain('.qmb-library-compact-controls>.qmb-library-tools');
  expect(css).toContain('.qmb-library-toolbar-slot>.connections-grid-toolbar');
  expect(quotes).toContain('onDocumentArchive=');
  expect(quotes).toContain('onDocumentRestore=');
 });
 it('ports the existing controls instead of duplicating selection state',()=>{
  expect(table).toContain('toolbarTarget?:HTMLElement|null;');
  expect(table).toContain('createPortal(toolbar,toolbarTarget)');
  expect(table).toContain('toolbarTarget===undefined?toolbar:toolbarTarget?');
  expect((table.match(/className="connections-grid-toolbar"/g)||[])).toHaveLength(1);
  expect(table).toContain('onBulkTaskProperty');
  expect(table).toContain('connections-columns-menu');
  expect(table).toContain('onBulkTask&&');
 });
 it('keeps narrow/mobile workspaces usable and leaves other tables alone',()=>{
  expect(css).toContain('@media(max-width:820px)');
  expect(css).toContain('.tasks-compact-controls>.tasks-summary');
  expect(css).toContain('.qmb-library-compact-controls');
  expect(read('main.tsx')).toContain("import './workspace-table-control-strip.css'");
  expect(read('components/Connections.tsx')).not.toContain('toolbarTarget=');
 });
});
