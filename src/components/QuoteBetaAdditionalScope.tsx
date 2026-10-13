import {useState} from 'react';
import type {Quote,QuoteSection,QuoteLineKind} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';

const OPTIONS=[['item','Custom work'],['rate','Rate item'],['allowance','Allowance'],['note','Customer note'],
  ['scope','Scope'],['warranty','Warranty']] as const;

/** Enter the scope now; customer selling prices remain in Materials. */
export function QuoteBetaAdditionalScope({quote,section,editable}:{quote:Quote;section:QuoteSection;editable:boolean}){
  const add=useQuoteStore(s=>s.addLine);
  const update=useQuoteStore(s=>s.updateLine);
  const remove=useQuoteStore(s=>s.deleteLine);
  const [kind,setKind]=useState<QuoteLineKind>('item');
  const rows=quote.lines.filter(line=>line.sectionId===section.id&&!line.takeoffSinkId
    &&line.id!==(quote.lines.find(l=>l.sectionId===section.id&&
      l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf')
      ??quote.lines.find(l=>l.sectionId===section.id&&l.kind==='material'&&!l.takeoffSinkId))?.id);
  return <div className="qmb-scope-extras" aria-label="Area additional work scope">
    <div className="qmb-scope-add-controls">
      <label>Work type <select aria-label="New additional work type" disabled={!editable}
        value={kind} onChange={e=>setKind(e.target.value as QuoteLineKind)}>
        {OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
      <button type="button" disabled={!editable} onClick={()=>add(quote.id,kind,section.id)}>+ Add work</button>
    </div>
    {rows.map((line,index)=><div className="qmb-scope-extra-row" key={line.id}>
      <label className="qmb-scope-extra-name">Work description
        <input aria-label={'Additional work '+(index+1)+' description'} value={line.description}
          disabled={!editable} onChange={e=>update(quote.id,line.id,{description:e.target.value})}/>
      </label>
      {line.pricingMode!=='none'&&<label className="qmb-scope-extra-qty">Qty
        <input aria-label={'Additional work '+(index+1)+' quantity'} type="number" min="0" step="1"
          value={line.quantity??1} disabled={!editable}
          onChange={e=>{
            const n=Number(e.target.value);if(!Number.isFinite(n)||n<0)return;
            if(line.pricingMode==='direct')update(quote.id,line.id,{
              pricingMode:'quantity-rate',quantity:n,rate:line.amount??0,amount:undefined,
            });
            else update(quote.id,line.id,{quantity:n});
          }}/>
      </label>}
      <button type="button" className="qmb-scope-extra-remove" disabled={!editable}
        aria-label={'Remove additional work '+(index+1)}
        onClick={()=>{if(window.confirm('Remove this work and its charge? You can Undo.'))remove(quote.id,line.id);}}>×</button>
    </div>)}
    {!rows.length&&<div className="qmb-grid-empty">No additional work yet. Add it here, then price it in Materials.</div>}
  </div>;
}
