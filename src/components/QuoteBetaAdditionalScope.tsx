import {useState} from 'react';
import type {Quote,QuoteSection,QuoteLineKind,QuoteLine} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {QuoteBetaRateCatalog,rateItemToQuotePatch} from './QuoteBetaRateCatalog';
import type {RateBookItem} from '../types/rateBook';

const extraKinds:[QuoteLineKind,string][]=[
  ['item','Custom work'],['allowance','Allowance'],['discount','Discount'],['tax','Tax'],
  ['note','Customer note'],['scope','Scope'],['warranty','Warranty'],
];
/** Catalog-priced Add-ons are shared by Measure and Materials. */
export function QuoteBetaAdditionalScope({quote,section,editable}:{quote:Quote;section:QuoteSection;editable:boolean}){
  const add=useQuoteStore(s=>s.addLine);
  const addCatalog=useQuoteStore(s=>s.addCatalogLine);
  const update=useQuoteStore(s=>s.updateLine);
  const remove=useQuoteStore(s=>s.deleteLine);
  const [extraKind,setExtraKind]=useState<QuoteLineKind>('item');
  const [showMore,setShowMore]=useState(false);
  const primary=quote.lines.find(l=>l.sectionId===section.id&&
    l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf')
    ??quote.lines.find(l=>l.sectionId===section.id&&l.kind==='material'&&!l.takeoffSinkId);
  const rows=quote.lines.filter(l=>l.sectionId===section.id&&!l.takeoffSinkId&&l.id!==primary?.id);
  const attach=(line:QuoteLine,item:RateBookItem)=>{
    const patch=rateItemToQuotePatch(item,quote);
    update(quote.id,line.id,{...patch,quantity:line.quantity??patch.quantity??1,
      customerVisible:line.customerVisible,includeInTotal:line.includeInTotal});
  };
  return <div className="qmb-scope-extras" aria-label="Area Add-ons scope">
    <div className="qmb-addon-toolbar">
      <QuoteBetaRateCatalog disabled={!editable} division={quote.pricingDivision} label="Add an item from Rates"
        onChoose={item=>{if(item)addCatalog(quote.id,'rate',{
          ...rateItemToQuotePatch(item,quote),sectionId:section.id,quantity:1,
        });}}/>
      <button type="button" disabled={!editable} onClick={()=>add(quote.id,'item',section.id)}>
        + Custom</button>
      <button type="button" aria-expanded={showMore} disabled={!editable}
        onClick={()=>setShowMore(value=>!value)}>Other…</button>
    </div>
    {showMore&&<div className="qmb-addon-other">
      <select aria-label="Additional item type" value={extraKind}
        onChange={e=>setExtraKind(e.target.value as QuoteLineKind)}>
        {extraKinds.map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}
      </select>
      <button type="button" disabled={!editable} onClick={()=>{add(quote.id,extraKind,section.id);
        setShowMore(false);}}>+ Add</button>
    </div>}
    <div className="qmb-compact-addon-table" aria-label="Add-on line table">
      <div className="qmb-compact-addon-columns" aria-hidden="true">
        <span>Add-on / Rate</span><span>Qty</span><span>Unit</span><span></span>
      </div>
      {rows.map((line,index)=><div className="qmb-compact-addon-row" key={line.id}>
        <div className="qmb-compact-addon-description">
          <input value={line.description} aria-label={'Additional work '+(index+1)+' description'}
            disabled={!editable} placeholder="Work description"
            onChange={e=>update(quote.id,line.id,{description:e.target.value})}/>
          <QuoteBetaRateCatalog division={quote.pricingDivision} label={'Choose Rate for additional work '+(index+1)}
            value={line.rateReference?.rateBookItemId??''} disabled={!editable}
            onChoose={item=>{if(item)attach(line,item);}}/>
        </div>
        {line.pricingMode==='none'?<span className="qmb-addon-nonpriced">—</span>:
          <input type="number" min="0" step="1" aria-label={'Additional work '+(index+1)+' quantity'}
            value={line.quantity??1} disabled={!editable}
            onChange={e=>{
              const amount=e.target.value===''?undefined:Number(e.target.value);
              if(amount===undefined||!Number.isFinite(amount)||amount<0)return;
              if(line.pricingMode==='direct'){
                update(quote.id,line.id,{pricingMode:'quantity-rate',quantity:amount,
                  rate:line.amount,amount:undefined});
              }else update(quote.id,line.id,{quantity:amount});
            }}/>}
        <small>{line.rateReference?.snapshot?.unit??(line.kind==='note'?'—':'each')}</small>
        <button type="button" className="qmb-compact-remove" disabled={!editable}
          aria-label={'Remove additional work '+(index+1)}
          onClick={()=>{if(window.confirm('Remove this Add-on and its charge? You can Undo.'))
            remove(quote.id,line.id);}}>×</button>
      </div>)}
      {!rows.length&&<p className="qmb-grid-empty">
        No Add-ons yet. Choose a catalog Rate to insert its saved price, or add a custom item.
      </p>}
    </div>
  </div>;
}
