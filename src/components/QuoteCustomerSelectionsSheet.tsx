import type {CustomerSelectionRow} from '../services/quoteCustomerSelections';

export function QuoteCustomerSelectionsSheet({rows}:{rows:readonly CustomerSelectionRow[]}) {
  if(!rows.length)return null;
  return <section className="quote-customer-selections" aria-label="Customer selections appendix">
    <h3>Selections</h3>
    <p>Materials and finish choices included with this proposal.</p>
    {rows.map(row=><div className="quote-customer-selection-area" key={row.id}>
      <strong>{row.area}</strong>
      {row.material&&<div><span>Material</span><b>{row.material}</b></div>}
      {row.sinkModels.length>0&&<div><span>Sinks</span><b>{row.sinkModels.join(' · ')}</b></div>}
      {row.edgeProfiles.length>0&&<div><span>Edge</span><b>{row.edgeProfiles.join(' / ')}</b></div>}
      {row.splashHeights.length>0&&<div><span>Backsplash</span><b>{row.splashHeights.join(' / ')}</b></div>}
    </div>)}
  </section>;
}
