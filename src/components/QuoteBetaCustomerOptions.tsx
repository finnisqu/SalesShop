import {useState} from 'react';
import type {Quote} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {QUOTE_STANDARD_TERMS,termsEnabled,toggleCustomerTerm,
  withCustomerTerms,freeCustomerNotes} from '../services/quoteCustomerTerms';

export function QuoteBetaCustomerOptions({quote}:{quote:Quote}){
  const updateQuote=useQuoteStore(s=>s.updateQuote);
  const setColumns=useQuoteStore(s=>s.setCustomerColumns);
  const setAllCustomerDisplayModes=useQuoteStore(s=>s.setAllCustomerDisplayModes);
  const updateSection=useQuoteStore(s=>s.updateSection);
  const updateLine=useQuoteStore(s=>s.updateLine);
  const [showLines,setShowLines]=useState(false);
  const editable=quoteIsCommerciallyEditable(quote);
  const visible=quote.sections.filter(s=>s.customerVisible).length;
  const lumpSum=quote.sections.filter(s=>s.customerDisplayMode==='summary').length;
  const knownAreaIds=new Set(quote.sections.map(s=>s.id));
  const lineGroups=[
    {id:'general',title:'General charges',shown:true,itemized:true,
      lines:quote.lines.filter(line=>!line.sectionId||!knownAreaIds.has(line.sectionId))},
    ...quote.sections.map(section=>({
      id:section.id,title:section.title||'Untitled Area',shown:section.customerVisible,
      itemized:section.customerDisplayMode!=='summary',
      lines:quote.lines.filter(line=>line.sectionId===section.id),
    })),
  ].filter(group=>group.lines.length>0);
  const applyAllModes=(mode:'detail'|'summary')=>setAllCustomerDisplayModes(quote.id,mode);
  const termsCount=QUOTE_STANDARD_TERMS.filter(t=>termsEnabled(quote.customerNotes,t.id)).length;
  const setTerm=(id:typeof QUOTE_STANDARD_TERMS[number]['id'],on:boolean)=>
    updateQuote(quote.id,{customerNotes:toggleCustomerTerm(quote.customerNotes,id,on)});
  return <details className="qmb-preview-customer-options" aria-label="Customer viewing options">
    <summary><strong>Customer viewing options</strong>
      <span>{visible}/{quote.sections.length} Areas shown · {lumpSum} lump sum · {termsCount} terms</span>
      <small>Choose what the customer sees</small></summary>
    <div className="qmb-preview-options-body">
      <section><h3>Price table columns</h3>
        <small className="qmb-preview-options-hint">Line amounts controls individual prices, including lump-sum Area prices. The final quote total stays visible.</small>
        <div className="qmb-preview-option-checks">
          {([['quantity','Quantity'],['rate','Rate per unit'],['lineAmount','Line amounts']] as const)
            .map(([key,label])=><label key={key}><input type="checkbox"
              checked={quote.customerColumns[key]} disabled={!editable}
              onChange={e=>setColumns(quote.id,{[key]:e.target.checked})}/>{label}</label>)}
        </div>
      </section>
      <section><h3>Areas and presentation</h3>
        <small className="qmb-preview-options-hint">Itemized lists visible charges. Lump sum combines the Area into one price; neither changes the selling total. Hiding an Area moves its price into General project scope.</small>
        {quote.sections.length>1&&<div className="qmb-preview-presentation-all" role="group" aria-label="Presentation for all Areas">
          <button type="button" disabled={!editable}
            aria-pressed={quote.sections.every(section=>section.customerDisplayMode!=='summary')}
            onClick={()=>applyAllModes('detail')}>All itemized</button>
          <button type="button" disabled={!editable}
            aria-pressed={quote.sections.every(section=>section.customerDisplayMode==='summary')}
            onClick={()=>applyAllModes('summary')}>All lump sum</button>
        </div>}
        <div className="qmb-preview-areas-options">
          {quote.sections.map(s=><div key={s.id} className="qmb-preview-area-option">
            <label><input type="checkbox" disabled={!editable}
              aria-label={'Show '+s.title+' to customer'} checked={s.customerVisible}
              onChange={e=>updateSection(quote.id,s.id,{customerVisible:e.target.checked})}/>
              <strong>{s.title||'Untitled Area'}</strong>
            </label>
            <div className="qmb-preview-display-buttons" role="group"
              aria-label={'Presentation for '+s.title}>
              <button type="button" disabled={!editable} aria-pressed={s.customerDisplayMode!=='summary'}
                onClick={()=>updateSection(quote.id,s.id,{customerDisplayMode:'detail'})}>Itemized</button>
              <button type="button" disabled={!editable} aria-pressed={s.customerDisplayMode==='summary'}
                onClick={()=>updateSection(quote.id,s.id,{customerDisplayMode:'summary'})}>Lump sum</button>
            </div>
          </div>)}
          {!quote.sections.length&&<p>No Areas have been added yet.</p>}
        </div>
      </section>
      <section><h3>Line-by-line visibility</h3>
        <small className="qmb-preview-options-hint">Hiding an included charge hides its description, not its price. Its amount rolls into a visible charge or an “Included work” row. To remove a charge from the quote total, edit the charge itself.</small>
        <button type="button" aria-expanded={showLines}
          onClick={()=>setShowLines(v=>!v)} className="qmb-preview-options-expand">
          {showLines?'Hide line controls':'Choose visible lines'} <span>›</span>
        </button>
        {showLines&&<div className="qmb-preview-line-options">
          {lineGroups.map(group=><div className="qmb-preview-line-group" role="group"
            aria-label={'Line visibility for '+group.title} key={group.id}>
            <header><strong>{group.title}</strong>
              <span>{group.lines.filter(l=>l.customerVisible).length}/{group.lines.length} shown</span></header>
            {!group.shown&&<small>Area hidden · priced work is shown under General project scope.</small>}
            {group.shown&&!group.itemized&&<small>Lump sum · these descriptions will not appear separately.</small>}
            {group.lines.map(line=><label key={line.id}>
              <input type="checkbox" checked={line.customerVisible} disabled={!editable}
                aria-label={'Show '+(line.description||'Untitled line')+' in '+group.title}
                onChange={e=>updateLine(quote.id,line.id,{customerVisible:e.target.checked})}/>
              <span>{line.description||'Untitled line'}</span>
            </label>)}
          </div>)}
          {!lineGroups.length&&<small>No charge lines to configure yet.</small>}
        </div>}
      </section>
      <section><h3>Scope, payment and policies</h3>
        <small className="qmb-preview-terms-caption">
          Optional World Stone wording from the supplied quote template. Review before issuing or sharing.
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
