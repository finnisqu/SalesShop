import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch #113 — Catalog worktable and shared interaction parity',()=>{
 it('groups mixed More menu items while preserving accessible actions',()=>{
  const menu=src('components/WorkspaceHeader.tsx');
  expect(menu).toContain('ss-workspace-more__section');
  expect(menu).toContain('items[index-1]?.section!==item.section');
  expect(menu).toContain('aria-pressed={item.active===undefined?undefined:item.active}');
  expect(src('workspace-header-standard.css')).toContain('line-height:1.27!important');
  expect(src('components/QuotesMobileBeta.tsx')).toContain("section:'Document types'");
  expect(src('components/TasksWorkspace.tsx')).toContain("section:'Due date filters'");
 });
 it('uses full worktables for Sink and Other catalogs with physical variants and pin boards',()=>{
  const catalog=src('components/CatalogWorkspace.tsx');
  const sinks=src('components/CatalogSinksWorktable.tsx');
  const other=src('components/CatalogOtherWorktable.tsx');
  const sinkType=src('types/sink.ts');
  const sinkStore=src('store/sinkCatalogStore.ts');
  const otherStore=src('store/otherCatalogStore.ts');
  expect(catalog).toContain('<CatalogSinksWorktable externalQuery={catalogSearch}');
  expect(catalog).toContain('<CatalogOtherWorktable externalQuery={catalogSearch}');
  expect(catalog).not.toContain('headerTarget={materialHeaderTarget}');
  expect(catalog).toContain('sales-shop:open-supplier-import');
  expect(src('components/MaterialsWorkspace.tsx')).toContain('catalog-card-actions');
  expect(catalog).not.toContain('OtherCatalogComingSoon');
  for(const field of ['cornerRadiusIn','bowlWidthIn','bowlLengthIn','bowlHeightIn',
   'totalWidthIn','totalLengthIn','totalHeightIn','availableColors','finish']){
   expect(sinkType).toContain(field);
   expect(sinkStore).toContain(field);
   expect(sinks).toContain(field);
  }
  for(const component of [sinks,other]){
   expect(component).toContain('materials-comparison-board');
   expect(component).toContain('materials-comparison-card');
   expect(component).toContain('materials-variant-expanded-row');
   expect(component).toContain('materials-pin-button');
   expect(component).not.toContain('CatalogAddToQuoteButton');
   expect(component).toContain('canEdit');
  }
  expect(other).toContain('Variant notes');
  expect(otherStore).toContain('other_catalog');
  expect(src('supabase/migrations/20261112141430_catalog_other_worktable.sql'))
   .toContain('other_catalog jsonb not null');
 });
 it('retains existing Quote picking but removes repetitive Add to Quote row actions',()=>{
  for(const component of ['MaterialsWorkspace','RatesWorkspace','SinksWorkspace']){
   const code=src('components/'+component+'.tsx');
   expect(code).not.toContain('CatalogAddToQuoteButton');
  }
  expect(src('components/TakeoffCatalogPickers.tsx')).toContain('Sink');
 });
 it('makes Tasks quick actions orderly and record view widths consistent',()=>{
  const table=src('components/ConnectionsTable.tsx');
  const cell=table.split('connections-row-actions">')[1];
  expect(cell).toBeTruthy();
  const complete=cell.indexOf('onTaskToggleComplete&&');
  const due=cell.indexOf('onTaskDuePreset&&');
  const deletion=cell.indexOf('onTaskDelete&&');
  expect(complete).toBeGreaterThan(-1);
  expect(due).toBeGreaterThan(complete);
  expect(deletion).toBeGreaterThan(due);
  expect(cell).toContain('<TrashIcon/></button>');
  expect(src('components/connections-board-toggle.css')).toContain('width:min(100%,var(--ss-workspace-width,1360px))');
  expect(src('components/board-quick-create-mobile.css')).toContain('.ss-unified-picker-trigger');
  expect(src('components/OurOrganizationDirectory.tsx')).toContain('our-org-unified-toolbar');
 });
});
