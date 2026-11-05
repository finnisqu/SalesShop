import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const overview=readFileSync(new URL('../components/QuoteBetaPricingOverview.tsx',import.meta.url),'utf8');
const service=readFileSync(new URL('./quotePricingOverview.ts',import.meta.url),'utf8');

describe('Quote pricing overview recomputation contract',()=>{
 it('calculates private cost once per measured Area for both summary and rows',()=>{
  expect(overview.match(/projectAreaCost\(quote,row.section\)/g)).toHaveLength(1);
  expect(overview).toContain('const costsByArea=useMemo(()=>new Map(measuredRows.map');
  expect(overview).toContain('const cost=row.measuredSf>0?costsByArea.get(row.section.id)??null:null;');
  expect(overview).toContain('{measuredRows.length-incompleteCosts.length}/{measuredRows.length}');
 });
 it('retains blockers-first precedence for a shared Area destination',()=>{
  expect(overview).toContain('[...report.blockers,...report.review]');
  expect(overview).toContain('index.has(finding.destination.areaId)');
  expect(overview).toContain('const issueFor=(id:string)=>issueByArea.get(id)');
 });
 it('reuses memoized reports and keeps the original pricing engine',()=>{
  expect(overview).toContain('useMemo(()=>auditQuoteDraft(quote),[quote])');
  expect(overview).toContain('useMemo(()=>quotePricingOverview(quote,report),[quote,report])');
  expect(overview).toContain('const total=useMemo(()=>quoteTotal(quote),[quote])');
  expect(service).toContain('quoteLinesTotal(areaLines.get(section.id)??[])');
  expect(overview).toContain('<QuoteSharedSlabPools quote={quote}/>');
 });
});
