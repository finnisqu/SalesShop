import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const publicShare=read('supabase/functions/quote-share-public/index.ts');
const cloud=read('src/services/normalizedQuoteSync.ts');
const store=read('src/store/quoteStore.ts');
const copy=read('src/services/quoteDocumentCopy.ts');
const pricing=read('src/components/QuoteBetaDesktopPricing.tsx');
const range=(source:string,start:string,end:string)=>{
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 expect(from).toBeGreaterThanOrEqual(0);
 expect(to).toBeGreaterThan(from);
 return source.slice(from,to);
};
describe('shared slab planner release source contracts',()=>{
 it('does not send raw scope, slab allocations or buying costs as public customer sections',()=>{
  const safe=range(publicShare,'function safePublicSection(', 'function safeAcceptedSnapshot(');
  expect(safe).toContain('specification: safeSectionSpecs(');
  expect(safe).not.toMatch(/scope:\s*section\.scope/);
  expect(safe).not.toContain('sharedSlabPool:');
  const exposed=range(publicShare,'function buildSafeQuote(', 'function ');
  expect(exposed).toContain('safePublicSection(');
  expect(exposed).not.toContain('sharedSlabPool');
  const selections=range(publicShare,'function publicCustomerSelections(', 'function buildSafeQuote(');
  expect(selections).not.toContain('sharedSlabPool');
  expect(selections).not.toContain('sourceSlabCost');
 });
 it('round-trips shared slab pools through existing owned Area scope storage',()=>{
  expect(store).toContain('sharedSlabPool:pool');
  expect(store).toContain('sharedSlabPool:undefined');
  expect(cloud).toContain('scope: section.scope ?? null');
  expect(cloud).toContain('slabPools:slabPoolsFromAreaScopes(');
 });
 it('never copies physical pool memberships back to the source quote',()=>{
  expect(copy).toContain('id:crypto.randomUUID()');
  expect(copy).toContain('sectionIds:pool.sectionIds.map(id=>sectionIds.get(id))');
  expect(copy).toContain('section.scope.sharedSlabPool=remappedPools?.find(');
 });
 it('starts three-way pricing on 30% margin and requires an explicit apply',()=>{
  expect(pricing).toContain("useState<'margin'|'sf'|'multiplier'>('margin')");
  expect(pricing).toContain('section.scope?.targetMargin??.30');
  expect(pricing).toContain('onClick={applyComparison}');
  expect(pricing).toContain("comparisonChoice==='margin'");
  expect(pricing).not.toContain('targetMargin??.25');
 });
 it('preserves one undoable action and does not switch manual/multiplier prices in bulk rate edits',()=>{
  const bulk=range(store,'  bulkEditAreas:(quoteId,sectionIds,patch)=>{',
    '  addSlabPool:(quoteId,sectionIds,spec)=>{');
  expect(bulk).toContain("line.pricingMode==='quantity-rate'");
  expect(bulk).toContain("line.quantitySource?.syncMode==='live'");
  expect(bulk).toContain('areaLines.length!==ids.size');
  expect(bulk).toContain('const history=historyPatch(get(),quoteId,current);');
 });
});
