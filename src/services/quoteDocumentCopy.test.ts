import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {copySalesDocument} from './quoteDocumentCopy';

function original():Quote{
  return {
    id:'original',quoteNumber:'WS-100',documentType:'quote',templateId:'quick-quote',
    originalQuoteDate:'2026-10-01',quoteDate:'2026-10-01',revision:3,
    title:'Sanford House',status:'Sent',ownerUserId:'old-user',
    sections:[{id:'area-1',title:'Master Bathroom',customerVisible:true,
      scope:{takeoffPieces:[{id:'piece-1',name:'Vanity',count:1,lengthIn:72,widthIn:22}],
        takeoffSinks:[{id:'sink-1',category:'bathroom',name:'Vanity bowl',count:2,
          includeInPricing:true}]}}],
    lines:[
      {id:'line-1',sectionId:'area-1',kind:'material',description:'Quartz',pricingMode:'quantity-rate',
        quantity:11,rate:50,customerVisible:true,includeInTotal:true,
        quantitySource:{kind:'area-scope',sectionId:'area-1',field:'countertopSf',
          capturedValue:11,appliedAt:'2026-10-01'}},
      {id:'line-2',sectionId:'area-1',kind:'sink',description:'Vanity sink',pricingMode:'quantity-rate',
        quantity:2,rate:100,customerVisible:true,includeInTotal:true,takeoffSinkId:'sink-1'},
    ],
    projectMaterials:[{id:'pin-1',label:'Quartz'}],
    customerColumns:{quantity:true,rate:true,lineAmount:true},
    customerNotes:'Selections pending',internalNotes:'Private',
    history:[{revision:2,quoteDate:'2026-09-25',capturedAt:'2026-10-01',
      status:'Sent',title:'Sanford House',sections:[],lines:[],
      customerColumns:{quantity:true,rate:true,lineAmount:true},
      customerNotes:'',customerTotal:250}],
    sentAt:'2026-10-05',createdAt:'2026-09-01',updatedAt:'2026-10-05',
  } as Quote;
}
function draftShell():Quote{
  return {...original(),id:'new',quoteNumber:'DRAFT-new',title:'Sanford House · Copy',
    quoteDate:'2026-10-14',originalQuoteDate:'2026-10-14',
    status:'Draft',revision:0,history:[],ownerUserId:'new-salesperson',
    sentAt:undefined,createdAt:'2026-10-14',updatedAt:'2026-10-14'};
}
describe('independent SalesShop document copy',()=>{
  it('uses new normalized IDs and relinks scope quantities and priced sink lines',()=>{
    const src=original(),copy=copySalesDocument(src,draftShell());
    expect(copy.id).toBe('new');
    expect(copy.quoteNumber).toBe('DRAFT-new');
    expect(copy.templateId).toBe('quick-quote');
    expect(copy.templateOrigin).toEqual({
      sourceQuoteId:'original',sourceRevision:3,sourceTitle:'Sanford House',
    });
    expect(copy.status).toBe('Draft');
    expect(copy.revision).toBe(0);
    expect(copy.history).toEqual([]);
    expect(copy.sentAt).toBeUndefined();
    expect(copy.ownerUserId).toBe('new-salesperson');
    const area=copy.sections[0],sink=area.scope!.takeoffSinks![0];
    expect(area.id).not.toBe(src.sections[0].id);
    expect(sink.id).not.toBe('sink-1');
    expect(area.scope!.takeoffPieces![0].id).not.toBe('piece-1');
    expect(copy.lines[0].id).not.toBe('line-1');
    expect(copy.lines[1].id).not.toBe('line-2');
    expect(copy.lines[0].sectionId).toBe(area.id);
    expect(copy.lines[0].quantitySource?.sectionId).toBe(area.id);
    expect(copy.lines[1].takeoffSinkId).toBe(sink.id);
    expect(copy.projectMaterials?.[0].id).not.toBe('pin-1');
    copy.sections[0].title='Changed only in duplicate';
    expect(src.sections[0].title).toBe('Master Bathroom');
  });
  it('copies schedule pricing as isolated working data while preserving source agreement',()=>{
    const src=original();
    src.documentType='pricing-schedule';src.templateId='builder-rates';
    src.pricingSchedule={route:'rate-sheet',publishSource:'rate-sheet',
      customerItems:[],builder:{rateBookName:'Original',
        plans:[],options:[],takeoffs:[],rates:[]}};
    const copy=copySalesDocument(src,{...draftShell(),documentType:'pricing-schedule'});
    expect(copy.templateId).toBe('builder-rates');
    expect(copy.pricingSchedule).toEqual(src.pricingSchedule);
    copy.pricingSchedule!.builder!.rateBookName='Copy price list';
    expect(src.pricingSchedule.builder!.rateBookName).toBe('Original');
  });
});
