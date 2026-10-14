import {useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canIssueTeamQuote} from '../services/teamDepartments';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {useCrmStore} from '../store/crmStore';
import {confirmedQuoteDeliveries,quoteDeliveryLabel,QUOTE_DELIVERY_METHOD_LABELS} from '../services/quoteDeliveryLifecycle';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {CustomerPreview} from './Quotes';
import {createPricingScheduleData} from '../services/pricingSchedule';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
/** Historical snapshots are frozen: viewing a prior customer document must
 * never substitute it into the active quote or mutate its latest revision. */
export function QuoteBetaHistory({quote}:{quote:Quote}){
  const update=useQuoteStore(s=>s.updateQuote);
  const activities=useCrmStore(s=>s.activities);
  const createChangeOrder=useQuoteStore(s=>s.createChangeOrder);
  const [selected,setSelected]=useState<number|null>(null);
  const editable=quoteIsCommerciallyEditable(quote);
  const authMode=useAuthStore(s=>s.mode);
  const teamRole=useAuthStore(s=>s.teamRole);
  const teamDepartment=useAuthStore(s=>s.teamDepartment);
  const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
  const canCreateOrder=authMode!=='cloud'||(!previewRole&&canIssueTeamQuote(teamRole,teamDepartment));
  const history=[...quote.history].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
  const currentDeliveries=confirmedQuoteDeliveries(quote,activities);
  const currentInHistory=history.some(item=>item.revision===quote.revision);
  const canChangeType=editable&&!quote.templateId&&!history.length&&quote.documentType!=='change-order';
  const snapshot=selected===null?undefined:history[selected];
  const frozen:Quote|undefined=snapshot?{
    ...quote,...snapshot,
    templateId:snapshot.templateId??quote.templateId,
    templateOrigin:snapshot.templateOrigin??quote.templateOrigin,
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
        <small>Current revision, issued snapshots and confirmed customer deliveries</small></div>
    </header>
    <div className="qmb-details-fields">
      <label><span>Document type</span>
        <select aria-label="Document type" disabled={!canChangeType} value={quote.documentType}
          onChange={event=>{
            const documentType=event.target.value as 'quote'|'pricing-schedule';
            update(quote.id,{
              documentType,
              ...(documentType==='pricing-schedule'&&!quote.pricingSchedule?
                {pricingSchedule:createPricingScheduleData(quote.id)}:{}),
            });
          }}>
          <option value="quote">Quick Quote</option>
          <option value="pricing-schedule">Pricing Schedule</option>
          {quote.documentType==='change-order'&&<option value="change-order">Change Order</option>}
        </select>
      </label>
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
    <details className="qmb-lifecycle-revisions" open>
      <summary>Revision timeline <span>{history.length} issued</span></summary>
      {!currentInHistory&&<div className="qmb-lifecycle-revision qmb-lifecycle-current">
        <div><strong>Current revision {quote.revision}{quote.revisionLabel?' · '+quote.revisionLabel:''}</strong>
          <small>{quote.status==='Ready'?'Ready for approval':'Draft'} · Not yet issued or delivered</small>
        </div>
      </div>}
      {history.length?history.map((item,index)=>{
        const deliveries=confirmedQuoteDeliveries({id:quote.id,revision:item.revision},activities);
        const latest=deliveries[0];
        const live=item.revision===quote.revision;
        const lifecycle=quoteDeliveryLabel({status:live?quote.status:item.status},deliveries);
        return <div className="qmb-lifecycle-revision qmb-lifecycle-entry" key={item.revision+'-'+item.capturedAt}>
          <div className="qmb-lifecycle-entry-content">
            <strong>{item.label||('Revision '+item.revision)}{live?' · Current':''}</strong>
            <small>{item.quoteDate} · {quote.documentType==='pricing-schedule'?`${item.pricingSchedule?.customerItems.length??0} price rows`:money.format(item.customerTotal)}</small>
            <span>Issued · {new Date(item.capturedAt).toLocaleString()}</span>
            <span>{lifecycle}{latest?' · '+QUOTE_DELIVERY_METHOD_LABELS[latest.metadata?.deliveryMethod??'other']+' · '+new Date(latest.occurredAt).toLocaleString():''}</span>
            {live&&quote.viewedAt&&<span>Viewed · {new Date(quote.viewedAt).toLocaleString()}</span>}
            {live&&quote.signedAt&&<span>Signed · {new Date(quote.signedAt).toLocaleString()}</span>}
          </div>
          <button type="button" onClick={()=>setSelected(index)}
            aria-label={'View issued revision '+item.revision}>View document</button>
        </div>;
      }):<p className="qmb-help">No issued revisions yet. Issuing will freeze a copy here but will not deliver it to a customer.</p>}
    </details>
    {snapshot&&frozen&&createPortal(<div className="qmb qmb-history-modal-backdrop"
      onPointerDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <section role="dialog" aria-modal="true" aria-label="Historical customer quote" className="qmb-history-modal">
        <header className="qmb-history-modal-heading">
          <div><strong>Frozen customer document · Revision {snapshot.revision}</strong>
            <small>Frozen on {new Date(snapshot.capturedAt).toLocaleString()} · Read-only · Opening this does not alter the live quote</small></div>
          <button type="button" aria-label="Close historical document" onClick={()=>setSelected(null)}>× Close</button>
        </header>
        <div className="qmb-history-document"><CustomerPreview quote={frozen}/></div>
      </section>
    </div>,document.body)}
  </section>;
}
