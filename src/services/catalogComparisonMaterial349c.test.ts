import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {reorderCatalogPins,shiftCatalogPin} from './catalogComparisonOrder';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Batch 349c — Materials compare-board parity',()=>{
 it('moves a Material before or after an existing comparison card without mutation',()=>{
  const original=['stone:a','stone:b','stone:c','stone:d'];
  expect(reorderCatalogPins(original,'stone:a','stone:c','after'))
   .toEqual(['stone:b','stone:c','stone:a','stone:d']);
  expect(reorderCatalogPins(original,'stone:d','stone:b','before'))
   .toEqual(['stone:a','stone:d','stone:b','stone:c']);
  expect(reorderCatalogPins(original,'stone:d','stone:b','after'))
   .toEqual(['stone:a','stone:b','stone:d','stone:c']);
  expect(original).toEqual(['stone:a','stone:b','stone:c','stone:d']);
 });
 it('does not resurrect deleted pins when the drag source or target disappears',()=>{
  const original=['stone:a','stone:b','stone:c'];
  expect(reorderCatalogPins(original,'stone:deleted','stone:b','after')).toBe(original);
  expect(reorderCatalogPins(original,'stone:a','stone:deleted','after')).toBe(original);
  expect(reorderCatalogPins(original,'stone:b','stone:b','after')).toBe(original);
  expect(reorderCatalogPins(original,'','stone:b','after')).toBe(original);
 });
 it('offers arrow-equivalent controls without wrapping at the endpoints',()=>{
  const original=['stone:a','stone:b','stone:c'];
  expect(shiftCatalogPin(original,'stone:b',-1)).toEqual(['stone:b','stone:a','stone:c']);
  expect(shiftCatalogPin(original,'stone:b',1)).toEqual(['stone:a','stone:c','stone:b']);
  expect(shiftCatalogPin(original,'stone:a',-1)).toBe(original);
  expect(shiftCatalogPin(original,'stone:c',1)).toBe(original);
 });
 it('uses the same shared pin logic as the Sinks and OTHER boards',()=>{
  const materials=source('src/components/MaterialsWorkspace.tsx');
  const sinks=source('src/components/CatalogSinksWorktable.tsx');
  const other=source('src/components/CatalogOtherWorktable.tsx');
  expect(materials).toContain('reorderCatalogPins(current, sourceKey, targetKey, position)');
  expect(materials).toContain('shiftCatalogPin(current, key, offset)');
  for(const table of [sinks,other]){
   expect(table).toContain('reorderCatalogPins(current,');
   expect(table).toContain('shiftCatalogPin(current,key,direction)');
  }
  expect(materials).toContain("dragTarget.position === 'after'");
 });
 it('gives pinned Material cards touch-accessible move controls with clear disabled boundaries',()=>{
  const materials=source('src/components/MaterialsWorkspace.tsx');
  expect(materials).toContain('pinnedVariants.map(({ material, variant }, index)');
  expect(materials).toContain('className="catalog-product-pin-actions materials-comparison-pin-actions"');
  expect(materials).toContain('disabled={index===0}');
  expect(materials).toContain('disabled={index===pinnedVariants.length-1}');
  expect(materials).toContain('onClick={()=>nudgePinned(key,-1)}');
  expect(materials).toContain('onClick={()=>nudgePinned(key,1)}');
  expect(materials).toContain('aria-label={`Unpin ${material.name} ${variantSpec(variant)}`}');
  const css=source('src/catalog-product-worktable.css');
  expect(css).toContain('.materials-comparison-pin-actions>button:focus-visible');
  expect(css).toContain('min-width:36px;width:36px;min-height:36px;height:36px;');
 });
 it('marks retired Material variants and supplier price programs without suggesting an unusable Quote',()=>{
  const materials=source('src/components/MaterialsWorkspace.tsx');
  expect(materials).toContain('const active=material.active&&variant.active!==false;');
  expect(materials).toContain('const retiredPrograms=Boolean(variant.purchaseOptions?.length&&');
  expect(materials).toContain('!activePurchaseOptions(variant).length)');
  expect(materials).toContain('CatalogLifecycleStatus active={active} isDefault={variant.default}');
  expect(materials).toContain('active&&retiredPrograms&&<small role="status">');
  expect(materials).toContain('active&&!retiredPrograms&&<CatalogQuoteLauncher');
  expect(materials).toContain('source={{kind:\'material\',material,variantId:variant.id}}');
  expect(materials).toContain('Supplier programs inactive · reactivate one before quoting');
 });
});
