import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {catalogPageSelection} from '../components/CatalogBulkSelection';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 336 — Catalog page-scoped selection and filter parity',()=>{
 const page=[
  {id:'active',active:true},{id:'retired',active:false},{id:'next',active:true},
 ];
 it('only selects visible page records even with stale or hidden IDs',()=>{
  expect(catalogPageSelection(page,['off-page','retired','active'])).toEqual({
   selectedPageIds:['active','retired'],allSelected:false,
   activeIds:['active'],archivedIds:['retired'],
  });
  expect(catalogPageSelection(page,['next','active','retired','off-page']).allSelected).toBe(true);
 });
 it('returns empty targets on empty pages or stale selection',()=>{
  expect(catalogPageSelection([],['hidden'])).toEqual({
   selectedPageIds:[],allSelected:false,activeIds:[],archivedIds:[],
  });
  expect(catalogPageSelection(page,['hidden']).activeIds).toEqual([]);
  expect(catalogPageSelection(page,['hidden']).archivedIds).toEqual([]);
 });
 it('shares page selection, confirmation, and safe bulk actions in both tables',()=>{
  const sinks=source('components/CatalogSinksWorktable.tsx');
  const other=source('components/CatalogOtherWorktable.tsx');
  for(const table of [sinks,other]){
   expect(table).toContain('useCatalogPageSelection(');
   expect(table).toContain('pagination.page,pagination.pageSize,selecting');
   expect(table).toContain('const selecting=canEdit&&editing');
   expect(table).toContain('const selectedIds=pageSelection.selectedPageIds');
   expect(table).toContain('onChange={checked=>pageSelection.selectPage(checked)}');
   expect(table).toContain('<WorktableSelectPageCheckbox');
   expect(table).toContain('pageSelection.selectRow(');
   expect(table).toContain('onArchive={bulkArchive} onRestore={bulkRestore}');
   expect(table).toContain('pageSelection.clear();');
   expect(table).toContain('if(!window.confirm(');
   expect(table).toContain('setShowInactive(true)');
   expect(table).toContain('colSpan={selecting?8:7}');
   expect(table).toContain('extraActions={selecting&&selectedIds.length>0&&');
  }
  expect(sinks).toContain('setModelsActive(pageSelection.activeIds,false)');
  expect(sinks).toContain('setModelsActive(pageSelection.archivedIds,true)');
  expect(other).toContain('setItemsActive(pageSelection.activeIds,false)');
  expect(other).toContain('setItemsActive(pageSelection.archivedIds,true)');
 });
 it('adds comparable active variant pricing sort and category matching',()=>{
  const sinks=source('components/CatalogSinksWorktable.tsx');
  const other=source('components/CatalogOtherWorktable.tsx');
  expect(sinks).toContain('SINK_CATEGORY_LABELS[model.category]');
  expect(sinks).toContain('SINK_CONFIGURATION_LABELS[variant.configuration]');
  expect(other).toContain("sort==='cost'?(activeCatalogDefaultVariant(a.variants)?.internalCost??Infinity)");
  expect(other).toContain("sort==='price'?(activeCatalogDefaultVariant(a.variants)?.sellPrice??Infinity)");
  expect(other).toContain('<option value="price">Customer price · low first</option>');
 });
});
