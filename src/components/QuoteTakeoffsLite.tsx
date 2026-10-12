import { useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuoteStore } from '../store/quoteStore';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import {
  isValidTakeoffPiece,newTakeoffPiece,newTakeoffSink,parseInches,takeoffPieceSf,
  totalSplashLf,totalTakeoffSf,takeoffOwnedScope,takeoffCustomerSpecs,
} from '../services/quoteTakeoffsLite';
import { quoteLinesTotal,type Quote, type QuoteSection, type QuoteTakeoffPiece, type QuoteTakeoffSink } from '../types/quote';

const sfFmt=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const cash=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
function Dim({value,label,disabled,onChange}:{
  value?:number;label:string;disabled:boolean;onChange:(next:number|undefined)=>void;
}){
  const [draft,setDraft]=useState(value===undefined?'':String(value));
  const [focused,setFocused]=useState(false);
  useEffect(()=>{if(!focused)setDraft(value===undefined?'':String(value));},[value,focused]);
  const invalid=Boolean(draft.trim())&&parseInches(draft)===undefined;
  return <input className="qtl-dimension" type="text" inputMode="decimal" autoComplete="off"
    aria-label={label} aria-invalid={invalid} disabled={disabled} placeholder="in"
    title="Inches: 25.5, 25 1/2, or 25½" value={draft}
    onFocus={e=>{setFocused(true);e.currentTarget.select();}}
    onChange={e=>{
      const raw=e.target.value;setDraft(raw);
      if(!raw.trim())onChange(undefined);
      else{const n=parseInches(raw);if(n!==undefined&&n!==value)onChange(n);}
    }}
    onBlur={()=>{setFocused(false);const n=parseInches(draft);setDraft(n===undefined?(value===undefined?'':String(value)):String(n));}}
  />;
}
export function QuoteTakeoffsLite({quote,section,onClose}:{
  quote:Quote;section:QuoteSection;onClose:()=>void;
}){
  const updatePieces=useQuoteStore(s=>s.updateTakeoffPieces);
  const updateSinks=useQuoteStore(s=>s.updateTakeoffSinks);
  const updateSection=useQuoteStore(s=>s.updateSection);
  const addSfLine=useQuoteStore(s=>s.addTakeoffLine);
  const detachTakeoff=useQuoteStore(s=>s.detachTakeoff);
  const [help,setHelp]=useState(false);
  const dialog=useRef<HTMLDivElement>(null);
  const returnFocus=useRef<Element|null>(null);
  const editable=quoteIsCommerciallyEditable(quote);
  const owned=takeoffOwnedScope(section.scope);
  const pieces=section.scope?.takeoffPieces??[];
  const sinks=section.scope?.takeoffSinks??[];
  const totalSf=totalTakeoffSf(pieces);
  const splashLf=totalSplashLf(pieces);
  const validCount=pieces.filter(isValidTakeoffPiece).length;
  const customerMode=section.customerDisplayMode==='summary'?'summary':'detail';
  const linkedSf=quote.lines.filter(l=>l.sectionId===section.id&&l.quantitySource?.field==='countertopSf'&&l.quantitySource.syncMode==='live');
  const pricedSinks=sinks.filter(s=>s.includeInPricing);
  const pendingPrice=pricedSinks.some(s=>s.unitPrice===undefined);
  const areaPrice=quoteLinesTotal(quote.lines.filter(l=>l.sectionId===section.id));

  useEffect(()=>{
    returnFocus.current=document.activeElement;
    dialog.current?.focus();
    if(!section.scope?.takeoffPieces?.length&&editable){
      updatePieces(quote.id,section.id,[newTakeoffPiece(1)]);
    }
    const handle=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key!=='Tab'||!dialog.current)return;
      const nodes=[...dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'
      )].filter(x=>x.getClientRects().length>0);
      if(nodes.length===0)return;
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',handle);
    return()=>{document.removeEventListener('keydown',handle);(returnFocus.current as HTMLElement|null)?.focus?.();};
    // Open/close lifecycle; no dependency on dimension edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const savePieces=(next:QuoteTakeoffPiece[])=>{
    if(editable&&next.length<=500)updatePieces(quote.id,section.id,next);
  };
  const patchPiece=(id:string,patch:Partial<QuoteTakeoffPiece>)=>
    savePieces(pieces.map(p=>p.id===id?{...p,...patch}:p));
  const addPiece=()=>{
    if(pieces.length>=500)return;
    savePieces([...pieces,newTakeoffPiece(pieces.length+1)]);
    window.requestAnimationFrame(()=>dialog.current?.querySelector<HTMLInputElement>(
      '.qtl-pieces .qtl-piece:last-child .qtl-name input')?.focus());
  };
  const patchSink=(id:string,patch:Partial<QuoteTakeoffSink>)=>
    updateSinks(quote.id,section.id,sinks.map(s=>s.id===id?{...s,...patch}:s));
  const mode=(next:'summary'|'detail')=>
    updateSection(quote.id,section.id,{customerDisplayMode:next});
  return createPortal(<div className="qtl-backdrop" role="presentation"
      onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div ref={dialog} className="qtl-dialog" role="dialog" aria-modal="true"
      aria-label={`Takeoffs Lite for ${section.title}`} tabIndex={-1}>
      <header className="qtl-topbar">
        <div><span className="qtl-kicker">SALESSHOP · QUICK TAKEOFF</span>
          <h2>{section.title}</h2><p>Dimensions, splash edges, sinks & quote presentation</p></div>
        <button type="button" className="qtl-close" onClick={onClose} aria-label="Close Takeoffs Lite">×</button>
      </header>
      <div className="qtl-scrollbody">
        <section className="qtl-summary-strip" aria-label="Area measurements">
          <div><small>Countertop</small><strong>{sfFmt.format(totalSf)} <em>SF</em></strong></div>
          <div><small>4″ Splash</small><strong>{sfFmt.format(splashLf)} <em>LF</em></strong></div>
          <div><small>Sinks</small><strong>{sinks.reduce((n,s)=>n+s.count,0)}</strong></div>
          <div><small>Area quote total</small><strong>{cash.format(areaPrice)}</strong></div>
        </section>

        <section className="qtl-panel qtl-pieces">
          <div className="qtl-section-title"><div><h3>Pieces</h3><p>Inches · optional name · check the exposed splash edges</p></div>
            <button type="button" onClick={()=>setHelp(p=>!p)} aria-expanded={help}>? Tips</button></div>
          {help&&<p className="qtl-help">Length × width × count ÷ 144 = SF. For a typical 4″ splash, back adds the piece length, and left/right add the piece width. Check only edges needing splash. Enter 25½, 25 1/2, or 25.5. Incomplete pieces count as zero.</p>}
          <div className="qtl-table-wrap">
            <div className="qtl-table-header"><span>PIECE NAME</span><span>LENGTH</span><span>WIDTH</span><span>QTY</span><span>BACK</span><span>LEFT</span><span>RIGHT</span><span>SF</span><span/></div>
            {pieces.map((piece,i)=><div className="qtl-piece" key={piece.id}>
              <label className="qtl-name"><span>Piece name</span><input type="text" maxLength={120} disabled={!editable}
                aria-label={`Piece ${i+1} name`} value={piece.name}
                placeholder={`Piece ${i+1} (optional)`}
                onFocus={e=>e.currentTarget.select()}
                onChange={e=>patchPiece(piece.id,{name:e.target.value})}/></label>
              <label className="qtl-length"><span>Length</span><Dim label={`Piece ${i+1} length in inches`}
                value={piece.lengthIn} disabled={!editable} onChange={lengthIn=>patchPiece(piece.id,{lengthIn})}/></label>
              <label className="qtl-width"><span>Width</span><Dim label={`Piece ${i+1} width in inches`}
                value={piece.widthIn} disabled={!editable} onChange={widthIn=>patchPiece(piece.id,{widthIn})}/></label>
              <label className="qtl-count"><span>Qty</span><input type="number" min="1" max="1000" step="1"
                aria-label={`Piece ${i+1} count`} disabled={!editable} value={piece.count}
                onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=1000)patchPiece(piece.id,{count:n});}}/></label>
              {(['backsplash','leftSplash','rightSplash'] as const).map((edge)=><label key={edge} className={`qtl-edge qtl-${edge}`}>
                <span>{edge==='backsplash'?'Back':edge==='leftSplash'?'Left':'Right'}</span>
                <input type="checkbox" aria-label={`Piece ${i+1} ${edge}`} disabled={!editable}
                  checked={Boolean(piece[edge])} onChange={e=>patchPiece(piece.id,{[edge]:e.target.checked})}/>
              </label>)}
              <output className="qtl-row-sf" aria-label={`Piece ${i+1} square feet`}>{sfFmt.format(takeoffPieceSf(piece))}</output>
              <div className="qtl-row-buttons">
                <button type="button" title="Duplicate piece" disabled={!editable||pieces.length>=500}
                  aria-label={`Duplicate piece ${i+1}`} onClick={()=>savePieces([...pieces.slice(0,i+1),
                    {...piece,id:newTakeoffPiece(i+2).id},...pieces.slice(i+1)])}>⧉</button>
                <button type="button" title="Remove piece" disabled={!editable}
                  aria-label={`Remove piece ${i+1}`} onClick={()=>savePieces(pieces.filter(p=>p.id!==piece.id))}>×</button>
              </div>
            </div>)}
          </div>
          <button type="button" className="qtl-add" disabled={!editable||pieces.length>=500} onClick={addPiece}>+ Add piece</button>
        </section>

        <section className="qtl-panel">
          <div className="qtl-section-title"><div><h3>Material & sinks</h3>
            <p>Specs can appear on a single lump-sum line. Add sink pricing only when needed.</p></div></div>
          <label className="qtl-material"><span>Material / finish specification</span><input type="text"
            value={section.scope?.takeoffMaterial??''} maxLength={300} disabled={!editable}
            placeholder="e.g. Carrara White Quartz · 3cm · Polished"
            onChange={e=>updateSection(quote.id,section.id,{
              scope:{...section.scope,takeoffMaterial:e.target.value}
            })}/></label>
          <div className="qtl-sinks">
            {sinks.map((sink,i)=><div className="qtl-sink-card" key={sink.id}>
              <label><span>Type</span><select value={sink.category} disabled={!editable}
                onChange={e=>patchSink(sink.id,{category:e.target.value as QuoteTakeoffSink['category']})}>
                <option value="kitchen">Kitchen</option><option value="vanity">Vanity</option>
              </select></label>
              <label className="qtl-sink-name"><span>Sink model / spec</span><input type="text"
                maxLength={160} disabled={!editable} value={sink.name}
                placeholder="e.g. 3218 Single Bowl" onFocus={e=>e.currentTarget.select()}
                onChange={e=>patchSink(sink.id,{name:e.target.value})}/></label>
              <label><span>Qty</span><input type="number" min="1" max="1000" step="1"
                value={sink.count} disabled={!editable}
                onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=1000)patchSink(sink.id,{count:n});}}/></label>
              <label className="qtl-sink-charge"><span>Price separately?</span><input type="checkbox" disabled={!editable}
                checked={sink.includeInPricing} onChange={e=>patchSink(sink.id,{includeInPricing:e.target.checked})}/></label>
              <label><span>Sell price / sink</span><input type="number" min="0" step=".01"
                inputMode="decimal" aria-label={`Sink ${i+1} selling price`}
                disabled={!editable||!sink.includeInPricing} value={sink.unitPrice??''}
                placeholder="Set price" onChange={e=>{const n=Number(e.target.value);
                  patchSink(sink.id,{unitPrice:e.target.value===''?undefined:Math.max(0,Number.isFinite(n)?n:0)});
                }}/></label>
              <button type="button" title="Remove sink" disabled={!editable}
                aria-label={`Remove sink ${i+1}`}
                onClick={()=>updateSinks(quote.id,section.id,sinks.filter(s=>s.id!==sink.id))}>×</button>
            </div>)}
          </div>
          {pendingPrice&&<p className="qtl-unpriced" role="status">A sink is marked for separate pricing but has no sell price yet.</p>}
          <button type="button" className="qtl-add" disabled={!editable||sinks.length>=100}
            onClick={()=>updateSinks(quote.id,section.id,[...sinks,newTakeoffSink()])}>+ Add sink</button>
          <p className="qtl-note">Sinks always appear in the area's scope. Checking <strong>Price separately</strong> adds a managed, priced quote row. Unchecked sinks add no extra charge—useful when your lump-sum price already includes them.</p>
        </section>

        <section className="qtl-panel">
          <div className="qtl-section-title"><div><h3>How should this Area appear on the quote?</h3>
            <p>Presentation only—switching views does not change existing prices.</p></div></div>
          <div className="qtl-mode-options" role="radiogroup" aria-label="Area quote presentation">
            <label className={customerMode==='summary'?'active':''}>
              <input type="radio" name={`qtl-mode-${section.id}`} checked={customerMode==='summary'}
                disabled={!editable} onChange={()=>mode('summary')}/>
              <span><strong>One line · Lump sum</strong><small>Show this Area's combined price, material, and sink specifications. Hide its detailed pricing rows from the customer.</small></span>
            </label>
            <label className={customerMode==='detail'?'active':''}>
              <input type="radio" name={`qtl-mode-${section.id}`} checked={customerMode==='detail'}
                disabled={!editable} onChange={()=>mode('detail')}/>
              <span><strong>Area header · Itemized</strong><small>Show the Area heading, then its material, sink, and other quote lines with individual pricing.</small></span>
            </label>
          </div>
          <p className="qtl-preview-spec"><strong>Customer description:</strong> {takeoffCustomerSpecs(section)||'Add material or sink specifications above.'}</p>
          <div className="qtl-price-actions">
            <button type="button" disabled={!editable||!owned||validCount===0}
              onClick={()=>addSfLine(quote.id,section.id)}>+ Add SF pricing row</button>
            <span>{linkedSf.length} live SF {linkedSf.length===1?'row':'rows'} · Amounts are summed from the Area's pricing rows.</span>
          </div>
        </section>
        {owned&&editable&&<button type="button" className="qtl-manual"
          onClick={()=>{
            if(window.confirm('Return to manual countertop SF? Measured pieces are removed and live SF pricing becomes a captured quantity. Sink selections and other prices remain.')){
              detachTakeoff(quote.id,section.id);onClose();
            }
          }}>Switch countertop SF to manual entry</button>}
      </div>
      <footer className="qtl-footer"><span><strong>{sfFmt.format(totalSf)} SF</strong> · {sfFmt.format(splashLf)} splash LF · {sinks.length} sink selections</span>
        <button type="button" onClick={onClose}>Done · Back to quote</button></footer>
    </div>
  </div>,document.body);
}
