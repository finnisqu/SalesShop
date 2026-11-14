import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
 catalogDefaultVariantPrice,compareCatalogVariantPrice,
 type CatalogVariantPriceRecord,
} from './catalogVariantPriceSort';

const record=(name:string,prices:Array<{
 active:boolean;default:boolean;internalCost?:number;sellPrice?:number;
}>):CatalogVariantPriceRecord=>({
 name,variants:prices.map((p,i)=>({id:'sku-'+i,...p})),
});
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Batch 349a — Sinks/OTHER Catalog worktable price parity',()=>{
 it('shows the active default, never a retired first or legacy default SKU',()=>{
  const item=record('Fixture',[
   {active:false,default:true,internalCost:3,sellPrice:5},
   {active:true,default:false,internalCost:40,sellPrice:120},
   {active:true,default:true,internalCost:50,sellPrice:140},
  ]);
  expect(catalogDefaultVariantPrice(item,'cost')).toBe(50);
  expect(catalogDefaultVariantPrice(item,'price')).toBe(140);
  const legacy=record('Legacy',[
   {active:false,default:true,internalCost:3,sellPrice:5},
   {active:true,default:false,internalCost:40,sellPrice:120},
  ]);
  expect(catalogDefaultVariantPrice(legacy,'price')).toBe(120);
  const retired=record('Retired',[
   {active:false,default:true,internalCost:3,sellPrice:5},
  ]);
  expect(catalogDefaultVariantPrice(retired,'cost')).toBeUndefined();
  expect(catalogDefaultVariantPrice(retired,'price')).toBeUndefined();
 });
 it('sorts unpriced, invalid or retired default variants LAST without NaN instability',()=>{
  const priced=record('Priced',[{active:true,default:true,internalCost:0,sellPrice:80}]);
  const expensive=record('High',[{active:true,default:true,internalCost:100,sellPrice:250}]);
  const noPrice=record('Blank',[{active:true,default:true,internalCost:undefined}]);
  const retired=record('Retired',[{active:false,default:true,internalCost:1,sellPrice:10}]);
  const invalid=record('Invalid',[{active:true,default:true,sellPrice:Infinity,internalCost:NaN}]);
  expect([retired,expensive,noPrice,priced,invalid].sort(
   (a,b)=>compareCatalogVariantPrice(a,b,'price')).map(r=>r.name))
   .toEqual(['Priced','High','Blank','Invalid','Retired']);
  expect([retired,expensive,noPrice,priced,invalid].sort(
   (a,b)=>compareCatalogVariantPrice(a,b,'cost')).map(r=>r.name))
   .toEqual(['Priced','High','Blank','Invalid','Retired']);
  expect(compareCatalogVariantPrice(noPrice,retired,'cost')).toBeLessThan(0);
  expect(compareCatalogVariantPrice(retired,priced,'price')).toBeGreaterThan(0);
 });
 it('does not mutate Catalog variants while sorting and prices can change separately',()=>{
  const first=record('B',[{active:true,default:true,internalCost:20,sellPrice:100}]);
  const second=record('A',[{active:true,default:true,internalCost:50,sellPrice:80}]);
  const snapshot=JSON.stringify([first,second]);
  expect([first,second].sort((a,b)=>compareCatalogVariantPrice(a,b,'cost'))[0].name).toBe('B');
  expect([first,second].sort((a,b)=>compareCatalogVariantPrice(a,b,'price'))[0].name).toBe('A');
  expect(JSON.stringify([first,second])).toBe(snapshot);
 });
 it('aligns Sink and OTHER headers and sorting with actual customer price fields',()=>{
  const sinks=source('src/components/CatalogSinksWorktable.tsx');
  const other=source('src/components/CatalogOtherWorktable.tsx');
  for(const table of [sinks,other]){
   expect(table).toContain('compareCatalogVariantPrice(a,b,sort)');
   expect(table).toContain('<option value="price">Customer price · low first</option>');
   expect(table).toContain('>Default cost</th>');
   expect(table).toContain('>Customer price</th>');
   expect(table).toContain("sort==='price'?'ascending':undefined");
  }
  expect(sinks).toContain("catalogDefaultVariantPrice(model,'cost')");
  expect(sinks).toContain("catalogDefaultVariantPrice(model,'price')");
  expect(sinks).toContain('colSpan={selecting?10:9}');
  expect(other).toContain('colSpan={selecting?8:7}');
 });
});
