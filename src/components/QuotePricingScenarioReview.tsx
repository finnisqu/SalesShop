import {useState} from 'react';
import type {Quote} from '../types/quote';
import {quotePricingScenarios} from '../services/quotePricingScenarios';
import './quote-pricing-scenarios.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
function optionalNumber(value:string){if(!value.trim())return undefined;const n=Number(value);return Number.isFinite(n)&&n>=0?n:undefined;}
export function QuotePricingScenarioReview({quote}:{quote:Quote}){
 const [margin,setMargin]=useState('30');
 const [multiplier,setMultiplier]=useState('2.2');
 const [sfRate,setSfRate]=useState('');
 const [units,setUnits]=useState('');
 const target=optionalNumber(margin),multiple=optionalNumber(multiplier);
 const comparison=quotePricingScenarios(quote,(target??30)/100,multiple??2.2,
  optionalNumber(sfRate),optionalNumber(units));
 return <section className="qsr-panel" aria-label="Private quote-wide pricing review">
  <header><div><strong>Quote-wide cost & pricing comparison</strong>
   <small>PRIVATE · scenarios do not overwrite the quote</small></div>
   <strong>{comparison.complete?'Costed':'Cost estimate incomplete'}</strong></header>
  <div className="qsr-summary">
   <span><small>Areas</small><strong>{comparison.areaCount}</strong></span>
   <span><small>Billable SF</small><strong>{comparison.totalSf.toFixed(2)}</strong></span>
   <span><small>Known costs</small><strong>{money.format(comparison.knownCosts)}</strong></span>
  </div>
  <div className="qsr-inputs">
   <label>Target margin %<input aria-label="Scenario target gross margin percent" type="number"
    min="0" max="95" step=".5" value={margin} onChange={e=>setMargin(e.target.value)}/></label>
   <label>Slab multiplier<input aria-label="Scenario slab multiplier" type="number"
    min=".1" max="50" step=".1" value={multiplier} onChange={e=>setMultiplier(e.target.value)}/></label>
   <label>Comparison $/SF<input aria-label="Scenario override selling per square foot"
    type="number" min="0" step=".01" placeholder="Area rates" value={sfRate}
    onChange={e=>setSfRate(e.target.value)}/></label>
   <label>Project units<input aria-label="Project unit count for pricing comparison"
    type="number" min="1" step="1" placeholder="Optional" value={units}
    onChange={e=>setUnits(e.target.value)}/></label>
  </div>
  <div className="qsr-table-scroll"><table>
   <thead><tr><th scope="col">Scenario</th><th scope="col">Price</th>
    <th scope="col">Gross profit</th><th scope="col">Margin</th>
    <th scope="col">$/SF</th><th scope="col">$/unit</th></tr></thead>
   <tbody>{[comparison.current,comparison.target,comparison.bySf,comparison.bySlab].map(row=>
    <tr key={row.label} title={row.reason??''}><th scope="row">{row.label}</th>
     <td>{row.price===undefined?'—':money.format(row.price)}</td>
     <td>{row.profit===undefined?'—':money.format(row.profit)}</td>
     <td>{row.margin===undefined?'—':row.margin.toFixed(1)+'%'}</td>
     <td>{row.perSf===undefined?'—':money.format(row.perSf)}</td>
     <td>{row.perUnit===undefined?'—':money.format(row.perUnit)}</td>
    </tr>)}</tbody>
  </table></div>
  {!comparison.complete&&<p className="qsr-warning">Missing buying costs are not treated as $0:
    {' '+comparison.missing.slice(0,5).join(' · ')}
    {comparison.missing.length>5?' (and more)':''}</p>}
  <p className="qsr-note">Changing these comparison inputs does not change saved quote prices.
   Area pricing methods, target margin and multiplier can be edited in the table or Calculator.
   Unmeasured charges, sinks, and General items retain their recorded selling prices.</p>
 </section>;
}
