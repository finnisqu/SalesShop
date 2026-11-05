import { useRef, useState } from 'react';
import type { Quote, QuoteLineMaterialReference } from '../types/quote';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import { useQuoteStore } from '../store/quoteStore';
import { QuoteProjectMaterials } from './QuoteProjectMaterials';
import { TakeoffMaterialCatalog } from './TakeoffCatalogPickers';
import { DEFAULT_EDGE_PROFILE, DEFAULT_SPLASH_HEIGHT_IN } from '../services/quoteTakeoffsLite';

const edgeOptions=['Flat','Eased','Beveled','Bullnose','Ogee','Mitered','Custom'];
export type QuoteSelectionsDraft={
  edge:string;height:string;material:string;
  materialRef?:QuoteLineMaterialReference;applyMaterial:boolean;
};

/** Reuses the real material Catalog, quote pinboard and Area takeoff defaults.
 * "Apply to all" is explicit: never silently overwrite individual piece overrides.
 */
export function QuoteBetaSelections({quote,onClose,draft,onDraftChange}:{
  quote:Quote;onClose:()=>void;
  draft?:QuoteSelectionsDraft;
  onDraftChange?:(next:QuoteSelectionsDraft|null)=>void;
}) {
  const editable=quoteIsCommerciallyEditable(quote);
  const pinMaterial=useQuoteStore(s=>s.pinProjectMaterial);
  const applySelections=useQuoteStore(s=>s.applyJobSelections);
  const updateQuote=useQuoteStore(s=>s.updateQuote);
  const first=quote.sections.find(s=>s.scope?.takeoffDefaultEdgeProfile!==undefined||
    s.scope?.takeoffDefaultSplashHeightIn!==undefined)??quote.sections[0];
  const [edge,setEdge]=useState(draft?.edge??first?.scope?.takeoffDefaultEdgeProfile??DEFAULT_EDGE_PROFILE);
  const [height,setHeight]=useState(draft?.height??String(first?.scope?.takeoffDefaultSplashHeightIn??DEFAULT_SPLASH_HEIGHT_IN));
  const [material,setMaterial]=useState(draft?.material??'');
  const [materialRef,setMaterialRef]=useState<QuoteLineMaterialReference|undefined>(draft?.materialRef);
  const [applyMaterial,setApplyMaterial]=useState(draft?.applyMaterial??false);
  const [message,setMessage]=useState('');
  // Retain unfinished choices when this sheet closes. This does not persist
  // anything to the quote until the salesperson explicitly applies it.
  const retainDraft=(patch:Partial<QuoteSelectionsDraft>)=>
    onDraftChange?.({edge,height,material,materialRef,applyMaterial,...patch});
  const bodyRef=useRef<HTMLDivElement>(null);
  const materialsRef=useRef<HTMLDivElement>(null);
  const sinksRef=useRef<HTMLDivElement>(null);
  const jobMaterialRef=useRef<HTMLDivElement>(null);
  const defaultsRef=useRef<HTMLDivElement>(null);
  const appendixRef=useRef<HTMLDivElement>(null);
  const jumpTo=(target:HTMLDivElement|null)=>{
    const parent=bodyRef.current;
    if(!parent||!target)return;
    const dy=target.getBoundingClientRect().top-parent.getBoundingClientRect().top;
    parent.scrollTo({top:Math.max(0,parent.scrollTop+dy-5),behavior:'smooth'});
  };
  // Derived from Area takeoffs. Sink selections are not duplicated or silently shared.
  const selectedSinks=quote.sections.flatMap(area=>(area.scope?.takeoffSinks??[])
    .filter(sink=>sink.name.trim())
    .map(sink=>({id:area.id+':'+sink.id,name:sink.name,qty:sink.count,area:area.title})));
  const manualSinks=quote.lines.filter(line=>line.kind==='sink'&&!line.takeoffSinkId&&line.description.trim())
    .map(line=>({id:line.id,name:line.description,qty:line.quantity??1,area:quote.sections.find(area=>area.id===line.sectionId)?.title??'General'}));
  const apply=(includeExistingPieces:boolean)=>{
    const n=Number(height);
    if(!height.trim()||!Number.isFinite(n)||n<0||n>120){setMessage('Backsplash height must be between 0 and 120 inches.');return;}
    if(!quote.sections.length){
      setMessage('Materials can be pinned now. Add an Area to save fabrication defaults to the quote.');
      if(material.trim())pinMaterial(quote.id,material,materialRef);
      return;
    }
    applySelections(quote.id,{
      edgeProfile:edge,splashHeightIn:n,includeExistingPieces,
      material:material.trim()||undefined,materialReference:materialRef,
      assignMaterialToAreas:applyMaterial,
    });
    // The confirmed values now live on the quote; do not restore an old
    // uncommitted snapshot over newer defaults on the next opening.
    onDraftChange?.(null);
    setMessage(includeExistingPieces?'Applied defaults to all current pieces.':'Saved defaults for new pieces in all current Areas.');
  };
  return <div className="qmb-selections-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="qmb-selections-drawer" role="dialog" aria-modal="true" aria-label="Quote selections">
      <header className="qmb-selections-head">
        <div><strong>Selections</strong><small>Materials and job fabrication defaults</small></div>
        <button type="button" onClick={onClose} aria-label="Close selections">×</button>
      </header>
      <nav className="qmb-selections-jump" aria-label="Jump to selection section">
        <button type="button" onClick={()=>jumpTo(materialsRef.current)}>Materials</button>
        <button type="button" onClick={()=>jumpTo(sinksRef.current)}>Sinks</button>
        <button type="button" onClick={()=>jumpTo(jobMaterialRef.current)}>Add material</button>
        <button type="button" onClick={()=>jumpTo(defaultsRef.current)}>Defaults</button>
        <button type="button" onClick={()=>jumpTo(appendixRef.current)}>Appendix</button>
      </nav>
      <div className="qmb-selections-body" ref={bodyRef}>
        <div ref={materialsRef} className="qmb-selections-anchor">
          <QuoteProjectMaterials quote={quote}/>
        </div>
        <div ref={sinksRef} className="qmb-selections-card" aria-label="Job sink selections">
          <strong>Job sinks · {selectedSinks.length+manualSinks.length}</strong>
          {selectedSinks.length+manualSinks.length===0
            ?<p className="qmb-help">No sinks selected yet. Choose one in any Area and it will appear here automatically.</p>
            :<ul className="qmb-job-sink-list">
              {[...selectedSinks,...manualSinks].map(sink=>
                <li key={sink.id}><span><strong>{sink.name}</strong><small>{sink.area}</small></span>
                  <span>{sink.qty} each</span></li>)}
            </ul>}
        </div>
        <div ref={jobMaterialRef} className="qmb-selections-card">
          <strong>Find a job material</strong>
          <TakeoffMaterialCatalog disabled={!editable} value={material} selected={materialRef}
            pinned={quote.projectMaterials??[]}
            onTextChange={text=>{setMaterial(text);setMaterialRef(undefined);
              retainDraft({material:text,materialRef:undefined});}}
            onSelect={(ref,label)=>{setMaterial(label);setMaterialRef(ref);
              retainDraft({material:label,materialRef:ref});}}/>
          <label className="qmb-check">
            <input type="checkbox" disabled={!editable} checked={applyMaterial}
              onChange={e=>{setApplyMaterial(e.target.checked);
                retainDraft({applyMaterial:e.target.checked});}}/>
            Also assign this material to all current Areas
          </label>
          <button type="button" className="qmb-outline qmb-block" disabled={!editable||!material.trim()}
            onClick={()=>{if(material.trim()){pinMaterial(quote.id,material,materialRef);
              setMessage('Material added to Deal Materials.');}}}>+ Pin for this quote</button>
        </div>
        <div ref={defaultsRef} className="qmb-selections-card">
          <strong>Fabrication defaults</strong>
          <div className="qmb-two">
            <label className="qmb-field"><span>Backsplash height</span>
              <input type="number" min="0" max="120" step=".5" inputMode="decimal"
                aria-label="Job backsplash height in inches" value={height} disabled={!editable}
                onChange={e=>{setHeight(e.target.value);
                  retainDraft({height:e.target.value});}}/></label>
            <label className="qmb-field"><span>Edge profile</span>
              <select aria-label="Job default edge profile" value={edge} disabled={!editable}
                onChange={e=>{setEdge(e.target.value);
                  retainDraft({edge:e.target.value});}}>
                {edgeOptions.map(item=><option key={item}>{item}</option>)}
              </select></label>
          </div>
          <div className="qmb-two">
            <button type="button" className="qmb-outline" disabled={!editable}
              onClick={()=>apply(false)}>Set defaults</button>
            <button type="button" className="qmb-primary" disabled={!editable}
              onClick={()=>apply(true)}>Apply to all pieces</button>
          </div>
          <p className="qmb-help">Set defaults affects new pieces in existing Areas. Apply to all also updates individual pieces. You can override any piece later. Unapplied choices are retained here when the sheet closes, not saved to the quote.</p>
        </div>
        <div ref={appendixRef} className="qmb-selections-card">
          <strong>Customer selections appendix</strong>
          <label className="qmb-check">
            <input type="checkbox" disabled={!editable} checked={Boolean(quote.attachSelectionsSheet)}
              onChange={event=>updateQuote(quote.id,{attachSelectionsSheet:event.target.checked})}/>
            Attach material, sink, edge and backsplash selections to customer quote
          </label>
          <p className="qmb-help">Optional. Customer preview will show only selected materials and finishes—not buying costs, measurements, or faucet-drilling instructions. Review the appendix before issuing.</p>
        </div>
        {message&&<p className="qmb-selections-feedback" role="status">{message}</p>}
      </div>
      <footer className="qmb-selections-foot"><button type="button" className="qmb-primary qmb-block" onClick={onClose}>Done</button></footer>
    </section>
  </div>;
}
