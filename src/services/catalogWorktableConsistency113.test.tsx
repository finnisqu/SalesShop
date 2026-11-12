import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorkspaceMoreMenu} from '../components/WorkspaceHeader';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch #113 — Catalog worktable and shared interaction parity',()=>{
 it('groups mixed More menu items while preserving accessible actions',()=>{
  const html=renderToStaticMarkup(<WorkspaceMoreMenu items={[
   {section:'Views',label:'Board',onClick:()=>{},active:true},
   {section:'Views',label:'Table',onClick:()=>{}},
   {section:'Actions',label:'Record external quote',onClick:()=>{}},
  ]}/>);
  expect(html).toContain('ss-workspace-more__section');
  expect(html).toContain('Views');
  expect(html).toContain('Actions');
  expect(html.match(/ss-workspace-more__section/g)).toHaveLength(2);
  expect(html).toContain('aria-pressed="true"');
  expect(src('workspace-header-standard.css')).toContain('line-height:1.27!important');
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
  expect(catalog).toContain('headerTarget={materialHeaderTarget}');
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
