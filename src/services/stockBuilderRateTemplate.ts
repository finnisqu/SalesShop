import type {StockMaterial} from '../types/settings';
import {resolveStockMaterialCostReference} from '../types/settings';
import type {MaterialLevelGuideDocument,MaterialLevelRule} from '../types/materialLevelGuide';
import {resolveMaterialPricingRecommendation} from '../types/materialLevelGuide';
import type {PricingMaterialType,PricingRateItem,PricingScheduleBuilderData} from '../types/quote';
import {createPricingRateItem} from './pricingScheduleBuilder';
import {selectableBuilderLevels} from './builderLevelRate';

export type StockLevelImport = NonNullable<PricingScheduleBuilderData['stockLevelImport']>;
export interface StockLevelTemplateResult {
  rates:PricingRateItem[];
  summary:StockLevelImport;
}
const eligible=(m:StockMaterial)=>m.active&&m.stockProgram;
function displayColor(material:StockMaterial,duplicates:Set<string>):string{
  return duplicates.has(material.name.trim().toLowerCase())&&material.brand?.trim()
    ?material.brand.trim()+' · '+material.name.trim():material.name.trim();
}
/**
 * Capture company's builder-level sell prices + assigned stocked colors.
 * - Explicit material level assignment wins over automatic cost-band suggestion.
 * - Price is always the GUIDE SELL RATE, never the supplier's buy cost.
 * - Unsupported, unpriced, or unassigned materials are reported, not silently priced.
 * - Active level tiers without stocked colors are omitted, rather than representing
 *   non-approved colors as if they were stocked.
 */
export function snapshotStockBuilderLevels(
  materials:StockMaterial[],
  guide:Pick<MaterialLevelGuideDocument,'id'|'name'|'updatedAt'|'rules'|'slabPricingThresholdCostPerSf'|'slabPricingMultiplier'>,
):StockLevelTemplateResult{
  const stock=materials.filter(eligible);
  const rules=selectableBuilderLevels(guide.rules);
  const grouped=new Map<string,{rule:MaterialLevelRule;type:PricingMaterialType;colors:StockMaterial[]}>();
  const unassigned:StockLevelImport['unassigned']=[];
  const nameCounts=new Map<string,number>();
  stock.forEach(m=>nameCounts.set(m.name.trim().toLowerCase(),(nameCounts.get(m.name.trim().toLowerCase())??0)+1));
  const duplicates=new Set([...nameCounts].filter(([,count])=>count>1).map(([name])=>name));
  for(const material of stock){
    const explicit=material.builderLevelId?.trim();
    const sourceCost=resolveStockMaterialCostReference(material).costPerSf;
    // Guide's automatic bands are intended for granite/quartz. Other
    // material families must have an explicit approved assignment.
    const automaticallyEligible=material.materialType==='Granite'||material.materialType==='Quartz';
    const selected=explicit
      ?rules.find(r=>r.id===explicit)
      :automaticallyEligible
        ?resolveMaterialPricingRecommendation(guide,sourceCost,undefined,material.materialType).mode==='level'
          ?rules.find(r=>r.id===resolveMaterialPricingRecommendation(guide,sourceCost,undefined,material.materialType).level.rule.id)
          :undefined
        :undefined;
    if(!selected){
      let reason:string;
      if(explicit)reason='Assigned builder level is missing or inactive in the company guide.';
      else if(!automaticallyEligible)reason='Assign an approved builder level for this material type.';
      else if(sourceCost===undefined)reason='No level assigned and no usable default purchase cost per SF.';
      else if(sourceCost>guide.slabPricingThresholdCostPerSf)reason='Purchase cost is above the level guide; review slab pricing or assign a level.';
      else reason='No approved active level covers its material cost.';
      unassigned.push({materialId:material.id,name:material.name,reason});
      continue;
    }
    if(selected.graniteOnly&&material.materialType!=='Granite'){
      unassigned.push({materialId:material.id,name:material.name,
        reason:selected.label+' is reserved for Granite; select a compatible level.'});
      continue;
    }
    const key=selected.id+'::'+material.materialType;
    if(!grouped.has(key))grouped.set(key,{rule:selected,type:material.materialType,colors:[]});
    grouped.get(key)!.colors.push(material);
  }
  const rank=new Map(rules.map((r,i)=>[r.id,i]));
  const rows=[...grouped.values()].sort((a,b)=>
    (rank.get(a.rule.id)??999)-(rank.get(b.rule.id)??999)||a.type.localeCompare(b.type));
  const rates=rows.map(({rule,type,colors})=>{
    const item=createPricingRateItem('Countertops','material-level');
    const ordered=colors.slice().sort((a,b)=>a.name.localeCompare(b.name)||String(a.brand).localeCompare(String(b.brand)));
    return {...item,
      name:rule.label+' '+type,
      materialType:type,
      level:rule.label,
      unit:'sf' as const,
      rate:rule.customerRate,
      suggestedRate:rule.customerRate,
      priceMode:'priced' as const,
      customerVisible:true,
      showLevelOnCustomer:true,
      detailsLayout:'list' as const,
      sourceBuilderLevelRuleId:rule.id,
      sourceBuilderLevelGuideUpdatedAt:guide.updatedAt,
      colorIds:ordered.map(m=>m.id),
      colors:ordered.map(m=>displayColor(m,duplicates)),
      colorsText:ordered.map(m=>displayColor(m,duplicates)).join('\n'),
    } satisfies PricingRateItem;
  });
  return {rates,summary:{
    guideName:guide.name,guideUpdatedAt:guide.updatedAt,
    stockCount:stock.length,
    assignedCount:stock.length-unassigned.length,
    levelCount:rates.length,
    unassigned,
  }};
}
