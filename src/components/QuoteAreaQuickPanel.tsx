import {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import {quoteLinesTotal} from '../types/quote';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {useQuoteStore} from '../store/quoteStore';
import {QuoteInlineAreaName,QuoteInlineAreaRate} from './QuoteInlineAreaEditing';
import {QuoteBetaMeasureGrid} from './QuoteBetaMeasureGrid';
import {QuoteBetaMaterials} from './QuoteBetaMaterials';
import {QuoteBetaDesktopPricing} from './QuoteBetaDesktopPricing';
import {QuoteSharedSlabPools} from './QuoteSharedSlabPools';
import './quote-area-quick-panel.css';
export type QuickAreaTab='overview'|'measure'|'material'|'pricing'|'calculator';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
export function QuoteAreaQuickPanel({quote,areaId,initialTab,onTab,onSelect,onClose,onFull}:{
 quote:Quote;areaId:string;initialTab:QuickAreaTab;
 onTab:(tab:QuickAreaTab)=>void;onSelect:(areaId:string)=>void;onClose:()=>void;
 onFull:(tab:'measure'|'materials'|'pricing'|'calculator')=>void;
}){
 const ref=useDismissibleLayer<HTMLElement>(true,onClose);
 const section=quote.sections.find(a=>a.id===areaId);
 const editable=quoteIsCommerciallyEditable(quote);
 const updateSection=useQuoteStore(s=>s.updateSection);
 const updatePieces=useQuoteStore(s=>s.updateTakeoffPieces);
 const areas=quote.sections.filter(a=>!isGeneralTakeoffSection(a));
 const index=areas.findIndex(a=>a.id===areaId);
 const [showFullNote,setShowFullNote]=useState(false);
 const sheetSwipeStart=useRef<number|null>(null);
 if(!section)return null;
 const total=quoteLinesTotal(quote.lines.filter(l=>l.sectionId===section.id));
 const defaults={splashHeightIn:section.scope?.takeoffDefaultSplashHeightIn??4,
   edgeProfile:section.scope?.takeoffDefaultEdgeProfile??'Flat'};
 return createPortal(<div className="qmb qmb-quick-area-backdrop" onPointerDown={e=>{
   if(e.currentTarget===e.target)onClose();
 }}>
   <aside ref={ref} role="dialog" aria-modal="true" aria-label={'Quick edit Area '+section.title}
     className="qmb-quick-area-panel">
     <header className="qmb-quick-area-header" onTouchStart={event=>{
      if((event.target as HTMLElement).closest('button,input,select'))return;
      sheetSwipeStart.current=event.touches[0]?.clientY??null;
     }} onTouchEnd={event=>{
      const start=sheetSwipeStart.current;sheetSwipeStart.current=null;
      if(start!==null&&(event.changedTouches[0]?.clientY??start)-start>85)onClose();
     }}>
       <div><small>QUOTE BUILDER · AREA</small><h2>{section.title||'Untitled Area'}</h2>
         <span>{sf.format(section.scope?.countertopSf??0)} SF · {money.format(total)}</span></div>
       <button type="button" data-dialog-initial-focus onClick={onClose}
         aria-label="Close Area quick editor">×</button>
     </header>
     <div className="qmb-quick-area-nav">
       <button type="button" disabled={index<=0} onClick={()=>onSelect(areas[index-1].id)}>‹ Previous</button>
       <span>{index+1} of {areas.length} Areas</span>
       <button type="button" disabled={index<0||index>=areas.length-1}
         onClick={()=>onSelect(areas[index+1].id)}>Next ›</button>
     </div>
     <div className="qmb-quick-area-tabs" role="tablist" aria-label="Quick Area sections">
       {([['overview','Summary'],['measure','Measure'],['material','Materials'],
         ['pricing','Selling'],['calculator','Calculator']] as const).map(([key,label])=>
         <button key={key} type="button" role="tab" aria-selected={initialTab===key}
           onClick={()=>onTab(key)}>{label}</button>)}
     </div>
     <div className="qmb-quick-area-body">
       {initialTab==='overview'&&<>
         <label className="qmb-quick-area-field">Area name
           <QuoteInlineAreaName quote={quote} section={section}/>
         </label>
         <label className="qmb-quick-area-field">Customer presentation
           <select disabled={!editable}
             value={!section.customerVisible?'hidden':section.customerDisplayMode==='summary'?'summary':'detail'}
             onChange={event=>{
               const value=event.target.value;
               updateSection(quote.id,section.id,{
                 customerVisible:value!=='hidden',
                 ...(value==='hidden'?{}:{customerDisplayMode:value==='summary'?'summary':'detail'}),
               });
             }}>
             <option value="detail">Itemized</option>
             <option value="summary">Lump sum</option>
             <option value="hidden">Hidden</option>
           </select>
         </label>
         <div className="qmb-quick-area-stat"><span>Material</span>
           <strong>{section.scope?.takeoffMaterial||'Not chosen'}</strong></div>
         <div className="qmb-quick-area-stat"><span>Measured surface</span>
           <strong>{sf.format(section.scope?.countertopSf??0)} SF</strong></div>
         <div className="qmb-quick-area-stat"><span>Area total</span><strong>{money.format(total)}</strong></div>
         <label className="qmb-quick-area-field">Customer selling rate / SF
           <QuoteInlineAreaRate quote={quote} section={section} onOpen={()=>onTab('pricing')}/>
         </label>
       </>}
       {initialTab==='measure'&&<QuoteBetaMeasureGrid
         pieces={section.scope?.takeoffPieces??[]} editable={editable}
         onSave={pieces=>updatePieces(quote.id,section.id,pieces)}
         onAdvanced={()=>onFull('measure')} defaults={defaults}
         onSetDefaults={(next,applyAll)=>{
           updateSection(quote.id,section.id,{scope:{...section.scope,
             takeoffDefaultSplashHeightIn:next.splashHeightIn,
             takeoffDefaultEdgeProfile:next.edgeProfile}});
           if(applyAll)updatePieces(quote.id,section.id,(section.scope?.takeoffPieces??[])
             .map(piece=>({...piece,splashHeightIn:next.splashHeightIn,edgeProfile:next.edgeProfile})));
         }}/>}
       {initialTab==='material'&&<QuoteBetaMaterials quote={quote} section={section}
         editable={editable} part="all" />}
       {initialTab==='pricing'&&<QuoteBetaDesktopPricing quote={quote}
         section={section} editable={editable} view="selling"/>}
       {initialTab==='calculator'&&<><QuoteBetaDesktopPricing quote={quote}
         section={section} editable={editable} view="calculator"/>
         <details className="qwt-shared-drawer"><summary>Shared slab buying · automatically combined when compatible</summary>
          <QuoteSharedSlabPools quote={quote}/>
         </details></>}
       {showFullNote&&<p role="status">The full Area workspace has detailed sink, add-on and fabrication options.</p>}
     </div>
     <footer className="qmb-quick-area-footer">
       <button type="button" onClick={()=>setShowFullNote(v=>!v)} aria-expanded={showFullNote}>ⓘ</button>
       <button type="button" onClick={()=>onFull(initialTab==='material'?'materials':
         initialTab==='calculator'?'calculator':initialTab==='pricing'?'pricing':'measure')}>
         Open full Area ↗</button>
       <button type="button" onClick={onClose}>Done</button>
     </footer>
   </aside>
 </div>,document.querySelector('.sales-app')??document.body);
}
