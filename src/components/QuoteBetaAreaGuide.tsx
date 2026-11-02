import type {Quote,QuoteSection} from '../types/quote';
import {quoteAreaGuide} from '../services/quoteAreaGuide';
import './quote-beta-area-guide.css';

export function QuoteBetaAreaGuide({quote,section,editable,onAddPiece,onMeasure,onMaterial,onPricing,onOverview,onSaveLayout}:{
 quote:Quote;section:QuoteSection;editable:boolean;
 onAddPiece:()=>void;onMeasure:()=>void;onMaterial:()=>void;onPricing:()=>void;onOverview:()=>void;onSaveLayout:()=>void;
}){
 const guide=quoteAreaGuide(quote,section);
 return <section className={'qmb-area-guide'+(guide.fresh?' is-fresh':'')} aria-label="Area quick start">
   <div className="qmb-area-guide-copy">
     <strong>{guide.fresh?'Start this Area':'Area quick actions'}</strong>
     <small>{guide.next}</small>
   </div>
   <div className="qmb-area-guide-actions">
     {guide.fresh&&editable&&<button type="button" className="is-primary"
       onClick={onAddPiece}>+ Add first piece</button>}
     <button type="button" onClick={onMeasure}>Measure{guide.pieces?' · '+guide.pieces:''}</button>
     <button type="button" onClick={onMaterial}>Material &amp; sinks</button>
     <button type="button" onClick={onPricing}>Selling price</button>
     {editable&&<button type="button" onClick={onSaveLayout}>Save layout</button>}
     <button type="button" className="is-overview" onClick={onOverview}>All pricing ›</button>
   </div>
 </section>;
}
