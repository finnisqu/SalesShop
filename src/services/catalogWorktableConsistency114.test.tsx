import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch #114 — Catalog layout parity',()=>{
 it('moves material management shortcuts into More without a floating import launcher',()=>{
  const catalog=src('components/CatalogWorkspace.tsx');
  const launcher=src('components/SupplierImportCenter.tsx');
  const materials=src('components/MaterialsWorkspace.tsx');
  expect(catalog).toContain("label:'Builder material levels'");
  expect(catalog).toContain("label:'Supplier Import'");
  expect(catalog).toContain('<SupplierImportLauncher placement="hidden"/>');
  expect(launcher).toContain("placement !== 'hidden'");
  expect(launcher).toContain('sales-shop:open-supplier-import');
  expect(materials).not.toContain('headerTarget');
  expect(materials).toContain('catalog-card-filter');
  expect(materials).toContain('catalog-card-sort');
  expect(materials).toContain('Supplier material catalog');
 });
 it('gives all catalog reference cards the same header control pattern',()=>{
  const sinks=src('components/CatalogSinksWorktable.tsx');
  const other=src('components/CatalogOtherWorktable.tsx');
  const rates=src('components/RatesWorkspace.tsx');
  const tags=src('components/CatalogTagsWorkspace.tsx');
  for(const worktable of [sinks,other]){
   expect(worktable).toContain('catalog-card-header');
   expect(worktable).toContain('catalog-card-filter');
   expect(worktable).toContain('catalog-card-sort');
   expect(worktable).toContain('catalog-card-edit');
   expect(worktable).not.toContain('<div className="catalog-product-toolbar">');
   expect(worktable).toContain('materials-comparison-board');
  }
  expect(rates).toContain('catalogReferenceActions');
  expect(rates).toContain('catalog-card-category');
  expect(rates).toContain('catalog-embedded-edit-row');
  expect(tags).toContain('catalog-card-header');
  expect(tags).toContain('catalog-card-filter');
  expect(tags).toContain('ConnectionsTable tableKey="tags"');
 });
 it('stretches the comparison tables to the full workspace width',()=>{
  const css=src('catalog-product-worktable.css');
  expect(css).toContain('.catalog-product-worktable>.catalog-product-card');
  expect(css).toContain('grid-template-columns:minmax(0,1fr)');
  expect(css).toContain('.catalog-card-header');
  expect(css).toContain('.catalog-card-filter-panel');
  expect(css).toContain('.rates-workspace.is-catalog-embedded>.rates-reference-controls');
 });
});
