import type {
  Quote, PricingScheduleData, PricingRateItem, SalesDocumentTemplate,
  SalesDocumentTemplateChoice, PricingBuilderProductType, PricingMaterialType,
} from '../types/quote';
import type {RateBookItem, RateBookDivision} from '../types/rateBook';
import {resolveRateBookValues} from '../types/rateBook';
import {createPricingRateItem,deriveBuilderCustomerItems,deriveRateSheetCustomerItems} from './pricingScheduleBuilder';
import {createPricingScheduleData,mergePricingScheduleData} from './pricingSchedule';

export interface SalesTemplateDefinition {
  id:SalesDocumentTemplateChoice;
  title:string;
  subtitle:string;
  description:string;
  available:boolean;
}
export const SALES_DOCUMENT_TEMPLATES:SalesTemplateDefinition[]=[
  {id:'quick-quote',title:'Quick Quote',subtitle:'Everyday estimates',
    description:'Retail homes, commercial projects, single jobs and fast countertop proposals.',
    available:true},
  {id:'builder-rates',title:'Builder Rate Schedule',subtitle:'Builder agreement pricing',
    description:'Material levels, approved colors, sinks and add-on rate agreements. No house takeoffs.',
    available:true},
  {id:'community-pricing',title:'Community Plan Pricing',subtitle:'Neighborhood house plans',
    description:'Shared material rates, house takeoffs, replacement options and a calculated pricing matrix.',
    available:true},
  {id:'spreadsheet',title:'Custom Spreadsheet',subtitle:'Flexible calculation workspace',
    description:'Full Univer spreadsheet, Excel import, formulas and customer-facing column mapping.',
    available:true},
  {id:'multifamily',title:'Multi-Family',subtitle:'Coming later',
    description:'Placeholder for multifamily bids, cut-to-size supplier pricing, wholesale programs and project costing.',
    available:false},
];

export type SalesTemplateStart='blank'|'company-rates'|'previous';

/** Historical schedules choose a single editor based on the original published source. */
export function salesDocumentTemplate(quote:Pick<Quote,'documentType'|'templateId'|'pricingSchedule'>):SalesDocumentTemplate{
  if(quote.documentType!=='pricing-schedule')return 'quick-quote';
  if(quote.templateId&&quote.templateId!=='quick-quote')return quote.templateId;
  const route=quote.pricingSchedule?.route;
  const source=quote.pricingSchedule?.publishSource;
  if(route==='workbook'||source==='workbook')return 'spreadsheet';
  if(route==='plan-builder'||source==='builder')return 'community-pricing';
  return 'builder-rates';
}
export function salesTemplateLabel(id:SalesDocumentTemplateChoice):string{
  return SALES_DOCUMENT_TEMPLATES.find(row=>row.id===id)?.title??'Sales Document';
}
const rateKind=(item:RateBookItem):PricingBuilderProductType=>{
  if(item.category==='material'||item.category==='fabrication-install')return 'Countertops';
  if(item.category==='sink')return /vanity|oval|rect|1714|1813/i.test(item.name+' '+(item.code??''))?'Vanity Sink':'Kitchen Sink';
  if(/splash/i.test(item.name))return 'Backsplash';
  if(/support|bracket|corbel/i.test(item.name))return 'Support';
  return 'Other';
};
/** A dated, editable copy of company rates. Company changes never silently reprice an agreement. */
export function snapshotCompanyRates(items:RateBookItem[],division?:RateBookDivision):PricingRateItem[]{
  return items.filter(item=>item.active && ['sf','each','flat'].includes(item.unit))
    .map(item=>{
      const material=item.category==='material';
      const rate=createPricingRateItem(rateKind(item),material?'material-level':'add-on');
      const resolved=resolveRateBookValues(item,division);
      rate.name=item.name;
      rate.unit=item.unit as 'sf'|'each'|'flat';
      rate.materialType=material?'Other' as PricingMaterialType:undefined;
      rate.level=material?undefined:rate.level;
      rate.sourceRateBookItemId=item.id;
      rate.sourceRateBookEffectiveDate=item.effectiveDate;
      rate.sourcePricingBehavior=item.pricingBehavior;
      rate.pricingDivision=division;
      rate.internalCost=resolved.internalCost;
      rate.suggestedRate=resolved.sellRate;
      rate.rate=item.pricingBehavior==='suggested'?resolved.sellRate:undefined;
      rate.priceMode=rate.rate===undefined?'tbd':'priced';
      rate.customerVisible=true;
      rate.showLevelOnCustomer=material?false:undefined;
      return rate;
    });
}

export function createTemplateSchedule(
  id:string,template:Exclude<SalesDocumentTemplate,'quick-quote'>,
  starting:SalesTemplateStart='blank',source?:Quote,companyRates:RateBookItem[]=[],
):PricingScheduleData{
  const route=template==='builder-rates'?'rate-sheet':template==='community-pricing'?'plan-builder':'workbook';
  const publishSource=template==='builder-rates'?'rate-sheet':template==='community-pricing'?'builder':'workbook';
  const startingSchedule=createPricingScheduleData(id);
  let builder=startingSchedule.builder!;
  let workbookData=startingSchedule.workbookData;
  let mapping=startingSchedule.mapping;
  if(starting==='previous'&&source?.pricingSchedule){
    // Community plans can begin with a prior Builder Rate Schedule. Import only
    // its materials/add-on rates, not unrelated manual rate-sheet pricing output.
    const copied=structuredClone(source.pricingSchedule);
    builder=copied.builder??builder;
    if(template==='community-pricing'&&salesDocumentTemplate(source)==='builder-rates'){
      builder={...builder,plans:[],takeoffs:[],options:[],outputMode:'matrix',
        manualPlans:undefined,manualPackages:undefined,manualAddons:undefined,
        contractRows:undefined,contractRates:undefined};
    }
    if(template==='spreadsheet'&&salesDocumentTemplate(source)==='spreadsheet'){
      workbookData=copied.workbookData??workbookData;
      mapping=copied.mapping??mapping;
    }
  }else if(starting==='company-rates'&&template!=='spreadsheet'){
    builder={...builder,rates:snapshotCompanyRates(companyRates)};
  }
  // Community uses the calculated matrix unless copying a prior, intentionally
  // manually priced community. Rate-sheets always use the same shared rates model.
  if(template==='community-pricing'&&starting!=='previous')builder={...builder,outputMode:'matrix'};
  if(template==='builder-rates')builder={...builder,outputMode:undefined};
  return mergePricingScheduleData(id,startingSchedule,{
    route,publishSource,builder,workbookData,mapping,
    customerItems:publishSource==='rate-sheet'?deriveRateSheetCustomerItems(builder):
      publishSource==='builder'?deriveBuilderCustomerItems(builder):[],
  });
}
