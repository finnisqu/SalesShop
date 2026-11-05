import {beforeEach,describe,expect,it,vi} from 'vitest';
import {loadNormalizedQuotes,syncNormalizedQuotes} from './normalizedQuoteSync';

type Row=Record<string,unknown>;
const fixture=vi.hoisted(()=>({
  rows:{
    quotes:[] as Row[],quote_sections:[] as Row[],
    quote_lines:[] as Row[],quote_revisions:[] as Row[],
  },
  ranges:[] as Array<{table:string;start:number;end:number}>,
  sorts:[] as Array<{table:string;columns:string[]}>,
}));

vi.mock('../lib/supabase',()=>({
  supabase:{
    from(table:keyof typeof fixture.rows){
      return {
        select(_columns:string){
          const sorts:string[]=[];
          const q={
            eq(_key:string,_value:string){return q;},
            order(column:string){sorts.push(column);return q;},
            async range(start:number,end:number){
              fixture.ranges.push({table,start,end});
              fixture.sorts.push({table,columns:sorts.slice()});
              return {data:fixture.rows[table].slice(start,end+1),error:null};
            },
          };
          return q;
        },
      };
    },
  },
}));

const baseQuote=(id:string):Row=>({
  id,quote_number:'DRAFT-'+id,document_type:'quote',
  original_quote_date:'2026-11-05',quote_date:'2026-11-05',
  revision:0,status:'Draft',title:id,customer_line_amount:true,
  created_at:'2026-11-05T10:00:00Z',updated_at:'2026-11-05T10:00:00Z',
});
beforeEach(()=>{
  fixture.ranges.length=0;fixture.sorts.length=0;
  for(const key of Object.keys(fixture.rows) as Array<keyof typeof fixture.rows>)
    fixture.rows[key]=[];
});

describe('normalized Quote cloud pagination',()=>{
  it('recovers every Area, line and historic revision beyond the 1,000-row API cap',async()=>{
    fixture.rows.quotes=[baseQuote('quote-a')];
    fixture.rows.quote_sections=Array.from({length:1051},(_,n)=>({
      id:'section-'+n,quote_id:'quote-a',title:'Area '+n,
      customer_visible:true,sort_order:n,
    }));
    fixture.rows.quote_lines=Array.from({length:1103},(_,n)=>({
      id:'line-'+n,quote_id:'quote-a',section_id:'section-0',
      kind:'item',description:'Work '+n,pricing_mode:'direct',
      amount:30,include_in_total:true,customer_visible:true,sort_order:n,
    }));
    fixture.rows.quote_revisions=Array.from({length:1004},(_,n)=>({
      quote_id:'quote-a',revision:n,
      snapshot:{revision:n,lines:[],sections:[]},
    }));
    const document=await loadNormalizedQuotes('shop');
    const quote=document?.quotes[0];
    expect(document?.activeQuoteId).toBe('quote-a');
    expect(quote?.sections).toHaveLength(1051);
    expect(quote?.lines).toHaveLength(1103);
    expect(quote?.history).toHaveLength(1004);
    for(const table of ['quote_sections','quote_lines','quote_revisions']){
      expect(fixture.ranges.filter(call=>call.table===table).map(({start,end})=>[start,end]))
        .toEqual([[0,499],[500,999],[1000,1499]]);
    }
    expect(fixture.sorts.find(x=>x.table==='quote_revisions')?.columns)
      .toEqual(['revision','quote_id']);
  });

  it('checks all existing server quotes before synchronizing an organization',async()=>{
    fixture.rows.quotes=Array.from({length:1101},(_,n)=>baseQuote('quote-'+n));
    await syncNormalizedQuotes('shop',{schemaVersion:2,quotes:[],activeQuoteId:null});
    const ranges=fixture.ranges.filter(call=>call.table==='quotes');
    expect(ranges.map(({start,end})=>[start,end]))
      .toEqual([[0,499],[500,999],[1000,1499]]);
    expect(fixture.sorts.filter(x=>x.table==='quotes').every(
      x=>x.columns.length===1&&x.columns[0]==='id')).toBe(true);
  });

  it('returns a valid empty workspace without manufacturing a quote',async()=>{
    expect(await loadNormalizedQuotes('shop')).toBeNull();
    expect(fixture.ranges.filter(call=>call.table==='quotes')).toHaveLength(1);
  });
});
