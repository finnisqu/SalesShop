import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const builder=source('src/components/QuoteMatrixBuilder.tsx');
const areas=source('src/components/QuoteQuickAreaSummary.tsx');
const areaCss=source('src/components/quote-quick-areas.css');
const takeoffs=source('src/components/QuoteCompactTakeoffs.tsx');
const quoteUi=source('src/components/QuotesMobileBeta.tsx');
const progress=source('src/services/quoteBuilderProgress.ts');

describe('Quick Quote guided workflow and compact table contract',()=>{
 it('uses Areas by default and does not stack the detailed table underneath',()=>{
  expect(builder).toContain("useState<'areas'|'takeoffs'>('areas')");
  expect(builder).toContain("subtab==='areas'&&<QuoteQuickAreaSummary");
  expect(builder).toContain("subtab==='takeoffs'&&!advanced&&<QuoteCompactTakeoffs");
  expect(builder).toContain("subtab==='takeoffs'&&advanced&&");
 });
 it('keeps the compact seven-value-column summary with only checkbox and Area frozen',()=>{
  expect(areas).toContain("'Stone selection','Square feet','Material price'");
  expect(areas).toContain("'Sinks price','Specialty price','Total price'");
  expect(areas).not.toContain("'Sinks qty','Sinks price'");
  expect(areas).not.toContain("'Specialty qty','Specialty price'");
  expect(areaCss).toContain('.qqs-pin-check{position:sticky;left:0;');
  expect(areaCss).toContain('.qqs-pin-area{position:sticky;left:34px;');
  expect(areaCss).not.toContain('.qqs-sticky-material');
  expect(areaCss).toContain('min-height:38px;max-height:38px');
 });
 it('moves contract presentation, private buying and technical details outside summary cells',()=>{
  expect(areas).toContain("detail.kind==='area'");
  expect(areas).toContain('Customer presentation');
  expect(areas).toContain("detail.kind==='price'");
  expect(areas).toContain("detail.kind==='material'");
  expect(areas).toContain('QuoteBetaDesktopPricing');
  expect(areas).toContain('CalculatorDrawer');
  expect(takeoffs).toContain('takeoffPieceSplashSf');
  expect(takeoffs).toContain("kind:'splash'");
  expect(takeoffs).toContain("store.bulkScopeRows");
 });
 it('edits basic amounts inline and advances from material choice to selling price',()=>{
  expect(areas).toContain('function writeManualSf');
  expect(areas).toContain('function writeStoneTotal');
  expect(areas).toContain("onNext('price')");
  expect(areas).toContain("onCustomCommit={()=>onNext('price')}");
  expect(areas).toContain("writeSingleChargeTotal");
  expect(areas).toContain('onPointerDown');
  expect(areas).toContain("onCommit:v=>writeStoneTotal");
  expect(quoteUi).toContain('qmb-quick-history');
  expect(areas).toContain("table.current.querySelector<HTMLInputElement>('input.qqs-edit:focus')?.blur()");
 });
 it('uses the same guided four stages and never requires opening an old Area page',()=>{
  expect(progress).toContain("label:'Deal Details'");
  expect(progress).toContain("label:'Build Quote'");
  expect(progress).toContain("label:'Pricing Review'");
  expect(progress).toContain("label:'Contract Review'");
  expect(quoteUi).toContain("Continue to Build Quote");
  expect(quoteUi).toContain("qmb-guided-footer-left");
  expect(quoteUi).toContain("is-quick-quote");
  expect(quoteUi).toContain('<QuoteMatrixBuilder quote={quote}');
 });
});
