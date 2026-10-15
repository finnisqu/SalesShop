import { useState } from 'react';
import { QUOTE_STANDARD_TERMS } from '../services/quoteCustomerTerms';

/** Read-only source library. The selected clause is copied into the person's
 * clipboard; we never silently change issued customer documents. */
export function CompanyDocumentTermsReference() {
  const [copied,setCopied]=useState<string|null>(null);
  const copy=async (id:string,text:string)=>{
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch { setCopied('failed'); }
  };
  return <article className="company-settings-card settings-terms-card">
    <header><div><strong>Standard quote wording</strong>
      <small>Ready-to-use customer clauses from the existing quote editor.</small></div></header>
    <div className="settings-terms-list">
      {QUOTE_STANDARD_TERMS.map(term=><section className="settings-term-row" key={term.id}>
        <div><strong>{term.title}</strong><p>{term.text}</p></div>
        <button type="button" onClick={()=>void copy(term.id,term.text)}
          aria-label={'Copy '+term.title}>{copied===term.id?'Copied ✓':'Copy'}</button>
      </section>)}
    </div>
    {copied==='failed'&&<p role="alert" className="settings-help">Could not access clipboard; select and copy the wording directly.</p>}
    <p className="settings-help">Reference only: these are built-in standard clauses, not editable or auto-applied company defaults. Quote customer notes change only when a salesperson deliberately includes a term. Shared company templates will need a dedicated cloud-backed library.</p>
  </article>;
}
