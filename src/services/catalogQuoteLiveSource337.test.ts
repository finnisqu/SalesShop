import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolveCatalogQuoteLiveSource} from './catalogQuoteLiveSource';
import {buildCatalogQuoteLinePatch} from './catalogQuoteInsertion';
import type {SinkModel} from '../types/sink';
import type {OtherCatalogItem} from '../store/otherCatalogStore';

const sink:SinkModel={
 id:'sink-1',name:'Vanity bowl',category:'vanity',active:true,
 createdAt:'2026-11-13',updatedAt:'2026-11-13',
 variants:[
  {id:'white',label:'White',configuration:'rectangular',ada:true,
   active:true,default:true,internalCost:50,sellPrice:125,history:[]},
  {id:'black',label:'Black',configuration:'rectangular',ada:true,
   active:true,default:false,internalCost:65,sellPrice:155,history:[]},
 ],
};
const other:OtherCatalogItem={
 id:'other-1',name:'Drain set',category:'Plumbing',unit:'each',active:true,
 updatedAt:'2026-11-13',
 variants:[
  {id:'chrome',label:'Chrome',active:true,default:true,internalCost:20,sellPrice:45},
  {id:'matte',label:'Matte',active:true,default:false,internalCost:24,sellPrice:55},
 ],
};
const sinkSource={kind:'sink' as const,model:sink,variantId:'white'};
const otherSource={kind:'other' as const,item:other,variantId:'chrome'};
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 337 — quote insertion uses current Catalog source identity',()=>{
 it('uses updated Sink pricing at insertion, never old modal-open prices',()=>{
  const current={...sink,updatedAt:'2026-11-14',
   variants:sink.variants.map(v=>v.id==='white'?{...v,internalCost:85,sellPrice:180}:v)};
  const source=resolveCatalogQuoteLiveSource(sinkSource,{sinkModels:[current]});
  expect(source?.kind).toBe('sink');
  if(!source)throw new Error('Missing current source');
  const patch=buildCatalogQuoteLinePatch(source,{variantId:'white',quantity:3});
  expect(patch).toMatchObject({quantity:3,rate:180,
   sinkReference:{sinkModelId:'sink-1',variantId:'white',
    snapshot:{sellPrice:180,internalCost:85,sourceUpdatedAt:'2026-11-14'}}});
  expect(sink.variants[0].sellPrice).toBe(125);
 });
 it('refuses removed Sink models and inactive/removed explicit variants',()=>{
  expect(resolveCatalogQuoteLiveSource(sinkSource,{sinkModels:[]})).toBeNull();
  const archived={...sink,active:false};
  const source=resolveCatalogQuoteLiveSource(sinkSource,{sinkModels:[archived]});
  expect(()=>buildCatalogQuoteLinePatch(source!,{variantId:'white'})).toThrow(/inactive/);
  const withoutWhite={...sink,variants:[sink.variants[1]]};
  const source2=resolveCatalogQuoteLiveSource(sinkSource,{sinkModels:[withoutWhite]});
  expect(()=>buildCatalogQuoteLinePatch(source2!,{variantId:'white'}))
   .toThrow(/inactive or no longer available/);
  const retired={...sink,variants:sink.variants.map(v=>v.id==='white'?{...v,active:false}:v)};
  const source3=resolveCatalogQuoteLiveSource(sinkSource,{sinkModels:[retired]});
  expect(()=>buildCatalogQuoteLinePatch(source3!,{variantId:'white'}))
   .toThrow(/inactive or no longer available/);
 });
 it('uses live OTHER prices but never switches an explicit retired SKU to its default',()=>{
  const current={...other,variants:other.variants.map(v=>v.id==='chrome'?
   {...v,sellPrice:70,internalCost:31}:v)};
  const source=resolveCatalogQuoteLiveSource(otherSource,{otherItems:[current]});
  const patch=buildCatalogQuoteLinePatch(source!,{variantId:'chrome',quantity:2});
  expect(patch).toMatchObject({rate:70,unitCost:31,quantity:2,
   otherReference:{itemId:'other-1',variantId:'chrome',
    snapshot:{sellPrice:70,internalCost:31}}});
  expect(other.variants[0].sellPrice).toBe(45);
  const archived={...other,variants:other.variants.map(v=>v.id==='chrome'?{...v,active:false}:v)};
  const retiredSource=resolveCatalogQuoteLiveSource(otherSource,{otherItems:[archived]});
  expect(()=>buildCatalogQuoteLinePatch(retiredSource!,{variantId:'chrome'}))
   .toThrow(/inactive or no longer available/);
  expect(resolveCatalogQuoteLiveSource(otherSource,{otherItems:[]})).toBeNull();
 });
 it('uses the newly active default only when the caller did not specify a variant',()=>{
  const revised={...sink,variants:sink.variants.map(v=>({...v,default:v.id==='black'}))};
  const source=resolveCatalogQuoteLiveSource({kind:'sink',model:sink},{sinkModels:[revised]});
  const patch=buildCatalogQuoteLinePatch(source!);
  expect(patch.sinkReference?.variantId).toBe('black');
  const revisedOther={...other,variants:other.variants.map(v=>({...v,default:v.id==='matte'}))};
  const otherLive=resolveCatalogQuoteLiveSource({kind:'other',item:other},{otherItems:[revisedOther]});
  expect(buildCatalogQuoteLinePatch(otherLive!).otherReference?.variantId).toBe('matte');
 });
 it('retains unhydrated or other-kind sources while stores load',()=>{
  expect(resolveCatalogQuoteLiveSource(sinkSource,{})).toBe(sinkSource);
  expect(resolveCatalogQuoteLiveSource(otherSource,{})).toBe(otherSource);
 });
 it('checks latest Catalog state at submit and shares defaults in dialog and service',()=>{
  const modal=read('components/CatalogQuoteInsert.tsx');
  const builder=read('services/catalogQuoteInsertion.ts');
  expect(modal).toContain('const currentSource=resolveCatalogQuoteLiveSource(initialSource,');
  expect(modal).toContain('const latestSource=resolveCatalogQuoteLiveSource(initialSource,');
  expect(modal).toContain('const source=latestSource;');
  expect(modal).toContain('if(!latestSource)throw new Error(');
  expect(modal).toContain('disabled={inserting || !validQuantity || !validSource || !validDestination}');
  expect(modal).toContain('if(targetId!==TARGET_NEW&&!finalTarget)');
  expect(modal).toContain('Selected quote unavailable · choose another');
  expect(modal).toContain("currentSource===null?'Catalog record unavailable'");
  expect(modal).toContain('activeCatalogDefaultVariant(source.item.variants)');
  expect(builder).toContain('defaultSinkVariant(source.model)');
  expect(builder).toContain('activeCatalogDefaultVariant(source.item.variants)');
 });
});
