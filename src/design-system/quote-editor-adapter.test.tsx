import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  QuoteDocumentSetupFields,
  QuoteNotesFields,
  QuoteRevisionLabelField,
} from '../components/QuoteEditorFields';

const source=readFileSync(new URL('../components/Quotes.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('./quote-editor-adapter.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../main.tsx',import.meta.url),'utf8');

describe('UI Foundation Batch 9 — Quotes internal editor',()=>{
  it('renders correctly labeled setup fields with guarded issuance statuses',()=>{
    const html=renderToStaticMarkup(<QuoteDocumentSetupFields
      quote={{status:'Draft',quoteDate:'2026-10-10'}}
      onStatusChange={()=>{}} onDateChange={()=>{}}/>);
    for(const key of ['status','date']){
      expect(html).toContain(`id="quote-document-${key}"`);
      expect(html).toContain(`for="quote-document-${key}"`);
    }
    expect(html).toContain('type="date"');
    expect(html).toContain('2026-10-10');
    expect(html).toContain('disabled=""'); // Signed and Sent options cannot be selected from Draft.
    const signed=renderToStaticMarkup(<QuoteDocumentSetupFields
      quote={{status:'Signed',quoteDate:'2026-09-01'}}
      onStatusChange={()=>{}} onDateChange={()=>{}}/>);
    expect(signed).toContain('<select');
    expect(signed).toContain('disabled=""');
  });

  it('gives revision, customer notes, and private internal notes distinct labels',()=>{
    const revision=renderToStaticMarkup(<QuoteRevisionLabelField value="Option A" onChange={()=>{}}/>);
    expect(revision).toContain('for="quote-revision-label"');
    expect(revision).toContain('id="quote-revision-label"');
    expect(revision).toContain('Option A');
    const notes=renderToStaticMarkup(<QuoteNotesFields
      customerNotes="Customer-visible schedule" internalNotes="Private margin analysis"
      onCustomerChange={()=>{}} onInternalChange={()=>{}}/>);
    for(const id of ['customer','internal']){
      expect(notes).toContain(`for="quote-${id}-notes"`);
      expect(notes).toContain(`id="quote-${id}-notes"`);
    }
    expect(notes).toContain('Customer-visible schedule');
    expect(notes).toContain('Private margin analysis');
    expect(notes).toContain('internal-notes');
    expect(notes).toContain('Appears on customer document');
  });

  it('keeps the exact QuoteStore handlers and customer/private note separation',()=>{
    for(const needle of [
      '<QuoteDocumentSetupFields quote={quote}',
      'onStatusChange={(status) => updateQuote(quote.id, { status })}',
      'onDateChange={(quoteDate) => updateQuote(quote.id, { quoteDate })}',
      '<QuoteRevisionLabelField value={quote.revisionLabel',
      'onChange={(revisionLabel) => updateQuote(quote.id, { revisionLabel })}',
      '<QuoteNotesFields customerNotes={quote.customerNotes} internalNotes={quote.internalNotes}',
      'onCustomerChange={(customerNotes) => updateQuote(quote.id, { customerNotes })}',
      'onInternalChange={(internalNotes) => updateQuote(quote.id, { internalNotes })}',
    ])expect(source,`Quote editor wiring missing: ${needle}`).toContain(needle);
  });

  it('keeps the three setup disclosures accessible and editable names labeled',()=>{
    for(const panel of ['document','project','visibility']){
      expect(source).toContain(`aria-controls="quote-setup-${panel}"`);
      expect(source).toContain(`aria-expanded={metaPanel === '${panel}'}`);
      expect(source).toContain(`id="quote-setup-${panel}"`);
    }
    expect(source).toContain('aria-label="Area name"');
    expect(source).toContain('aria-label="Quote title"');
  });

  it('preserves pricing, snapshots, revisions, sending, signatures and customer preview',()=>{
    for(const action of [
      'recordSent(','createRevision(','createChangeOrder(',
      '<QuoteShareControl','<QuoteSignatureDialog',
      '<QuoteInternalPricingSummary','<QuoteSinkLineFields',
      '<QuoteMaterialLineFields','<QuoteRateLineFields',
      '<PricingScheduleWorkbook','<CustomerPreview',
      '<LineEditor','quoteLineAmount(', 'quoteTotal(', 'reorderLine(',
      'canIssueQuote','commerciallyEditable',
    ])expect(source,`Quotes operation lost: ${action}`).toContain(action);
  });

  it('uses theme-paired editor-only colors and leaves customer document presentation alone',()=>{
    for(const selector of [
      '.sales-app.view-quotes .quotes-workbench',
      '.quote-foundation-fields','.quote-revision-label-field',
      '.quote-foundation-notes','.quote-config-popover',
      '.quote-area-scope-popover','.quote-pricing-popover',
      '.quote-area-card','.quote-line-editor',
    ])expect(css,`Missing editor styling: ${selector}`).toContain(selector);
    expect(css).toContain('background:var(--ss-quote-field-card)');
    expect(css).toContain('color:var(--ss-quote-field-ink)');
    expect(css).not.toMatch(/\n\s*[^*\n]*\.customer-quote-paper\s*\{/);
    expect(css).not.toMatch(/\n\s*[^*\n]*\.customer-quote-letterhead\s*\{/);
    expect(main.indexOf("import './design-system/quote-editor-adapter.css'"))
      .toBeGreaterThan(main.indexOf("import './design-system/quotes-adapter.css'"));
  });

  it('keeps phone and rotated-phone popovers scrollable, with readable input sizes',()=>{
    expect(css).toContain('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)');
    expect(css).toContain('max-height:min(66dvh,430px)');
    expect(css).toContain('overscroll-behavior:contain');
    expect(css).toContain('font-size:16px');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('-webkit-overflow-scrolling:touch');
    const qChrome=readFileSync(new URL('./quotes-adapter.css',import.meta.url),'utf8');
    expect(qChrome).toContain('.quote-mobile-menu-footer');
    expect(source).toContain('className="quote-mobile-menu-footer"');
    expect(source).toContain('onClick={() => setMobileMenu(null)}');
  });
});
