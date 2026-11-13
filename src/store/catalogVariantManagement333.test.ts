import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {useSinkCatalogStore,SINK_CATALOG_SEED} from './sinkCatalogStore';
import {useOtherCatalogStore,type OtherCatalogItem} from './otherCatalogStore';
import {defaultSinkVariant,type SinkModel} from '../types/sink';
import {createQuoteSinkSnapshot} from '../services/quoteSinkSnapshot';
import {createQuoteOtherSnapshot} from '../services/quoteOtherSnapshot';
import {activeCatalogDefaultVariant} from '../services/catalogVariantDefaults';

const saved=new Map<string,string>();
const mockStorage={
 setItem:(key:string,value:string)=>{saved.set(key,value);},
 getItem:(key:string)=>saved.get(key)??null,
 removeItem:(key:string)=>{saved.delete(key);},
};
const sinkModel=():SinkModel=>{
 const seed=SINK_CATALOG_SEED.find(m=>m.id==='sink_model_3218');
 if(!seed)throw new Error('Sink seed missing');
 return {...structuredClone(seed),id:'sink333',variants:[
  {...structuredClone(seed.variants[0]),id:'chrome',active:true,default:true,internalCost:110,sellPrice:220},
  {...structuredClone(seed.variants[1]),id:'black',active:true,default:false,internalCost:130,sellPrice:255},
  {...structuredClone(seed.variants[2]),id:'retired',active:false,default:false,internalCost:190,sellPrice:345},
 ]};
};
const otherItem=():OtherCatalogItem=>({
 id:'other333',name:'Faucet kit',category:'Plumbing',unit:'each',
 active:true,updatedAt:'2026-11-13T10:00:00.000Z',
 variants:[
  {id:'chrome',label:'Chrome',active:true,default:true,internalCost:30,sellPrice:65},
  {id:'black',label:'Black',active:true,default:false,internalCost:40,sellPrice:82},
  {id:'retired',label:'Old finish',active:false,default:false,internalCost:50,sellPrice:110},
 ],
});
const sinkVariants=()=>useSinkCatalogStore.getState().models[0].variants;
const otherVariants=()=>useOtherCatalogStore.getState().items[0].variants;
const defaults=<T extends {id:string;default:boolean;active:boolean}>(variants:T[])=>
 variants.filter(v=>v.active&&v.default).map(v=>v.id);
beforeEach(()=>{
 saved.clear();
 // Suppress debounce only; actions still perform their real state changes and
 // local snapshot writes. No cloud or background save should occur in tests.
 vi.stubGlobal('window',{setTimeout:()=>1,clearTimeout:()=>{}});
 vi.stubGlobal('localStorage',mockStorage);
 useSinkCatalogStore.setState({models:[sinkModel()],hydrated:true,saving:false,error:null});
 useOtherCatalogStore.setState({items:[otherItem()],hydrated:true,saving:false,error:null});
});
afterEach(()=>{vi.unstubAllGlobals();});
describe('Batch 333 — persisted Sink and OTHER variant management',()=>{
 it('switches active Sink default without copying or mutating the old SKU',()=>{
  const model=useSinkCatalogStore.getState().models[0];
  const historical=createQuoteSinkSnapshot(model,model.variants[0]);
  useSinkCatalogStore.getState().updateVariant('sink333','black',{default:true});
  expect(defaults(sinkVariants())).toEqual(['black']);
  expect(defaultSinkVariant(useSinkCatalogStore.getState().models[0])?.id).toBe('black');
  expect(historical).toMatchObject({variantId:'chrome',sellPrice:220,internalCost:110});
  expect(sinkVariants().find(v=>v.id==='chrome')?.sellPrice).toBe(220);
  expect(saved.has('salesshop-sink-catalog-v1')).toBe(true);
 });
 it('reassigns Sink default when deactivated, handles all-inactive and recovery',()=>{
  useSinkCatalogStore.getState().updateVariant('sink333','chrome',{active:false});
  expect(defaults(sinkVariants())).toEqual(['black']);
  useSinkCatalogStore.getState().updateVariant('sink333','black',{active:false});
  expect(defaults(sinkVariants())).toEqual([]);
  expect(sinkVariants().every(v=>!v.default)).toBe(true);
  useSinkCatalogStore.getState().updateVariant('sink333','retired',{active:true});
  expect(defaults(sinkVariants())).toEqual(['retired']);
 });
 it('disallows an inactive Sink default and reassigns after deletion',()=>{
  useSinkCatalogStore.getState().updateVariant('sink333','retired',{default:true});
  expect(defaults(sinkVariants())).toEqual(['chrome']);
  useSinkCatalogStore.getState().deleteVariant('sink333','chrome');
  expect(defaults(sinkVariants())).toEqual(['black']);
  const duplicate=useSinkCatalogStore.getState().duplicateVariant('sink333','black');
  expect(duplicate).toBeTruthy();
  expect(defaults(sinkVariants())).toEqual(['black']);
  expect(sinkVariants().find(v=>v.id===duplicate)?.default).toBe(false);
 });
 it('keeps exactly one Other default when edited, duplicated, deactivated and removed',()=>{
  const item=useOtherCatalogStore.getState().items[0];
  const oldSnapshot=createQuoteOtherSnapshot(item,item.variants[0]);
  useOtherCatalogStore.getState().updateVariant('other333','black',{default:true});
  expect(defaults(otherVariants())).toEqual(['black']);
  useOtherCatalogStore.getState().duplicateVariant('other333','black');
  expect(defaults(otherVariants())).toEqual(['black']);
  useOtherCatalogStore.getState().updateVariant('other333','black',{active:false});
  expect(defaults(otherVariants())).toEqual(['chrome']);
  useOtherCatalogStore.getState().removeVariant('other333','chrome');
  expect(defaults(otherVariants())).toEqual([otherVariants().find(v=>v.active)?.id]);
  expect(oldSnapshot).toMatchObject({variantId:'chrome',sellPrice:65,internalCost:30});
  expect(saved.has('salesshop-catalog-other-v1')).toBe(true);
 });
 it('does not show a retired Other SKU as a default price',()=>{
  useOtherCatalogStore.getState().updateVariant('other333','chrome',{active:false});
  useOtherCatalogStore.getState().updateVariant('other333','black',{active:false});
  expect(activeCatalogDefaultVariant(otherVariants())).toBeUndefined();
  expect(defaults(otherVariants())).toEqual([]);
  useOtherCatalogStore.getState().updateVariant('other333','retired',{active:true});
  expect(defaults(otherVariants())).toEqual(['retired']);
 });
});
