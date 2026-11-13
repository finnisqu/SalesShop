import {create} from 'zustand';
import {normalizeCatalogVariantDefaults} from '../services/catalogVariantDefaults';
import {supabase} from '../lib/supabase';
import {scopedStorageKey} from '../lib/developerPlayground';
import {useAuthStore} from './authStore';

export interface OtherCatalogVariant{
 id:string;label:string;sku?:string;
 specification?:string;material?:string;finish?:string;
 availableColors?:string[];notes?:string;
 internalCost?:number;sellPrice?:number;
 active:boolean;default:boolean;
}
export interface OtherCatalogItem{
 id:string;name:string;category:string;brand?:string;supplier?:string;
 sku?:string;unit?:string;notes?:string;active:boolean;
 variants:OtherCatalogVariant[];
 updatedAt:string;
}
interface OtherCatalogState{
 items:OtherCatalogItem[];hydrated:boolean;saving:boolean;error:string|null;
 hydrate:()=>Promise<void>;
 addItem:()=>string;
 duplicateItem:(itemId:string)=>string|null;
 updateItem:(id:string,patch:Partial<OtherCatalogItem>)=>void;
 setItemsActive:(itemIds:readonly string[],active:boolean)=>void;
 addVariant:(id:string)=>void;
 updateVariant:(id:string,variantId:string,patch:Partial<OtherCatalogVariant>)=>void;
 duplicateVariant:(id:string,variantId:string)=>void;
 removeVariant:(id:string,variantId:string)=>void;
}
const KEY=scopedStorageKey('salesshop-catalog-other-v1');
const uid=(prefix:string)=>prefix+'_'+crypto.randomUUID();
let timer:number|undefined;
const num=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
function normalize(raw:unknown):OtherCatalogItem[]{
 if(!Array.isArray(raw))return [];
 return raw.flatMap((item):OtherCatalogItem[]=>{
  if(!item||typeof item!=='object')return [];
  const obj=item as Partial<OtherCatalogItem>;
  if(!obj.id||!obj.name)return [];
  const variants:OtherCatalogVariant[]=Array.isArray(obj.variants)?obj.variants.flatMap(v=>{
   if(!v||typeof v!=='object')return [];
   const variant=v as Partial<OtherCatalogVariant>;
   return [{id:variant.id||uid('other_variant'),label:variant.label||'Standard',
    sku:variant.sku,specification:variant.specification,
    material:variant.material,finish:variant.finish,
    availableColors:Array.isArray(variant.availableColors)?variant.availableColors.filter(
      (color):color is string=>typeof color==='string'&&Boolean(color.trim())):[],
    notes:variant.notes,internalCost:num(variant.internalCost),sellPrice:num(variant.sellPrice),
    active:variant.active!==false,default:variant.default===true}];
  }):[];
  if(!variants.length)variants.push({id:uid('other_variant'),label:'Standard',
   active:true,default:true,availableColors:[]});
  return [{id:obj.id,name:obj.name,category:obj.category||'Accessories',
    brand:obj.brand,supplier:obj.supplier,sku:obj.sku,unit:obj.unit,notes:obj.notes,
    active:obj.active!==false,variants:normalizeCatalogVariantDefaults(variants),
    updatedAt:obj.updatedAt||new Date().toISOString()}];
 });
}
function readLocal(){
 try{const raw=localStorage.getItem(KEY);return raw?normalize(JSON.parse(raw)):null;}
 catch{return null;}
}
function writeLocal(items:OtherCatalogItem[]){
 try{localStorage.setItem(KEY,JSON.stringify(items));}catch{/* optional fallback */}
}
async function saveCloud(items:OtherCatalogItem[]){
 const auth=useAuthStore.getState();
 if(auth.mode!=='cloud'||!auth.organizationId||!supabase)return;
 useOtherCatalogStore.setState({saving:true,error:null});
 try{
  const {data,error}=await supabase.from('organizations')
   .update({other_catalog:items,updated_at:new Date().toISOString()})
   .eq('id',auth.organizationId).select('id').maybeSingle();
  if(error||!data)throw new Error(error?.message||'Other catalog save was not confirmed.');
  useOtherCatalogStore.setState({error:null});
 }catch(e){
  useOtherCatalogStore.setState({error:e instanceof Error?e.message:'Other catalog save failed.'});
 }finally{
  useOtherCatalogStore.setState({saving:false});
 }
}
function scheduleSave(items:OtherCatalogItem[]){
 writeLocal(items);
 window.clearTimeout(timer);
 timer=window.setTimeout(()=>{void saveCloud(items);},600);
}
export const useOtherCatalogStore=create<OtherCatalogState>((set,get)=>({
 items:[],hydrated:false,saving:false,error:null,
 hydrate:async()=>{
  if(get().hydrated)return;
  const cached=readLocal();
  const auth=useAuthStore.getState();
  if(auth.mode!=='cloud'||!supabase||!auth.organizationId){
   set({items:cached??[],hydrated:true});return;
  }
  const {data,error}=await supabase.from('organizations')
   .select('other_catalog').eq('id',auth.organizationId).maybeSingle();
  if(error||!data){
   set({items:cached??[],hydrated:true,error:error?.message||'Unable to load the shared Other catalog.'});
   return;
  }
  const items=normalize(data.other_catalog);
  writeLocal(items);
  set({items,hydrated:true,error:null});
 },
 addItem:()=>{
  const id=uid('other_item'),time=new Date().toISOString();
  const next:OtherCatalogItem[]=[...get().items,{
   id,name:'New catalog item',category:'Accessories',unit:'each',active:true,updatedAt:time,
   variants:[{id:uid('other_variant'),label:'Standard',active:true,default:true}],
  }];
  set({items:next});scheduleSave(next);return id;
 },
 // A copy is a new sellable Catalog identity. Clear duplicated SKUs while
 // retaining dimensions/specifications and current selling prices.
 duplicateItem:(itemId)=>{
  const source=get().items.find(item=>item.id===itemId);
  if(!source)return null;
  const id=uid('other_item');
  const copy:OtherCatalogItem={
   ...structuredClone(source),id,name:`${source.name} copy`,
   sku:undefined,active:true,updatedAt:new Date().toISOString(),
   variants:normalizeCatalogVariantDefaults(source.variants.map(variant=>({
    ...structuredClone(variant),id:uid('other_variant'),sku:undefined,
   }))),
  };
  const next=[...get().items,copy];
  set({items:next});scheduleSave(next);return id;
 },
 updateItem:(id,patch)=>{
  const next:OtherCatalogItem[]=get().items.map(item=>item.id===id?{
   ...item,...patch,variants:normalizeCatalogVariantDefaults(patch.variants??item.variants),
   updatedAt:new Date().toISOString(),
  }:item);
  set({items:next});scheduleSave(next);
 },
 setItemsActive:(itemIds,active)=>{
  const selected=new Set(itemIds);
  if(!selected.size||!get().items.some(item=>selected.has(item.id)&&item.active!==active))return;
  const now=new Date().toISOString();
  const next:OtherCatalogItem[]=get().items.map(item=>
   selected.has(item.id)&&item.active!==active?{...item,active,updatedAt:now}:item);
  set({items:next});scheduleSave(next);
 },
 addVariant:(id)=>{
  const next:OtherCatalogItem[]=get().items.map(item=>item.id===id?{
   ...item,updatedAt:new Date().toISOString(),
   variants:normalizeCatalogVariantDefaults([...item.variants,{id:uid('other_variant'),
    label:'Variant '+(item.variants.length+1),active:true,default:false}]),
  }:item);
  set({items:next});scheduleSave(next);
 },
 updateVariant:(id,variantId,patch)=>{
  const next:OtherCatalogItem[]=get().items.map(item=>item.id===id?{
   ...item,updatedAt:new Date().toISOString(),
   variants:normalizeCatalogVariantDefaults(
    item.variants.map(variant=>variant.id===variantId?{...variant,...patch}:variant),
    patch.default?variantId:undefined,
   ),
  }:item);
  set({items:next});scheduleSave(next);
 },
 duplicateVariant:(id,variantId)=>{
  const next:OtherCatalogItem[]=get().items.map(item=>{
   if(item.id!==id)return item;
   const source=item.variants.find(variant=>variant.id===variantId);
   if(!source)return item;
   return {...item,updatedAt:new Date().toISOString(),variants:normalizeCatalogVariantDefaults([
    ...item.variants,{...structuredClone(source),id:uid('other_variant'),
      label:source.label+' copy',default:false}])};
  });
  set({items:next});scheduleSave(next);
 },
 removeVariant:(id,variantId)=>{
  const next:OtherCatalogItem[]=get().items.map(item=>{
   if(item.id!==id||item.variants.length<=1)return item;
   const variants=normalizeCatalogVariantDefaults(
    item.variants.filter(variant=>variant.id!==variantId));
   return {...item,variants,updatedAt:new Date().toISOString()};
  });
  set({items:next});scheduleSave(next);
 },
}));
