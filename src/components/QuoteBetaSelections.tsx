import { useEffect, useState } from 'react';
import type { Quote, QuoteLineMaterialReference } from '../types/quote';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import { useQuoteStore } from '../store/quoteStore';
import { QuoteProjectMaterials } from './QuoteProjectMaterials';
import { TakeoffMaterialCatalog } from './TakeoffCatalogPickers';
import { DEFAULT_EDGE_PROFILE, DEFAULT_SPLASH_HEIGHT_IN } from '../services/quoteTakeoffsLite';

const edgeOptions=['Flat','Eased','Beveled','Bullnose','Ogee','Mitered','Custom'];

/** Reuses the real material Catalog, quote pinboard and Area takeoff defaults.
 * "Apply to all" is explicit: never silently overwrite individual piece overrides.
 */
export function QuoteBetaSelections({quote,onClose}:{
  quote:Quote;onClose:()=>void;
}) {
  const editable=quoteIsCommerciallyEditable(quote);
  const pinMaterial=useQuoteStore(s=>s.pinProjectMaterial);
  const applySelections=useQuoteStore(s=>s.applyJobSelections);
  const updateQuote=useQuoteStore(s=>s.updateQuote);
  const first=quote.sections.find(s=>s.scope?.takeoffDefaultEdgeProfile!==undefined||
    s.scope?.takeoffDefaultSplashHeightIn!==undefined)??quote.sections[0];
  const [edge,setEdge]=useState(first?.scope?.takeoffDefaultEdgeProfile??DEFAULT_EDGE_PROFILE);
  const [height,setHeight]=useState(String(first?.scope?.takeoffDefaultSplashHeightIn??DEFAULT_SPLASH_HEIGHT_IN));
  const [material,setMaterial]=useState('');
  const [materialRef,setMaterialRef]=useState<QuoteLineMaterialReference|undefined>();
  const [applyMaterial,setApplyMaterial]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{setEdge(first?.scope?.takeoffDefaultEdgeProfile??DEFAULT_EDGE_PROFILE);
    setHeight(String(first?.scope?.takeoffDefaultSplashHeightIn??DEFAULT_SPLASH_HEIGHT_IN));
  },[quote.id,first?.scope?.takeoffDefaultEdgeProfile,first?.scope?.takeoffDefaultSplashHeightIn]);
  const apply=(includeExistingPieces:boolean)=>{
    const n=Number(height);
    if(!Number.isFinite(n)||n<0||n>120){setMessage('Backsplash height must be between 0 and 120 inches.');return;}
    if(!quote.sections.length){
      setMessage('Materials can be pinned now. Add an Area to save fabrication defaults to the quote.');
      if(material.trim())pinMaterial(quote.id,material);
      return;
    }
    applySelections(quote.id,{
      edgeProfile:edge,splashHeightIn:n,includeExistingPieces,
      material:material.trim()||undefined,materialReference:materialRef,
      assignMaterialToAreas:applyMaterial,
    });
    setMessage(includeExistingPieces?'Applied defaults to all current pieces.':'Saved defaults for new pieces in all current Areas.');
  };
  return <div className="qmb-selections-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="qmb-selections-drawer" role="dialog" aria-modal="true" aria-label="Quote selections">
      <header className="qmb-selections-head">
        <div><strong>Selections</strong><small>Materials and job fabrication defaults</small></div>
        <button type="button" onClick={onClose} aria-label="Close selections">×</button>
      </header>
      <div className="qmb-selections-body">
        <QuoteProjectMaterials quote={quote}/>
        <div className="qmb-selections-card">
          <strong>Find a job material</strong>
          <TakeoffMaterialCatalog disabled={!editable} value={material} selected={materialRef}
            pinned={quote.projectMaterials??[]}
            onTextChange={text=>{setMaterial(text);setMaterialRef(undefined);}}
            onSelect={(ref,label)=>{setMaterial(label);setMaterialRef(ref);}}/>
          <label className="qmb-check">
            <input type="checkbox" disabled={!editable} checked={applyMaterial}
              onChange={e=>setApplyMaterial(e.target.checked)}/>
            Also assign this material to all current Areas
          </label>
          <button type="button" className="qmb-outline qmb-block" disabled={!editable||!material.trim()}
            onClick={()=>{if(material.trim()){pinMaterial(quote.id,material,materialRef);
              setMessage('Material added to Project Materials.');}}}>+ Pin for this quote</button>
        </div>
        <div className="qmb-selections-card">
          <strong>Fabrication defaults</strong>
          <div className="qmb-two">
            <label className="qmb-field"><span>Backsplash height</span>
              <input type="number" min="0" max="120" step=".5" inputMode="decimal"
                aria-label="Job backsplash height in inches" value={height} disabled={!editable}
                onChange={e=>setHeight(e.target.value)}/></label>
            <label className="qmb-field"><span>Edge profile</span>
              <select aria-label="Job default edge profile" value={edge} disabled={!editable}
                onChange={e=>setEdge(e.target.value)}>
                {edgeOptions.map(item=><option key={item}>{item}</option>)}
              </select></label>
          </div>
          <div className="qmb-two">
            <button type="button" className="qmb-outline" disabled={!editable}
              onClick={()=>apply(false)}>Set defaults</button>
            <button type="button" className="qmb-primary" disabled={!editable}
              onClick={()=>apply(true)}>Apply to all pieces</button>
          </div>
          <p className="qmb-help">Set defaults affects new pieces in existing Areas. Apply to all also updates individual pieces. You can override any piece later.</p>
        </div>
        <div className="qmb-selections-card">
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
