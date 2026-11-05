import {beforeEach,describe,expect,it,vi} from 'vitest';
import {loadNormalizedSignatures,syncNormalizedSignatures} from './normalizedSignatureSync';
import type {SignatureDocument} from '../types/signature';

type Row=Record<string,unknown>;
const fixture=vi.hoisted(()=>({
 rows:[] as Row[],
 reads:[] as Array<{start:number;end:number;columns:string;order:string[]}>,
 inserts:[] as Row[][],
}));
vi.mock('../lib/supabase',()=>({
 supabase:{
  from(table:string){
   if(table!=='signatures')throw new Error('Unexpected table '+table);
   return {
    select(columns:string){
     const order:string[]=[];
     const query={
      eq(_field:string,_value:string){return query;},
      order(field:string){order.push(field);return query;},
      async range(start:number,end:number){
       fixture.reads.push({start,end,columns,order:order.slice()});
       return {data:fixture.rows.slice(start,end+1),error:null};
      },
     };
     return query;
    },
    async insert(rows:Row[]){fixture.inserts.push(rows);return {error:null};},
   };
  },
 },
}));
beforeEach(()=>{fixture.rows=[];fixture.reads.length=0;fixture.inserts.length=0;});
const signature=(id:string)=>({
 id,quoteId:'quote-1',quoteNumber:'Q-1',revision:0,signerName:'Customer',
 method:'typed' as const,signatureText:'Customer',strokes:[],
 consentText:'Accepted',acceptedAt:'2026-11-05T14:00:00Z',
 acceptedSnapshot:{} as SignatureDocument['signatures'][number]['acceptedSnapshot'],
});

describe('large immutable signature datasets',()=>{
 it('loads all pages with stable ties, without omitting older signatures',async()=>{
  fixture.rows=Array.from({length:1150},(_,i)=>({
   id:'sig-'+i,quote_id:'quote-1',quote_number:'Q-1',
   revision:0,signer_name:'Customer',method:'typed',
   accepted_at:'2026-11-05T14:00:00Z',accepted_snapshot:{},
  }));
  const loaded=await loadNormalizedSignatures('org');
  expect(loaded?.signatures).toHaveLength(1150);
  expect(fixture.reads.map(r=>[r.start,r.end])).toEqual([
   [0,499],[500,999],[1000,1499]]);
  expect(fixture.reads.every(r=>r.order.join(',')==='accepted_at,id')).toBe(true);
 });
 it('does not try to reinsert signatures beyond row 1,000',async()=>{
  fixture.rows=Array.from({length:1150},(_,i)=>({id:'sig-'+i}));
  const document:SignatureDocument={schemaVersion:1,
   signatures:[signature('sig-1049'),signature('new-sig')]};
  await syncNormalizedSignatures('org',document);
  expect(fixture.inserts).toHaveLength(1);
  expect(fixture.inserts[0].map(r=>r.id)).toEqual(['new-sig']);
  expect(fixture.reads.every(r=>r.order.join(',')==='id')).toBe(true);
 });
 it('inserts missing signatures in bounded chunks and stops on errors',async()=>{
  const document:SignatureDocument={schemaVersion:1,
   signatures:Array.from({length:417},(_,i)=>signature('new-'+i))};
  await syncNormalizedSignatures('org',document);
  expect(fixture.inserts.map(rows=>rows.length)).toEqual([200,200,17]);
 });
});
