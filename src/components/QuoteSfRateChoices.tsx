import {useEffect,useMemo} from 'react';
import {useRateBookStore} from '../store/rateBookStore';
import {createQuoteRateSnapshot} from '../services/quoteRateSnapshot';
import type {QuoteLineRateReference} from '../types/quote';
import type {RateBookDivision} from '../types/rateBook';
import {BuilderLevelChoices} from './BuilderLevelChoices';

/** Shared SF rate options for takeoff Pricing, material lines, and inline Review
 * resolutions. Pricing UI is kept outside the quantity/rate input grid so it
 * cannot stretch the adjacent quantity field on small screens. */
export function QuoteSfRateChoices({division,selectedRateId,materialType,materialCostPerSf,
  onSelect,includeBuilderLevels=true}:{
  division?:RateBookDivision;
  selectedRateId?:string;
  materialType?:string;
  materialCostPerSf?:number;
  includeBuilderLevels?:boolean;
  onSelect:(rate:number,ref:QuoteLineRateReference)=>void;
}) {
  const items=useRateBookStore(s=>s.items);
  const hydrate=useRateBookStore(s=>s.hydrate);
  useEffect(()=>{hydrate();},[hydrate]);
  const choices=useMemo(()=>items.filter(i=>i.active&&i.unit==='sf').map(item=>({
    item,snapshot:createQuoteRateSnapshot(item,division),
  })).filter(x=>x.snapshot.pricingBehavior!=='cost-reference'),[items,division]);
  return <div className="qmb-sf-rate-choices" role="region" aria-label="Available selling rates">
    {includeBuilderLevels&&<BuilderLevelChoices division={division}
      selectedRateId={selectedRateId} materialType={materialType}
      materialCostPerSf={materialCostPerSf} onSelect={onSelect}/>}
    <div className="qmb-other-rate-heading">Other SF rates</div>
    <div className="qmb-other-rate-choices">
      {choices.map(({item,snapshot})=><button type="button" key={item.id}
        className={selectedRateId===item.id?'is-active':''}
        onClick={()=>{if(snapshot.sellRate!==undefined)onSelect(snapshot.sellRate,{
          rateBookItemId:item.id,snapshot,
        });}}
        disabled={snapshot.sellRate===undefined}>
        <strong>{item.name}</strong>
        <small>{snapshot.sellRate===undefined?'No sell rate set':
          '$'+snapshot.sellRate.toFixed(2)+'/SF'}</small>
      </button>)}
      {!choices.length&&<p>No other active SF rates. Enter a custom rate above.</p>}
    </div>
  </div>;
}
