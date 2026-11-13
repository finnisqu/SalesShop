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
  expect(modal).toContain('disabled={inserting || !validQuantity || !validSource}');
  expect(modal).toContain('const countRequired=source.kind');
  expect(builder).toContain('validateCatalogQuoteQuantity(options.quantity,source)');
  expect(builder).toContain('validateCatalogQuoteSource(source,options.variantId,options.purchaseOptionId)');
 });
 it('disables Quote insertion for retired material sources but retains legacy references',()=>{
  const modal=src('components/CatalogQuoteInsert.tsx');
  const builder=src('services/catalogQuoteInsertion.ts');
  expect(modal).toContain('materialVariantsValid');
  expect(modal).toContain('materialProgramsValid');
  expect(modal).toContain('No active variants · choose another material');
  expect(builder).toContain('if(configured.length&&!active.length)');
  expect(builder).toContain('if(programs.length&&!programs.some');
 });
 it('prevents quote launchers for retired structured Material variants or supplier programs',()=>{
  const materials=src('components/MaterialsWorkspace.tsx');
  const builder=src('services/catalogQuoteInsertion.ts');
  expect(materials).toContain('const retiredPrograms=Boolean(variant.purchaseOptions?.length&&!options.length)');
  expect(materials).toContain('Supplier programs inactive · reactivate one before quoting');
  expect(materials).toContain('All structured variants are inactive.');
  expect(materials).toContain('No structured variants yet. Quote the legacy cost reference');
  expect(materials).toContain("source={{kind:'material',material,variantId:variant.id}}");
  expect(builder).toContain('if(configured.length&&!active.length)');
  expect(builder).toContain('if(programs.length&&!programs.some');
 });
 it('serializes Catalog-to-Quote creation and avoids duplicate writes after a committed insert',()=>{
  const modal=src('components/CatalogQuoteInsert.tsx');
  expect(modal).toContain('if(insertPending.current)return');
  expect(modal).toContain('insertPending.current=true;setInserting(true)');
  expect(modal).toContain('committed=true;');
  expect(modal).toContain('if(!committed){insertPending.current=false;setInserting(false)}');
  expect(modal).toContain('catalogQuoteWholeUnits(source)');
 });
 it('round-trips private OTHER catalog snapshots using existing rate_reference JSONB',()=>{
  const quote=src('types/quote.ts');
  const sync=src('services/normalizedQuoteSync.ts');
  const store=src('store/quoteStore.ts');
  expect(quote).toContain('otherReference?: QuoteLineOtherReference');
  expect(quote).toContain('otherCatalog?:QuoteLineOtherReference');
  const codec=src('services/quoteCloudLineMetadata.ts');
  expect(sync).toContain('...quoteCloudLineMetadata(row.rate_reference)');
  expect(sync).toContain('rate_reference:quoteCloudLineReference(line)');
  expect(codec).toContain('...(line.otherReference?{otherCatalog:line.otherReference}:{}),');
  expect(codec).toContain('unitCost:line.unitCost');
  expect(codec).toContain('unitCost:estimate?.unitCost??reference?.otherCatalog?.snapshot?.internalCost');
  expect(store).toContain("'material' | 'sink' | 'rate' | 'item'");
 });
 it('keeps quote-time Catalog source snapshots through manual selling edits across editors',()=>{
  const beta=src('components/QuotesMobileBeta.tsx');
  const audit=src('components/QuoteAuditInlineEditor.tsx');
  const summary=src('components/QuoteQuickAreaSummary.tsx');
  const ratePicker=src('components/QuoteRateLineFields.tsx');
  const sinkPicker=src('components/QuoteSinkLineFields.tsx');
  const materialPicker=src('components/QuoteMaterialLineFields.tsx');
  const materialSource=src('services/quoteMaterialSourceRefresh.ts');
  const source=src('services/quoteCatalogLineEditing.ts');
  expect(beta).toContain('rate:e.target.value===\'\'?undefined:Number(e.target.value)');
  expect(beta).toContain('Preserve the frozen source snapshot when overriding selling.');
  expect(beta).toContain("line.otherReference&&<QuoteOtherLineFields");
  expect(audit).toContain('updateLine(quote.id,line.id,{rate:n})');
  expect(summary).toContain('line.otherReference&&<QuoteOtherLineFields');
  expect(summary).toContain("Calculated from Catalog");
  expect(summary).not.toContain("rateReference:undefined,");
  expect(ratePicker).toContain('quoteRateSourcePatch(line,nextSnapshot)');
  expect(ratePicker).toContain('quoteRateCatalogPricePatch(line)');
  expect(ratePicker).toContain('Refresh source · keep quoted price');
  expect(ratePicker).toContain('Manual selling override');
  expect(sinkPicker).toContain('quoteSinkSourcePatch(line,nextSnapshot)');
  expect(sinkPicker).toContain('quoteSinkCatalogPricePatch(line)');
  expect(sinkPicker).toContain('Refresh source · keep quoted price');
  expect(sinkPicker).toContain('Manual selling override');
  expect(source).toContain('const sameUnit=priorUnit===snapshot.unit');
  expect(source).toContain('export function quoteSinkSourcePatch(');
  expect(source).toContain('export function quoteRateSourcePatch(');
  expect(source).toContain('catalogSellingOverride(line:QuoteLine)');
  expect(sinkPicker).toContain('selectedVariantId=line.sinkReference?.variantId??snapshot?.variantId');
  expect(ratePicker).toContain('selectedRateId=line.rateReference?.rateBookItemId??snapshot?.rateBookItemId');
  expect(sinkPicker).toContain('Use Catalog selling price');
  expect(ratePicker).toContain('Use Rate Book selling price');
  expect(materialPicker).toContain('quoteMaterialSourcePatch(');
  expect(materialPicker).toContain('quoteMaterialSlabRepricePatch(line)');
  expect(materialPicker).toContain('Refresh buying reference · keep quoted price');
  expect(materialPicker).toContain('Recalculate slab selling total to');
  expect(materialPicker).toContain('selectedVariantId=line.materialReference?.variantId??snapshot?.variantId');
  expect(materialPicker).toContain('selectedPurchaseId=line.materialReference?.purchaseOptionId??snapshot?.purchaseOptionId');
  expect(materialSource).toContain('lockedCost=slabMode&&existingSource');
  expect(materialSource).toContain('export function quoteMaterialSlabRepricePatch(');
  expect(materialSource).not.toContain('rate:reference.costPerSf');
  const other=src('components/QuoteOtherLineFields.tsx');
  const otherPatch=src('services/quoteOtherSelection.ts');
  expect(other).toContain('quoteOtherSourcePatch(line,nextItem,nextVariant)');
  expect(other).toContain('quoteOtherCatalogPricePatch(line)');
  expect(other).toContain('Refresh this Catalog variant · keep quoted price');
  expect(otherPatch).toContain('const quotedUnit=line.otherReference.snapshot.unit');
  expect(otherPatch).toContain("rate:price");
  expect(otherPatch).not.toContain('rate:next.rate');
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
