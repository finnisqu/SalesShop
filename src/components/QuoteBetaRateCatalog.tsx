import {useEffect} from 'react';
import {useRateBookStore} from '../store/rateBookStore';
import {RATE_BOOK_CATEGORY_LABELS,resolveRateBookValues,type RateBookCategory,type RateBookItem,type RateBookDivision} from '../types/rateBook';
import {createQuoteRateSnapshot,rateSnapshotLinePatch} from '../services/quoteRateSnapshot';
import type {Quote,QuoteLine} from '../types/quote';

const categories:RateBookCategory[]=['add-on','fabrication-install','sink','material'];

/** A saved catalog price is a suggestion, not a lock. Each selection is
 * snapshotted on the quote; later manual edits preserve that reference. */
export function rateItemToQuotePatch(item:RateBookItem,quote:Quote):Partial<QuoteLine>{
  const snapshot=createQuoteRateSnapshot(item,quote.pricingDivision);
  const base=rateSnapshotLinePatch(snapshot);
  return {...base,kind:'rate',
    // Flat catalog fees may be ordered more than once in an Area.
    ...(snapshot.unit==='flat'&&snapshot.pricingBehavior!=='cost-reference'
      ?{pricingMode:'quantity-rate' as const,quantity:1,rate:snapshot.sellRate,amount:undefined}:{}),
  };
}

/** Rate selections are available during Measure and again next to Materials
 * pricing. No popover clipping, and list includes every active Rates category. */
export function QuoteBetaRateCatalog({value='',onChoose,disabled,label,includeCustom=false,division}:{
  value?:string;onChoose:(item:RateBookItem|null)=>void;disabled:boolean;
  label:string;includeCustom?:boolean;division?:RateBookDivision;
}){
  const items=useRateBookStore(s=>s.items);
  const hydrate=useRateBookStore(s=>s.hydrate);
  useEffect(()=>{hydrate();},[hydrate]);
  return <select aria-label={label} className="qmb-rate-catalog-select" value={value}
    disabled={disabled} onChange={e=>{
      if(!e.target.value){if(includeCustom)onChoose(null);return;}
      const item=items.find(x=>x.id===e.target.value);
      if(item)onChoose(item);
    }}>
    <option value="">{includeCustom?'Custom / select Rate…':'Select from Rates…'}</option>
    {categories.filter(category=>items.some(item=>item.active&&item.category===category)).map(category=><optgroup key={category} label={RATE_BOOK_CATEGORY_LABELS[category]}>
      {items.filter(item=>item.active&&item.category===category)
        .sort((a,b)=>a.name.localeCompare(b.name))
        .map(item=><option key={item.id} value={item.id}>
          {item.name} · {item.unit.toUpperCase()}
          {resolveRateBookValues(item,division).sellRate!==undefined
            ?' · $'+resolveRateBookValues(item,division).sellRate!.toFixed(2):' · set price'}
        </option>)}
    </optgroup>)}
  </select>;
}
