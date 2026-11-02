import type {Quote,QuoteSection,QuoteSlabPool} from '../types/quote';
import {roundCurrency} from '../types/quote';
import {totalBillableTakeoffSf} from './quoteTakeoffsLite';

const finitePositive=(x:number)=>Number.isFinite(x)&&x>0;
const areaOf=(section:QuoteSection)=>totalBillableTakeoffSf(section.scope?.takeoffPieces??[]);
/** A slab pool requires a matching material, variant, finish, thickness and purchasing option.
 * No inferred interchangeability across different material/supplier catalog variants. */
export function slabPoolMaterialKey(section:QuoteSection):string|null{
 const scope=section.scope;
 const ref=scope?.takeoffMaterialReference;
 const snap=ref?.snapshot;
 // Free-text labels are not safe identities: two vendors may both sell a
 // material called "White Quartz" with incompatible slabs and pricing.
 const id=(snap?.materialId??ref?.materialId??'').trim().toLowerCase();
 if(!id)return null;
 return JSON.stringify([
   id,snap?.brand??'',snap?.supplier??'',snap?.variantId??ref?.variantId??'',
   snap?.thickness??'',snap?.finish??'',snap?.purchaseOptionId??ref?.purchaseOptionId??'',
   snap?.formatKind??'',snap?.formatName??'',snap?.lengthIn??null,snap?.widthIn??null,
 ]);
}
export interface SlabPoolEstimate {
 pool:QuoteSlabPool;valid:boolean;reason?:string;materialKey:string;
 measuredSf:number;slabCount?:number;independentSlabCount:number;
 totalBuyingCost?:number;allocation:Record<string,number>;
 /** Fractional buying quantity per Area (not a separate physical purchase). */
 fractionalSlabs:Record<string,number>;
}
export function estimateQuoteSlabPool(quote:Quote,pool:QuoteSlabPool):SlabPoolEstimate{
 const allocation:Record<string,number>={},fractionalSlabs:Record<string,number>={};
 const invalid=(reason:string):SlabPoolEstimate=>({
   pool,valid:false,reason,materialKey:pool.materialKey,
   measuredSf:0,independentSlabCount:0,allocation,fractionalSlabs,
 });
 if(!Array.isArray(pool.sectionIds)||new Set(pool.sectionIds).size!==pool.sectionIds.length
   ||pool.sectionIds.length<2||pool.sectionIds.length>50)return invalid('Choose 2–50 different Areas.');
 if(!finitePositive(pool.slabAreaSf)||!Number.isFinite(pool.slabCost)||pool.slabCost<0
   ||!finitePositive(pool.yield)||pool.yield>1)return invalid('Enter slab size, buying cost and yield.');
 const areas=pool.sectionIds.map(id=>quote.sections.find(s=>s.id===id));
 if(areas.some(a=>!a))return invalid('An Area in this pool no longer exists.');
 const sections=areas as QuoteSection[];
 if(sections.some(a=>slabPoolMaterialKey(a)!==pool.materialKey))
   return invalid('The Areas no longer share the same material and variant.');
 const sf=sections.map(areaOf);
 if(sf.some(value=>!finitePositive(value)))return invalid('Measure all Areas before pooling slabs.');
 const total=sf.reduce((a,b)=>a+b,0);
 const minimumCount=Math.ceil(total/(pool.slabAreaSf*pool.yield));
 const count=pool.slabCountOverride??minimumCount;
 if(!Number.isInteger(count)||count<1||count>100000)
   return invalid('Use a positive whole-slab count.');
 if(count<minimumCount)
   return invalid('Manual slab count is below the minimum implied by combined SF and usable yield. Adjust yield or purchase count.');
 const other=quote.slabPools??[];
 if(other.some(p=>p.id!==pool.id&&p.sectionIds.some(id=>pool.sectionIds.includes(id))))
   return invalid('An Area is already assigned to another slab pool.');
 // Allocate integer cents deterministically: sum of Area allocations equals one purchase.
 const cents=Math.round(roundCurrency(count*pool.slabCost)*100);
 let allocated=0;
 sections.forEach((section,index)=>{
   const portion=index===sections.length-1?cents-allocated:Math.round(cents*sf[index]/total);
   allocated+=portion;allocation[section.id]=portion/100;
   fractionalSlabs[section.id]=count*sf[index]/total;
 });
 const independent=sf.reduce((sum,amount)=>sum+Math.ceil(amount/(pool.slabAreaSf*pool.yield)),0);
 return {pool,valid:true,materialKey:pool.materialKey,measuredSf:total,
   independentSlabCount:independent,slabCount:count,
   totalBuyingCost:cents/100,allocation,fractionalSlabs};
}
export function quoteSharedSlabEstimates(quote:Quote):SlabPoolEstimate[]{
 return (quote.slabPools??[]).map(pool=>estimateQuoteSlabPool(quote,pool));
}
/** Automatically share whole-slab buying for measured Areas with the same exact Catalog
 * material/variant and identical purchasing inputs. This is a derived estimate:
 * no quote mutation, no cloud migration and no change to customer selling prices.
 * Areas lacking safe Catalog identity, dimensions or buying cost remain independent. */
export function effectiveQuoteSlabEstimates(quote:Quote):SlabPoolEstimate[]{
 const explicit=quoteSharedSlabEstimates(quote);
 const occupied=new Set((quote.slabPools??[]).flatMap(pool=>pool.sectionIds));
 const compatible=new Map<string,{areas:QuoteSection[];size:number;cost:number;yield:number;key:string}>();
 for(const area of quote.sections){
  if(occupied.has(area.id)||!finitePositive(areaOf(area)))continue;
  const key=slabPoolMaterialKey(area);
  if(!key)continue;
  const scope=area.scope,ref=scope?.takeoffMaterialReference,snap=ref?.snapshot;
  // A manual Area purchasing-count override signals a deliberate exception.
  // Leave it independent unless the seller explicitly creates a pool.
  if(scope?.slabCountOverride!==undefined||
     scope?.slabPurchaseQuantityOverride!==undefined)continue;
  const size=scope?.slabAreaOverrideSf??snap?.areaSf??
   (snap?.lengthIn&&snap?.widthIn?snap.lengthIn*snap.widthIn/144:undefined);
  const cost=scope?.slabCostOverride??ref?.sourceSlabCost??snap?.slabCost??ref?.catalogSlabCost;
  const yieldFraction=scope?.slabYield??.65;
  if(size===undefined||!finitePositive(size)||cost===undefined||
   !Number.isFinite(cost)||cost<0||!finitePositive(yieldFraction)||yieldFraction>1)continue;
  const groupKey=JSON.stringify([key,size,cost,yieldFraction]);
  const group=compatible.get(groupKey);
  if(group)group.areas.push(area);
  else compatible.set(groupKey,{key,size,cost,yield:yieldFraction,areas:[area]});
 }
 const automatic:SlabPoolEstimate[]=[];
 for(const group of compatible.values()){
  if(group.areas.length<2)continue;
  // The estimator rejects overlapping explicit pools and allocates cents
  // deterministically across the measured Areas.
  const pool:QuoteSlabPool={id:'auto:'+group.areas.map(a=>a.id).sort().join(':'),
   label:'Auto-shared slabs',sectionIds:group.areas.map(a=>a.id),
   materialKey:group.key,slabAreaSf:group.size,slabCost:group.cost,yield:group.yield};
  const estimate=estimateQuoteSlabPool(quote,pool);
  if(estimate.valid)automatic.push(estimate);
 }
 return [...explicit,...automatic];
}

export function allocatedSharedSlabCost(quote:Quote,areaId:string):
 {cost:number;purchaseSlabs:number;physicalSlabs:number;poolLabel:string;unitSlabCost:number;slabAreaSf:number}|null{
 const match=effectiveQuoteSlabEstimates(quote)
   .find(group=>group.valid&&Object.prototype.hasOwnProperty.call(group.allocation,areaId));
 if(!match)return null;
 return {cost:match.allocation[areaId],purchaseSlabs:match.fractionalSlabs[areaId],
   physicalSlabs:match.slabCount!,poolLabel:match.pool.label,
   unitSlabCost:match.pool.slabCost,slabAreaSf:match.pool.slabAreaSf};
}
export function createQuoteSlabPool(quote:Quote,selectedIds:readonly string[],spec:{
 id:string;label:string;slabAreaSf:number;slabCost:number;yield:number;slabCountOverride?:number;
}):QuoteSlabPool|null{
 const unique=[...new Set(selectedIds)];
 if(unique.length!==selectedIds.length||unique.length<2||unique.length>50)return null;
 const first=quote.sections.find(a=>a.id===unique[0]);
 if(!first)return null;
 const key=slabPoolMaterialKey(first);
 if(!key||unique.some(id=>{
   const area=quote.sections.find(a=>a.id===id);
   return !area||slabPoolMaterialKey(area)!==key;
 }))return null;
 const candidate:QuoteSlabPool={...spec,sectionIds:unique,materialKey:key,
   label:spec.label.trim().slice(0,100)||'Shared slabs'};
 return estimateQuoteSlabPool(quote,candidate).valid?candidate:null;
}

/** Read explicit pool metadata embedded in quote_sections.scope JSONB.
 * Cloud sync has no quote-level slab_pools column; never infer a pool
 * from matching material automatically. */
export function slabPoolsFromAreaScopes(sections:readonly QuoteSection[]):QuoteSlabPool[]{
 const seen=new Set<string>(),pools:QuoteSlabPool[]=[];
 for(const section of sections){
   const value:unknown=section.scope?.sharedSlabPool;
   if(!value||typeof value!=='object')continue;
   const item=value as Record<string,unknown>;
   if(typeof item.id!=='string'||item.id.length>100||seen.has(item.id)
     ||typeof item.label!=='string'||item.label.length>100
     ||typeof item.materialKey!=='string'||item.materialKey.length>500
     ||!Array.isArray(item.sectionIds)||item.sectionIds.length<2||item.sectionIds.length>50
     ||item.sectionIds.some(id=>typeof id!=='string'||id.length>150)
     ||typeof item.slabAreaSf!=='number'||!finitePositive(item.slabAreaSf)
     ||typeof item.slabCost!=='number'||!Number.isFinite(item.slabCost)||item.slabCost<0
     ||typeof item.yield!=='number'||!finitePositive(item.yield)||item.yield>1
     ||(item.slabCountOverride!==undefined&&
       (typeof item.slabCountOverride!=='number'||!Number.isInteger(item.slabCountOverride)
         ||item.slabCountOverride<1)))continue;
   seen.add(item.id);
   pools.push({id:item.id,label:item.label,materialKey:item.materialKey,
     sectionIds:[...item.sectionIds] as string[],slabAreaSf:item.slabAreaSf,
     slabCost:item.slabCost,yield:item.yield,
     ...(item.slabCountOverride!==undefined?{slabCountOverride:item.slabCountOverride as number}:{})});
 }
 return pools;
}
