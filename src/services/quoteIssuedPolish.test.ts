import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

const contract=source('src/components/QuoteContractApproval.tsx');
const contractCss=source('src/components/quote-contract-approval.css');
const delivery=source('src/components/QuoteDeliveryConfirmation.tsx');
const sharing=source('src/components/QuoteShareControl.tsx');
const shareCss=source('src/quote-share.css');
const previewCss=source('src/quotes-mobile-beta.css');
const printCss=source('src/components/quote-print-preview.css');

describe('Issued Quick Quote visual handoff contract',()=>{
 it('replaces post-issue approval language with a separate issued sharing flow',()=>{
  expect(contract).toContain("editable?'Approve this customer quote':'Delivery & sharing'");
  expect(contract).toContain('qca-issued-summary');
  expect(contract).toContain('qca-issued-sharing');
  expect(contract).toContain('qca-issued-delivery');
  expect(contract).toContain('qca-issued-signing');
  expect(contract).toContain('Create editable revision');
 });
 it('retains separate share, delivery confirmation and in-person signing actions',()=>{
  expect(contract).toContain('<QuoteShareControl inline allowCreation={canIssue}/>');
  expect(contract).toContain('<QuoteDeliveryConfirmation quote={quote}');
  expect(contract).toContain('setSignatureOpen(true)');
  expect(sharing).toContain('createQuoteShare(');
  expect(delivery).toContain('recordQuoteDelivered(');
  expect(delivery).toContain('confirmedQuoteDeliveries(');
  expect(delivery).toContain("window.confirm(");
  expect(contract).not.toContain('<QuoteShareControl inline allowCreation={canIssue} autoOpenOnIssue/>');
 });
 it('keeps the share panel in document flow and inherits active theme tokens',()=>{
  expect(contractCss).toContain('.qca-issued-sharing .quote-share-panel');
  expect(contractCss).toContain('position:static!important');
  expect(contractCss).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
  expect(contractCss).toContain('grid-template-columns:minmax(0,1fr)');
  expect(shareCss).toContain('.sales-app .qmb .quote-share-panel');
  expect(shareCss).toContain('background:var(--qmb-card)');
  expect(shareCss).toContain('color:var(--qmb-ink)');
  expect(shareCss).toContain('color:var(--qmb-muted)');
 });
 it('keeps the contract page white while its frame and print-dialog chrome adopt the theme',()=>{
  expect(previewCss).toContain('.qmb-preview>.customer-quote-paper');
  expect(previewCss).toContain('background:var(--qmb-bg);color:var(--qmb-ink)');
  expect(previewCss).toContain('color:#28342d;background:#fff;');
  expect(printCss).toContain('@media screen{');
  expect(printCss).toContain('var(--ss-theme-card,#fff)');
  expect(printCss).toContain('background:#fff;color:#292929;');
  expect(printCss).toContain('@media print{');
 });
});
