import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const source=(name:string)=>readFileSync(join(process.cwd(),name),'utf8');
const details=source('src/components/QuoteBetaDetails.tsx');
const history=source('src/components/QuoteBetaHistory.tsx');
const quoteUi=source('src/components/QuotesMobileBeta.tsx');
const review=source('src/components/QuoteBetaReview.tsx');
const sync=source('src/services/normalizedQuoteSync.ts');
const slim=source('src/quote-details-single-column.css');
const settings=source('src/components/CompanySettings.tsx');
describe('Quick Quote Details single-column and secure cloud-save contract',()=>{
  it('keeps an identical narrow, single-column form on desktop and phone',()=>{
    expect(slim).toContain('max-width:430px');
    expect(slim).toContain('flex-direction:column');
    expect(slim).toContain('grid-template-columns:minmax(0,1fr)');
    expect(slim).toContain('@media(max-width:500px)');
    expect(details).toContain('Quote customer and deal details');
  });
  it('puts CRM and revision management under Deal Advanced, not a fourth card',()=>{
    expect(details).toContain('qmb-details-advanced');
    expect(details).toContain('CRM deal link · Document &amp; revisions');
    expect(details).toContain('<QuoteBetaHistory quote={quote} embedded/>');
    expect(history).toContain('is-embedded');
    expect(details).not.toContain('qmb-details-next');
  });
  it('supports sequential Tab and Enter without stealing CRM suggestions or notes newlines',()=>{
    expect(details).toContain("onKeyDownCapture={e=>onEnter('customer',e)}");
    expect(details).toContain("onKeyDownCapture={e=>onEnter('deal',e)}");
    expect(details).toContain("event.nativeEvent.isComposing");
    expect(details).toContain('.quote-crm-suggestions');
    expect(details).toContain('scrollIntoView');
    const crm=source('src/components/QuoteCrmFields.tsx');
    expect(crm).toContain('visible[focused]?.onChoose()');
    expect(details).not.toContain("instanceof HTMLTextAreaElement");
  });
  it('keeps one named Detailed Editor fallback while preserving the Settings switch',()=>{
    expect(quoteUi).not.toContain('>Classic</button>');
    expect(quoteUi).not.toContain('>Classic ↗</button>');
    expect(review).not.toContain('Continue in Classic Quotes');
    expect(settings).toContain("tab === 'beta'");
    expect(settings).toContain('setQuotesBetaEnabled');
    expect(settings).toContain('Open Detailed Editor');
    expect(settings).toContain('Open Quick Quote');
    expect(quoteUi).toContain("label:'Detailed Editor'");
    expect(quoteUi).not.toContain('qmb-library-heading-actions');
  });
  it('inserts fresh owned quotes before upserting existing ones without widening RLS',()=>{
    expect(sync).toContain("const freshQuotes=quotes.filter(row=>!guards.has(String(row.id)));");
    expect(sync).toContain("supabase.from('quotes').insert(freshQuotes)");
    expect(sync).toContain("await upsertRows('quotes', existingQuotes)");
    expect(sync).toContain("const acceptedQuotes = document.quotes.filter");
    expect(sync).toContain('quote.ownerUserId === actorId');
  });
});
