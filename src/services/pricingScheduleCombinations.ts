import type {PricingContractQuantities,PricingContractRow} from '../types/quote';

const cellNumber=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:undefined;

/**
 * Generate twelve separately priced full-house configurations from a measured
 * base: 3 stone mixes x 2 kitchen splash scopes x 2 master bowl counts.
 * They are standalone contract prices, not increments to the base.
 */
export function generateHouseConfigurations(base:PricingContractRow,kitchenSplashSf:number):PricingContractRow[]{
  if(base.itemType!=='Base')throw new Error('Select a base-house takeoff.');
  if(!Number.isFinite(kitchenSplashSf)||kitchenSplashSf<0)
    throw new Error('Enter a valid nonnegative kitchen backsplash SF.');
  const ownerBowls=cellNumber(base.sourceCells?.[23]);
  if(ownerBowls!==1)throw new Error('The owner bathroom must have one bowl in the base takeoff to generate a double-bowl upgrade.');
  const originalSplash=cellNumber(base.sourceCells?.[19])??0;
  const kitchenSf=(base.quantities.graniteKitchenSf??base.quantities.quartzKitchenSf??0)-originalSplash;
  const bathroomSf=base.quantities.bathSf??base.quantities.graniteBathSf??base.quantities.quartzBathSf??0;
  if(kitchenSf<=0||bathroomSf<=0)throw new Error('A positive kitchen SF and bath SF are needed.');
  const combos=[
    {k:'Granite',b:'Granite',s:true},{k:'Granite',b:'Granite',s:false},
    {k:'Granite',b:'Quartz',s:true},{k:'Granite',b:'Quartz',s:false},
    {k:'Quartz',b:'Quartz',s:true},{k:'Quartz',b:'Quartz',s:false},
  ] as const;
  return combos.flatMap((combo,i)=>[1,2].map(ownerCount=>{
    const quantities:PricingContractQuantities={...base.quantities};
    const selectedKitchenSf=kitchenSf+(combo.s?kitchenSplashSf:0);
    quantities.graniteKitchenSf=combo.k==='Granite'?selectedKitchenSf:0;
    quantities.quartzKitchenSf=combo.k==='Quartz'?selectedKitchenSf:0;
    // Original bath top SF includes bath splashes. Do not charge those twice.
    quantities.bathSf=bathroomSf;
    quantities.graniteBathSf=combo.b==='Granite'?bathroomSf:0;
    quantities.quartzBathSf=combo.b==='Quartz'?bathroomSf:0;
    quantities.bathBowls=(base.quantities.bathBowls??0)+(ownerCount===2?1:0);
    const sourceCells=(base.sourceCells??Array(40).fill(null)).slice();
    sourceCells[19]=combo.s?kitchenSplashSf:null;
    sourceCells[23]=ownerCount;
    const code='CFG-'+String.fromCharCode(65+i)+ownerCount;
    return {
      ...base,id:crypto.randomUUID(),itemType:i===0&&ownerCount===1?'Base':'Option',
      optionCode:code,priceMode:'calculated' as const,customerPrice:undefined,
      optionBehavior:'standalone' as const,quantities,sourceRow:undefined,
      sourceCells,
      description:combo.k+' kitchen / '+combo.b+' bathrooms · '+
        (combo.s?'all splashes':'bath splashes only')+' · '+
        (ownerCount===2?'double':'single')+' owner sink',
    };
  }));
}
