import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Batch 333 — Catalog creation remains visible and variant management stays safe',()=>{
 it('opens a newly created Sink or Other item after removing hidden filters',()=>{
  const sinks=source('components/CatalogSinksWorktable.tsx');
  const other=source('components/CatalogOtherWorktable.tsx');
  expect(sinks).toContain("const selectedCategory=category==='all'?'kitchen':category");
  expect(sinks).toContain("setQuery('');setCategory('all');setShowInactive(false);setSort('brand');");
  expect(sinks).toContain('const id=addModel(selectedCategory)');
  expect(other).toContain("setQuery('');setCategory('all');setShowInactive(false);setSort('category');");
  expect(other).toContain('const id=addItem();setEditing(true);setExpanded(id)');
  for(const component of [sinks,other]){
   expect(component).toContain('onClearExternalQuery?.()');
   expect(component).toContain('const index=filtered.findIndex(row=>row.id===expanded)');
   expect(component).toContain('pagination.setPage(Math.floor(index/pagination.pageSize)+1)');
  }
 });
 it('blocks default toggles for inactive and already-default variants',()=>{
  for(const file of ['CatalogSinksWorktable','CatalogOtherWorktable']){
   const content=source('components/'+file+'.tsx');
   expect(content).toContain("disabled={key==='default'&&(!variant.active||variant.default)}");
   expect(content).toContain('catalog-product-default-note');
   expect(content).not.toContain('normalizeCatalogVariantDefaults');
  }
 });
 it('uses active default pricing rather than retired first variants',()=>{
  const sinks=source('components/CatalogSinksWorktable.tsx');
  const other=source('components/CatalogOtherWorktable.tsx');
  expect(sinks).toContain('defaultSinkVariant(a)?.internalCost');
  expect(other).toContain('defaultVariant=activeCatalogDefaultVariant(item.variants)');
  expect(other).not.toContain('item.variants.find(v=>v.default)||item.variants[0]');
 });
 it('keeps quoted variant identity and sales price snapshots immutable',()=>{
  const sink=source('services/quoteSinkSnapshot.ts');
  const other=source('services/quoteOtherSnapshot.ts');
  expect(sink).toContain('variantId: variant.id');
  expect(sink).toContain('sellPrice: variant.sellPrice');
  expect(other).toContain('variantId:variant.id');
  expect(other).toContain('sellPrice:variant.sellPrice');
 });
 it('offers model-level duplication and reversible archiving on both worktables',()=>{
  const sinks=source('components/CatalogSinksWorktable.tsx');
  const other=source('components/CatalogOtherWorktable.tsx');
  expect(sinks).toContain('onClick={()=>duplicateCatalogModel(model.id)}');
  expect(other).toContain('onClick={()=>duplicateCatalogItem(item.id)}');
  expect(sinks).toContain('const id=duplicateModel(modelId)');
  expect(other).toContain('const id=duplicateItem(itemId)');
  for(const content of [sinks,other]){
   expect(content).toContain("onClearExternalQuery?.();setExpanded(id);setEditing(true)");
   expect(content).toContain('Active in catalog');
   expect(content).toContain('Uncheck to archive; saved quotes keep their original selections.');
   expect(content).toContain("?' · Archived':''");
  }
  expect(sinks).toContain("variant.internalCost===undefined?'—':money.format(variant.internalCost)");
  expect(sinks).toContain("variant.sellPrice===undefined?'—':money.format(variant.sellPrice)");
 });
});
