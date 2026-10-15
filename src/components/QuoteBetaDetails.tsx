import { QuoteCrmFields } from './QuoteCrmFields';
import {QuoteBetaHistory} from './QuoteBetaHistory';
import { QuoteNotesFields } from './QuoteEditorFields';
import { useQuoteStore } from '../store/quoteStore';
import { RATE_BOOK_DIVISIONS, type RateBookDivision } from '../types/rateBook';
import type { Quote } from '../types/quote';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import {QUOTE_STANDARD_TERMS,freeCustomerNotes,termsEnabled,withCustomerTerms} from '../services/quoteCustomerTerms';

/** Mobile-first Details: customer -> project -> notes.
 * Never navigates away to Board from a CRM link or selection. */
export function QuoteBetaDetails({quote}:{quote:Quote}) {
  const update=useQuoteStore(state=>state.updateQuote);
  const editable=quoteIsCommerciallyEditable(quote);
  return <div className="qmb-details-page" role="region" aria-label="Quote customer and deal details">
    <section className="qmb-details-section qmb-card" aria-labelledby="qmb-details-customer">
      <header className="qmb-details-heading">
        <span className="qmb-details-step">1</span>
        <div><h3 id="qmb-details-customer">Customer</h3>
          <small>Who will receive the quote?</small></div>
      </header>
      <QuoteCrmFields quote={quote} compactSection="customer" editable={editable}/>
    </section>
    <section className="qmb-details-section qmb-card" aria-labelledby="qmb-details-project">
      <header className="qmb-details-heading">
        <span className="qmb-details-step">2</span>
        <div><h3 id="qmb-details-project">Deal details</h3>
          <small>Quote date, job location and pricing context</small></div>
      </header>
      <div className="qmb-details-fields">
        <label><span>Quote date</span><input type="date" value={quote.quoteDate}
          disabled={!editable} onChange={e=>update(quote.id,{quoteDate:e.target.value})}/></label>
        <label><span>Job address</span><input value={quote.address??''} disabled={!editable}
          placeholder="Street, city or jobsite location"
          onChange={e=>update(quote.id,{address:e.target.value})}/></label>
        <label><span>Division / pricing</span>
          <select disabled={!editable} value={quote.pricingDivision??''}
            onChange={e=>update(quote.id,{pricingDivision:(e.target.value||undefined) as RateBookDivision|undefined})}>
            <option value="">Base company rates</option>
            {RATE_BOOK_DIVISIONS.map(division=><option key={division} value={division}>{division}</option>)}
          </select>
        </label>
      </div>
      <details className="qmb-details-project-lookup">
        <summary>CRM deal link <span>Optional</span></summary>
        <QuoteCrmFields quote={quote} compactSection="project" editable={editable}/>
      </details>
    </section>
    <section className="qmb-details-section qmb-card" aria-labelledby="qmb-details-notes">
      <header className="qmb-details-heading">
        <span className="qmb-details-step">3</span>
        <div><h3 id="qmb-details-notes">Notes</h3>
          <small>Customer-facing and private information</small></div>
      </header>
      <fieldset className="qmb-details-notes-fields" disabled={!editable}>
        <QuoteNotesFields customerNotes={freeCustomerNotes(quote.customerNotes)}
          internalNotes={quote.internalNotes}
          onCustomerChange={value=>{
            const enabled=QUOTE_STANDARD_TERMS.filter(term=>termsEnabled(quote.customerNotes,term.id))
              .map(term=>term.id);
            update(quote.id,{customerNotes:withCustomerTerms(value,enabled)});
          }}
          onInternalChange={value=>update(quote.id,{internalNotes:value})}/>
      </fieldset>
    </section>
    <QuoteBetaHistory quote={quote}/>
  </div>;
}
