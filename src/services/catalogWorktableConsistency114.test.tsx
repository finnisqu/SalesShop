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
 it('matches Materials typography, borders and row surfaces throughout Catalog',()=>{
  const css=src('catalog-product-worktable.css');
  const parity=css.split('Batch 115 — Materials is the canonical Catalog visual language.')[1];
  expect(parity).toBeTruthy();
  for(const section of ['catalog-section-sinks','catalog-section-other','catalog-section-rates','catalog-section-tags']){
    expect(parity).toContain(section);
  }
  for(const token of ['--ss-theme-border','--ss-theme-card','--ss-theme-base',
    '--ss-theme-tint','--ss-theme-ink','--ss-theme-muted','--ss-theme-accent']){
    expect(parity).toContain(token);
  }
  expect(parity).toContain('.catalog-sink-variant.materials-variant-line');
  expect(parity).toContain('grid-template-columns:minmax(0,1fr)');
  expect(parity).toContain('.catalog-product-pin-board');
  expect(parity).toContain('.connections-data-table thead th');
  expect(parity).toContain('max-height:none');
  expect(parity).not.toContain('background:#fff');
 });
 it('gives all five Catalog tabs one gutter and shared reference-table measurements',()=>{
  const catalog=src('components/CatalogWorkspace.tsx');
  const css=src('catalog-product-worktable.css');
  const parity=css.split('Batch 116: the five Catalog tabs share one page gutter')[1];
  expect(catalog).toContain('catalog-section-host catalog-reference-layout catalog-section-');
  expect(parity).toBeTruthy();
  for(const tab of ['materials','sinks','other','rates','tags']){
    expect(parity).toContain('.catalog-section-'+tab);
  }
  expect(parity).toContain('padding:18px clamp(16px,3.7vw,64px) 24px');
  expect(parity).toContain('overflow-y:auto');
  expect(parity).toContain('>.rates-workspace.is-catalog-embedded');
  expect(parity).toContain('>.catalog-product-worktable');
  expect(parity).toContain('min-height:72px');
  expect(parity).toContain('height:46px');
  expect(parity).toContain('height:60px');
 });
 it('keeps Tags checkbox and pin cells visible and preserves rotated phone layout',()=>{
  const css=src('catalog-product-worktable.css');
  const parity=css.split('Batch 116: the five Catalog tabs share one page gutter')[1];
  expect(parity).toContain('.connections-check-cell,.connections-pin-cell');
  expect(parity).toContain('min-width:52px');
  expect(parity).toContain('overflow:visible');
  expect(parity).toContain('min-height:64px');
  expect(parity).toContain('max-height:520px');
  expect(parity).toContain('padding:0;');
  expect(parity).toContain('tr.has-pinned-variant');
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
