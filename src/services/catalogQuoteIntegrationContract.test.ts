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
   modal.indexOf('const quoteId = finalTarget?.id ?? createQuote('));
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
 it('keeps the destination dialog themed after portal rendering outside the sales-app root',()=>{
  const css=src('catalog-quote-integration.css');
  expect(css).toContain(':root[data-sales-theme] .catalog-quote-sheet');
  expect(css).toContain('background:var(--ss-theme-card);color:var(--ss-theme-ink)');
  expect(css).toContain(':root[data-sales-theme] .catalog-add-to-quote');
 });
});
