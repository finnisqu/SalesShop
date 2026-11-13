import {beforeEach,describe,expect,it,vi} from 'vitest';
import {loadNormalizedQuotes} from './normalizedQuoteSync';
import {buildCatalogQuoteLinePatch} from './catalogQuoteInsertion';
import {quoteCloudLineReference} from './quoteCloudLineMetadata';
import {summarizeQuoteInternalPricing} from './quoteInternalPricing';
import {quoteTotal,type QuoteLine} from '../types/quote';
import type {StockMaterial} from '../types/settings';
import type {SinkModel} from '../types/sink';
import type {RateBookItem} from '../types/rateBook';
import type {OtherCatalogItem} from '../store/otherCatalogStore';

type Row=Record<string,unknown>;
const fixture=vi.hoisted(()=>({
 rows:{
  quotes:[] as Row[],quote_sections:[] as Row[],
  quote_lines:[] as Row[],quote_revisions:[] as Row[],
 },
}));
vi.mock('../lib/supabase',()=>({
 supabaseConfigured:false,
 supabase:{
  from(table:keyof typeof fixture.rows){
   return {
    select(_columns:string){
     const query={
      eq(_column:string,_value:string){return query;},
      order(_column:string){return query;},
      async range(start:number,end:number){
       return {data:fixture.rows[table].slice(start,end+1),error:null};
      },
     };
     return query;
    },
   };
  },
 },
}));
const freeze=(value:unknown):unknown=>value===undefined||value===null
 ?null:JSON.parse(JSON.stringify(value));
const asLine=(id:string,kind:QuoteLine['kind'],patch:Partial<QuoteLine>):QuoteLine=>({
 id,kind,description:id,pricingMode:'quantity-rate',
 customerVisible:true,includeInTotal:true,...patch,
});
const dbLine=(line:QuoteLine,sortOrder:number):Row=>({
 id:line.id,quote_id:'quote-catalog',section_id:line.sectionId??null,
 kind:line.kind,description:line.description,pricing_mode:line.pricingMode,
 quantity:line.quantity??null,rate:line.rate??null,amount:line.amount??null,
 internal_cost:line.internalCost??null,
 customer_visible:line.customerVisible,include_in_total:line.includeInTotal,
 material_reference:freeze(line.materialReference),
 sink_reference:freeze(line.sinkReference),
 rate_reference:freeze(quoteCloudLineReference(line)),
 takeoff_sink_id:line.takeoffSinkId??null,sort_order:sortOrder,
});
beforeEach(()=>{
 for(const key of Object.keys(fixture.rows) as Array<keyof typeof fixture.rows>)
  fixture.rows[key]=[];
});

describe('Batch 326 — normalized Catalog Quote reload',()=>{
 it('restores four frozen Catalog selections, private costs, selling overrides and revision snapshots',async()=>{
  const material:StockMaterial={
   id:'stone',name:'White Quartz',materialType:'Quartz',unit:'sf',
   stockProgram:true,active:true,variants:[{
    id:'3cm',active:true,default:true,thickness:'3cm',finish:'Polished',
    purchaseOptions:[{
     id:'stock',label:'Stock supplier',active:true,default:true,
     pricingBasis:'sf',costPerSf:12,
    }],
   }],
  };
  const sink:SinkModel={
   id:'sink',name:'3218',category:'kitchen',active:true,
   createdAt:'2026-11-01',updatedAt:'2026-11-01',variants:[{
    id:'under',label:'Undermount',configuration:'single',ada:false,
    active:true,default:true,internalCost:105,sellPrice:220,history:[],
   }],
  };
  const rate:RateBookItem={
   id:'labor',name:'Installation',category:'fabrication-install',
   unit:'sf',pricingBehavior:'suggested',internalCost:4,sellRate:13.5,
   divisionOverrides:[],history:[],active:true,
   createdAt:'2026-11-01',updatedAt:'2026-11-01',
  };
  const other:OtherCatalogItem={
   id:'drain',name:'Drain assembly',category:'Plumbing',unit:'each',
   active:true,updatedAt:'2026-11-01',variants:[{
    id:'black',label:'Black',active:true,default:true,
    internalCost:42,sellPrice:95,material:'Brass',
   }],
  };
  const lines=[
   asLine('mat','material',{
    ...buildCatalogQuoteLinePatch({kind:'material',material},{
     variantId:'3cm',purchaseOptionId:'stock',quantity:20,
    }),rate:40,
   }),
   asLine('rate','rate',{
    ...buildCatalogQuoteLinePatch({kind:'rate',item:rate},{quantity:20}),
   }),
   asLine('sink','sink',{
    ...buildCatalogQuoteLinePatch({kind:'sink',model:sink},{quantity:2}),
   }),
   asLine('other','item',{
    ...buildCatalogQuoteLinePatch({kind:'other',item:other},{quantity:2}),
   }),
  ];
  fixture.rows.quotes=[{
   id:'quote-catalog',quote_number:'Q-20261113-001',
   document_type:'quote',original_quote_date:'2026-11-13',
   quote_date:'2026-11-13',revision:1,status:'Draft',
   title:'Frozen catalog test',customer_quantity:true,
   customer_rate:true,customer_line_amount:true,
   created_at:'2026-11-13T10:00:00Z',updated_at:'2026-11-13T10:00:00Z',
  }];
  fixture.rows.quote_lines=lines.map(dbLine);
  fixture.rows.quote_revisions=[{
   quote_id:'quote-catalog',revision:0,snapshot:{
    revision:0,status:'Sent',title:'Frozen catalog test',
    customerTotal:1700,lines:freeze(lines),sections:[],
   },
  }];
  // Older OTHER rows sometimes omit estimate.unitCost; their frozen
  // product snapshot remains the authoritative private-cost fallback.
  const extra=fixture.rows.quote_lines[3].rate_reference as {
   estimate?:Record<string,unknown>;
  };
  if(extra.estimate)delete extra.estimate.unitCost;

  // A later catalog import does not implicitly alter the saved quote rows.
  material.variants![0].purchaseOptions[0].costPerSf=99;
  sink.variants[0].sellPrice=999;
  rate.sellRate=999;
  other.variants[0].sellPrice=999;

  const loaded=await loadNormalizedQuotes('shop');
  const quote=loaded?.quotes[0];
  expect(quote).toBeDefined();
  if(!quote)throw new Error('The mock cloud quote did not reload.');
  expect(quote.lines).toHaveLength(4);
  expect(quote.lines.map(item=>item.rate)).toEqual([40,13.5,220,95]);
  expect(quote.lines.map(item=>item.quantity)).toEqual([20,20,2,2]);
  expect(quoteTotal(quote)).toBe(1700);
  expect(summarizeQuoteInternalPricing(quote.lines)).toMatchObject({
   customerTotal:1700,knownInternalCost:614,complete:true,
  });
  expect(quote.lines[0].materialReference).toMatchObject({
   materialId:'stone',variantId:'3cm',purchaseOptionId:'stock',
   snapshot:{costPerSf:12,purchaseOptionId:'stock'},
  });
  expect(quote.lines[1].rateReference).toMatchObject({
   rateBookItemId:'labor',snapshot:{sellRate:13.5,internalCost:4},
  });
  expect(quote.lines[2].sinkReference).toMatchObject({
   sinkModelId:'sink',variantId:'under',
   snapshot:{sellPrice:220,internalCost:105},
  });
  expect(quote.lines[3].otherReference).toMatchObject({
   itemId:'drain',variantId:'black',
   snapshot:{sellPrice:95,internalCost:42},
  });
  expect(quote.lines[3].unitCost).toBe(42);
  expect(quote.history).toHaveLength(1);
  expect(quote.history[0].customerTotal).toBe(1700);
  expect(quote.history[0].lines[0].materialReference?.snapshot?.costPerSf).toBe(12);
  expect(quote.history[0].lines[3].otherReference?.snapshot.sellPrice).toBe(95);
 });
});
