import { useEffect, useState } from 'react';
import { useQuoteStore } from '../store/quoteStore';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import {
  newTakeoffPiece, parseInches, takeoffOwnedScope, takeoffPieceSf, totalTakeoffSf,
  isValidTakeoffPiece,
} from '../services/quoteTakeoffsLite';
import type { Quote, QuoteTakeoffPiece, QuoteSection } from '../types/quote';

const sfFormat=new Intl.NumberFormat('en-US',{maximumFractionDigits:2,minimumFractionDigits:2});

function DimensionInput({label,value,disabled,onCommit}:{
  label:string;value:number|undefined;disabled:boolean;onCommit:(value:number|undefined)=>void;
}){
  const [draft,setDraft]=useState(value===undefined?'':String(value));
  const [focused,setFocused]=useState(false);
  useEffect(()=>{if(!focused)setDraft(value===undefined?'':String(value));},[value,focused]);
  const valid=!draft.trim() || parseInches(draft)!==undefined;
  return <input aria-label={label} title="Inches: 25.5, 25 1/2, or 25½"
    inputMode="decimal" type="text" autoComplete="off" value={draft}
    disabled={disabled} aria-invalid={!valid}
    placeholder="in"
    onFocus={()=>setFocused(true)}
    onChange={event=>{
      const next=event.target.value;
      setDraft(next);
      if(!next.trim())onCommit(undefined);
      else{
        const parsed=parseInches(next);
        if(parsed!==undefined && parsed!==value)onCommit(parsed);
      }
    }}
    onBlur={()=>{
      setFocused(false);
      const parsed=parseInches(draft);
      setDraft(parsed===undefined ? (value===undefined?'':String(value)) : String(parsed));
    }}
  />;
}
export function QuoteTakeoffsLite({quote,section}:{
  quote:Quote;section:QuoteSection;
}){
  const edit=useQuoteStore(s=>s.updateTakeoffPieces);
  const addSfLine=useQuoteStore(s=>s.addTakeoffLine);
  const detachTakeoff=useQuoteStore(s=>s.detachTakeoff);
  const [showHelp,setShowHelp]=useState(false);
  const editable=quoteIsCommerciallyEditable(quote);
  const enabled=takeoffOwnedScope(section.scope);
  const pieces=section.scope?.takeoffPieces??[];
  const total=totalTakeoffSf(pieces);
  const completed=pieces.filter(isValidTakeoffPiece).length;
  const linked=quote.lines.filter(line=>line.sectionId===section.id
    &&line.quantitySource?.syncMode==='live'
    &&line.quantitySource.field==='countertopSf');
  const update=(nextPieces:QuoteTakeoffPiece[])=>{
    if(nextPieces.length<=500)edit(quote.id,section.id,nextPieces);
  };
  const patch=(id:string,values:Partial<QuoteTakeoffPiece>)=>
    update(pieces.map(piece=>piece.id===id?{...piece,...values}:piece));
  return <div className="quote-takeoffs-lite" aria-label={`Takeoffs Lite for ${section.title}`}>
    <div className="quote-takeoffs-top">
      <div><span className="quote-takeoffs-eyebrow">TAKEOFFS LITE · {section.title}</span>
        <h4>Quick piece takeoff</h4><p>Measure rectangles in inches. Total SF feeds this Area's countertop scope.</p></div>
      <div className="quote-takeoffs-total"><small>AREA TOTAL</small><strong>{sfFormat.format(total)} <span>SF</span></strong>
        <small>{completed} of {pieces.length} pieces measured</small></div>
    </div>
    <div className="quote-takeoffs-help-row">
      <button type="button" onClick={()=>setShowHelp(s=>!s)} aria-expanded={showHelp}>? How it works</button>
      {linked.length>0&&<span>{linked.length} priced {linked.length===1?'line':'lines'} live-linked</span>}
    </div>
    {showHelp&&<p className="quote-takeoffs-help">
      Each piece: length × width × count ÷ 144 = SF. Enter inches such as 25.5 or 25 1/2.
      Incomplete pieces contribute 0 SF. Rounding happens once after all measured pieces.
      A line linked to this live takeoff updates automatically; manual pricing quantities and existing captured values stay unchanged.
      This measures rectangular surface area only—not material waste or slab yield.
    </p>}
    <div className="quote-takeoffs-scroll">
      <div className="quote-takeoffs-grid-head">
        <span>PIECE</span><span>LENGTH (in)</span><span>WIDTH (in)</span><span>COUNT</span><span>SF</span><span className="sr-only">Piece actions</span>
      </div>
      {pieces.map((piece,i)=><div className="quote-takeoffs-grid-row" key={piece.id}>
        <input type="text" aria-label={`Piece ${i+1} name`} placeholder={`Piece ${i+1}`}
          value={piece.name} disabled={!editable} maxLength={120}
          onChange={event=>patch(piece.id,{name:event.target.value})}/>
        <DimensionInput label={`${piece.name||'Piece '+(i+1)} length in inches`} value={piece.lengthIn}
          disabled={!editable} onCommit={lengthIn=>patch(piece.id,{lengthIn})}/>
        <DimensionInput label={`${piece.name||'Piece '+(i+1)} width in inches`} value={piece.widthIn}
          disabled={!editable} onCommit={widthIn=>patch(piece.id,{widthIn})}/>
        <input type="number" aria-label={`${piece.name||'Piece '+(i+1)} count`}
          min="1" max="1000" step="1" disabled={!editable}
          value={piece.count} onChange={event=>{
            const count=Number(event.target.value);
            if(Number.isInteger(count)&&count>=1&&count<=1000)patch(piece.id,{count});
          }}/>
        <output aria-label={`${piece.name||'Piece '+(i+1)} square feet`}>{sfFormat.format(takeoffPieceSf(piece))}</output>
        <div className="quote-takeoffs-row-actions">
          <button type="button" disabled={!editable} aria-label={`Duplicate ${piece.name}`}
            title="Duplicate piece" onClick={()=>update([...pieces.slice(0,i+1),
              {...piece,id:newTakeoffPiece(i+2).id},...pieces.slice(i+1)])}>⧉</button>
          <button type="button" disabled={!editable} aria-label={`Delete ${piece.name}`}
            title="Remove piece" onClick={()=>update(pieces.filter(p=>p.id!==piece.id))}>×</button>
        </div>
      </div>)}
      {!pieces.length&&<div className="quote-takeoffs-empty">No pieces yet. Add a rectangular piece to start your takeoff.</div>}
    </div>
    <div className="quote-takeoffs-bottom">
      <button type="button" className="quote-takeoffs-add" disabled={!editable||pieces.length>=500}
        onClick={()=>update([...pieces,newTakeoffPiece(pieces.length+1)])}>+ Add Piece</button>
      <div className="quote-takeoffs-actions">
        <span>Measured area: <strong>{sfFormat.format(total)} SF</strong></span>
        <button type="button" disabled={!editable||!enabled||completed===0}
          title="Create a priced quantity × rate line linked to this takeoff; set the selling rate in the quote."
          onClick={()=>addSfLine(quote.id,section.id)}>+ Quote SF line</button>
      </div>
    </div>
    {enabled&&editable&&<button type="button" className="quote-takeoffs-manual" onClick={()=>{
      if(window.confirm('Return this Area to manual countertop SF? The last measured total and current quote pricing will stay, but piece measurements will be removed and live links will become captured quantities.')){
        detachTakeoff(quote.id,section.id);
      }
    }}>Switch to manual SF</button>}
    <p className="quote-takeoffs-note">Internal takeoff only. It does not automatically add waste or reveal piece dimensions in the customer proposal. Add a selling rate to any new SF line.</p>
  </div>;
}
