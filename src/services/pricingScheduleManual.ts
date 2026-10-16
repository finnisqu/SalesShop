import type {
  PricingContractRow,PricingManualAddon,PricingManualPackage,
  PricingManualPlan,PricingScheduleBuilderData,PricingScheduleItem,
} from '../types/quote';

const id=()=>crypto.randomUUID();
const trim=(value:string)=>value.trim();
const asContract=(builder:PricingScheduleBuilderData):PricingScheduleBuilderData=>({
  ...builder,outputMode:'contract',
});
export function standardManualPackages():PricingManualPackage[]{
  return [
    ['A','Granite kitchen + granite baths · all splashes'],
    ['B','Granite kitchen + granite baths · bath splashes only'],
    ['C','Granite kitchen + quartz baths · all splashes'],
    ['D','Granite kitchen + quartz baths · bath splashes only'],
    ['E','Quartz kitchen + quartz baths · all splashes'],
    ['F','Quartz kitchen + quartz baths · bath splashes only'],
  ].map(([code,name])=>({id:id(),code,name}));
}
function optionRow(plan:PricingManualPlan,pkg:PricingManualPackage,index:number):PricingContractRow{
  return {
    id:id(),manualPlanId:plan.id,manualPackageId:pkg.id,
    series:plan.series,planNumber:plan.planNumber,planName:plan.name,
    itemType:index===0?'Base':'Option',optionCode:pkg.code,
    description:pkg.name,priceMode:'manual',customerPrice:undefined,
    optionBehavior:'standalone',quantities:{},
  };
}
export function addManualPlan(builder:PricingScheduleBuilderData,details:{
  name:string;planNumber?:string;series?:string;
}):PricingScheduleBuilderData{
  const name=trim(details.name),planNumber=trim(details.planNumber??'');
  const series=trim(details.series??'');
  if(!name)throw new Error('Enter the house plan name.');
  const duplicate=(builder.manualPlans??[]).some(p=>
    p.name.toLowerCase()===name.toLowerCase()&&p.planNumber===planNumber&&p.series===series);
  if(duplicate)throw new Error('This series, number and house plan already exist.');
  const packages=builder.manualPackages?.length?builder.manualPackages:standardManualPackages();
  const plan:PricingManualPlan={id:id(),name,planNumber,series};
  return asContract({...builder,manualPackages:packages,
    manualPlans:[...(builder.manualPlans??[]),plan],
    contractRows:[...(builder.contractRows??[]),...packages.map((pkg,i)=>optionRow(plan,pkg,i))]});
}
export function updateManualPlan(builder:PricingScheduleBuilderData,planId:string,patch:Partial<Pick<PricingManualPlan,'name'|'planNumber'|'series'>>):PricingScheduleBuilderData{
  const plan=builder.manualPlans?.find(p=>p.id===planId);
  if(!plan)throw new Error('Plan no longer exists.');
  const updated={...plan,...patch};
  return asContract({...builder,
    manualPlans:builder.manualPlans!.map(p=>p.id===planId?updated:p),
    contractRows:(builder.contractRows??[]).map(r=>r.manualPlanId===planId?
      {...r,series:updated.series,planNumber:updated.planNumber,planName:updated.name}:r),
  });
}
export function duplicateManualPlan(builder:PricingScheduleBuilderData,planId:string){
  const plan=builder.manualPlans?.find(p=>p.id===planId);
  if(!plan)throw new Error('Plan no longer exists.');
  const name=plan.name+' Copy';
  const created=addManualPlan(builder,{name,planNumber:'',series:plan.series});
  const target=created.manualPlans![created.manualPlans!.length-1];
  const base=(builder.contractRows??[]).filter(r=>r.manualPlanId===planId);
  return asContract({...created,
    contractRows:(created.contractRows??[]).map(row=>{
      if(row.manualPlanId!==target.id)return row;
      const source=base.find(r=>r.manualPackageId===row.manualPackageId);
      return source?{...row,quantities:{...source.quantities},
        sourceCells:source.sourceCells?.slice(),priceMode:'manual' as const,customerPrice:undefined}:row;
    }),
  });
}
export function removeManualPlan(builder:PricingScheduleBuilderData,planId:string){
  return asContract({...builder,
    manualPlans:(builder.manualPlans??[]).filter(p=>p.id!==planId),
    contractRows:(builder.contractRows??[]).filter(r=>r.manualPlanId!==planId),
    manualAddons:(builder.manualAddons??[]).map(a=>({
      ...a,planRates:Object.fromEntries(Object.entries(a.planRates??{}).filter(([key])=>key!==planId)),
      excludedPlanIds:a.excludedPlanIds?.filter(key=>key!==planId),
    })),
  });
}
export function addManualPackage(builder:PricingScheduleBuilderData,code:string,name:string){
  code=trim(code);name=trim(name);
  if(!code||!name)throw new Error('Enter a package code and name.');
  if((builder.manualPackages??[]).some(p=>p.code.toLowerCase()===code.toLowerCase()))
    throw new Error('This package code is already used.');
  const pkg:PricingManualPackage={id:id(),code,name};
  const packages=[...(builder.manualPackages??[]),pkg];
  return asContract({...builder,manualPackages:packages,
    contractRows:[...(builder.contractRows??[]),
      ...(builder.manualPlans??[]).map(p=>optionRow(p,pkg,packages.length-1))],
  });
}
export function updateManualPackage(builder:PricingScheduleBuilderData,packageId:string,patch:Partial<Pick<PricingManualPackage,'code'|'name'|'description'>>){
  const pkg=builder.manualPackages?.find(p=>p.id===packageId);
  if(!pkg)throw new Error('Package no longer exists.');
  const next={...pkg,...patch};
  if(!trim(next.code)||!trim(next.name))throw new Error('Package code and name cannot be blank.');
  if((builder.manualPackages??[]).some(p=>p.id!==packageId&&p.code.toLowerCase()===next.code.toLowerCase()))
    throw new Error('Package code must be unique.');
  return asContract({...builder,
    manualPackages:builder.manualPackages!.map(p=>p.id===packageId?next:p),
    contractRows:(builder.contractRows??[]).map(row=>row.manualPackageId===packageId?{
      ...row,optionCode:next.code,description:row.description===pkg.name?next.name:row.description,
    }:row),
  });
}
export function removeManualPackage(builder:PricingScheduleBuilderData,packageId:string){
  const packages=(builder.manualPackages??[]).filter(p=>p.id!==packageId);
  const first=packages[0]?.id;
  return asContract({...builder,manualPackages:packages,
    manualPlans:(builder.manualPlans??[]).map(p=>({
      ...p,excludedPackageIds:p.excludedPackageIds?.filter(value=>value!==packageId),
    })),
    contractRows:(builder.contractRows??[]).filter(r=>r.manualPackageId!==packageId).map(r=>
      r.manualPackageId&&r.manualPlanId?{...r,itemType:r.manualPackageId===first?'Base' as const:'Option' as const}:r),
  });
}
export function setManualPackageOffered(builder:PricingScheduleBuilderData,planId:string,packageId:string,offered:boolean){
  return asContract({...builder,manualPlans:(builder.manualPlans??[]).map(plan=>{
    if(plan.id!==planId)return plan;
    const excluded=new Set(plan.excludedPackageIds??[]);
    if(offered)excluded.delete(packageId);else excluded.add(packageId);
    return {...plan,excludedPackageIds:[...excluded]};
  })});
}
export function manualPackageOffered(plan:PricingManualPlan,pkg:PricingManualPackage){
  return !plan.excludedPackageIds?.includes(pkg.id);
}
export function manualPriceRow(builder:PricingScheduleBuilderData,planId:string,packageId:string){
  return (builder.contractRows??[]).find(row=>row.manualPlanId===planId&&row.manualPackageId===packageId);
}
export function setManualMatrixPrice(builder:PricingScheduleBuilderData,planId:string,packageId:string,price:number|undefined){
  if(price!==undefined&&(!Number.isFinite(price)||price<0))
    throw new Error('Enter a nonnegative, finite customer price.');
  const row=manualPriceRow(builder,planId,packageId);
  if(!row)throw new Error('This plan/package cell does not exist.');
  return asContract({...builder,contractRows:(builder.contractRows??[]).map(r=>r.id===row.id?
    {...r,customerPrice:price,priceMode:'manual' as const}:r)});
}
export function addManualAddon(builder:PricingScheduleBuilderData,details:{
  name:string;code?:string;unit?:PricingManualAddon['unit'];behavior?:PricingManualAddon['behavior'];
}){
  const name=trim(details.name),code=trim(details.code??'')||('ADD-'+String((builder.manualAddons??[]).length+1).padStart(2,'0'));
  if(!name)throw new Error('Enter an add-on name.');
  if((builder.manualAddons??[]).some(addon=>addon.code.toLowerCase()===code.toLowerCase()))
    throw new Error('This add-on code is already used.');
  const addon:PricingManualAddon={
    id:id(),name,code,unit:details.unit??'flat',behavior:details.behavior??'increment',
  };
  return asContract({...builder,manualAddons:[...(builder.manualAddons??[]),addon]});
}
export function manualAddonOffered(addon:PricingManualAddon,planId:string){
  return !addon.excludedPlanIds?.includes(planId);
}
export function effectiveManualAddonRate(addon:PricingManualAddon,planId:string){
  if(!manualAddonOffered(addon,planId))return undefined;
  return addon.planRates?.[planId]??addon.defaultRate;
}
export function manualAddonRows(builder:PricingScheduleBuilderData):PricingContractRow[]{
  return (builder.manualPlans??[]).flatMap(plan=>
    (builder.manualAddons??[]).filter(a=>manualAddonOffered(a,plan.id)).map(addon=>{
      const unit=addon.unit==='flat'?'flat':addon.unit==='sf'?'/ SF':'/ EA';
      const explanation=addon.behavior==='increment'?'additional charge':'replacement price';
      return {
        id:'manual-addon-'+plan.id+'-'+addon.id,manualPlanId:plan.id,
        series:plan.series,planNumber:plan.planNumber,planName:plan.name,
        itemType:'Option' as const,optionCode:addon.code,
        description:addon.name+' ('+unit+', '+explanation+')',
        priceMode:'manual' as const,customerPrice:effectiveManualAddonRate(addon,plan.id),
        optionBehavior:addon.behavior,quantities:{},
      };
    }));
}
export function manualAddonCustomerItems(builder:PricingScheduleBuilderData):PricingScheduleItem[]{
  return manualAddonRows(builder).map((row,index)=>({
    sourceRow:(builder.contractRows?.length??0)+index+1,series:row.series||undefined,
    itemType:'Add-on',planNumber:row.planNumber||undefined,planName:row.planName||undefined,
    optionCode:row.optionCode,description:row.description,
    customerPrice:row.customerPrice,displayType:'schedule-item' as const,
  }));
}
export function manualPricingHealth(builder:PricingScheduleBuilderData){
  const warnings:string[]=[];
  if(!builder.manualPlans?.length)return warnings;
  if(!builder.manualPackages?.length)warnings.push('Add at least one pricing package.');
  for(const plan of builder.manualPlans){
    if(!plan.name.trim())warnings.push('A manual plan is missing its name.');
    const packages=(builder.manualPackages??[]).filter(pkg=>manualPackageOffered(plan,pkg));
    if(!packages.length)warnings.push((plan.name||'Plan')+' has no offered packages.');
    for(const pkg of packages){
      const row=manualPriceRow(builder,plan.id,pkg.id);
      if(!row)warnings.push(plan.name+' / '+pkg.code+' is missing its contract row.');
      else if(row.priceMode==='manual'&&(row.customerPrice===undefined||!Number.isFinite(row.customerPrice)||row.customerPrice<0))
        warnings.push(plan.name+' / '+pkg.code+' needs a customer price.');
    }
    for(const addon of builder.manualAddons??[]){
      if(!manualAddonOffered(addon,plan.id))continue;
      const rate=effectiveManualAddonRate(addon,plan.id);
      if(rate===undefined||!Number.isFinite(rate)||rate<0)
        warnings.push(plan.name+' / '+addon.code+' needs an add-on rate, or mark it Not offered.');
    }
  }
  return warnings;
}
