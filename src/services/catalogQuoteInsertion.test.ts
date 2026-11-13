import { describe, expect, it } from 'vitest';
import { buildCatalogQuoteLinePatch, validateCatalogQuoteQuantity,
 validateCatalogQuoteSource } from './catalogQuoteInsertion';
import type {OtherCatalogItem} from '../store/otherCatalogStore';
import type { StockMaterial } from '../types/settings';
import type { SinkModel } from '../types/sink';
import type { RateBookItem } from '../types/rateBook';

const material = {
  id: 'stone1', name: 'Calacatta Test', brand: 'Supplier A', materialType: 'Quartz', stockProgram: true, unit: 'sf', active: true,
  variants: [{
    id: 'slab1', active: true, default: true, thickness: '3cm', finish: 'Polished',
    formatKind: 'slab', lengthIn: 120, widthIn: 60,
    purchaseOptions: [{
      id: 'program1', active: true, default: true, label: 'Stock slab', pricingBasis: 'sf', costPerSf: 9.5,
    }],
  }],
} as StockMaterial;
const sink = {
  id: 'model1', name: '3218 Sink', category: 'kitchen', active: true, createdAt: '', updatedAt: '', variants: [{
    id: 'v1', label: 'Single', configuration: 'single', ada: false, active: true, default: true,
    internalCost: 110, sellPrice: 220, history: [],
  }],
} as SinkModel;
const rate = {
  id: 'rate1', name: 'Install', category: 'fabrication-install', unit: 'sf',
  pricingBehavior: 'suggested', internalCost: 3, sellRate: 5, divisionOverrides: [],
  active: true, history: [], createdAt: '', updatedAt: '',
} as RateBookItem;

describe('Catalog to Quotes snapshots', () => {
  it('copies material source costs internally without creating customer sell prices', () => {
    const patch = buildCatalogQuoteLinePatch({ kind: 'material', material }, { variantId: 'slab1', quantity: 30 });
    expect(patch.description).toContain('Calacatta Test');
    expect(patch.materialReference?.snapshot?.costPerSf).toBe(9.5);
    expect(patch.materialReference?.snapshot?.variantId).toBe('slab1');
    expect(patch.materialReference?.sourceCostPerSf).toBe(9.5);
    expect(patch.materialReference?.pricingSource).toBe('manual-line-rate');
    expect(patch.quantity).toBe(30);
    expect(patch.rate).toBeUndefined();
    expect(patch.amount).toBeUndefined();
  });

  it('captures exact sink variant sell price and its private cost', () => {
    const patch = buildCatalogQuoteLinePatch({ kind: 'sink', model: sink, variantId: 'v1' });
    expect(patch.sinkReference?.snapshot?.sinkModelId).toBe('model1');
    expect(patch.sinkReference?.snapshot?.internalCost).toBe(110);
    expect(patch.rate).toBe(220);
    expect(patch.quantity).toBe(1);
  });

  it('uses existing rate pricing behavior and allows quantity to be entered later', () => {
    const patch = buildCatalogQuoteLinePatch({ kind: 'rate', item: rate });
    expect(patch.rateReference?.snapshot?.rateBookItemId).toBe('rate1');
    expect(patch.rate).toBe(5);
    expect(patch.quantity).toBeUndefined();
  });

  it('inserts OTHER catalog product variants with private cost and immutable sell snapshot',()=>{
    const other:OtherCatalogItem={
      id:'other1',name:'Faucet upgrade',category:'Plumbing',unit:'each',
      brand:'Acme',active:true,updatedAt:'2026-11-12',
      variants:[{id:'chrome',label:'Chrome',default:true,active:true,
        internalCost:30,sellPrice:65,material:'Brass'}],
    };
    const line=buildCatalogQuoteLinePatch({kind:'other',item:other,variantId:'chrome'},{quantity:2});
    expect(line).toMatchObject({
      description:'Acme Faucet upgrade · Chrome',
      pricingMode:'quantity-rate',quantity:2,rate:65,
      unitCost:30,customerVisible:true,includeInTotal:true,
      otherReference:{itemId:'other1',variantId:'chrome',
        snapshot:{internalCost:30,sellPrice:65}},
    });
    expect(line.amount).toBeUndefined();
    other.variants[0].sellPrice=75;
    expect(line.rate).toBe(65);
  });

  it('rejects inactive or removed variant selections instead of defaulting to a different SKU',()=>{
    const staleSink:SinkModel={...sink,variants:[
      ...sink.variants,{...sink.variants[0],id:'retired',active:false,default:false}]};
    expect(()=>buildCatalogQuoteLinePatch({kind:'sink',model:staleSink,variantId:'retired'}))
      .toThrow(/inactive or no longer available/);
    expect(()=>buildCatalogQuoteLinePatch({kind:'sink',model:{...sink,active:false}}))
      .toThrow(/inactive/);
    const staleMaterial:StockMaterial={...material,variants:[
      ...material.variants!,{...material.variants![0],id:'retired',active:false,default:false}]};
    expect(()=>buildCatalogQuoteLinePatch({kind:'material',material:staleMaterial,variantId:'retired'}))
      .toThrow(/inactive or no longer available/);
    expect(()=>buildCatalogQuoteLinePatch({kind:'material',material},{purchaseOptionId:'not-found'}))
      .toThrow(/purchase program is inactive/);
    expect(()=>buildCatalogQuoteLinePatch({kind:'rate',item:{...rate,active:false}}))
      .toThrow(/inactive/);
    const other:OtherCatalogItem={
      id:'other1',name:'Shelf',category:'Accessories',unit:'each',active:true,
      updatedAt:'2026-11-12',variants:[
        {id:'default',label:'Standard',active:true,default:true},
        {id:'retired',label:'Old',active:false,default:false},
      ],
    };
    expect(()=>buildCatalogQuoteLinePatch({kind:'other',item:other,variantId:'retired'}))
      .toThrow(/inactive or no longer available/);
    expect(()=>buildCatalogQuoteLinePatch({kind:'other',item:{...other,active:false}}))
      .toThrow(/inactive/);
    expect(()=>validateCatalogQuoteSource({kind:'other',item:other},'default')).not.toThrow();
  });

  it('rejects invalid purchase quantities before pricing',()=>{
    for(const amount of [0,-1,Number.NaN,Number.POSITIVE_INFINITY,1_000_001])
      expect(()=>validateCatalogQuoteQuantity(amount)).toThrow(/positive quantity/);
    expect(()=>validateCatalogQuoteQuantity(undefined)).not.toThrow();
    expect(()=>buildCatalogQuoteLinePatch({kind:'sink',model:sink},{quantity:-2}))
      .toThrow(/positive quantity/);
  });

  it('keeps internal-only rate references out of customer totals', () => {
    const patch = buildCatalogQuoteLinePatch({ kind: 'rate', item: {
      ...rate, pricingBehavior: 'cost-reference',
    } });
    expect(patch.customerVisible).toBe(false);
    expect(patch.includeInTotal).toBe(false);
    expect(patch.rate).toBeUndefined();
  });
});
