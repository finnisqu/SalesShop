import { useEffect, useMemo, useRef, useState } from 'react';
import { PHONE_LAYOUT_QUERY } from '../lib/mobileViewport';
import { useQuoteStore } from '../store/quoteStore';
import { useCrmStore } from '../store/crmStore';
import { useAuthStore } from '../store/authStore';
import { useQuoteLibraryStore } from '../store/quoteLibraryStore';
import { useQuotesMobileBetaStore } from '../store/quotesMobileBetaStore';
import { useNavigationStore } from '../store/navigationStore';
import { useRolePerspectiveStore } from '../store/rolePerspectiveStore';
import { canIssueTeamQuote } from '../services/teamDepartments';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import {
  parseInches, takeoffCustomerSpecs,
  totalBillableTakeoffSf, totalSplashSf, totalTakeoffSf,
} from '../services/quoteTakeoffsLite';
import {
  displayQuoteNumber, quoteLineAmount, quoteLinesTotal, quoteTotal,
  type Quote, type QuoteSection, type QuoteLine, type QuoteLineKind, type QuoteTakeoffPiece,
} from '../types/quote';
import { QuoteBetaDetails } from './QuoteBetaDetails';
import { QuoteMaterialLineFields } from './QuoteMaterialLineFields';
import { QuoteSinkLineFields } from './QuoteSinkLineFields';
import { QuoteRateLineFields } from './QuoteRateLineFields';
import { QuoteBetaEditablePreview } from './QuoteBetaEditablePreview';
import { TeamQuotesWorkspace } from './TeamQuotesWorkspace';
import { TakeoffRatePicker } from './TakeoffRatePicker';
import { QuoteSfRateChoices } from './QuoteSfRateChoices';
import { QuoteTakeoffsLite } from './QuoteTakeoffsLite';
import { QuoteBetaMeasureGrid } from './QuoteBetaMeasureGrid';
import { QuoteBetaMaterials } from './QuoteBetaMaterials';
import { QuoteBetaDesktopCommerce } from './QuoteBetaDesktopCommerce';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { selectedMaterialCost } from '../services/selectedMaterialCost';
import { QuoteBetaSelections } from './QuoteBetaSelections';
import { QuoteBetaReview } from './QuoteBetaReview';
import { QuoteBetaReviewOverlay } from './QuoteBetaReviewOverlay';
import { QuoteBetaDesktopRails, QuoteBetaInspector } from './QuoteBetaDesktopRails';
import {useQuoteBetaAreaManager,QuoteBetaAreaModeButton,QuoteBetaAreaGrip,
  QuoteBetaAreaDeleteButton,QuoteBetaAreaDeleteDialog,QuoteBetaAreaVisibilityButton} from './QuoteBetaAreasMenu';
import {useQuoteBetaGeneralManager,QuoteBetaGeneralModeButton,QuoteBetaGeneralGrip,
  QuoteBetaGeneralDelete,QuoteBetaGeneralDeleteDialog} from './QuoteBetaGeneralManager';
import {useQuoteBetaCardReflow} from './quoteBetaCardMotion';
import { auditQuoteDraft, type QuoteAuditDestination } from '../services/quoteDraftAudit';
import { isGeneralTakeoffSection } from '../services/quoteCustomerPresentation';

const money = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'});
const sf = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
type Page = 'library' | 'quote' | 'area' | 'review';
type QuoteTab = 'build' | 'details' | 'preview';
type AreaTab = 'measure' | 'materials' | 'pricing' | 'calculator';

function AppMenu() {
  const setView = useNavigationStore(s=>s.setView);
  const goBack = useNavigationStore(s=>s.goBack);
  const canGoBack = useNavigationStore(s=>s.history.length>0);
  return <div className="qmb-appnav-actions">
    {canGoBack&&<button type="button" className="qmb-app-back"
      onClick={goBack} aria-label="Back to previous SalesShop tab" title="Go back">‹</button>}
    <details className="qmb-appnav"><summary aria-label="Open SalesShop navigation">☰</summary>
    <nav aria-label="SalesShop destinations">
      {([['notebook','Notebook'],['board','Board'],['quotes','Quotes'],['catalog','Catalog'],['dashboard','Connections'],['settings','Settings']] as const).map(([id,name])=>
        <button type="button" key={id} onClick={()=>setView(id)}>{name}</button>)}
    </nav>
    </details>
  </div>;
}
function InchField({value,onChange,disabled,label}:{
  value?:number;onChange:(next:number|undefined)=>void;disabled:boolean;label:string;
}) {
  const [draft,setDraft]=useState(value===undefined?'':String(value));
  useEffect(()=>setDraft(value===undefined?'':String(value)),[value]);
  const commit=()=>{const raw=draft.trim();if(!raw){onChange(undefined);return;}
    const parsed=parseInches(raw);
    if(parsed!==undefined)onChange(parsed);
    else setDraft(value===undefined?'':String(value));
  };
  return <Field label={label}><input aria-label={label} inputMode="decimal" disabled={disabled}
    value={draft} placeholder="—" onChange={e=>setDraft(e.target.value)}
    onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();}}}/></Field>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <label className="qmb-field"><span>{label}</span>{children}</label>;
}
function BetaLine({quote,line,editable}:{quote:Quote;line:QuoteLine;editable:boolean}) {
  const update = useQuoteStore(s=>s.updateLine);
  const remove = useQuoteStore(s=>s.deleteLine);
  const reorderLine = useQuoteStore(s=>s.reorderLine);
  const moveLine = useQuoteStore(s=>s.moveLine);
  const peers = quote.lines.filter(candidate => candidate.sectionId === line.sectionId);
  const position = peers.findIndex(candidate => candidate.id === line.id);
  const canRelocate = !line.takeoffSinkId && line.quantitySource?.syncMode !== 'live';
  const [expanded,setExpanded] = useState(false);
  const [ratesOpen,setRatesOpen] = useState(false);
  useEffect(()=>{const collapse=()=>{setExpanded(false);setRatesOpen(false);};
    window.addEventListener('sales-shop:quote-collapse-all',collapse);
    return ()=>window.removeEventListener('sales-shop:quote-collapse-all',collapse);},[]);
  const textOnly = line.pricingMode === 'none';
  return <article className="qmb-line" data-quote-line-id={line.id}>
    <div className="qmb-line-top">
      <button type="button" className="qmb-line-name" aria-expanded={expanded}
        onClick={()=>setExpanded(v=>!v)}>
        <strong>{line.description || 'Untitled line'}</strong>
        <small>{line.kind} · {textOnly?'No charge':line.pricingMode==='quantity-rate' && line.rate===undefined?'Rate not set':money.format(quoteLineAmount(line))}</small>
      </button>
      <button type="button" className="qmb-icon" onClick={()=>setExpanded(v=>!v)} aria-label={expanded?'Collapse line':'Edit line'}>{expanded?'⌃':'›'}</button>
    </div>
    {expanded&&<div className="qmb-line-fields">
      <fieldset disabled={!editable}>
        <Field label="Description">
          <input value={line.description} maxLength={1000} onChange={e=>update(quote.id,line.id,{description:e.target.value})} placeholder="Describe the work"/>
        </Field>
        {line.kind==='material'&&<QuoteMaterialLineFields quoteId={quote.id} line={line}/>}
        {line.kind==='sink'&&<QuoteSinkLineFields quoteId={quote.id} line={line}/>}
        {line.kind==='rate'&&<QuoteRateLineFields quote={quote} line={line}/>}
        {!textOnly&&<div className="qmb-two">
          {line.pricingMode==='quantity-rate'?<>
            <Field label="Quantity"><input type="number" inputMode="decimal" step="any" value={line.quantity??''}
              disabled={line.quantitySource?.syncMode==='live'} placeholder="—"
              onChange={e=>update(quote.id,line.id,{quantity:e.target.value===''?undefined:Number(e.target.value)})}/></Field>
            <div className="qmb-material-rate-cell">
              <Field label="Sell rate ($/SF)"><input type="number" inputMode="decimal" min="0" step=".01"
                value={line.rate??''} placeholder="Not set"
                onChange={e=>update(quote.id,line.id,{
                  rate:e.target.value===''?undefined:Number(e.target.value),rateReference:undefined,
                })}/></Field>
              {line.kind==='material'&&<button type="button"
                className="qmb-builder-rate-toggle qmb-line-rate-trigger"
                disabled={!editable} aria-expanded={ratesOpen}
                aria-label="Choose rate for material line"
                // New catalog material rows open a search popover by default.
                // Prevent its document-level pointerdown handler from removing
                // the click target before RATE can receive the click event.
                onPointerDown={e=>e.stopPropagation()}
                onClick={()=>{
                  window.dispatchEvent(new CustomEvent('sales-shop:quote-collapse-line',{
                    detail:{lineId:line.id},
                  }));
                  setRatesOpen(open=>!open);
                }}>
                RATE {ratesOpen?'⌃':'▾'}
              </button>}
            </div>
          </>:<Field label="Amount ($)"><input type="number" inputMode="decimal" step=".01" value={line.amount??''}
            placeholder="Not set" onChange={e=>update(quote.id,line.id,{amount:e.target.value===''?undefined:Number(e.target.value)})}/></Field>}
        </div>}
        {ratesOpen&&line.kind==='material'&&line.pricingMode==='quantity-rate'&&
          <div className="qmb-line-rate-drawer" aria-label="Material line rate options">
            <QuoteSfRateChoices division={quote.pricingDivision}
              selectedRateId={line.rateReference?.rateBookItemId}
              materialType={line.materialReference?.snapshot?.materialType}
              materialCostPerSf={line.materialReference?.sourceCostPerSf??line.materialReference?.snapshot?.costPerSf}
              onSelect={(price,ref)=>{
                update(quote.id,line.id,{rate:price,rateReference:ref});
                setRatesOpen(false);
              }}/>
          </div>}
        {line.takeoffSinkId?<p className="qmb-help">Sink charge is always included in the quote total.</p>
          :<label className="qmb-check"><input type="checkbox" checked={line.includeInTotal} onChange={e=>update(quote.id,line.id,{includeInTotal:e.target.checked})}/> Include in quote total</label>}
        <label className="qmb-check"><input type="checkbox" checked={line.customerVisible} onChange={e=>update(quote.id,line.id,{customerVisible:e.target.checked})}/> Show this line to customer (itemized view)</label>
        <div className="qmb-line-structure" aria-label="Line arrangement">
          <div className="qmb-line-order">
            <span>Line order</span>
            <button type="button" aria-label="Move line up" disabled={position<=0}
              onClick={()=>reorderLine(quote.id,line.id,-1)}>↑</button>
            <button type="button" aria-label="Move line down" disabled={position>=peers.length-1}
              onClick={()=>reorderLine(quote.id,line.id,1)}>↓</button>
          </div>
          {canRelocate?<label className="qmb-line-destination">
            <span>Move line to</span>
            <select aria-label="Move line to Area" value={line.sectionId??''}
              onChange={e=>moveLine(quote.id,line.id,e.target.value||undefined)}>
              <option value="">General</option>
              {quote.sections.map(area=><option key={area.id} value={area.id}>{area.title||'Untitled Area'}</option>)}
            </select>
          </label>:<p className="qmb-help">This charge follows its Takeoffs source. Move or remove that source under Materials or Measure.</p>}
        </div>
        {line.takeoffSinkId
          ?<p className="qmb-help">Remove the sink itself from Materials if it is no longer needed.</p>
          :<button type="button" className="qmb-danger" onClick={()=>{if(window.confirm('Remove this quote line? You can undo the change.'))remove(quote.id,line.id);}}>Remove line</button>}
      </fieldset>
    </div>}
  </article>;
}

function AreaWorkspace({quote,section,tab,setTab,goBack,onNextArea,onDuplicate}:{
  quote:Quote;section:QuoteSection;tab:AreaTab;setTab:(v:AreaTab)=>void;
  goBack:()=>void;onNextArea:()=>void;onDuplicate:()=>void;
}) {
  const editable=quoteIsCommerciallyEditable(quote);
  const general=isGeneralTakeoffSection(section);
  const updateSection=useQuoteStore(s=>s.updateSection);
  const updatePieces=useQuoteStore(s=>s.updateTakeoffPieces);
  const addLinked=useQuoteStore(s=>s.addTakeoffLine);
  const setRate=useQuoteStore(s=>s.setTakeoffRate);
  const addLine=useQuoteStore(s=>s.addLine);
  const updateLine=useQuoteStore(s=>s.updateLine);
  const [kind,setKind]=useState<QuoteLineKind>('item');
  const [advanced,setAdvanced]=useState(false);
  const [desktopLab,setDesktopLab]=useState(()=>
    typeof window!=='undefined'&&window.matchMedia('(min-width:1000px) and (min-height:550px)').matches);
  useEffect(()=>{
    const media=window.matchMedia('(min-width:1000px) and (min-height:550px)');
    const update=()=>setDesktopLab(media.matches);
    media.addEventListener('change',update);
    return()=>media.removeEventListener('change',update);
  },[]);
  const areaScrollRef=useRef<HTMLDivElement>(null);
  const catalogMaterials=useCompanySettingsStore(state=>state.settings.stockMaterials);
  const selectedCost=selectedMaterialCost(
    section.scope?.takeoffMaterial??'',section.scope?.takeoffMaterialReference,catalogMaterials);
  const costPerSf=selectedCost.quotedCostPerSf??selectedCost.currentCatalogCostPerSf;
  const pieces=section.scope?.takeoffPieces??[];
  const lines=quote.lines.filter(l=>l.sectionId===section.id);
  const linked=lines.find(l=>l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf');
  const amount=quoteLinesTotal(lines);
  const measured=totalBillableTakeoffSf(pieces);
  const savePieces=(next:QuoteTakeoffPiece[])=>updatePieces(quote.id,section.id,next);
  const advanceArea=()=>{
    if(tab==='pricing'||tab==='calculator'){onNextArea();return;}
    if(desktopLab&&tab==='materials'){setTab('calculator');return;}
    setTab(tab==='measure'?'materials':'pricing');
    const scroll=areaScrollRef.current;
    const tabs=scroll?.querySelector<HTMLElement>('.qmb-tabs');
    if(scroll&&tabs)scroll.scrollTo({top:tabs.offsetTop,behavior:'auto'});
  };
  const patchPiece=(id:string,patch:Partial<QuoteTakeoffPiece>)=>savePieces(pieces.map(p=>p.id===id?{...p,...patch}:p));
  return <div className="qmb-editor qmb-area-editor">
    <div ref={areaScrollRef} className="qmb-area-scroll">
    <header className="qmb-pagehead">
      <button type="button" className="qmb-back" onClick={goBack}>‹ Quote</button>
      <div className="qmb-area-header-actions">
        {editable&&!general&&<button type="button" className="qmb-area-duplicate-action"
          aria-label="Duplicate this Area" onClick={onDuplicate}>⧉ Duplicate</button>}
        <span className="qmb-chip">{editable?'Auto-save':'Read only'}</span>
      </div>
    </header>
    <div className="qmb-pad qmb-titlepad">
      {general?<div className="qmb-kicker">GENERAL · TAKEOFFS & PRICING</div>:<>
        <div className="qmb-kicker">AREA WORKSPACE</div>
        <Field label="Area name">
          <input className="qmb-titleinput" value={section.title} disabled={!editable} maxLength={200} placeholder="Kitchen, Unit A, Level 2…"
            onChange={e=>updateSection(quote.id,section.id,{title:e.target.value})}/>
        </Field>
      </>}
      <div className="qmb-area-summary"><span>{sf.format(measured)} SF measured</span><strong>{money.format(amount)}</strong></div>

    </div>
    <nav className="qmb-tabs" aria-label="Area sections">
      {(desktopLab?([['measure','Measure'],['materials','Materials'],['calculator','Calculator']] as const)
        :([['measure','Measure'],['materials','Materials'],['pricing','Pricing']] as const)).map(([id,label])=>
        <button key={id} type="button" className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>{
          setTab(id);
          const scroll=areaScrollRef.current;
          const tabs=scroll?.querySelector<HTMLElement>('.qmb-tabs');
          if(scroll&&tabs)scroll.scrollTo({top:tabs.offsetTop,behavior:'auto'});
        }}>{label}</button>)}
    </nav>
    <div className="qmb-pad qmb-pagecontent">
      {tab==='measure'&&<QuoteBetaMeasureGrid pieces={pieces} editable={editable}
        onSave={savePieces} onAdvanced={()=>setAdvanced(true)}
        defaults={{splashHeightIn:section.scope?.takeoffDefaultSplashHeightIn??4,
          edgeProfile:section.scope?.takeoffDefaultEdgeProfile??'Flat'}}
        onSetDefaults={(next,applyAll)=>{
          updateSection(quote.id,section.id,{scope:{...section.scope,
            takeoffDefaultSplashHeightIn:next.splashHeightIn,takeoffDefaultEdgeProfile:next.edgeProfile}});
          if(applyAll)savePieces(pieces.map(piece=>({...piece,splashHeightIn:next.splashHeightIn,
            edgeProfile:next.edgeProfile})));
        }}/>}
      {tab==='materials'&&(desktopLab
        ?<QuoteBetaDesktopCommerce quote={quote} section={section} editable={editable} tab="materials"/>
        :<QuoteBetaMaterials quote={quote} section={section} editable={editable}/>)}
      {tab==='calculator'&&desktopLab&&<QuoteBetaDesktopCommerce quote={quote} section={section}
        editable={editable} tab="calculator"/>}
      {tab==='pricing'&&<div className="qmb-mobile-pricing-legacy">
        <div className="qmb-section-head"><div><h3>Pricing & presentation</h3><p>Finish pricing here—or leave it undecided.</p></div></div>
        <section className="qmb-card">
          <div className="qmb-split"><span>Linked area SF</span><strong>{sf.format(measured)} SF</strong></div>
          <div className="qmb-area-material-cost" aria-label="Selected material cost reference">
            <div className="qmb-area-cost-top">
              <span>Selected material cost <small>· internal</small></span>
              <strong>{costPerSf!==undefined
                ?money.format(costPerSf)+'/SF':'—'}</strong>
            </div>
            {costPerSf!==undefined?<>
              <small className="qmb-area-cost-detail">{selectedCost.materialName} · {selectedCost.quotedCostPerSf!==undefined?'Cost captured when selected':'Current Catalog reference (not saved on quote)'}</small>
              {selectedCost.catalogCostChanged&&<small className="qmb-area-cost-updated">
                Catalog now {money.format(selectedCost.currentCatalogCostPerSf!)}/SF · Re-select under Materials to update the cost reference
              </small>}
            </>:<div className="qmb-area-cost-missing">
              <small>{selectedCost.materialName==='Material not selected'
                ?'Choose a catalog material to compare buying cost and selling levels.'
                :'No $/SF buying cost recorded for this material.'}</small>
              <button type="button" onClick={()=>setTab('materials')}>Materials ›</button>
            </div>}
          </div>
          {linked?<TakeoffRatePicker quote={quote} rate={linked.rate} disabled={!editable}
            selectedRateId={linked.rateReference?.rateBookItemId}
            materialType={selectedCost.materialType}
            materialCostPerSf={costPerSf}
            onSelect={(rate,ref)=>setRate(quote.id,section.id,rate,ref)}/>:<>
            <p className="qmb-help">{pieces.length?'No linked SF price yet. Adding one is a separate charge: check for existing material rows first.':'Add measurements first, or create a manual price row below.'}</p>
            <button type="button" className="qmb-outline" disabled={!editable||!pieces.some(p=>p.lengthIn&&p.widthIn)}
              onClick={()=>addLinked(quote.id,section.id)}>+ Add linked SF price</button>
          </>}
        </section>
        <section className="qmb-card">
          <strong>Customer display</strong>
          <p className="qmb-help">Changes visibility, never the underlying total.</p>
          <div className="qmb-choice">
            <button type="button" disabled={!editable} aria-pressed={section.customerDisplayMode!=='detail'}
              className={section.customerDisplayMode!=='detail'?'active':''}
              onClick={()=>updateSection(quote.id,section.id,{customerDisplayMode:'summary'})}>One lump sum</button>
            <button type="button" disabled={!editable} aria-pressed={section.customerDisplayMode==='detail'}
              className={section.customerDisplayMode==='detail'?'active':''}
              onClick={()=>updateSection(quote.id,section.id,{customerDisplayMode:'detail'})}>Itemized</button>
          </div>
          <p className="qmb-help">{general?'General has no customer-facing heading or specification blurb.':takeoffCustomerSpecs(section)||'Material and sink specifications can be added anytime.'}</p>
          {section.customerDisplayMode==='detail'&&lines.filter(l=>l.includeInTotal).map(l=>
            <label key={l.id} className="qmb-check"><input type="checkbox" disabled={!editable} checked={l.customerVisible}
              onChange={e=>updateLine(quote.id,l.id,{customerVisible:e.target.checked})}/>{l.description||'Line item'}</label>)}
        </section>
        <div className="qmb-section-head"><h3>Area charges</h3><strong>{money.format(amount)}</strong></div>
        {lines.map(l=><BetaLine key={l.id} quote={quote} line={l} editable={editable}/>)}
        <section className="qmb-card qmb-addcharge">
          <Field label="Add a line"><select disabled={!editable} value={kind} onChange={e=>setKind(e.target.value as QuoteLineKind)}>
            {([['item','Custom charge'],['material','Catalog material'],['sink','Catalog sink'],['rate','Rate Book item'],['allowance','Allowance'],['discount','Discount'],['tax','Tax'],['scope','Scope'],['warranty','Warranty'],['note','Customer note']] as const)
              .map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field>
          <button type="button" className="qmb-outline qmb-block" disabled={!editable}
            onClick={()=>addLine(quote.id,kind,section.id)}>+ Add line to Area</button>
        </section>
      </div>}
    </div>
    </div>
    <footer className="qmb-footer qmb-area-footer">
      <div className="qmb-footer-area-total"><small>Area total</small><strong>{money.format(amount)}</strong></div>
      <div className="qmb-area-footer-actions">
        {editable&&<button type="button" className="qmb-outline qmb-area-next"
          aria-label={tab==='pricing'||tab==='calculator'?'Create next Area':'Continue to next Area step'}
          onClick={advanceArea}>
          {tab==='measure'?'Materials ›':tab==='materials'&&!desktopLab?'Pricing ›':
            tab==='materials'&&desktopLab?'Calculator ›':'+ Next Area ›'}
        </button>}
        <button type="button" className="qmb-primary" onClick={goBack}>Done · Quote ›</button>
      </div>
    </footer>
    {advanced&&<QuoteTakeoffsLite quote={quote} section={section} onClose={()=>setAdvanced(false)}/>}
  </div>;
}

export function QuotesMobileBeta() {
  const hydrate=useQuoteStore(s=>s.hydrate);
  const hydrated=useQuoteStore(s=>s.hydrated);
  const quotes=useQuoteStore(s=>s.quotes);
  const activeQuoteId=useQuoteStore(s=>s.activeQuoteId);
  const create=useQuoteStore(s=>s.createQuote);
  const select=useQuoteStore(s=>s.selectQuote);
  const update=useQuoteStore(s=>s.updateQuote);
  const addSection=useQuoteStore(s=>s.addSection);
  const duplicateArea=useQuoteStore(s=>s.duplicateArea);
  const ensureGeneralTakeoff=useQuoteStore(s=>s.ensureGeneralTakeoff);
  const addLine=useQuoteStore(s=>s.addLine);
  const updateSinks=useQuoteStore(s=>s.updateTakeoffSinks);
  const updateManagedSinkLine=useQuoteStore(s=>s.updateLine);
  const undo=useQuoteStore(s=>s.undoQuote);
  const redo=useQuoteStore(s=>s.redoQuote);
  const recordSent=useQuoteStore(s=>s.recordSent);
  const undoDepth=useQuoteStore(s=>activeQuoteId?s.undoStacks[activeQuoteId]?.length??0:0);
  const redoDepth=useQuoteStore(s=>activeQuoteId?s.redoStacks[activeQuoteId]?.length??0:0);
  const hydrateCrm=useCrmStore(s=>s.hydrate);
  const exitBeta=useQuotesMobileBetaStore(s=>s.setEnabled);
  const authMode=useAuthStore(s=>s.mode);
  const teamRole=useAuthStore(s=>s.teamRole);
  const department=useAuthStore(s=>s.teamDepartment);
  const userId=useAuthStore(s=>s.user?.id);
  const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
  const libraryMode=useQuoteLibraryStore(s=>s.mode);
  const setLibraryMode=useQuoteLibraryStore(s=>s.setMode);
  const setView=useNavigationStore(s=>s.setView);
  const restoredLocation=useRef(useQuotesMobileBetaStore.getState().location);
  const setLocation=useQuotesMobileBetaStore(s=>s.setLocation);
  const [page,setPage]=useState<Page>(()=>restoredLocation.current.page);
  const [quoteTab,setQuoteTab]=useState<QuoteTab>(()=>restoredLocation.current.quoteTab);
  const [areaTab,setAreaTab]=useState<AreaTab>(()=>restoredLocation.current.areaTab);
  const [areaId,setAreaId]=useState<string|null>(()=>restoredLocation.current.areaId);
  const [search,setSearch]=useState('');
  const [showArchived,setShowArchived]=useState(false);

  const [selectionsOpen,setSelectionsOpen]=useState(false);
  const [reviewOpen,setReviewOpen]=useState(false);
  const [reviewFocus,setReviewFocus]=useState<string|null>(null);
  const quoteScrollRef=useRef<HTMLDivElement>(null);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{hydrate();hydrateCrm();},[hydrate,hydrateCrm]);
  useEffect(()=>{
    if(!hydrated)return;
    const previous=restoredLocation.current.quoteId;
    if(previous&&previous!==activeQuoteId&&page!=='library'){
      setPage('quote');setQuoteTab('build');setAreaId(null);
      restoredLocation.current={...restoredLocation.current,quoteId:activeQuoteId??undefined};
      return;
    }
    setLocation({quoteId:activeQuoteId??undefined,page,quoteTab,areaTab,areaId});
  },[hydrated,activeQuoteId,page,quoteTab,areaTab,areaId,setLocation]);
  const myQuotes=useMemo(()=>authMode==='cloud'?quotes.filter(q=>q.ownerUserId===userId):quotes,
    [authMode,quotes,userId]);
  const quote=myQuotes.find(q=>q.id===activeQuoteId)??null;
  const generalTakeoff=quote?.sections.find(isGeneralTakeoffSection);
  const areaManager=useQuoteBetaAreaManager(quote);
  const generalManager=useQuoteBetaGeneralManager(quote);
  const mobileAreaRef=useQuoteBetaCardReflow<HTMLDivElement>(
    (areaManager.editing?areaManager.orderedSections:quote?.sections.filter(s=>!isGeneralTakeoffSection(s))??[]).map(s=>s.id));
  const mobileGeneralRef=useQuoteBetaCardReflow<HTMLDivElement>(
    (generalManager.editing?generalManager.lines:(quote?.lines??[]).filter(l=>
      !l.sectionId||!quote?.sections.some(s=>s.id===l.sectionId))).map(l=>l.id));
  // One-time upgrade when opening old Beta takeoffs: historical specifications
  // should not silently remain unpriced. Normal Catalog/manually priced rows are
  // preserved; only missing takeoff-managed sink charges are created.
  useEffect(()=>{
    if(!quote||!quoteIsCommerciallyEditable(quote))return;
    // Beta always includes the managed sink sell charge in the quote amount.
    // Classic retains its earlier manual Include behavior for compatibility.
    for(const line of quote.lines){
      if(line.takeoffSinkId&&!line.includeInTotal)
        updateManagedSinkLine(quote.id,line.id,{includeInTotal:true});
    }
    for(const section of quote.sections){
      const sinks=section.scope?.takeoffSinks;
      if(!sinks?.length)continue;
      const hasExcludedCharge=quote.lines.some(line=>line.sectionId===section.id
        &&line.takeoffSinkId&&!line.includeInTotal);
      if(!sinks.some(s=>!s.includeInPricing)&&!hasExcludedCharge)continue;
      const updated=sinks.map(sink=>{
        if(sink.includeInPricing)return sink;
        const alreadyCharged=quote.lines.some(line=>line.sectionId===section.id
          &&line.includeInTotal
          &&(line.takeoffSinkId===sink.id
            ||(line.kind==='sink' && !!sink.name.trim()
              &&line.description.toLowerCase().includes(sink.name.trim().toLowerCase()))));
        return alreadyCharged?sink:{...sink,includeInPricing:true};
      });
      if(updated.some((sink,i)=>sink!==sinks[i])||hasExcludedCharge)
        updateSinks(quote.id,section.id,updated);
    }
  },[quote,updateSinks,updateManagedSinkLine]);
  const area=quote?.sections.find(s=>s.id===areaId)??null;
  const editable=Boolean(quote&&quoteIsCommerciallyEditable(quote));
  const canBrowseTeam=authMode==='cloud'&&(teamRole==='owner'||teamRole==='admin')&&!previewRole;
  const canIssue=authMode!=='cloud'||canIssueTeamQuote(teamRole,department);
  const list=myQuotes.filter(q=>(showArchived||!q.archivedAt)&&
    [q.title,q.companyName,q.quoteNumber].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const openQuote=(id:string)=>{select(id);setQuoteTab('build');setPage('quote');setSelectionsOpen(false);setReviewOpen(false);setError('');};
  const createQuote=()=>{const id=create();useQuoteStore.getState().updateQuote(id,{lines:[]});openQuote(id);};
  const openArea=(id:string)=>{setAreaId(id);setAreaTab('measure');setPage('area');};
  const goBack=()=>{setPage('quote');setAreaId(null);};
  const newArea=()=>{
    if(!quote||!editable)return;
    const id=addSection(quote.id);
    if(id){
      const jobDefaults=quote.sections.find(s=>s.scope?.takeoffDefaultSplashHeightIn!==undefined||
        s.scope?.takeoffDefaultEdgeProfile!==undefined)?.scope;
      useQuoteStore.getState().updateSection(quote.id,id,{
        customerDisplayMode:'summary',
        ...(jobDefaults?{scope:{takeoffDefaultSplashHeightIn:jobDefaults.takeoffDefaultSplashHeightIn,
          takeoffDefaultEdgeProfile:jobDefaults.takeoffDefaultEdgeProfile}}:{}),
      });
      openArea(id);
    }
  };
  const duplicateCurrentArea=()=>{
    if(!quote||!area||!editable)return;
    const copy=duplicateArea(quote.id,area.id);
    if(copy)openArea(copy);
  };
  useEffect(()=>{
    if(page==='area'&&!area)setPage('quote');
    if(page!=='library'&&!quote)setPage('library');
  },[page,area,quote]);
  const audit=quote?auditQuoteDraft(quote):null;
  const openReview=(focusId:string|null=null)=>{setError('');setSelectionsOpen(false);setReviewFocus(focusId);setReviewOpen(true);};
  const openReviewCategory=(kind:'blockers'|'review'|'optional')=>{
    const item=audit?.[kind][0];openReview(item?.id??null);
  };
  // Send is always a visible entry point. Drafts with issues drill into their
  // first finding; a clear draft opens delivery, never silently dispatches email.
  const openSend=()=>{
    if(audit?.blockers.length){openReview(audit.blockers[0].id);return;}
    if(audit?.review.length){openReview(audit.review[0].id);return;}
    openReview('__delivery__');
  };
  const fixAudit=(destination:QuoteAuditDestination)=>{
    setReviewOpen(false);
    if(destination.view==='area'){
      setAreaId(destination.areaId);setAreaTab(destination.tab);setPage('area');
    }else{
      setQuoteTab(destination.view);setPage('quote');setAreaId(null);
    }
  };
  const issueQuote=async()=>{
    if(!quote||sending)return;
    const latest=useQuoteStore.getState().quotes.find(q=>q.id===quote.id);
    // Recheck at the moment of issuing, not just when the screen rendered.
    if(!latest||auditQuoteDraft(latest).blockers.length){
      setError('Resolve pricing blockers before issuing this quote.');return;
    }
    setSending(true);setError('');
    try{await recordSent(quote.id);}
    catch(e){setError(e instanceof Error?e.message:'Could not issue quote');}
    finally{setSending(false);}
  };
  if(!hydrated)return <main className="qmb"><p className="qmb-loading">Opening Quotes Beta…</p></main>;
  if(canBrowseTeam&&libraryMode==='team')return <main className="quotes-view qmb-team">
    <div className="qmb-team-back"><button type="button" onClick={()=>setLibraryMode('mine')}>‹ My Quotes Beta</button></div>
    <TeamQuotesWorkspace quotes={quotes} onShowMine={()=>setLibraryMode('mine')}/>
  </main>;
  return <main className={"quotes-view qmb"+(reviewOpen?" is-review-expanded":"")} aria-label="Quotes mobile beta">
    <div className={'qmb-desktop-frame'+(page==='library'?' is-library':'')}>
      {quote&&page!=='library'&&<QuoteBetaDesktopRails
        quote={quote} page={page} quoteTab={quoteTab} areaTab={areaTab} areaId={areaId}
        areaManager={areaManager}
        onLibrary={()=>{setSelectionsOpen(false);setPage('library');setAreaId(null);}}
        onQuoteTab={tab=>{setPage('quote');setQuoteTab(tab);setAreaId(null);}}
        onArea={id=>{if(page==='area'&&id===areaId)return;openArea(id);}}
        onAreaTab={tab=>{setPage('area');setAreaTab(tab);}}
        onReview={()=>openReview()}
        onReviewFinding={openReviewCategory}
        onReviewIssue={id=>openReview(id)}
        onSend={openSend} canIssue={canIssue}
        onUndo={()=>undo(quote.id)} onRedo={()=>redo(quote.id)}
        undoDepth={undoDepth} redoDepth={redoDepth}
        onAddArea={newArea}
        onSelections={()=>setSelectionsOpen(true)}
        />}
      <div className="qmb-desktop-main">
    {page==='library'?<>
      <header className="qmb-top"><div className="qmb-brand"><b>S</b><strong>Quotes <span>Beta</span></strong></div>
        <div className="qmb-headeractions"><AppMenu/><button type="button" className="qmb-quiet" onClick={()=>exitBeta(false)}>Classic ↗</button></div></header>
      <div className="qmb-pad qmb-pagecontent">
        <div className="qmb-kicker">YOUR SALES WORKSPACE</div><h1>Quotes</h1>
        <p className="qmb-subtitle">Pick up where you left off, or start with a blank idea.</p>
        <label className="qmb-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a quote or customer" aria-label="Search my quotes"/></label>
        <div className="qmb-section-head"><h3>My quotes</h3><button type="button" className="qmb-quiet" onClick={()=>setShowArchived(v=>!v)}>{showArchived?'Hide archived':'Show archived'}</button></div>
        <div className="qmb-library-grid">
        {list.map(q=><button type="button" key={q.id} className="qmb-card qmb-listcard" onClick={()=>openQuote(q.id)}>
          <div className="qmb-split"><small>{displayQuoteNumber(q)}</small><span className="qmb-chip">{q.status}</span></div>
          <strong>{q.title||'Untitled quote'}</strong>
          <div className="qmb-split"><small>{q.companyName||'Customer not selected'} · {q.sections.length} Areas</small>
            <b>{money.format(quoteTotal(q))}</b></div>
        </button>)}
        </div>
        {!list.length&&<div className="qmb-empty">No matching quotes. Start one without filling in any required fields.</div>}
        {canBrowseTeam&&<button type="button" className="qmb-outline qmb-block" onClick={()=>setLibraryMode('team')}>Team Quotes ›</button>}
      </div>
      <footer className="qmb-footer qmb-footer-single"><button type="button" className="qmb-primary" onClick={createQuote}>+ New quote</button></footer>
    </>:page==='quote'&&quote?<div className="qmb-editor qmb-quote-editor">
      <div className="qmb-quote-scroll" ref={quoteScrollRef}>
        <header className="qmb-pagehead">
          <button type="button" className="qmb-back" onClick={()=>setPage('library')}>‹ My quotes</button>
          <span className="qmb-chip">{quote.status}</span>
          <div className="qmb-headeractions"><AppMenu/><button type="button" className="qmb-quiet" onClick={()=>exitBeta(false)}>Classic</button></div>
        </header>
        <div className="qmb-quote-sticky">
          <div className="qmb-quote-identity">
            <input className="qmb-quote-name" aria-label="Quote title" maxLength={300}
              disabled={!editable} placeholder="Untitled quote"
              value={quote.title==='Untitled quote'?'':quote.title}
              onChange={e=>update(quote.id,{title:e.target.value})}/>
            <strong className="qmb-quote-total" aria-label="Current quote total">{money.format(quoteTotal(quote))}</strong>
          </div>
          <nav className="qmb-tabs" aria-label="Quote views">
            {([['build','Build'],['details','Details'],['preview','Preview']] as const).map(([id,label])=>
              <button key={id} type="button" className={quoteTab===id?'active':''}
                aria-current={quoteTab===id?'page':undefined}
                onClick={()=>{
                  setQuoteTab(id);
                  const scroll=quoteScrollRef.current;
                  const identity=scroll?.querySelector<HTMLElement>('.qmb-quote-sticky');
                  if(scroll&&identity)scroll.scrollTop=identity.offsetTop;
                }}>{label}</button>)}
            <button type="button" className="qmb-selections-tab"
              aria-label="Open quote selections" onClick={()=>setSelectionsOpen(true)}>◇ Selections</button>
          </nav>
        </div>
        <div className="qmb-pad qmb-pagecontent">
        {quote.documentType==='pricing-schedule'&&<div className="qmb-card"><strong>Pricing Schedule</strong><p>Use Classic Quotes for the full schedule workbook. This Beta editor does not alter its special pricing data.</p>
          <button type="button" className="qmb-outline" onClick={()=>exitBeta(false)}>Open classic editor</button></div>}
        {quoteTab==='build'&&quote.documentType!=='pricing-schedule'&&<>
          <div className="qmb-section-head qmb-general-heading" data-general-edit-workspace><h3>General</h3>
            <div className="qmb-general-quick-add" aria-label="Add General line">
              {editable&&!generalManager.editing&&<button type="button"
                aria-label="General takeoffs" onClick={()=>{
                  const id=ensureGeneralTakeoff(quote.id);
                  if(id)openArea(id);
                }}>{generalTakeoff?'Edit takeoff':'Takeoff'}</button>}
              {editable&&!generalManager.editing&&([['item','Custom'],['material','Material'],['sink','Sink'],['rate','Rate'],['note','Note']] as const)
                .map(([id,label])=><button type="button" key={id} onClick={()=>addLine(quote.id,id)}>{label}</button>)}
              <QuoteBetaGeneralModeButton manager={generalManager}/>
            </div>
          </div>
          {generalTakeoff&&<button type="button" className="qmb-general-takeoff-ref"
            onClick={()=>openArea(generalTakeoff.id)}>
            <strong>General takeoff · {sf.format(generalTakeoff.scope?.countertopSf??0)} SF</strong>
            <span>{money.format(quoteLinesTotal(quote.lines.filter(l=>l.sectionId===generalTakeoff.id)))} · Edit measurements and pricing ›</span>
          </button>}
          <div ref={mobileGeneralRef} className={'qmb-inline-general-list'+(generalManager.editing?' is-managing-general':'')}
            data-general-edit-workspace aria-label="General line cards">
            {(generalManager.editing?generalManager.lines:
              quote.lines.filter(l=>!l.sectionId||!quote.sections.some(s=>s.id===l.sectionId)))
              .map(l=><div className="qmb-inline-general-row" data-qmb-sort-row={l.id} key={l.id}>
                {generalManager.editing&&<QuoteBetaGeneralGrip manager={generalManager} line={l}/>}
                <div className="qmb-general-inline-item"><BetaLine quote={quote} line={l} editable={editable&&!generalManager.editing}/></div>
                {generalManager.editing&&<QuoteBetaGeneralDelete manager={generalManager} line={l}/>}
              </div>)}
            {generalManager.editing&&<p className="qmb-inline-area-hint">Drag to reorder · Enter / Done saves · Esc cancels</p>}
          </div>


          <div className="qmb-section-head" data-area-edit-workspace><h3>Areas</h3>
            <div className="qmb-areas-actions">
              <QuoteBetaAreaModeButton manager={areaManager}/>
              {!areaManager.editing&&<button className="qmb-quiet" type="button" disabled={!editable} onClick={newArea}>+ Add Area</button>}
            </div>
          </div>
          <div ref={mobileAreaRef} className={'qmb-inline-area-list'+(areaManager.editing?' is-managing-areas':'')}
            data-area-edit-workspace aria-label="Quote Area cards">
          {(areaManager.editing?areaManager.orderedSections:quote.sections.filter(s=>!isGeneralTakeoffSection(s))).map(s=>{
            const lines=quote.lines.filter(l=>l.sectionId===s.id);
            return <div className="qmb-inline-area-row" data-qmb-sort-row={s.id} data-area-sort-id={s.id} key={s.id}>
              {areaManager.editing&&<QuoteBetaAreaGrip manager={areaManager} area={s}/>}
              <button type="button" className="qmb-card qmb-area-card"
                aria-disabled={areaManager.editing}
                onClick={()=>{if(!areaManager.editing)openArea(s.id);}}>
                <span className="qmb-area-icon">▤</span><span className="qmb-area-text"><strong>{s.title.trim().toLowerCase()==='general takeoffs'?'General':s.title||'Untitled Area'}</strong>
                  <small>{sf.format(s.scope?.countertopSf??0)} SF · {s.scope?.takeoffMaterial||'Material not selected'}</small>
                  <small>{s.customerDisplayMode==='summary'?'One lump sum':'Itemized'}</small>
                  {!s.customerVisible&&<small className="qmb-area-hidden-label">Hidden from customer</small>}</span>
                <span className="qmb-area-price"><b>{money.format(quoteLinesTotal(lines))}</b>{!areaManager.editing&&<span>›</span>}</span>
              </button>
              {areaManager.editing&&<><QuoteBetaAreaVisibilityButton quote={quote} area={s}/>
                <QuoteBetaAreaDeleteButton manager={areaManager} area={s}/></>}
            </div>;
          })}
          {areaManager.editing&&<p className="qmb-inline-area-hint">Drag to reorder · Enter / Done saves · Esc cancels</p>}
          </div>
          {!quote.sections.some(s=>!isGeneralTakeoffSection(s))&&<div className="qmb-empty">No Areas yet. Add a Kitchen, Bathroom, Unit Type—or jump to Details first.</div>}
        </>}
        {quoteTab==='details'&&<QuoteBetaDetails quote={quote}/>} 
        {quoteTab==='preview'&&<>
          <QuoteBetaEditablePreview quote={quote}/>
        </>}
        </div>
      </div>
      <footer className="qmb-footer qmb-quote-footer">
        <button type="button" className="qmb-primary" onClick={openSend}>
          {audit?.blockers.length?'Resolve '+audit.blockers.length+' pricing issue'+(audit.blockers.length===1?'':'s')+' ›':'Send quote ›'}</button>
      </footer>
    </div>:page==='area'&&quote&&area?<AreaWorkspace key={area.id} quote={quote} section={area} tab={areaTab}
      setTab={setAreaTab} goBack={goBack} onNextArea={newArea} onDuplicate={duplicateCurrentArea}/>:null}
      </div>
    </div>
    {quote&&page!=='library'&&selectionsOpen&&<QuoteBetaSelections quote={quote} onClose={()=>setSelectionsOpen(false)}/>}
    <QuoteBetaAreaDeleteDialog manager={areaManager} quote={quote}/>
    <QuoteBetaGeneralDeleteDialog manager={generalManager} quote={quote}/>
    {quote&&page!=='library'&&reviewOpen&&<QuoteBetaReviewOverlay quote={quote} focusId={reviewFocus}
      inspector={<QuoteBetaInspector quote={quote} page={page} areaTab={areaTab} areaId={areaId}
        onAreaTab={tab=>{setPage('area');setAreaTab(tab);}} onReview={()=>openReview()}
        onReviewFinding={openReviewCategory} onReviewIssue={id=>openReview(id)}
        onSend={openSend} canIssue={canIssue}/>}
      canIssue={canIssue} sending={sending} error={error} onIssue={issueQuote}
      onClose={()=>{setReviewOpen(false);setReviewFocus(null);}}
      onFix={fixAudit} onPreview={()=>{setReviewOpen(false);setQuoteTab('preview');setPage('quote');setAreaId(null);}}
      onClassic={()=>{setReviewOpen(false);exitBeta(false);setView('quotes');}}/>}
    {quote&&page==='quote'&&quoteTab!=='preview'&&<div className="qmb-history" aria-label="Undo or redo">
      <button type="button" disabled={!editable||!undoDepth} onClick={()=>undo(quote.id)} aria-label="Undo">↶</button>
      <button type="button" disabled={!editable||!redoDepth} onClick={()=>redo(quote.id)} aria-label="Redo">↷</button>
    </div>}
  </main>;
}

export function useIsPhoneLayout() {
  const [matches,setMatches] = useState(()=>typeof window!=='undefined'&&window.matchMedia(PHONE_LAYOUT_QUERY).matches);
  useEffect(()=>{
    const media=window.matchMedia(PHONE_LAYOUT_QUERY);
    const update=()=>setMatches(media.matches);
    update();media.addEventListener('change',update);
    return()=>media.removeEventListener('change',update);
  },[]);
  return matches;
}
