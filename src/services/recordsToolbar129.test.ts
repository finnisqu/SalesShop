import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 129 — compact Records toolbar consistency',()=>{
 it('keeps Tasks and Pages in the same inset frame as Activity and Deals',()=>{
  const records=source('components/Connections.tsx');
  const css=source('records-toolbar-consistency.css');
  expect(records).toContain('className="connections-directory records-tasks-directory"');
  expect(records).toContain('className="connections-directory records-pages-host"');
  expect(records).toContain('className="connections-directory records-activity-directory"');
  expect(css).toContain('.connections-directory-content > :is(.records-tasks-directory,.records-pages-host)');
 });
 it('shows only one desktop Open/Completed selector while keeping mobile tabs',()=>{
  const tasks=source('components/TasksWorkspace.tsx');
  const css=source('records-toolbar-consistency.css');
  expect(tasks).toContain('tasks-records-mobile-tabs tasks-records-tabs');
  expect(tasks).toContain("embedded&&<nav className=\"tasks-records-tabs\"");
  expect(css).toContain('.tasks-records-mobile-tabs');
  expect(css).toContain('display:none!important');
  expect(css).toContain('display:flex!important');
 });
 it('leaves just pipeline controls in Deals, moving external quote into the document creation picker',()=>{
  const records=source('components/Connections.tsx');
  const quotes=source('components/QuotesMobileBeta.tsx');
  const picker=source('components/NewSalesDocumentPicker.tsx');
  expect(records).toContain('toolbarControls={<>{dealPipelineControl}</>}');
  expect(records).not.toContain('connections-deals-capture-bar is-mobile');
  expect(quotes).toContain('onRecordExternal={canRecordExternal?()=>');
  expect(quotes).not.toContain("section:'Actions',label:'Record external quote'");
  expect(picker).toContain('Record external quote');
  expect(picker).toContain('onClick={onRecordExternal}');
 });
 it('groups Activity filters into a dismissible, keyboard-friendly menu',()=>{
  const records=source('components/Connections.tsx');
  const css=source('records-toolbar-consistency.css');
  expect(records).toContain('useDismissibleDetails(activityFilterMenuRef)');
  expect(records).toContain('records-activity-filter-menu');
  expect(records).toContain('records-activity-filter-popover');
  expect(records).toContain('activeActivityFilters');
  expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
  expect(css).toContain('max-height:min(75dvh,480px)');
 });
 it('shares compact quote control sizing without altering the actual Quote editor',()=>{
  const app=source('App.tsx');
  const style=source('records-toolbar-consistency.css');
  expect(app).toContain("import './records-toolbar-consistency.css'");
  expect(style).toContain('.qmb-documents-table .connections-grid-toolbar');
  expect(style).toContain('.qmb-documents-table .connections-toolbar-controls');
  const quotes=source('components/QuotesMobileBeta.tsx');
  expect(quotes).toContain('QuoteMatrixBuilder');
  expect(quotes).toContain('<RecordsSectionNav selected="quotes"');
 });
});
