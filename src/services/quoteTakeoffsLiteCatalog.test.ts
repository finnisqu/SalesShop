import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SINK_CATALOG_SEED } from '../store/sinkCatalogStore';
import { createQuoteSinkSnapshot,sinkSnapshotDescription } from './quoteSinkSnapshot';
import { resolveStockMaterialCostReference } from '../types/settings';
import { createQuoteMaterialCostSnapshot } from './quoteMaterialSnapshot';
import { patchQuoteTakeoffSinks,patchQuoteTakeoffMaterial } from './quoteTakeoffsLite';
import type { Quote,QuoteLine,QuoteLineMaterialReference } from '../types/quote';
import type { StockMaterial } from '../types/settings';

const now='2026-10-12T18:00:00Z';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const quote=():Quote=>({
  id:'quote',quoteNumber:'DEMO',documentType:'quote',originalQuoteDate:'2026-10-12',
  quoteDate:'2026-10-12',revision:0,status:'Draft',title:'Kitchen',
  sections:[{id:'k',title:'Kitchen',customerVisible:true,scope:{countertopSf:20}}],
  lines:[
    {id:'custom',sectionId:'k',kind:'sink',description:'Manual sink',pricingMode:'direct',
      amount:90,customerVisible:true,includeInTotal:true},
    {id:'sf',sectionId:'k',kind:'item',description:'Top SF',pricingMode:'quantity-rate',
      quantity:20,rate:55,customerVisible:true,includeInTotal:true,
      quantitySource:{kind:'area-scope',field:'countertopSf',sectionId:'k',
        capturedValue:20,appliedAt:now,syncMode:'live'}},
  ],customerColumns:{quantity:true,rate:true,lineAmount:true},
  customerNotes:'',internalNotes:'',history:[],createdAt:now,updatedAt:now,
});
describe('Takeoffs Lite Catalog integration',()=>{
  it('resolves Material catalog variant, purchase program and captured cost snapshot without setting a sell rate',()=>{
    const material:StockMaterial={id:'m1',name:'Demo Quartz',brand:'Example Stone',
      materialType:'Quartz',stockProgram:true,unit:'sf',active:true,
      variants:[{id:'v1',active:true,default:true,thickness:'3cm',finish:'Polished',
        purchaseOptions:[{id:'o1',active:true,default:true,label:'Stock program',
          pricingBasis:'sf',costPerSf:19.5}]}],
    };
    const cost=resolveStockMaterialCostReference(material,'v1','o1');
    expect(cost.costPerSf).toBe(19.5);
    const snapshot=createQuoteMaterialCostSnapshot(material,cost,now);
    const reference:QuoteLineMaterialReference={
      materialId:material.id,variantId:'v1',purchaseOptionId:'o1',
      stockProgram:true,pricingSource:'manual-line-rate',
      sourceCostPerSf:cost.costPerSf,snapshot,
    };
    const result=patchQuoteTakeoffMaterial(quote(),'k','Example Stone · Demo Quartz · 3cm · Polished',reference);
    expect(result.sections[0].scope?.takeoffMaterialReference?.snapshot).toEqual(snapshot);
    expect(result.lines.find(l=>l.id==='sf')).toMatchObject({kind:'material',rate:55,
      materialReference:reference});
    expect(result.lines.find(l=>l.id==='custom')?.amount).toBe(90);
  });
  it('uses real Sink Catalog variant sell price when user explicitly opts into separate pricing',()=>{
    const model=SINK_CATALOG_SEED.find(model=>model.active&&model.variants.some(v=>v.active&&v.sellPrice!==undefined));
    expect(model).toBeDefined();
    const variant=model!.variants.find(v=>v.active&&v.sellPrice!==undefined)!;
    const snapshot=createQuoteSinkSnapshot(model!,variant,now);
    const reference={sinkModelId:model!.id,variantId:variant.id,snapshot};
    const selection={id:'takeoff-sink1',name:sinkSnapshotDescription(snapshot),
      category:model!.category,count:2,unitPrice:variant.sellPrice,
      includeInPricing:false,sinkReference:reference};
    const included=patchQuoteTakeoffSinks(quote(),'k',[selection]);
    expect(included.lines).toHaveLength(2);
    const priced=patchQuoteTakeoffSinks(included,'k',[{...selection,includeInPricing:true}]);
    const managed=priced.lines.find(l=>l.takeoffSinkId===selection.id) as QuoteLine;
    expect(managed).toMatchObject({kind:'sink',quantity:2,rate:variant.sellPrice,
      sinkReference:reference});
    expect(managed.sinkReference?.snapshot?.internalCost).toBe(snapshot.internalCost);
    expect(priced.lines.find(l=>l.id==='custom')?.amount).toBe(90);
    const notPriced=patchQuoteTakeoffSinks(priced,'k',[selection]);
    expect(notPriced.lines.find(l=>l.takeoffSinkId)).toBeUndefined();
    expect(notPriced.sections[0].scope?.takeoffSinks?.[0]?.sinkReference).toEqual(reference);
  });
  it('changes an Area Material reference only on a committed selection, preserving its selling rate',()=>{
    const current=quote();
    const material:StockMaterial={
      id:'m-2',name:'Black Quartz',materialType:'Quartz',
      active:true,stockProgram:true,unit:'sf',variants:[{
       id:'black',active:true,default:true,thickness:'3cm',
       purchaseOptions:[{id:'program',active:true,default:true,
        pricingBasis:'sf',costPerSf:26}],
      }],
    };
    const catalog=resolveStockMaterialCostReference(material,'black','program');
    const ref:QuoteLineMaterialReference={
      materialId:'m-2',variantId:'black',purchaseOptionId:'program',
      stockProgram:true,pricingSource:'manual-line-rate',
      sourceCostPerSf:catalog.costPerSf,
      snapshot:createQuoteMaterialCostSnapshot(material,catalog,now),
    };
    const selected=patchQuoteTakeoffMaterial(current,'k','Black Quartz',ref);
    const linked=selected.lines.find(l=>l.id==='sf')!;
    expect(linked).toMatchObject({kind:'material',rate:55,quantity:20,
      materialReference:ref});
    const custom=patchQuoteTakeoffMaterial(selected,'k','Custom Blue Marble');
    expect(custom.sections[0].scope).toMatchObject({
      takeoffMaterial:'Custom Blue Marble',
      takeoffMaterialReference:undefined,
    });
    expect(custom.lines.find(l=>l.id==='sf')).toMatchObject({
      kind:'item',description:'Custom Blue Marble',rate:55,quantity:20,
      materialReference:undefined,
    });
    expect(current.sections[0].scope?.takeoffMaterialReference).toBeUndefined();
    expect(current.lines.find(l=>l.id==='sf')?.rate).toBe(55);
  });
  it('keeps Material and Sink search drafts local until an explicit selection or custom commit',()=>{
    const picker=read('src/components/TakeoffCatalogPickers.tsx');
    const material=picker.split('export function TakeoffMaterialCatalog')[1]
      .split('export function TakeoffSinkCatalog')[0];
    const sink=picker.split('export function TakeoffSinkCatalog')[1];
    for(const source of [material,sink]){
      expect(source).toContain('value={open?searchTerm:value}');
      expect(source).toContain('onChange={e=>{setSearchTerm(e.target.value)');
      expect(source).not.toContain('onTextChange(e.target.value)');
      expect(source).toContain('onTextChange(name)');
      expect(source).toContain('onFocus={()=>{setSearchTerm(\'\');setOpen(true);}}');
      expect(source).toContain('qtl-search-preserved');
      expect(source).toContain('setOpen(false);setSearchTerm(\'\')');
    }
    expect(material).toContain('onSelect({');
    expect(material).toContain('if(resolved.variant?.id!==v.id');
    expect(material).toContain('onCustomCommit?.()');
    expect(sink).toContain('onSelect({name:sinkSnapshotDescription(snapshot)');
    expect(read('src/quote-takeoffs-lite.css')).toContain('max-height:min(29dvh,210px)');
  });
  it('uses the same catalog stores as Quote line selectors and mobile-safe search controls',()=>{
    const pickers=read('src/components/TakeoffCatalogPickers.tsx');
    const modal=read('src/components/QuoteTakeoffsLite.tsx');
    const css=read('src/quote-takeoffs-lite.css');
    expect(pickers).toContain('useCompanySettingsStore');
    expect(pickers).toContain('useSinkCatalogStore');
    expect(pickers).toContain('createQuoteMaterialCostSnapshot');
    expect(pickers).toContain('createQuoteSinkSnapshot');
    expect(modal).toContain('<TakeoffMaterialCatalog');
    expect(modal).toContain('<TakeoffSinkCatalog');
    expect(css).toContain('.qtl-catalog-choices');
    expect(css).toContain('min-height:45px');
  });
});
