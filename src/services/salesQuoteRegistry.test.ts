import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Quote} from '../types/quote';
import type {Activity,Project} from '../types/crm';
import {buildSalesQuoteRegistry,mySalesQuoteRegistry,isExternalQuoteActivity} from './salesQuoteRegistry';
import {indexConnectionsCounts} from './connectionsCountIndex';

const read=(name:string)=>readFileSync(join(process.cwd(),name),'utf8');
const deal:Project={id:'d1',name:'Apartments bid',companyId:'co1',companyName:'Builder LLC',
 stage:'Bid Sent',assignedUserId:'rep-a',createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-10T12:00:00Z'};
const native:Quote={
 id:'q1',title:'SalesShop detailed bid',status:'Sent',quoteNumber:'Q-101',
 companyId:'co1',companyName:'Builder LLC',projectId:'d1',ownerUserId:'rep-a',
 documentType:'quote',lines:[],sections:[],history:[],
 customerColumns:{quantity:false,rate:false,lineAmount:true},
 updatedAt:'2026-11-09T12:00:00Z',
} as unknown as Quote;
const external:Activity={
 id:'a1',type:'quote-sent',projectId:'d1',companyId:'co1',
 summary:'External quote sent',occurredAt:'2026-09-25T12:00:00Z',
 metadata:{externalQuoteSent:true,externalQuoteFormat:'BuildingConnected',
  amount:75000,bidSentDate:'2026-09-25',recordedByUserId:'rep-a',
  recordedAt:'2026-11-10T12:00:00Z'},
};

describe('one first-class quote index for both submission methods',()=>{
 it('represents a native document and an external builder bid as distinct equal quote records',()=>{
  const records=buildSalesQuoteRegistry([native],[external],[deal]);
  expect(records).toHaveLength(2);
  expect(records.map(q=>q.source).sort()).toEqual(['external','salesshop']);
  const nativeRecord=records.find(q=>q.source==='salesshop')!;
  expect(nativeRecord).toMatchObject({
   id:'native:q1',sourceId:'q1',name:'SalesShop detailed bid',
   number:'Q-101',projectId:'d1',
  });
  const externalRecord=records.find(q=>q.source==='external')!;
  expect(externalRecord).toMatchObject({
   id:'external:a1',sourceId:'a1',name:'Apartments bid',
   status:'Sent',platform:'BuildingConnected',value:75000,
   sentDate:'2026-09-25',ownerUserId:'rep-a',
  });
  expect(externalRecord.updatedAt).toBe('2026-11-10T12:00:00Z');
 });
 it('includes archived native quotes only when the library requests them',()=>{
  const archived={...native,archivedAt:'2026-11-11T12:00:00Z'};
  expect(buildSalesQuoteRegistry([archived],[],[deal])).toEqual([]);
  const index=buildSalesQuoteRegistry([archived],[],[deal],{includeArchived:true});
  expect(index).toHaveLength(1);
  expect(index[0]).toMatchObject({id:'native:q1',archived:true});
 });
 it('uses correction timestamps and keeps a corrected external quote as one Activity',()=>{
  const corrected={...external,metadata:{...external.metadata,
   amount:91000,bidSentDate:'2026-09-26',editedAt:'2026-11-12T12:00:00Z'}};
  const records=buildSalesQuoteRegistry([], [corrected,corrected],[deal]);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({id:'external:a1',value:91000,
   sentDate:'2026-09-26',updatedAt:'2026-11-12T12:00:00Z'});
 });
 it('never turns native quote history into an external bid',()=>{
  const ordinary={...external,id:'fake',quoteId:'q1'};
  expect(isExternalQuoteActivity(ordinary)).toBe(false);
  expect(buildSalesQuoteRegistry([native],[ordinary],[deal])).toHaveLength(1);
 });
 it('honors the personal Quote view, including linked assigned Deal submissions',()=>{
  const byOther:Activity={...external,id:'a2',
   metadata:{...external.metadata,recordedByUserId:'rep-b'}};
  const rows=buildSalesQuoteRegistry([native],[external,byOther],[deal]);
  expect(mySalesQuoteRegistry(rows,'cloud','rep-a',[deal])).toHaveLength(3);
  const otherDeal={...deal,assignedUserId:'rep-b'};
  const rowsUnassigned=buildSalesQuoteRegistry([native],[external,byOther],[otherDeal]);
  expect(mySalesQuoteRegistry(rowsUnassigned,'cloud','rep-a',[otherDeal]).map(r=>r.id))
   .toEqual(['external:a1','native:q1']);
  expect(mySalesQuoteRegistry(rowsUnassigned,'cloud',undefined,[otherDeal])).toEqual([]);
 });
 it('counts both bid sources once for the Company and Deal',()=>{
  const count=indexConnectionsCounts([],[deal],[native],[external]);
  expect(count.quotesByDeal.get('d1')).toBe(2);
  expect(count.quotesByCompany.get('co1')).toBe(2);
  expect(indexConnectionsCounts([],[deal],[],[external,external]).quotesByDeal.get('d1'))
   .toBe(1); // duplicate cache copies of one submission are not separate bids
 });
 it('shows both in Connections directory and primary Quotes library without counterfeit editable documents',()=>{
  const directory=read('src/components/Connections.tsx');
  const library=read('src/components/QuotesMobileBeta.tsx');
  const dealPage=read('src/components/DealRecordPage.tsx');
  expect(directory).toContain('buildSalesQuoteRegistry(quotes,activities,projects)');
  expect(directory).toContain("if(id.startsWith('external:'))");
  expect(directory).toContain('setActivityPreview');
  expect(library).toContain('...externalList.map(x=>({');
  expect(library).toContain('readOnly:true');
  expect(library).toContain('setExternalQuotePreviewId');
  expect(dealPage).toContain('related.linkedQuotes.length+outsideQuotes.length');
  expect(read('src/components/CompanyRecordPage.tsx')).toContain(
   'related.relatedQuotes.length+externalQuotes.length');
  const team=read('src/components/TeamQuotesWorkspace.tsx');
  expect(team).toContain('metrics.total+externalFiltered.length');
  expect(team).toContain('metrics.value+externalValue');
  expect(team).toContain('metrics.delivered+externalFiltered.length');
  expect(team).toContain('View external quote details');
  expect(read('src/components/ConnectionsTable.tsx')).toContain('hasDocumentActions&&!row.readOnly');
 });
 it('has one secure database register that respects native quote permissions',()=>{
  const sql=read('supabase/migrations/20261110192526_sales_quote_registry_20261110.sql');
  expect(sql).toContain('security_invoker = true');
  expect(sql).toContain('from public.quotes q');
  expect(sql).toContain('from public.activities a');
  expect(sql).toContain("a.metadata->>'externalQuoteSent'='true'");
  expect(sql).toContain('revoke all on public.sales_quote_registry from public, anon');
  expect(sql).toContain('grant select on public.sales_quote_registry to authenticated');
 });
 it('counts repeated cloud cache copies as one quote in the unified registry',()=>{
  const duplicate={...external,metadata:{...external.metadata}};
  const rows=buildSalesQuoteRegistry([native],[external,duplicate],[deal]);
  expect(rows.map(row=>row.id).sort()).toEqual(['external:a1','native:q1']);
  expect(rows.filter(row=>row.source==='external').reduce((sum,row)=>sum+(row.value??0),0))
   .toBe(75000);
  const distinct={...external,id:'a2'};
  expect(buildSalesQuoteRegistry([],[external,duplicate,distinct],[deal]).map(q=>q.id))
   .toEqual(['external:a1','external:a2']);
  expect(buildSalesQuoteRegistry([],[{...external,quoteId:'q1'},{
   ...external,id:'orphan',projectId:undefined}],[deal])).toHaveLength(0);
 });
});
