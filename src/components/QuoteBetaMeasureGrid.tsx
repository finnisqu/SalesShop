import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { QuoteTakeoffPiece } from '../types/quote';
import {
  newTakeoffPiece, parseInches, takeoffPieceTotalSf,
  DEFAULT_SPLASH_HEIGHT_IN, DEFAULT_EDGE_PROFILE,
  totalBillableTakeoffSf, totalSplashSf, totalTakeoffSf,
} from '../services/quoteTakeoffsLite';

const number = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
type SplashFlag = 'backsplash' | 'leftSplash' | 'rightSplash';

export function FloatingRowMenu({label,caption,active,width=214,children}:{
  label:string;caption:string;active?:boolean;width?:number;
  children:(close:()=>void)=>ReactNode;
}) {
  const [open,setOpen]=useState(false);
  const [position,setPosition]=useState({top:0,left:0});
  const trigger=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLDivElement>(null);
  const close=()=>setOpen(false);
  const toggle=()=>{
    if(open){close();return;}
    const rect=trigger.current?.getBoundingClientRect();
    if(!rect)return;
    const panelWidth=width;
    const panelHeight=width>250?345:226;
    const below=window.innerHeight-rect.bottom;
    setPosition({
      top:below>=panelHeight+12?rect.bottom+5:Math.max(8,rect.top-panelHeight-5),
      left:Math.min(Math.max(8,rect.right-panelWidth),Math.max(8,window.innerWidth-panelWidth-8)),
    });
    setOpen(true);
  };
  useEffect(()=>{
    if(!open)return;
    const dismiss=(e:PointerEvent)=>{
      if(!(e.target instanceof Node))return;
      if(trigger.current?.contains(e.target)||panel.current?.contains(e.target))return;
      close();
    };
    const key=(e:globalThis.KeyboardEvent)=>{
      if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close();trigger.current?.focus();}
    };
    // Scrolling dismisses rather than leaving a detached floating menu behind.
    const scroll=()=>close();
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',key,true);
    window.addEventListener('scroll',scroll,true);
    window.addEventListener('resize',scroll);
    return()=>{
      document.removeEventListener('pointerdown',dismiss);
      document.removeEventListener('keydown',key,true);
      window.removeEventListener('scroll',scroll,true);
      window.removeEventListener('resize',scroll);
    };
  },[open]);
  return <>
    <button ref={trigger} type="button" className={'qmb-row-menu-trigger'+(active?' is-selected':'')}
      aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>{caption}</button>
    {open&&createPortal(<div ref={panel} className="qmb-row-floating-menu"
      role="dialog" aria-label={label} style={{top:position.top,left:position.left,width}}>
      {children(close)}
    </div>,document.body)}
  </>;
}

function InchCell({value,label,disabled,onChange}:{
  value?:number;label:string;disabled:boolean;onChange:(next:number|undefined)=>void;
}) {
  const [draft,setDraft]=useState(value===undefined?'':String(value));
  useEffect(()=>setDraft(value===undefined?'':String(value)),[value]);
  const commit=()=>{
    if(!draft.trim()){if(value!==undefined)onChange(undefined);return;}
    const parsed=parseInches(draft);
    if(parsed!==undefined){if(parsed!==value)onChange(parsed);}
    else setDraft(value===undefined?'':String(value));
  };
  return <input type="text" inputMode="decimal" data-qmb-grid-cell="1"
    className="qmb-grid-input qmb-grid-number" aria-label={label}
    disabled={disabled} placeholder="—" value={draft} onChange={e=>setDraft(e.target.value)}
    onBlur={commit}/>;
}

const EDGE_PROFILES=['Flat','Eased','Beveled','Bullnose','Ogee','Mitered','Custom'];

function QuantityCell({value,disabled,label,onChange}:{
  value:number;disabled:boolean;label:string;onChange:(value:number)=>void;
}) {
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  const commit=()=>{
    if(draft.trim()===''){onChange(0);return;}
    const parsed=Number(draft);
    if(Number.isInteger(parsed)&&parsed>=0&&parsed<=1000)onChange(parsed);
    else setDraft(String(value));
  };
  return <input type="text" inputMode="numeric" data-qmb-grid-cell="1"
    className="qmb-grid-input qmb-grid-number" aria-label={label}
    disabled={disabled} value={draft} placeholder="0"
    onChange={e=>{if(/^\d{0,4}$/.test(e.target.value))setDraft(e.target.value);}}
    onBlur={commit}/>;
}

function HeightInput({value,disabled,onChange,label}:{
  value:number;disabled:boolean;label:string;onChange:(value:number)=>void;
}) {
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  return <input type="number" min="0" max="120" step=".5" inputMode="decimal"
    aria-label={label} value={draft} disabled={disabled}
    onChange={e=>setDraft(e.target.value)}
    onBlur={()=>{const n=Number(draft);if(draft!==''&&Number.isFinite(n)&&n>=0&&n<=120)onChange(n);else setDraft(String(value));}}/>;
}

function SplashMenu({piece,index,editable,onPatch}:{
  piece:QuoteTakeoffPiece;index:number;editable:boolean;onPatch:(patch:Partial<QuoteTakeoffPiece>)=>void;
}) {
  const flags:SplashFlag[]=['backsplash','leftSplash','rightSplash'];
  const selected=flags.filter(f=>piece[f]);
  const caption=selected.length===3?'B·L·R':selected.map(f=>f==='backsplash'?'B':f==='leftSplash'?'L':'R').join('·')||'+';
  return <FloatingRowMenu label={'Splash options for Piece '+index} caption={caption} active={selected.length>0}>
    {close=><>
      <div className="qmb-row-menu-title"><strong>{piece.splashHeightIn??DEFAULT_SPLASH_HEIGHT_IN}″ splash edges</strong><small>Piece {index}</small></div>
      {([['backsplash','Back'],['leftSplash','Left'],['rightSplash','Right']] as const).map(([flag,label])=>
        <label key={flag} className="qmb-row-menu-check">
          <input type="checkbox" checked={Boolean(piece[flag])} disabled={!editable}
            onChange={e=>onPatch({[flag]:e.target.checked})}/>
          <span>{label}</span>
        </label>)}
      <div className="qmb-row-menu-buttons">
        <button type="button" disabled={!editable||selected.length===0} onClick={()=>onPatch({backsplash:false,leftSplash:false,rightSplash:false})}>Clear</button>
        <button type="button" className="qmb-row-menu-done" onClick={close}>Done</button>
      </div>
    </>}
  </FloatingRowMenu>;
}

export function QuoteBetaMeasureGrid({pieces,editable,onSave,onAdvanced,defaults,onSetDefaults}:{
  pieces:QuoteTakeoffPiece[];
  editable:boolean;
  onSave:(pieces:QuoteTakeoffPiece[])=>void;
  onAdvanced:()=>void;
  defaults:{splashHeightIn:number;edgeProfile:string};
  onSetDefaults:(next:{splashHeightIn:number;edgeProfile:string},applyAll:boolean)=>void;
}) {
  const grid=useRef<HTMLDivElement>(null);
  const [showHelp,setShowHelp]=useState(false);
  const [defaultHeight,setDefaultHeight]=useState(defaults.splashHeightIn);
  const [defaultEdge,setDefaultEdge]=useState(defaults.edgeProfile);
  useEffect(()=>{setDefaultHeight(defaults.splashHeightIn);setDefaultEdge(defaults.edgeProfile);},[defaults.splashHeightIn,defaults.edgeProfile]);
  const patch=(id:string,next:Partial<QuoteTakeoffPiece>)=>
    onSave(pieces.map(p=>p.id===id?{...p,...next}:p));
  const duplicate=(piece:QuoteTakeoffPiece)=>onSave([...pieces,{
    ...piece,id:'takeoff_'+crypto.randomUUID(),name:piece.name?piece.name+' copy':'',
  }]);
  // Spreadsheet-like Enter handling, but no forced progression or mandatory cells.
  const advance=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key!=='Enter'||!(event.target instanceof HTMLInputElement)||!event.target.matches('[data-qmb-grid-cell]'))return;
    if(event.nativeEvent.isComposing)return;
    const cells=Array.from(grid.current?.querySelectorAll<HTMLInputElement>('[data-qmb-grid-cell]:not(:disabled)')??[]);
    const index=cells.indexOf(event.target);
    if(index<0)return;
    event.preventDefault();
    event.target.blur();
    if(index+1<cells.length)window.requestAnimationFrame(()=>cells[index+1]?.focus());
  };
  return <>
    <div className="qmb-grid-toolbar">
      <div><strong>Pieces</strong><small>{pieces.length} total · edit any cell</small></div>
      <div className="qmb-grid-toolbar-actions">
        <FloatingRowMenu label="Area fabrication defaults" caption="Defaults" width={298}>
          {close=><div className="qmb-fabrication-options">
            <div className="qmb-row-menu-title"><strong>Area defaults</strong><small>Used for new pieces</small></div>
            <label>Backsplash height (in)
              <HeightInput label="Default backsplash height (in)" value={defaultHeight} disabled={!editable} onChange={setDefaultHeight}/></label>
            <label>Edge profile
              <select aria-label="Default edge profile" disabled={!editable} value={defaultEdge} onChange={e=>setDefaultEdge(e.target.value)}>
                {EDGE_PROFILES.map(edge=><option key={edge}>{edge}</option>)}
              </select></label>
            <div className="qmb-row-menu-buttons">
              <button type="button" disabled={!editable} onClick={()=>{onSetDefaults({splashHeightIn:defaultHeight,edgeProfile:defaultEdge},false);close();}}>Set default</button>
              <button type="button" className="qmb-row-menu-done" disabled={!editable} onClick={()=>{onSetDefaults({splashHeightIn:defaultHeight,edgeProfile:defaultEdge},true);close();}}>Apply all</button>
            </div>
          </div>}
        </FloatingRowMenu>
        <div className="qmb-grid-sf-pill">{number.format(totalBillableTakeoffSf(pieces))} <span>SF</span></div>
      </div>
    </div>
    <div className="qmb-measure-sheet" ref={grid} onKeyDown={advance}>
      <div className="qmb-measure-columns" aria-hidden="true">
        <span>Piece</span><span>L (in)</span><span>W (in)</span><span>Qty</span><span>Splash</span><span></span>
      </div>
      {pieces.map((piece,index)=><div className="qmb-measure-row" key={piece.id}>
        <div className="qmb-row-piece">
          <input className="qmb-grid-input qmb-grid-name" type="text" data-qmb-grid-cell="1"
            aria-label={'Piece '+(index+1)+' name'} disabled={!editable}
            placeholder={'Piece '+(index+1)} value={piece.name}
            maxLength={140} onChange={e=>patch(piece.id,{name:e.target.value})}/>
          <small aria-label={'Piece '+(index+1)+' area'}>{number.format(takeoffPieceTotalSf(piece))} SF</small>
        </div>
        <InchCell key={piece.id+'-l'} label="Length (in)" disabled={!editable} value={piece.lengthIn}
          onChange={n=>patch(piece.id,{lengthIn:n})}/>
        <InchCell key={piece.id+'-w'} label="Width (in)" disabled={!editable} value={piece.widthIn}
          onChange={n=>patch(piece.id,{widthIn:n})}/>
        <QuantityCell label={'Piece '+(index+1)+' quantity'} disabled={!editable} value={piece.count}
          onChange={value=>patch(piece.id,{count:value})}/>
        <SplashMenu piece={piece} index={index+1} editable={editable} onPatch={next=>patch(piece.id,next)}/>
        <FloatingRowMenu label={'Actions for Piece '+(index+1)} caption="⋯" width={270}>
          {close=><>
            <div className="qmb-row-menu-title"><strong>Piece {index+1}</strong><small>{piece.name||'No name'}</small></div>
            <div className="qmb-fabrication-options">
              <label>Backsplash height (in)
                <HeightInput label={'Piece '+(index+1)+' backsplash height (in)'}
                  value={piece.splashHeightIn??DEFAULT_SPLASH_HEIGHT_IN} disabled={!editable}
                  onChange={height=>patch(piece.id,{splashHeightIn:height})}/></label>
              <label>Edge profile
                <select aria-label={'Piece '+(index+1)+' edge profile'} disabled={!editable}
                  value={piece.edgeProfile??DEFAULT_EDGE_PROFILE}
                  onChange={e=>patch(piece.id,{edgeProfile:e.target.value})}>
                  {EDGE_PROFILES.map(edge=><option key={edge}>{edge}</option>)}
                </select></label>
            </div>
            <button type="button" className="qmb-row-action" disabled={!editable||pieces.length>=500}
              onClick={()=>{duplicate(piece);close();}}>⧉ Duplicate piece</button>
            <button type="button" className="qmb-row-action is-danger" disabled={!editable}
              onClick={()=>{onSave(pieces.filter(p=>p.id!==piece.id));close();}}>× Remove piece</button>
          </>}
        </FloatingRowMenu>
      </div>)}
      {!pieces.length&&<p className="qmb-grid-empty">Add a piece, or leave this Area blank for now.</p>}
      <button type="button" className="qmb-grid-add" disabled={!editable||pieces.length>=500}
        onClick={()=>onSave([...pieces,{...newTakeoffPiece(pieces.length+1),
          splashHeightIn:defaults.splashHeightIn,edgeProfile:defaults.edgeProfile}])}>+ Add piece</button>
    </div>
    <div className="qmb-grid-summary">
      <div><span>Top</span><strong>{number.format(totalTakeoffSf(pieces))} SF</strong></div>
      <div><span>Splash</span><strong>{number.format(totalSplashSf(pieces))} SF</strong></div>
      <div className="is-total"><span>Material total</span><strong>{number.format(totalBillableTakeoffSf(pieces))} SF</strong></div>
    </div>
    <div className="qmb-grid-lower">
      <button type="button" className="qmb-quiet" onClick={()=>setShowHelp(v=>!v)} aria-expanded={showHelp}>ⓘ Entry tips</button>
      <button type="button" className="qmb-quiet" onClick={onAdvanced}>Advanced takeoffs ↗</button>
    </div>
    {showHelp&&<p className="qmb-help">Unfinished dimensions or a quantity of 0 yield no square footage and will be flagged before issuing. Dimensions accept decimals and fractions such as 25½ or 25 1/2. Tap + in Splash for Back / Left / Right edges and the ⋯ menu for backsplash height or edge profile. Enter moves to the next editable cell. Names, quantities and splash selections save through the same quote as Classic.</p>}
  </>;
}
