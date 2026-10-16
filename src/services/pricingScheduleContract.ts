import type {PricingContractRateKey,PricingContractQuantities,PricingContractRow,PricingScheduleBuilderData,PricingScheduleItem} from '../types/quote';
import {manualAddonCustomerItems,manualPackageOffered,manualPricingHealth} from './pricingScheduleManual';

export const CONTRACT_COLUMNS:PricingContractRateKey[]=[
  'corbels','kitchenSinks','graniteKitchenSf','quartzKitchenSf','bathSf','bathBowls',
  'graniteBathSf','quartzBathSf','kitchenSplashSf','bathSplashSf',
];
const readText=(v:unknown)=>v===null||v===undefined?'':String(v).trim();
const readNumber=(v:unknown):number|undefined=>{
  if(typeof v==='number')return Number.isFinite(v)?v:undefined;
  if(v===null||v===undefined||!readText(v))return;
  const n=Number(readText(v).replace(/[$,]/g,''));
  return Number.isFinite(n)?n:undefined;
};
export function parseContractPricingWorkbook(value:unknown){
  type Sheet={cellData?:Record<string,Record<string,{v?:unknown}>>;rowCount?:number};
  const book=value as {sheetOrder?:string[];sheets?:Record<string,Sheet>}|undefined;
  const sheets=book?.sheets??{};
  const ids=book?.sheetOrder?.length?book.sheetOrder:Object.keys(sheets);
  for(const id of ids){
    const sheet=sheets[id];
    if(!sheet?.cellData)continue;
    const get=(r:number,c:number)=>sheet.cellData?.[String(r)]?.[String(c)]?.v;
    let header=-1;
    for(let r=0;r<Math.min(sheet.rowCount??100,30);r++){
      if(/spec\s*series/i.test(readText(get(r,0)))&&/plan\s*name/i.test(readText(get(r,3)))&&
        /contract\s*pricing/i.test(readText(get(r,6)).replace(/\s+/g,' '))){header=r;break;}
    }
    if(header<0)continue;
    const rates:PricingContractQuantities={};
    CONTRACT_COLUMNS.forEach((key,i)=>{
      const n=readNumber(get(Math.max(0,header-2),i<6?i+7:i+30));
      if(n!==undefined)rates[key]=n;
    });
    const rows:PricingContractRow[]=[];
    const last=Math.min(Math.max(0,...Object.keys(sheet.cellData).map(Number).filter(Number.isFinite))+1,1500);
    for(let r=header+1;r<last;r++){
      const planNumber=readText(get(r,2)),planName=readText(get(r,3));
      const kind=readText(get(r,1)).toLowerCase();
      if((!planNumber&&!planName)||(kind!=='base'&&kind!=='option'))continue;
      const quantities:PricingContractQuantities={};
      CONTRACT_COLUMNS.forEach((key,i)=>{
        const n=readNumber(get(r,i<6?i+7:i+30));
        if(n!==undefined)quantities[key]=n;
      });
      rows.push({
        id:crypto.randomUUID(),series:readText(get(r,0)),
        itemType:kind==='base'?'Base':'Option',planNumber,planName,
        optionCode:readText(get(r,4)),description:readText(get(r,5)),
        customerPrice:readNumber(get(r,6)),priceMode:'manual',
        quantities,optionBehavior:'standalone',sourceRow:r+1,
        sourceCells:Array.from({length:40},(_,c)=>{
          const v=get(r,c);return typeof v==='string'||(typeof v==='number'&&Number.isFinite(v))?v:null;
        }),
      });
    }
    if(!rows.length)throw new Error('No base or option contract rows were found.');
    return {rows,rates};
  }
  throw new Error('Expected contract columns: Spec Series, Plan Name and Div. Contract Pricing. Use the Spreadsheet route for other templates.');
}
export function calculateContractRow(row:PricingContractRow,rates:PricingContractQuantities){
  const missing:string[]=[];
  let total=0;
  const hasBathMaterial=(row.quantities.graniteBathSf??0)>0||(row.quantities.quartzBathSf??0)>0;
  for(const key of CONTRACT_COLUMNS){
    if(key==='bathSf'&&hasBathMaterial)continue;
    // The source kitchen/bath SF already includes its configured splash SF.
    if(key==='kitchenSplashSf'||key==='bathSplashSf')continue;
    const qty=row.quantities[key]??0;
    // A negative quantity in the original contract is a replacement marker,
    // not necessarily an incremental discount to apply to the customer price.
    if(qty<=0)continue;
    const rate=key==='graniteBathSf'?(rates.graniteBathSf??rates.bathSf):rates[key];
    if(rate===undefined)missing.push(key);
    else total+=qty*rate;
  }
  return {total:missing.length?undefined:Math.round((total+Number.EPSILON)*100)/100,missing};
}
export function contractPublishedPrice(row:PricingContractRow,rates:PricingContractQuantities){
  return row.priceMode==='manual'?row.customerPrice:calculateContractRow(row,rates).total;
}
export function activeContractRows(builder:PricingScheduleBuilderData):PricingContractRow[]{
  return (builder.contractRows??[]).filter(row=>{
    if(!row.manualPlanId||!row.manualPackageId)return true;
    const plan=builder.manualPlans?.find(p=>p.id===row.manualPlanId);
    const pkg=builder.manualPackages?.find(p=>p.id===row.manualPackageId);
    return !!(plan&&pkg&&manualPackageOffered(plan,pkg));
  });
}
export function deriveContractCustomerItems(builder:PricingScheduleBuilderData):PricingScheduleItem[]{
  const priced=activeContractRows(builder).map((row,index)=>({
    sourceRow:row.sourceRow??index+1,series:row.series||undefined,itemType:row.itemType,
    planNumber:row.planNumber||undefined,planName:row.planName||undefined,
    optionCode:row.optionCode||undefined,description:row.description||undefined,
    customerPrice:contractPublishedPrice(row,builder.contractRates??{}),displayType:'schedule-item' as const,
  }));
  return [...priced,...manualAddonCustomerItems(builder)];
}
export function contractScheduleHealth(builder:PricingScheduleBuilderData){
  const rows=activeContractRows(builder),rates=builder.contractRates??{};
  const warnings:string[]=[];
  if(!rows.length)warnings.push('Import or create at least one contract row.');
  const known=new Set<string>();
  rows.forEach((row,index)=>{
    const label=(row.planName||row.planNumber||'Row '+(index+1))+' / '+row.optionCode;
    if(!row.planNumber&&!row.planName)warnings.push(label+': missing plan name or number.');
    if(!row.description.trim())warnings.push(label+': missing description.');
    if(!row.optionCode.trim())warnings.push(label+': missing option code.');
    const key=[row.series,row.planNumber||row.planName,row.optionCode,row.itemType].join('|').toLowerCase();
    if(known.has(key))warnings.push(label+': duplicate series, plan, type and option code.');
    known.add(key);
    if(row.priceMode==='calculated'){
      const calc=calculateContractRow(row,rates);
      if(calc.missing.length)warnings.push(label+': missing rates for '+calc.missing.join(', ')+'.');
    }
    const amount=contractPublishedPrice(row,rates);
    if(amount===undefined||amount<0)warnings.push(label+': missing customer price.');
  });
  return [...new Set([...warnings,...manualPricingHealth(builder)])];
}
export function newContractRow():PricingContractRow{
  return {id:crypto.randomUUID(),series:'',itemType:'Base',planNumber:'',
    planName:'',optionCode:'',description:'',priceMode:'calculated',
    quantities:{},optionBehavior:'standalone'};
}
