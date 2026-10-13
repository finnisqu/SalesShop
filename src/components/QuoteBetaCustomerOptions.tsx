import {useState} from 'react';
import type {Quote} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {QUOTE_STANDARD_TERMS,termsEnabled,toggleCustomerTerm,
  withCustomerTerms,freeCustomerNotes} from '../services/quoteCustomerTerms';

export function QuoteBetaCustomerOptions({quote}:{quote:Quote}){
  const updateQuote=useQuoteStore(s=>s.updateQuote);
  const setColumns=useQuoteStore(s=>s.setCustomerColumns);
  const updateSection=useQuoteStore(s=>s.updateSection);
  const updateLine=useQuoteStore(s=>s.updateLine);
  const [showLines,setShowLines]=useState(false);
  const editable=quoteIsCommerciallyEditable(quote);
  const visible=quote.sections.filter(s=>s.customerVisible).length;
  const termsCount=QUOTE_STANDARD_TERMS.filter(t=>termsEnabled(quote.customerNotes,t.id)).length;
  const setTerm=(id:typeof QUOTE_STANDARD_TERMS[number]['id'],on:boolean)=>
    updateQuote(quote.id,{customerNotes:toggleCustomerTerm(quote.customerNotes,id,on)});
  return <details className="qmb-preview-customer-options" aria-label="Customer viewing options">
    <summary><strong>Customer viewing options</strong>
      <span>{visible}/{quote.sections.length} Areas shown · {termsCount} terms</span>
      <small>Choose what the customer sees</small></summary>
    <div className="qmb-preview-options-body">
      <section><h3>Price table columns</h3>
        <div className="qmb-preview-option-checks">
          {([['quantity','Quantity'],['rate','Rate per unit'],['lineAmount','Line amounts']] as const)
            .map(([key,label])=><label key={key}><input type="checkbox"
              checked={quote.customerColumns[key]} disabled={!editable}
              onChange={e=>setColumns(quote.id,{[key]:e.target.checked})}/>{label}</label>)}
        </div>
      </section>
      <section><h3>Areas and presentation</h3>
        <div className="qmb-preview-areas-options">
          {quote.sections.map(s=><div key={s.id} className="qmb-preview-area-option">
            <label><input type="checkbox" disabled={!editable}
              aria-label={'Show '+s.title+' to customer'} checked={s.customerVisible}
              onChange={e=>updateSection(quote.id,s.id,{customerVisible:e.target.checked})}/>
              <strong>{s.title||'Untitled Area'}</strong>
            </label>
            <div className="qmb-preview-display-buttons" role="group"
              aria-label={'Presentation for '+s.title}>
              <button type="button" disabled={!editable} aria-pressed={s.customerDisplayMode==='detail'}
                onClick={()=>updateSection(quote.id,s.id,{customerDisplayMode:'detail'})}>Itemized</button>
              <button type="button" disabled={!editable} aria-pressed={s.customerDisplayMode==='summary'}
                onClick={()=>updateSection(quote.id,s.id,{customerDisplayMode:'summary'})}>Lump sum</button>
            </div>
          </div>)}
          {!quote.sections.length&&<p>No Areas have been added yet.</p>}
        </div>
      </section>
      <section><h3>Line-by-line visibility</h3>
        <button type="button" aria-expanded={showLines}
          onClick={()=>setShowLines(v=>!v)} className="qmb-preview-options-expand">
          {showLines?'Hide line controls':'Choose visible lines'} <span>›</span>
        </button>
        {showLines&&<div className="qmb-preview-line-options">
          {quote.lines.map(line=><label key={line.id}>
            <input type="checkbox" checked={line.customerVisible} disabled={!editable}
              onChange={e=>updateLine(quote.id,line.id,{customerVisible:e.target.checked})}/>
            <span>{line.description||'Untitled line'}</span></label>)}
        </div>}
      </section>
      <section><h3>Scope, payment and policies</h3>
        <small className="qmb-preview-terms-caption">
          Optional World Stone wording from the supplied quote template. Review before sending.
        </small>
        <div className="qmb-preview-option-checks is-terms">
          {QUOTE_STANDARD_TERMS.map(term=><label key={term.id} title={term.text}>
            <input type="checkbox" disabled={!editable} checked={termsEnabled(quote.customerNotes,term.id)}
              onChange={e=>setTerm(term.id,e.target.checked)}/>
            <span><strong>{term.title}</strong><small>{term.text}</small></span>
          </label>)}
        </div>
        <div className="qmb-preview-term-actions">
          <button type="button" disabled={!editable} onClick={()=>
            updateQuote(quote.id,{customerNotes:withCustomerTerms(quote.customerNotes,
              QUOTE_STANDARD_TERMS.map(t=>t.id))})}>Select all template terms</button>
          <button type="button" disabled={!editable} onClick={()=>
            updateQuote(quote.id,{customerNotes:withCustomerTerms(quote.customerNotes,[])})}>
            Clear template terms</button>
        </div>
        <label className="qmb-preview-other-notes">Other customer notes
          <textarea rows={3} disabled={!editable} value={freeCustomerNotes(quote.customerNotes)}
            placeholder="Other notes or special conditions…"
            onChange={e=>{
              const ids=QUOTE_STANDARD_TERMS.filter(t=>termsEnabled(quote.customerNotes,t.id))
                .map(t=>t.id);
              updateQuote(quote.id,{customerNotes:withCustomerTerms(e.target.value,ids)});
            }}/>
        </label>
      </section>
      <section><h3>Customer appendix</h3>
        <label className="qmb-preview-appendix"><input type="checkbox" disabled={!editable}
          checked={Boolean(quote.attachSelectionsSheet)} onChange={e=>
            updateQuote(quote.id,{attachSelectionsSheet:e.target.checked})}/>
          Include customer-facing Job Selections sheet</label>
      </section>
    </div>
  </details>;
}
