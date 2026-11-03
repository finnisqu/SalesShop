import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const mobile=source('src/quote-quick-mobile.css');
const quote=source('src/components/QuotesMobileBeta.tsx');
const mobileChrome=source('src/components/MobileAppChrome.tsx');
const compactChrome=source('src/mobile-profile-quote-toolbar.css');
const areas=source('src/components/QuoteQuickAreaSummary.tsx');
const takeoffs=source('src/components/QuoteCompactTakeoffs.tsx');
const review=source('src/components/QuoteBetaReview.tsx');
const reuse=source('src/components/QuoteReuseAreaDialog.tsx');
const layouts=source('src/components/QuoteAreaPresetPicker.tsx');
const calculator=source('src/components/QuoteWorkTables.tsx');
const quickArea=source('src/components/QuoteAreaQuickPanel.tsx');

describe('Quick Quote dedicated phone usability contract',()=>{
 it('keeps desktop tables and uses contiguous compact mobile rows',()=>{
  expect(mobile).toContain('@media(max-width:700px)');
  expect(mobile).toContain('.qqs-grid.qqs-row');
  expect(mobile).toContain('grid-template-columns:32px repeat(4,minmax(0,1fr))!important;');
  expect(mobile).toContain('.qqt-grid.qqt-row');
  expect(mobile).toContain('margin:0!important;border-left:0;border-right:0;border-top:0');
  expect(mobile).toContain('.qqs-header{display:none!important}');
  expect(mobile).toContain('.qqt-header{display:none!important}');
 });
 it('replaces phone-wide pricing tables with complete visible values',()=>{
  expect(mobile).toContain('.qqr-table-scroll{display:none}');
  expect(mobile).toContain('.qqr-mobile-totals');
  expect(review).toContain('qqr-mobile-price-table');
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
 it('moves quote navigation and history into the shared mobile app bar',()=>{
  expect(quote).not.toContain('qmb-quote-library-back');
  expect(quote).not.toContain('qmb-quick-history');
  expect(quote).toContain('SalesDocumentActionsMenu quote={quote}');
  expect(quote).toContain('sales-shop:quotes-beta-back');
  expect(mobileChrome).toContain('mobile-quote-back');
  expect(mobileChrome).toContain('mobile-quote-history-button');
  expect(mobileChrome).toContain("onClick={backFromQuote}");
  expect(mobileChrome).toContain('undoQuote(activeQuote.id)');
  expect(mobileChrome).toContain('redoQuote(activeQuote.id)');
  expect(mobileChrome).toContain('mobile-profile-trigger');
  expect(mobileChrome).toContain('openQuickNote');
  expect(mobileChrome).toContain('openSearch');
  expect(mobileChrome).toContain('openCreate');
  expect(mobileChrome).toContain('<BuildBadge compact />');
  expect(compactChrome).toContain('.mobile-profile-panel');
  expect(compactChrome).toContain('.mobile-quote-toolbar-spacer');
  expect(quote).toContain('qmb-pricing-footer-slot');
  expect(review).toContain('footerTarget?createPortal(footer,footerTarget):footer');
  expect(review).not.toContain('className="qmb-pagehead qqr-pagehead"');
 });
 it('uses an actionable empty state and touch rather than keyboard instructions',()=>{
  expect(areas).toContain('Start with your first Area');
  expect(areas).toContain('qqs-mobile-hint');
  expect(takeoffs).toContain('qqt-mobile-hint');
  expect(mobile).toContain('.qqs-mobile-empty');
  expect(mobile).toContain('.qqs-desktop-hint{display:none}');
  expect(mobile).toContain('.qqt-desktop-hint{display:none}');
 });
 it('uses scrollable native-like sheets with visible close and swipe-down dismissal',()=>{
  expect(mobile).toContain('.qmb.qqs-overlay>.qqs-panel');
  expect(mobile).toContain('.qmb.qqt-overlay>.qqt-panel');
  expect(mobile).toContain('border-radius:18px 18px 0 0!important');
  expect(mobile).toContain('animation:quickQuoteSheetEnter');
  expect(mobile).toContain('@media(prefers-reduced-motion:reduce)');
  expect(areas).toContain('onTouchEnd={event=>');
  expect(takeoffs).toContain('onTouchEnd={event=>');
  expect(reuse).toContain('onTouchEnd={event=>');
  expect(layouts).toContain('onTouchEnd={event=>');
  expect(calculator).toContain('sheetSwipeStart.current');
  expect(quickArea).toContain('sheetSwipeStart.current');
  expect(mobile).toContain('.qwt-drawer.qwt-drawer');
  expect(mobile).toContain('.qmb-quick-area-panel.qmb-quick-area-panel');
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
