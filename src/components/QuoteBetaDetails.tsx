import {useRef,type KeyboardEvent as ReactKeyboardEvent,type FocusEvent as ReactFocusEvent} from 'react';
import {QuoteCrmFields} from './QuoteCrmFields';
import {QuoteBetaHistory} from './QuoteBetaHistory';
import {QuoteNotesFields} from './QuoteEditorFields';
import {useQuoteStore} from '../store/quoteStore';
import {RATE_BOOK_DIVISIONS,type RateBookDivision} from '../types/rateBook';
import type {Quote} from '../types/quote';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {QUOTE_STANDARD_TERMS,freeCustomerNotes,termsEnabled,withCustomerTerms} from '../services/quoteCustomerTerms';

type SectionName='customer'|'deal'|'notes';
const navigable='input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), summary';
/** A single narrow, ordered form on all screen sizes. Enter in a text field
 * advances focus without submitting; Tab and native controls are preserved. */
export function QuoteBetaDetails({quote}:{quote:Quote}){
  const update=useQuoteStore(state=>state.updateQuote);
  const editable=quoteIsCommerciallyEditable(quote);
  const sections=useRef<Record<SectionName,HTMLElement|null>>({customer:null,deal:null,notes:null});
  const focusables=(section:SectionName)=>Array.from(sections.current[section]?.querySelectorAll<HTMLElement>(navigable)??[])
    .filter(el=>!el.closest('details:not([open])')&&!el.closest('[hidden]'));
  const jump=(section:SectionName,focus=true)=>{
    const el=sections.current[section];
    if(!el)return;
    el.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    if(focus)focusables(section)[0]?.focus({preventScroll:true});
  };
  const onEnter=(section:SectionName,event:ReactKeyboardEvent<HTMLElement>)=>{
    if(event.key!=='Enter'||event.defaultPrevented||event.nativeEvent.isComposing||!editable)return;
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||!['text','email','search','url','tel'].includes(target.type))return;
    // Autocomplete selects its own suggestions with Enter.
    if(target.closest('.quote-crm-input-wrap')?.querySelector('.quote-crm-suggestions'))return;
    const inputs=focusables(section),index=inputs.indexOf(target);
    if(index<0)return;
    const next=inputs.slice(index+1).find(el=>el.tagName!=='SUMMARY');
    event.preventDefault();
    if(next){next.focus();return;}
    if(section==='customer')jump('deal');
    else if(section==='deal')jump('notes');
    else target.blur();
  };
  const onExit=(section:SectionName,event:ReactFocusEvent<HTMLElement>)=>{
    const next=event.relatedTarget;
    if(!(next instanceof HTMLElement))return;
    const following:SectionName|null=section==='customer'?'deal':section==='deal'?'notes':null;
    if(following&&sections.current[following]?.contains(next)&&!sections.current[section]?.contains(next)){
      sections.current[following]?.scrollIntoView({block:'start',behavior:'smooth'});
    }
  };
  return <div className="qmb-details-page" role="region" aria-label="Quote customer and deal details">
    <section ref={el=>{sections.current.customer=el;}} className="qmb-details-section qmb-card"
      aria-labelledby="qmb-details-customer" onKeyDownCapture={e=>onEnter('customer',e)}
      onBlurCapture={e=>onExit('customer',e)}>
      <header className="qmb-details-heading"><span className="qmb-details-step">1</span>
        <div><h3 id="qmb-details-customer">Customer</h3>
          <small>Who will receive the quote?</small></div>
      </header>
      <QuoteCrmFields quote={quote} compactSection="customer" editable={editable}/>
    </section>
    <section ref={el=>{sections.current.deal=el;}} className="qmb-details-section qmb-card"
      aria-labelledby="qmb-details-project" onKeyDownCapture={e=>onEnter('deal',e)}
      onBlurCapture={e=>onExit('deal',e)}>
      <header className="qmb-details-heading"><span className="qmb-details-step">2</span>
        <div><h3 id="qmb-details-project">Deal details</h3>
          <small>Job location and pricing context</small></div>
      </header>
      <div className="qmb-details-fields">
        <label><span>Quote date</span><input type="date" value={quote.quoteDate}
          disabled={!editable} onChange={e=>update(quote.id,{quoteDate:e.target.value})}/></label>
        <label><span>Job address</span><input type="text" value={quote.address??''} disabled={!editable}
          placeholder="Street, city or jobsite location" onChange={e=>update(quote.id,{address:e.target.value})}/></label>
        <label><span>Division / pricing</span><select disabled={!editable} value={quote.pricingDivision??''}
          onChange={e=>update(quote.id,{pricingDivision:(e.target.value||undefined) as RateBookDivision|undefined})}>
          <option value="">Base company rates</option>
          {RATE_BOOK_DIVISIONS.map(division=><option key={division} value={division}>{division}</option>)}
        </select></label>
      </div>
      <details className="qmb-details-advanced" aria-label="Advanced deal and document settings">
        <summary>Advanced <span>CRM deal link · Document &amp; revisions</span></summary>
        <div className="qmb-details-advanced-body">
          <div className="qmb-details-advanced-group">
            <h4>CRM deal link</h4>
            <QuoteCrmFields quote={quote} compactSection="project" editable={editable}/>
          </div>
          <QuoteBetaHistory quote={quote} embedded/>
        </div>
      </details>
    </section>
    <section ref={el=>{sections.current.notes=el;}} className="qmb-details-section qmb-card"
      aria-labelledby="qmb-details-notes" onKeyDownCapture={e=>onEnter('notes',e)}>
      <header className="qmb-details-heading"><span className="qmb-details-step">3</span>
        <div><h3 id="qmb-details-notes">Notes</h3>
          <small>Customer-facing and private information</small></div>
      </header>
      <fieldset className="qmb-details-notes-fields" disabled={!editable}>
        <QuoteNotesFields customerNotes={freeCustomerNotes(quote.customerNotes)}
          internalNotes={quote.internalNotes}
          onCustomerChange={value=>{
            const enabled=QUOTE_STANDARD_TERMS.filter(term=>termsEnabled(quote.customerNotes,term.id)).map(term=>term.id);
            update(quote.id,{customerNotes:withCustomerTerms(value,enabled)});
          }}
          onInternalChange={value=>update(quote.id,{internalNotes:value})}/>
      </fieldset>
    </section>
    <p className="qmb-details-save-note">Changes save automatically. Tab moves between fields. Enter advances through text fields; Enter in notes adds a new line.</p>
  </div>;
}
