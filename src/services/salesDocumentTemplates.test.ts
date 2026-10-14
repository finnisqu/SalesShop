import {describe,expect,it} from 'vitest';
import type {Quote,SalesDocumentTemplate} from '../types/quote';
import {createPricingScheduleData} from './pricingSchedule';
import {createPricingScheduleBuilderData,createPricingRateItem} from './pricingScheduleBuilder';
import {
  SALES_DOCUMENT_TEMPLATES,createTemplateSchedule,salesDocumentTemplate,snapshotCompanyRates,
} from './salesDocumentTemplates';
const legacy=(route:'rate-sheet'|'plan-builder'|'workbook')=>({
  documentType:'pricing-schedule' as const,
  pricingSchedule:{route,publishSource:route==='rate-sheet'?'rate-sheet':route==='workbook'?'workbook':'builder'},
});
describe('SalesShop document templates',()=>{
  it('defines exactly five clear starting points; Multi-Family is deliberately not executable',()=>{
    expect(SALES_DOCUMENT_TEMPLATES.map(t=>t.id)).toEqual([
      'quick-quote','builder-rates','community-pricing','spreadsheet','multifamily',
    ]);
    expect(SALES_DOCUMENT_TEMPLATES.find(t=>t.id==='quick-quote')?.description).toMatch(/commercial projects/i);
    expect(SALES_DOCUMENT_TEMPLATES.find(t=>t.id==='multifamily')).toMatchObject({available:false});
    expect(SALES_DOCUMENT_TEMPLATES.find(t=>t.id==='multifamily')?.description).toMatch(/cut-to-size/i);
  });
  it.each([
    ['rate-sheet','builder-rates'],['plan-builder','community-pricing'],['workbook','spreadsheet'],
  ] as const)('opens legacy %s schedules in a fixed %s editor', (route,expected)=>{
    expect(salesDocumentTemplate(legacy(route))).toBe(expected);
  });
  it('new stored template identity wins over conflicting old route data',()=>{
    const q={...legacy('rate-sheet'),templateId:'spreadsheet' as SalesDocumentTemplate};
    expect(salesDocumentTemplate(q)).toBe('spreadsheet');
    expect(salesDocumentTemplate({documentType:'quote',templateId:'quick-quote'})).toBe('quick-quote');
  });
  it('creates a separate builder-rates document without community takeoffs or workbook publishing',()=>{
    const data=createTemplateSchedule('new-id','builder-rates');
    expect(data.route).toBe('rate-sheet');
    expect(data.publishSource).toBe('rate-sheet');
    expect(data.builder?.takeoffs).toEqual([]);
    expect(data.customerItems).toEqual([]);
  });
  it('creates community pricing with a calculated matrix and empty measurements',()=>{
    const data=createTemplateSchedule('new-id','community-pricing');
    expect(data.route).toBe('plan-builder');
    expect(data.publishSource).toBe('builder');
    expect(data.builder?.outputMode).toBe('matrix');
    expect(data.builder?.plans).toEqual([]);
  });
  it('copies a negotiated builder rate agreement into a new community without linking or bringing old takeoffs',()=>{
    const rate=createPricingRateItem('Countertops','material-level');
    rate.name='Quartz';rate.rate=32;rate.materialType='Quartz';rate.unit='sf';
    const prev=createPricingScheduleData('old');
    const builder=createPricingScheduleBuilderData();
    builder.rates=[rate];
    const source={
      id:'old',title:'2026 Builder Agreement',revision:4,documentType:'pricing-schedule',
      templateId:'builder-rates',pricingSchedule:{...prev,
        route:'rate-sheet',publishSource:'rate-sheet',builder,
      },
    } as Quote;
    const copy=createTemplateSchedule('new','community-pricing','previous',source);
    expect(copy.route).toBe('plan-builder');
    expect(copy.builder?.rates[0]).toMatchObject({name:'Quartz',rate:32});
    expect(copy.builder?.plans).toHaveLength(0);
    expect(copy.builder?.outputMode).toBe('matrix');
    copy.builder!.rates[0].rate=49;
    expect(source.pricingSchedule?.builder?.rates[0].rate).toBe(32);
  });
  it('copies custom spreadsheet data only from an existing custom spreadsheet',()=>{
    const source={...legacy('workbook'),templateId:'spreadsheet',
      pricingSchedule:createTemplateSchedule('old','spreadsheet')} as unknown as Quote;
    const copy=createTemplateSchedule('new','spreadsheet','previous',source);
    expect(copy.route).toBe('workbook');
    expect(copy.workbookData).toEqual(source.pricingSchedule!.workbookData);
    expect(copy.workbookData).not.toBe(source.pricingSchedule!.workbookData);
  });
  it('company rate snapshot keeps editable sell prices and avoids exposing cost-only rates',()=>{
    const source=[
      {id:'q',name:'Quartz top',unit:'sf',active:true,category:'material',
        pricingBehavior:'suggested',sellRate:32,internalCost:18,divisionOverrides:[],history:[],
        effectiveDate:'2026-10-01'},
      {id:'cut',name:'Vanity bowl',unit:'each',active:true,category:'sink',
        pricingBehavior:'manual',sellRate:70,internalCost:20,divisionOverrides:[],history:[],
        effectiveDate:'2026-10-01'},
    ] as Parameters<typeof snapshotCompanyRates>[0];
    const rates=snapshotCompanyRates(source);
    expect(rates).toHaveLength(2);
    expect(rates[0]).toMatchObject({
      name:'Quartz top',rate:32,internalCost:18,sourceRateBookItemId:'q',unit:'sf',
    });
    expect(rates[1]).toMatchObject({rate:undefined,priceMode:'tbd',sourceRateBookItemId:'cut'});
    const doc=createTemplateSchedule('new','builder-rates','company-rates',undefined,source);
    expect(doc.builder?.rates).toHaveLength(2);
  });
});
