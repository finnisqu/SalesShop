import {useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canIssueTeamQuote} from '../services/teamDepartments';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {CustomerPreview} from './Quotes';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
/** Historical snapshots are frozen: viewing a prior customer document must
 * never substitute it into the active quote or mutate its latest revision. */
export function QuoteBetaHistory({quote}:{quote:Quote}){
  const update=useQuoteStore(s=>s.updateQuote);
  const createChangeOrder=useQuoteStore(s=>s.createChangeOrder);
  const [selected,setSelected]=useState<number|null>(null);
  const editable=quoteIsCommerciallyEditable(quote);
  const authMode=useAuthStore(s=>s.mode);
  const teamRole=useAuthStore(s=>s.teamRole);
  const teamDepartment=useAuthStore(s=>s.teamDepartment);
  const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
  const canCreateOrder=authMode!=='cloud'||(!previewRole&&canIssueTeamQuote(teamRole,teamDepartment));
  const history=[...quote.history].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
  const snapshot=selected===null?undefined:history[selected];
  const frozen:Quote|undefined=snapshot?{
    ...quote,...snapshot,
    revision:snapshot.revision,
    revisionLabel:snapshot.label,
    status:snapshot.status,
    sections:snapshot.sections,
    lines:snapshot.lines,
    customerColumns:snapshot.customerColumns,
    customerNotes:snapshot.customerNotes,
    pricingSchedule:snapshot.pricingSchedule,
  }:undefined;
  return <section className="qmb-details-section qmb-card qmb-lifecycle-card" aria-label="Quote document and history">
    <header className="qmb-details-heading">
      <span className="qmb-details-step">4</span><div><h3>Document &amp; revisions</h3>
        <small>Current document setup and immutable sent history</small></div>
    </header>
    <div className="qmb-details-fields">
      <label><span>Revision / option label</span>
        <input aria-label="Revision or option label" disabled={!editable} maxLength={120}
          placeholder="Optional · Example: VE Option A" value={quote.revisionLabel??''}
          onChange={e=>update(quote.id,{revisionLabel:e.target.value})}/>
      </label>
      <label><span>Draft status</span>
        <select aria-label="Draft status" disabled={!editable}
          value={editable&&quote.status==='Ready'?'Ready':editable?'Draft':quote.status}
          onChange={e=>update(quote.id,{status:e.target.value as 'Draft'|'Ready'})}>
          <option value="Draft">Draft</option><option value="Ready">Ready for review</option>
          {!editable&&quote.status!=='Ready'&&quote.status!=='Draft'&&<option value={quote.status}>{quote.status}</option>}
        </select>
      </label>
    </div>
    {quote.status==='Signed'&&canCreateOrder&&<button type="button" className="qmb-lifecycle-change-order"
      onClick={()=>createChangeOrder(quote.id)}>+ Create Change Order from signed quote</button>}
    <details className="qmb-lifecycle-revisions">
      <summary>Sent revision history <span>{history.length}</span></summary>
      {history.length?history.map((item,index)=><div className="qmb-lifecycle-revision" key={item.revision+'-'+item.capturedAt}>
        <div><strong>{item.label||('Revision '+item.revision)}</strong>
          <small>{item.status} · {item.quoteDate} · {money.format(item.customerTotal)}</small></div>
        <button type="button" onClick={()=>setSelected(index)}
          aria-label={'View sent revision '+item.revision}>View document</button>
      </div>):<p className="qmb-help">No issued revisions yet. Sending the quote will freeze a copy here.</p>}
    </details>
    {snapshot&&frozen&&createPortal(<div className="qmb qmb-history-modal-backdrop"
      onPointerDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <section role="dialog" aria-modal="true" aria-label="Historical customer quote" className="qmb-history-modal">
        <header className="qmb-history-modal-heading">
          <div><strong>Frozen customer document · Revision {snapshot.revision}</strong>
            <small>Issued {new Date(snapshot.capturedAt).toLocaleString()} · Read-only</small></div>
          <button type="button" aria-label="Close historical document" onClick={()=>setSelected(null)}>× Close</button>
        </header>
        <div className="qmb-history-document"><CustomerPreview quote={frozen}/></div>
      </section>
    </div>,document.body)}
  </section>;
}
