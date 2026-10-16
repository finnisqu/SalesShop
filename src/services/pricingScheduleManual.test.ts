import {describe,expect,it} from 'vitest';
import type {PricingScheduleBuilderData,PricingManualAddon} from '../types/quote';
import {createPricingScheduleBuilderData,deriveBuilderCustomerItems,pricingBuilderHealth} from './pricingScheduleBuilder';
import {
  addManualAddon,addManualPackage,addManualPlan,duplicateManualPlan,
  effectiveManualAddonRate,manualAddonRows,manualPriceRow,
  removeManualPackage,removeManualPlan,setManualMatrixPrice,setManualPackageOffered,
  updateManualPackage,updateManualPlan,manualPricingHealth,
} from './pricingScheduleManual';
import {activeContractRows,contractScheduleHealth,deriveContractCustomerItems} from './pricingScheduleContract';
import {buildContractPricingXlsx} from './pricingScheduleContractXlsx';

function setup():PricingScheduleBuilderData{
  return addManualPlan(createPricingScheduleBuilderData(),{
    name:'Sanford',planNumber:'1183',series:'DRH-e',
  });
}
describe('manual pricing schedule',()=>{
  it('creates six offered, blank, independent prices for a house plan',()=>{
    const builder=setup();
    expect(builder.outputMode).toBe('contract');
    expect(builder.manualPlans).toHaveLength(1);
    expect(builder.manualPackages?.map(pkg=>pkg.code)).toEqual(['A','B','C','D','E','F']);
    expect(builder.contractRows).toHaveLength(6);
    expect(builder.contractRows?.[0]).toMatchObject({
      itemType:'Base',optionCode:'A',planName:'Sanford',
      priceMode:'manual',customerPrice:undefined,optionBehavior:'standalone',
    });
    expect(builder.contractRows?.[1]).toMatchObject({itemType:'Option',optionCode:'B'});
    expect(manualPricingHealth(builder)).toHaveLength(6);
    expect(deriveBuilderCustomerItems(builder).every(item=>item.customerPrice===undefined)).toBe(true);
  });
  it('allows zero but never silently substitutes it for a missing price',()=>{
    let builder=setup();
    const plan=builder.manualPlans![0],a=builder.manualPackages![0];
    builder=setManualMatrixPrice(builder,plan.id,a.id,0);
    expect(manualPriceRow(builder,plan.id,a.id)?.customerPrice).toBe(0);
    expect(contractScheduleHealth(builder).some(s=>s.includes('A needs a customer price'))).toBe(false);
    builder=setManualMatrixPrice(builder,plan.id,a.id,undefined);
    expect(manualPriceRow(builder,plan.id,a.id)?.customerPrice).toBeUndefined();
    expect(pricingBuilderHealth(builder).some(s=>s.includes('A needs a customer price'))).toBe(true);
    expect(()=>setManualMatrixPrice(builder,plan.id,a.id,-1)).toThrow();
  });
  it('can turn off a package without deleting its price, then restore it',()=>{
    let builder=setup();
    const plan=builder.manualPlans![0],pkg=builder.manualPackages![1];
    builder=setManualMatrixPrice(builder,plan.id,pkg.id,1750);
    builder=setManualPackageOffered(builder,plan.id,pkg.id,false);
    expect(activeContractRows(builder)).toHaveLength(5);
    expect(deriveContractCustomerItems(builder).some(x=>x.customerPrice===1750)).toBe(false);
    expect(manualPriceRow(builder,plan.id,pkg.id)?.customerPrice).toBe(1750);
    builder=setManualPackageOffered(builder,plan.id,pkg.id,true);
    expect(deriveContractCustomerItems(builder).some(x=>x.customerPrice===1750)).toBe(true);
  });
  it('updates package headings and plan labels without losing prices',()=>{
    let builder=setup();
    const plan=builder.manualPlans![0],pkg=builder.manualPackages![0];
    builder=setManualMatrixPrice(builder,plan.id,pkg.id,1234);
    builder=updateManualPlan(builder,plan.id,{name:'Sanford II',planNumber:'1184'});
    builder=updateManualPackage(builder,pkg.id,{code:'BASE',name:'Granite everywhere'});
    expect(manualPriceRow(builder,plan.id,pkg.id)).toMatchObject({
      planName:'Sanford II',planNumber:'1184',optionCode:'BASE',
      description:'Granite everywhere',customerPrice:1234,
    });
    expect(()=>updateManualPackage(builder,pkg.id,{code:'B'})).toThrow();
  });
  it('adds and removes package columns across all plans safely',()=>{
    let builder=setup();
    builder=addManualPlan(builder,{name:'Devon'});
    builder=addManualPackage(builder,'G','Kitchen waterfall');
    expect(builder.contractRows).toHaveLength(14);
    const pkg=builder.manualPackages?.find(p=>p.code==='G');
    expect(pkg).toBeDefined();
    expect(builder.contractRows?.filter(r=>r.manualPackageId===pkg?.id)).toHaveLength(2);
    builder=removeManualPackage(builder,pkg!.id);
    expect(builder.contractRows).toHaveLength(12);
  });
  it('copies measured scopes to a new plan, but not unreviewed approved prices',()=>{
    let builder=setup();
    const plan=builder.manualPlans![0],pkg=builder.manualPackages![0];
    builder=setManualMatrixPrice(builder,plan.id,pkg.id,1650);
    builder={...builder,contractRows:builder.contractRows!.map(r=>
      r.manualPlanId===plan.id&&r.manualPackageId===pkg.id?{
        ...r,quantities:{graniteKitchenSf:30},sourceCells:Array(40).fill(null),
      }:r)};
    builder=duplicateManualPlan(builder,plan.id);
    expect(builder.manualPlans).toHaveLength(2);
    const copy=builder.manualPlans![1];
    expect(copy.name).toBe('Sanford Copy');
    expect(manualPriceRow(builder,copy.id,pkg.id)?.quantities.graniteKitchenSf).toBe(30);
    expect(manualPriceRow(builder,copy.id,pkg.id)?.customerPrice).toBeUndefined();
    builder=removeManualPlan(builder,copy.id);
    expect(builder.contractRows).toHaveLength(6);
  });
  it('uses standard add-on rates with optional per-plan overrides and availability',()=>{
    let builder=setup();
    builder=addManualPlan(builder,{name:'Devon',planNumber:'1281'});
    builder=addManualAddon(builder,{name:'Double sink master',code:'DBL',unit:'flat',behavior:'increment'});
    const addon=builder.manualAddons![0],sanford=builder.manualPlans![0],devon=builder.manualPlans![1];
    const withRate:PricingManualAddon={...addon,defaultRate:180,planRates:{[devon.id]:215}};
    builder={...builder,manualAddons:[withRate]};
    expect(effectiveManualAddonRate(withRate,sanford.id)).toBe(180);
    expect(effectiveManualAddonRate(withRate,devon.id)).toBe(215);
    expect(manualAddonRows(builder)).toHaveLength(2);
    expect(manualAddonRows(builder).every(row=>row.optionBehavior==='increment')).toBe(true);
    expect(deriveBuilderCustomerItems(builder).filter(item=>item.itemType==='Add-on').map(x=>x.customerPrice)).toEqual([180,215]);
    builder={...builder,manualAddons:[{...withRate,excludedPlanIds:[devon.id]}]};
    expect(manualAddonRows(builder)).toHaveLength(1);
    expect(manualAddonRows(builder)[0].planName).toBe('Sanford');
    expect(manualAddonRows(builder)[0].description).toContain('additional charge');
  });
  it('prevents publishing unknown add-on prices until supplied or excluded',()=>{
    let builder=setup();
    const plan=builder.manualPlans![0];
    builder=addManualAddon(builder,{name:'Corbel',code:'CORBEL',unit:'each'});
    expect(manualPricingHealth(builder)).toContain('Sanford / CORBEL needs an add-on rate, or mark it Not offered.');
    builder={...builder,manualAddons:[{...builder.manualAddons![0],excludedPlanIds:[plan.id]}]};
    expect(manualPricingHealth(builder).some(v=>v.includes('CORBEL'))).toBe(false);
  });
  it('exports the complete manual price matrix, add-ons and internal plan rate sheet',async()=>{
    let builder=setup();
    const plan=builder.manualPlans![0],pkgs=builder.manualPackages!;
    builder=setManualMatrixPrice(builder,plan.id,pkgs[0].id,1285);
    builder=setManualMatrixPrice(builder,plan.id,pkgs[1].id,1435);
    builder=addManualAddon(builder,{name:'Master double sink',code:'DBL',unit:'flat'});
    builder={...builder,manualAddons:[{...builder.manualAddons![0],defaultRate:180}]};
    const workbook=await buildContractPricingXlsx(builder);
    const sheet=workbook.getWorksheet('Contract Pricing')!;
    expect(sheet.getCell('G5').value).toBe(1285);
    expect(sheet.getCell('G6').value).toBe(1435);
    expect(sheet.getCell('F11').value).toContain('Master double sink');
    expect(sheet.getCell('G11').value).toBe(180);
    expect(sheet.getCell('AO11').value).toBe('Additional charge');
    const rates=workbook.getWorksheet('Add-on Rate Book')!;
    expect(rates.getCell('B3').value).toBe('Master double sink');
    expect(rates.getCell('E3').value).toBe(180);
    expect(rates.getCell('F3').value).toBe(180);
  });
});
