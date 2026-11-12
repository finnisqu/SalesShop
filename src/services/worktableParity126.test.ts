import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 126 — shared compact Records/Catalog worktables',()=>{
 it('reuses Catalog paging choices, column controls, selection and pins across Records tables',()=>{
  const table=src('components/ConnectionsTable.tsx');
  for(const text of ['CATALOG_PAGE_SIZES','catalogPageRange','catalogPagination',
   'WorktablePagination','Select pinned','bulkActions?.(chosen','connections-columns-menu']){
   expect(table).toContain(text);
  }
  expect(table).toContain("const PAGE_SIZE=DEFAULT_CATALOG_PAGE_SIZE;");
  expect(table).toContain("'pages'|'activity'");
 });
 it('gives Notebook Pages and Activity History real shared worktables, not separate scrolling lists',()=>{
  const pages=src('components/RecordsPagesDirectory.tsx');
  const records=src('components/Connections.tsx');
  expect(pages).toContain('<ConnectionsTable tableKey="pages"');
  expect(pages).toContain('bulkActions={(items,clear)');
  expect(pages).toContain('Destination notebook folder');
  expect(pages).toContain('isCalendarInbox');
  expect(pages).not.toContain('<table>');
  expect(records).toContain('<ConnectionsTable tableKey="activity"');
  expect(records).toContain('toolbarFilters={<div className="connections-activity-filters"');
  expect(records).not.toContain('<div className="connections-activity-list">');
  expect(records).toContain('records-activity-directory');
 });
 it('keeps desktop People, Deals and Our Organization metadata/actions in the shared toolbar',()=>{
  const records=src('components/Connections.tsx');
  const organization=src('components/OurOrganizationDirectory.tsx');
  expect(records).toContain('connections-people-attention-filters is-mobile');
  expect(records).toContain('records-tasks-directory');
  expect(records).not.toContain('connections-deals-capture-bar is-mobile');
  expect(records).toContain('toolbarFilters={dealPipelineControl}');
  expect(organization).toContain('our-org-unified-toolbar is-mobile');
  expect(organization).toContain('our-org-table-controls');
  expect(organization).toContain('toolbarFilters={<div className="our-org-table-controls">');
 });
 it('keeps Quotes in the existing full workspace, with a single table toolbar and compact action menu',()=>{
  const quotes=src('components/QuotesMobileBeta.tsx');
  const header=src('components/WorkspaceHeader.tsx');
  expect(quotes).toContain('<WorkspaceHeader title="Records"');
  expect(quotes).toContain('const documentTypeControl');
  expect(quotes).toContain('toolbarFilters={<>{documentTypeControl}{sharedLibraryControls}</>}');
  expect(quotes).not.toContain('qmb-library-directory-caption');
  expect(quotes).toContain('compact label="Quote actions"');
  expect(header).toContain('compact=false');
 });
 it('prevents Overview panel from stretching Tasks and retains mobile access to Activity/Pages',()=>{
  const style=src('worktable-parity.css');
  const app=src('App.tsx');
  expect(style).toContain('.tasks-overview-menu:not([open])>.tasks-summary');
  expect(style).toContain('.tasks-workspace.is-records-embedded .connections-toolbar-controls');
  expect(style).toContain('.records-pages-directory .connections-grid-shell');
  expect(style).toContain('.records-activity-directory .connections-grid-shell');
  expect(style).toContain('.catalog-pagination.materials-page-controls');
  expect(app).toContain("import './worktable-parity.css'");
 });
});
