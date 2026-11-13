import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const src=(name:string)=>readFileSync(join(process.cwd(),'src',name),'utf8');

describe('Catalog to Quote worktable and cloud parity',()=>{
 it('opens the same permission-aware quote destination chooser from all four Catalog types',()=>{
  const modal=src('components/CatalogQuoteInsert.tsx');
  expect(modal).toContain('export function CatalogQuoteLauncher');
  expect(modal).toContain('canEditTeamArea(teamRole,department,\'quotes\')');
  expect(modal).toContain('createPortal(<CatalogQuoteInsert');
  for(const file of ['MaterialsWorkspace.tsx','CatalogSinksWorktable.tsx',
   'CatalogOtherWorktable.tsx','RatesWorkspace.tsx']){
   const source=src('components/'+file);
   expect(source,file).toContain('CatalogQuoteLauncher');
  }
  expect(src('components/MaterialsWorkspace.tsx')).toContain("source={{kind:'material',material,variantId:variant.id}}");
  expect(src('components/CatalogSinksWorktable.tsx')).toContain("source={{kind:'sink',model,variantId:variant.id}}");
  expect(src('components/CatalogOtherWorktable.tsx')).toContain("source={{kind:'other',item,variantId:variant.id}}");
  expect(src('components/RatesWorkspace.tsx')).toContain("source={{kind:'rate',item}}");
 });
 it('validates snapshot and selection before creating a new Quote',()=>{
  const modal=src('components/CatalogQuoteInsert.tsx');
  const builder=src('services/catalogQuoteInsertion.ts');
  expect(modal.indexOf('const patch = buildCatalogQuoteLinePatch(source')).toBeLessThan(
   modal.indexOf('quoteId=createCatalogQuote('));
  expect(modal).toContain('quoteId=createCatalogQuote(');
  expect(modal).toContain('const id=addCatalogLine(quote.id,kind,patch)');
  const store=src('store/quoteStore.ts');
  expect(store).toContain('createCatalogQuote:(title,kind,patch)=>');
  expect(store).toContain('quote.lines=[line]');
  expect(store).toContain('persist(quotes,quote.id)');
  expect(store).toContain('recentCatalogInsert:{quoteId:quote.id,lineId:line.id}');
  expect(modal).toContain('validateCatalogQuoteSource(source,');
  expect(modal).toContain("source.kind==='other'?'item':source.kind");
  expect(modal).toContain('disabled={!validQuantity || !validSource}');
  expect(modal).toContain('const countRequired=source.kind');
  expect(builder).toContain('validateCatalogQuoteQuantity(options.quantity)');
  expect(builder).toContain('validateCatalogQuoteSource(source,options.variantId,options.purchaseOptionId)');
 });
 it('round-trips private OTHER catalog snapshots using existing rate_reference JSONB',()=>{
  const quote=src('types/quote.ts');
  const sync=src('services/normalizedQuoteSync.ts');
  const store=src('store/quoteStore.ts');
  expect(quote).toContain('otherReference?: QuoteLineOtherReference');
  expect(quote).toContain('otherCatalog?:QuoteLineOtherReference');
  expect(sync).toContain('otherReference:rateReferenceOrUndefined(row.rate_reference)?.otherCatalog');
  expect(sync).toContain('...(line.otherReference?{otherCatalog:line.otherReference}:{}),');
  expect(sync).toContain('unitCost:line.unitCost');
  expect(sync).toContain('unitCost:rateReferenceOrUndefined(row.rate_reference)?.estimate?.unitCost');
  expect(store).toContain("'material' | 'sink' | 'rate' | 'item'");
 });
 it('keeps quote-time Catalog source snapshots through manual selling edits across editors',()=>{
  const beta=src('components/QuotesMobileBeta.tsx');
  const audit=src('components/QuoteAuditInlineEditor.tsx');
  const summary=src('components/QuoteQuickAreaSummary.tsx');
  const ratePicker=src('components/QuoteRateLineFields.tsx');
  const sinkPicker=src('components/QuoteSinkLineFields.tsx');
  const source=src('services/quoteCatalogLineEditing.ts');
  expect(beta).toContain('rate:e.target.value===\'\'?undefined:Number(e.target.value)');
  expect(beta).toContain('Preserve the frozen source snapshot when overriding selling.');
  expect(beta).toContain('line.otherReference&&<div');
  expect(audit).toContain('updateLine(quote.id,line.id,{rate:n})');
  expect(summary).toContain("line.otherReference.snapshot.itemName");
  expect(summary).toContain("Calculated from Catalog");
  expect(summary).not.toContain("rateReference:undefined,");
  expect(ratePicker).toContain('rateCatalogSelectionPatch(line,nextSnapshot)');
  expect(ratePicker).toContain('Manual selling override');
  expect(sinkPicker).toContain('Manual selling override');
  expect(source).toContain('const sameUnit=priorUnit===snapshot.unit');
  expect(source).toContain('catalogSellingOverride(line:QuoteLine)');
 });
 it('recovers quoted OTHER cost if older normalized records lack unitCost',()=>{
  const pricing=src('services/quoteInternalPricing.ts');
  expect(pricing).toContain('line.unitCost??line.otherReference?.snapshot?.internalCost');
  expect(src('services/quoteCatalogLifecycle.test.ts'))
   .toContain('reconstructs original Catalog prices and snapshots after a new quote revision');
 });
 it('keeps the destination dialog themed after portal rendering outside the sales-app root',()=>{
  const css=src('catalog-quote-integration.css');
  expect(css).toContain(':root[data-sales-theme] .catalog-quote-sheet');
  expect(css).toContain('background:var(--ss-theme-card);color:var(--ss-theme-ink)');
  expect(css).toContain(':root[data-sales-theme] .catalog-add-to-quote');
 });
});
