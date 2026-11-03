import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const mobile=source('src/quote-quick-mobile.css');
const quote=source('src/components/QuotesMobileBeta.tsx');
const areas=source('src/components/QuoteQuickAreaSummary.tsx');
const takeoffs=source('src/components/QuoteCompactTakeoffs.tsx');
const review=source('src/components/QuoteBetaReview.tsx');
const reuse=source('src/components/QuoteReuseAreaDialog.tsx');
const layouts=source('src/components/QuoteAreaPresetPicker.tsx');

describe('Quick Quote dedicated phone usability contract',()=>{
 it('keeps desktop tables and gates card layouts under phone breakpoint',()=>{
  expect(mobile).toContain('@media(max-width:700px)');
  expect(mobile).toContain('.qqs-grid.qqs-row');
  expect(mobile).toContain('grid-template-columns:38px minmax(0,1.1fr)');
  expect(mobile).toContain('.qqt-grid.qqt-row');
  expect(mobile).toContain('grid-template-columns:38px repeat(3,minmax(0,1fr))');
  expect(mobile).toContain('.qqs-header{display:none!important}');
  expect(mobile).toContain('.qqt-header{display:none!important}');
 });
 it('replaces phone-wide pricing tables with complete visible values',()=>{
  expect(mobile).toContain('.qqr-table-scroll{display:none}');
  expect(mobile).toContain('.qqr-mobile-totals');
  expect(review).toContain('qqr-mobile-total-card');
  expect(review).toContain('data.billedSf.toFixed(2)');
  expect(review).toContain('money.format(data.materialPrice)');
  expect(review).toContain('money.format(data.sinkPrice)');
  expect(review).toContain('money.format(data.specialtyPrice)');
  expect(review).toContain('money.format(data.total)');
  expect(review).toContain('quickGeneralSummary(quote).total');
 });
 it('keeps duplicate and selected-row actions reachable without a vertical toolbar',()=>{
  expect(mobile).toContain('.qqs-summary-head.is-selecting>.qqs-bulk');
  expect(mobile).toContain('.qqt-heading.is-selecting .qqt-bulk');
  expect(mobile).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
  expect(areas).toContain('onClick={duplicateSelected}');
  expect(takeoffs).toContain('onClick={()=>duplicateRows(selected)}');
  expect(mobile).toContain('.qqt-row .qqt-actions button');
 });
 it('does not leave floating Undo or More controls over phone worksheets',()=>{
  expect(quote).toContain('qmb-quick-history');
  expect(quote).toContain('SalesDocumentActionsMenu quote={quote}');
  expect(quote).toContain("quote.documentType==='pricing-schedule'&&quoteTab!=='preview'&&<div className=\"qmb-history\"");
  expect(mobile).toContain('.qmb-quote-footer');
  expect(mobile).toContain('white-space:normal');
  expect(mobile).toContain('.qqr-footer');
 });
 it('uses an actionable empty state and touch rather than keyboard instructions',()=>{
  expect(areas).toContain('Start with your first Area');
  expect(areas).toContain('qqs-mobile-hint');
  expect(takeoffs).toContain('qqt-mobile-hint');
  expect(mobile).toContain('.qqs-mobile-empty');
  expect(mobile).toContain('.qqs-desktop-hint{display:none}');
  expect(mobile).toContain('.qqt-desktop-hint{display:none}');
 });
 it('keeps the reusable Area and Saved Layouts pickers accessible on phones',()=>{
  expect(mobile).toContain('.qra-panel');
  expect(mobile).toContain('height:auto;max-height:min(85dvh,740px)');
  expect(mobile).toContain('.qmb-area-preset-dialog header');
  expect(mobile).toContain('position:sticky;bottom:-13px');
  expect(reuse).toContain("document.querySelector('.sales-app')??document.body");
  expect(layouts).toContain("document.querySelector('.sales-app')??document.body");
  expect(mobile).toContain('font-size:16px');
 });
});
