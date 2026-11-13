import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const publicEndpoint=()=>readFileSync(
 join(process.cwd(),'supabase/functions/quote-share-public/index.ts'),'utf8'
);

describe('Catalog quote customer-sharing privacy contract',()=>{
 it('projects customer lines through an explicit safe-field allowlist',()=>{
  const src=publicEndpoint();
  const start=src.indexOf('function safePublicLine(');
  const end=src.indexOf('\n}',start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const body=src.slice(start,end+2);
  for(const field of ['id','sectionId','kind','description','pricingMode','quantity',
   'rate','amount','customerVisible','includeInTotal'])
   expect(body).toContain(field);
  for(const privateField of ['internalCost','unitCost','supplierName',
   'materialReference','sinkReference','rateReference','otherReference',
   'otherCatalog','sourceCostPerSf','grossSpread'])
   expect(body).not.toContain(privateField);
  expect(body).not.toContain('...line');
 });
 it('uses customer-safe line projection for visible quote and receipt views',()=>{
  const src=publicEndpoint();
  expect(src).toContain('const base = safePublicLine(line)');
  expect(src).toContain('}).map(safePublicLine)');
  expect(src).toContain('return { ...publicSnapshot, sections, lines }');
  expect(src).toContain('const safeQuote = buildSafeQuote(snapshot,');
  expect(src).toContain('accepted_snapshot: { ...safeQuote }');
 });
});
