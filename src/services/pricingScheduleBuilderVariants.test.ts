import {describe,expect,it} from 'vitest';
import type {PricingScheduleBuilderData,PricingOptionPackage,PricingPlan,PricingPlanTakeoff,PricingRateItem} from '../types/quote';
import {
  calculatePlanOption,deriveBuilderCustomerItems,includedPricingTakeoffs,
  pricingBuilderHealth,pricingTakeoffGroups,
} from './pricingScheduleBuilder';

function fixtures(){
  const rates:PricingRateItem[]=[
    {id:'marble',name:'Cultured Marble',kind:'material-level',materialType:'Cultured Marble',
      productType:'Countertops',unit:'sf',rate:20},
    {id:'granite',name:'Granite',kind:'material-level',materialType:'Granite',
      productType:'Countertops',unit:'sf',rate:25},
    {id:'quartz',name:'Quartz',kind:'material-level',materialType:'Quartz',
      productType:'Countertops',unit:'sf',rate:32},
    {id:'kitchenSink',name:'Kitchen sink',kind:'add-on',productType:'Kitchen Sink',unit:'each',rate:200},
    {id:'vanitySink',name:'Vanity bowl',kind:'add-on',productType:'Vanity Sink',unit:'each',rate:70},
    {id:'extra',name:'Special faucet drilling',kind:'add-on',productType:'Other',unit:'flat',rate:35},
  ];
  const plan:PricingPlan={id:'sanford',planNumber:'1183',name:'Sanford'};
  const takeoffs:PricingPlanTakeoff[]=[
    {id:'k',planId:'sanford',room:'Kitchen',piece:'Countertop',squareFeet:30,kitchenSinks:1},
    {id:'ks',planId:'sanford',room:'Kitchen',piece:'Backsplash',category:'Backsplash',squareFeet:6},
    {id:'bath',planId:'sanford',room:'Hall Bathroom',piece:'Vanity Top',squareFeet:12,vanityBowls:1},
    {id:'bs',planId:'sanford',room:'Hall Bathroom',piece:'Backsplash',category:'Backsplash',squareFeet:3},
    {id:'master-base',planId:'sanford',room:'Master Bathroom',piece:'Vanity Top',
      variantGroup:'Master Vanity',variantCode:'BASE',length:48,width:22,vanityBowls:1},
    {id:'master-double',planId:'sanford',room:'Master Bathroom',piece:'Vanity Top',
      variantGroup:'Master Vanity',variantCode:'DOUBLE',length:72,width:22,vanityBowls:2},
  ];
  const basic:PricingOptionPackage={id:'A',code:'A',name:'All granite',
    kitchenMaterialRateId:'granite',bathroomMaterialRateId:'marble',
    includeKitchenSplash:true,includeBathroomSplash:true,
    rules:[],flatAdjustment:0,isBase:true};
  const next:PricingOptionPackage={...basic,id:'B',code:'B',name:'Bath splash / double',
    includeKitchenSplash:false,takeoffVariants:{'Master Vanity':'DOUBLE'}};
  const builder:PricingScheduleBuilderData={
    rateBookName:'Example',outputMode:'matrix',rates,options:[basic,next],plans:[plan],takeoffs,
  };
  return {builder,plan,basic,next};
}
describe('calculated builder universal material rates and selectable takeoffs',()=>{
  it('uses one material SF rate for kitchen tops and kitchen splash, likewise bathrooms',()=>{
    const {builder,plan,basic}=fixtures();
    const calc=calculatePlanOption(builder,plan,basic);
    expect(calc.warnings).toEqual([]);
    expect(calc.total).toBeCloseTo(1686.6667,3);
    expect(calc.lines.filter(l=>l.productType==='Backsplash')).toHaveLength(2);
    expect(calc.lines.find(l=>l.id==='ks-Backsplash-Backsplash')?.rate).toBe(25);
    expect(calc.lines.find(l=>l.id==='bs-Backsplash-Backsplash')?.rate).toBe(20);
    expect(calc.lines.find(l=>l.id==='master-base-Countertops-Vanity Top')?.rate).toBe(20);
    expect(calc.lines.some(l=>l.id.startsWith('master-double-'))).toBe(false);
    expect(pricingTakeoffGroups(builder,'sanford')).toEqual([{
      name:'Master Vanity',codes:['BASE','DOUBLE'],defaultCode:'BASE',
    }]);
  });
  it('DOUBLE replaces BASE including SF and bowl count; kitchen splash can be excluded',()=>{
    const {builder,plan,next}=fixtures();
    const calc=calculatePlanOption(builder,plan,next);
    expect(calc.warnings).toEqual([]);
    expect(calc.total).toBeCloseTo(1680,3);
    expect(calc.lines.some(l=>l.id.startsWith('master-base-'))).toBe(false);
    expect(calc.lines.some(l=>l.id.startsWith('master-double-'))).toBe(true);
    expect(calc.lines.find(l=>l.id==='master-double-Vanity Sink-Vanity bowl')?.quantity).toBe(2);
    expect(calc.lines.some(l=>l.id.startsWith('ks-'))).toBe(false);
    expect(calc.lines.find(l=>l.id==='bs-Backsplash-Backsplash')?.rate).toBe(20);
    expect(includedPricingTakeoffs(builder,plan,next).takeoffs).toHaveLength(4);
  });
  it('allows quartz everywhere, excludes bath splashes, and adds a flat package extra once',()=>{
    const {builder,plan,basic}=fixtures();
    const option:PricingOptionPackage={...basic,kitchenMaterialRateId:'quartz',
      bathroomMaterialRateId:'quartz',includeBathroomSplash:false,
      extraRateQuantities:{extra:3}};
    const calc=calculatePlanOption(builder,plan,option);
    expect(calc.warnings).toEqual([]);
    expect(calc.lines.filter(l=>l.productType==='Backsplash')).toHaveLength(1);
    expect(calc.lines.find(l=>l.room==='Option extras')).toMatchObject({
      quantity:1,unit:'Flat',rate:35,amount:35,
    });
    expect(calc.total).toBeCloseTo(32*(30+6+12+(48*22/144))+200+2*70+35,3);
  });
  it('does not invent a price when variant is missing or measurements are incomplete',()=>{
    const {builder,plan,basic,next}=fixtures();
    const missingWidth:PricingScheduleBuilderData={...builder,takeoffs:builder.takeoffs.map(t=>
      t.id==='master-double'?{...t,width:undefined}:t)};
    const incomplete=calculatePlanOption(missingWidth,plan,next);
    expect(incomplete.total).toBeUndefined();
    expect(incomplete.warnings.some(w=>w.includes('needs both length and width'))).toBe(true);
    const missingVariant:PricingScheduleBuilderData={...builder,takeoffs:builder.takeoffs
      .filter(t=>t.id!=='master-base').map(t=>t.variantGroup?{...t,variantCode:'DOUBLE'}:t)};
    const unknown=calculatePlanOption(missingVariant,plan,basic);
    expect(unknown.total).toBeUndefined();
    expect(unknown.warnings.some(w=>w.includes('Select an available Master Vanity'))).toBe(true);
  });
  it('requires material assignment when multiple eligible rates exist',()=>{
    const {builder,plan,basic}=fixtures();
    const none={...basic,kitchenMaterialRateId:undefined};
    const calc=calculatePlanOption(builder,plan,none);
    expect(calc.total).toBeUndefined();
    expect(calc.warnings.some(w=>w.includes('No Countertops rate is assigned for Kitchen'))).toBe(true);
    const items=deriveBuilderCustomerItems({...builder,options:[none]});
    expect(items[0].customerPrice).toBeUndefined();
    expect(pricingBuilderHealth({...builder,options:[none]}).some(w=>w.includes('Kitchen'))).toBe(true);
  });
});
