import { describe, expect, it } from 'vitest';
import type { QuoteLineMaterialReference } from '../types/quote';
import type { StockMaterial } from '../types/settings';
import { selectedMaterialCost } from './selectedMaterialCost';

const reference=(cost?:number):QuoteLineMaterialReference=>({
  materialId:'quartz-one',variantId:'3cm',purchaseOptionId:'supplier',
  stockProgram:true,pricingSource:'manual-line-rate',sourceCostPerSf:cost,
});
const materials:StockMaterial[]=[{
  id:'quartz-one',name:'Ashen White',materialType:'Quartz',stockProgram:true,
  active:true,unit:'sf',variants:[{
    id:'3cm',active:true,default:true,thickness:'3cm',
    purchaseOptions:[{id:'supplier',default:true,active:true,costPerSf:14.25,pricingBasis:'sf'}],
  }],
} as StockMaterial];

describe('mobile Area internal supplier cost comparison',()=>{
  it('shows the cost captured when chosen and labels a changed live Catalog price',()=>{
    const cost=selectedMaterialCost('Ashen White',reference(13.5),materials);
    expect(cost).toMatchObject({
      materialName:'Ashen White',quotedCostPerSf:13.5,
      currentCatalogCostPerSf:14.25,catalogCostChanged:true,materialType:'Quartz',
    });
    // A Catalog update must not implicitly overwrite the quote's captured cost.
    expect(reference(13.5).sourceCostPerSf).toBe(13.5);
  });
  it('uses the selected quote cost if no live catalog data is available',()=>{
    const cost=selectedMaterialCost('Ashen White',reference(13.5),[]);
    expect(cost.quotedCostPerSf).toBe(13.5);
    expect(cost.currentCatalogCostPerSf).toBeUndefined();
    expect(cost.catalogCostChanged).toBe(false);
  });
  it('does not substitute a default variant cost for a missing exact variant',()=>{
    const cost=selectedMaterialCost('Ashen White',{...reference(13.5),variantId:'missing'},materials);
    expect(cost.currentCatalogCostPerSf).toBeUndefined();
    expect(cost.quotedCostPerSf).toBe(13.5);
  });
  it('does not invent a cost for free-text materials or missing supplier prices',()=>{
    expect(selectedMaterialCost('Unlisted Quartz',undefined,materials)).toMatchObject({
      materialName:'Unlisted Quartz',quotedCostPerSf:undefined,
      currentCatalogCostPerSf:undefined,catalogCostChanged:false,
    });
  });
  it('uses current Catalog cost only as a separate reference for old quoted materials',()=>{
    const quoteRef={...reference(),sourceCostPerSf:undefined};
    const cost=selectedMaterialCost('Ashen White',quoteRef,materials);
    expect(cost.quotedCostPerSf).toBeUndefined();
    expect(cost.currentCatalogCostPerSf).toBe(14.25);
  });
});
