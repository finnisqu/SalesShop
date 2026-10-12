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
import { QuoteCrmFields } from './QuoteCrmFields';
import { QuoteProjectMaterials } from './QuoteProjectMaterials';
import { QuoteNotesFields } from './QuoteEditorFields';
import { QuoteMaterialLineFields } from './QuoteMaterialLineFields';
import { QuoteSinkLineFields } from './QuoteSinkLineFields';
import { QuoteRateLineFields } from './QuoteRateLineFields';
import { QuoteShareControl } from './QuoteShareControl';
import { CustomerPreview } from './Quotes';
import { TeamQuotesWorkspace } from './TeamQuotesWorkspace';
import { TakeoffRatePicker } from './TakeoffRatePicker';
import { QuoteTakeoffsLite } from './QuoteTakeoffsLite';
import { QuoteBetaMeasureGrid } from './QuoteBetaMeasureGrid';
import { QuoteBetaMaterials } from './QuoteBetaMaterials';
import { isGeneralTakeoffSection } from '../services/quoteCustomerPresentation';

const money = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'});
const sf = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
type Page = 'library' | 'quote' | 'area' | 'review';
type QuoteTab = 'build' | 'details' | 'preview';
type AreaTab = 'measure' | 'materials' | 'pricing';

function AppMenu() {
  const setView = useNavigationStore(s=>s.setView);
  return <details className="qmb-appnav"><summary aria-label="Open SalesShop navigation">☰</summary>
    <nav aria-label="SalesShop destinations">
      {([['notebook','Notebook'],['board','Board'],['quotes','Quotes'],['catalog','Catalog'],['dashboard','Connections'],['settings','Settings']] as const).map(([id,name])=>
        <button type="button" key={id} onClick={()=>setView(id)}>{name}</button>)}
    </nav>
  </details>;
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
  const [expanded,setExpanded] = useState(false);
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
            <Field label="Sell rate ($)"><input type="number" inputMode="decimal" min="0" step=".01" value={line.rate??''}
              placeholder="Not set" onChange={e=>update(quote.id,line.id,{rate:e.target.value===''?undefined:Number(e.target.value)})}/></Field>
          </>:<Field label="Amount ($)"><input type="number" inputMode="decimal" step=".01" value={line.amount??''}
            placeholder="Not set" onChange={e=>update(quote.id,line.id,{amount:e.target.value===''?undefined:Number(e.target.value)})}/></Field>}
        </div>}
        {line.takeoffSinkId?<p className="qmb-help">Sink charge is always included in the quote total.</p>
          :<label className="qmb-check"><input type="checkbox" checked={line.includeInTotal} onChange={e=>update(quote.id,line.id,{includeInTotal:e.target.checked})}/> Include in quote total</label>}
        <label className="qmb-check"><input type="checkbox" checked={line.customerVisible} onChange={e=>update(quote.id,line.id,{customerVisible:e.target.checked})}/> Show this line to customer (itemized view)</label>
        {line.takeoffSinkId
          ?<p className="qmb-help">Remove the sink itself from Materials if it is no longer needed.</p>
          :<button type="button" className="qmb-danger" onClick={()=>{if(window.confirm('Remove this quote line? You can undo the change.'))remove(quote.id,line.id);}}>Remove line</button>}
      </fieldset>
    </div>}
  </article>;
}

function AreaWorkspace({quote,section,tab,setTab,goBack}:{
  quote:Quote;section:QuoteSection;tab:AreaTab;setTab:(v:AreaTab)=>void;goBack:()=>void;
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
  const areaScrollRef=useRef<HTMLDivElement>(null);
  const pieces=section.scope?.takeoffPieces??[];
  const lines=quote.lines.filter(l=>l.sectionId===section.id);
  const linked=lines.find(l=>l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf');
  const amount=quoteLinesTotal(lines);
  const measured=totalBillableTakeoffSf(pieces);
  const savePieces=(next:QuoteTakeoffPiece[])=>updatePieces(quote.id,section.id,next);
  const patchPiece=(id:string,patch:Partial<QuoteTakeoffPiece>)=>savePieces(pieces.map(p=>p.id===id?{...p,...patch}:p));
  return <div className="qmb-editor qmb-area-editor">
    <div ref={areaScrollRef} className="qmb-area-scroll">
    <header className="qmb-pagehead">
      <button type="button" className="qmb-back" onClick={goBack}>‹ Quote</button>
      <span className="qmb-chip">{editable?'Auto-save':'Read only'}</span>
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
      {([['measure','Measure'],['materials','Materials'],['pricing','Pricing']] as const).map(([id,label])=>
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
      {tab==='materials'&&<QuoteBetaMaterials quote={quote} section={section} editable={editable}/>}
      {tab==='pricing'&&<>
        <div className="qmb-section-head"><div><h3>Pricing & presentation</h3><p>Finish pricing here—or leave it undecided.</p></div></div>
        <section className="qmb-card">
          <div className="qmb-split"><span>Linked area SF</span><strong>{sf.format(measured)} SF</strong></div>
          {linked?<TakeoffRatePicker quote={quote} rate={linked.rate} disabled={!editable}
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
            {([['item','Custom charge'],['material','Catalog material'],['sink','Catalog sink'],['rate','Rate Book item'],['allowance','Allowance'],['discount','Discount'],['note','Customer note']] as const)
              .map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field>
          <button type="button" className="qmb-outline qmb-block" disabled={!editable}
            onClick={()=>addLine(quote.id,kind,section.id)}>+ Add line to Area</button>
        </section>
      </>}
    </div>
    </div>
    <footer className="qmb-footer"><div><small>Area total</small><strong>{money.format(amount)}</strong></div>
      <button type="button" className="qmb-primary" onClick={goBack}>Done · Quote ›</button></footer>
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
  const deleteSection=useQuoteStore(s=>s.deleteSection);
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
  const [page,setPage]=useState<Page>('library');
  const [quoteTab,setQuoteTab]=useState<QuoteTab>('build');
  const [areaTab,setAreaTab]=useState<AreaTab>('measure');
  const [areaId,setAreaId]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [showArchived,setShowArchived]=useState(false);
  const [newLineKind,setNewLineKind]=useState<QuoteLineKind>('item');
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{hydrate();hydrateCrm();},[hydrate,hydrateCrm]);
  const myQuotes=useMemo(()=>authMode==='cloud'?quotes.filter(q=>q.ownerUserId===userId):quotes,
    [authMode,quotes,userId]);
  const quote=myQuotes.find(q=>q.id===activeQuoteId)??null;
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
  const openQuote=(id:string)=>{select(id);setQuoteTab('build');setPage('quote');setError('');};
  const createQuote=()=>{const id=create();useQuoteStore.getState().updateQuote(id,{lines:[]});openQuote(id);};
  const openArea=(id:string)=>{setAreaId(id);setAreaTab('measure');setPage('area');};
  const goBack=()=>{setPage('quote');setAreaId(null);};
  const newArea=()=>{
    if(!quote||!editable)return;
    const id=addSection(quote.id);
    if(id){
      useQuoteStore.getState().updateSection(quote.id,id,{customerDisplayMode:'summary'});
      openArea(id);
    }
  };
  useEffect(()=>{
    if(page==='area'&&!area)setPage('quote');
    if(page!=='library'&&!quote)setPage('library');
  },[page,area,quote]);
  const reminders=quote?[
    ...quote.sections.flatMap(section=>[
      ...(section.scope?.takeoffPieces??[]).filter(p=>p.count===0||!p.lengthIn||!p.widthIn)
        .map(p=>`Unfinished piece in ${section.title}: ${p.name||'Unnamed'}`),
      ...(section.scope?.takeoffSinks??[]).filter(s=>s.includeInPricing&&s.unitPrice===undefined)
        .map(s=>`Sink needs selling price: ${s.name||'Unnamed sink'}`),
    ]),
    ...(!quote.companyName&&!quote.contactName?['Customer not selected']:[]),
    ...(!quote.contactEmail?['Contact email not entered']:[]),
    ...(!quote.lines.some(l=>l.includeInTotal&&quoteLineAmount(l)!==0)?['No priced work yet']:[]),
    ...quote.lines.filter(l=>l.includeInTotal&&l.pricingMode==='quantity-rate'&&l.rate===undefined&&
      (l.quantity??0)>0).map(l=>'Sell rate needed: '+l.description),
  ]:[];
  if(!hydrated)return <main className="qmb"><p className="qmb-loading">Opening Quotes Beta…</p></main>;
  if(canBrowseTeam&&libraryMode==='team')return <main className="quotes-view qmb-team">
    <div className="qmb-team-back"><button type="button" onClick={()=>setLibraryMode('mine')}>‹ My Quotes Beta</button></div>
    <TeamQuotesWorkspace quotes={quotes} onShowMine={()=>setLibraryMode('mine')}/>
  </main>;
  return <main className="quotes-view qmb" aria-label="Quotes mobile beta">
    {page==='library'?<>
      <header className="qmb-top"><div className="qmb-brand"><b>S</b><strong>Quotes <span>Beta</span></strong></div>
        <div className="qmb-headeractions"><AppMenu/><button type="button" className="qmb-quiet" onClick={()=>exitBeta(false)}>Classic ↗</button></div></header>
      <div className="qmb-pad qmb-pagecontent">
        <div className="qmb-kicker">YOUR SALES WORKSPACE</div><h1>Quotes</h1>
        <p className="qmb-subtitle">Pick up where you left off, or start with a blank idea.</p>
        <label className="qmb-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a quote or customer" aria-label="Search my quotes"/></label>
        <div className="qmb-section-head"><h3>My quotes</h3><button type="button" className="qmb-quiet" onClick={()=>setShowArchived(v=>!v)}>{showArchived?'Hide archived':'Show archived'}</button></div>
        {list.map(q=><button type="button" key={q.id} className="qmb-card qmb-listcard" onClick={()=>openQuote(q.id)}>
          <div className="qmb-split"><small>{displayQuoteNumber(q)}</small><span className="qmb-chip">{q.status}</span></div>
          <strong>{q.title||'Untitled quote'}</strong>
          <div className="qmb-split"><small>{q.companyName||'Customer not selected'} · {q.sections.length} Areas</small>
            <b>{money.format(quoteTotal(q))}</b></div>
        </button>)}
        {!list.length&&<div className="qmb-empty">No matching quotes. Start one without filling in any required fields.</div>}
        {canBrowseTeam&&<button type="button" className="qmb-outline qmb-block" onClick={()=>setLibraryMode('team')}>Team Quotes ›</button>}
      </div>
      <footer className="qmb-footer qmb-footer-single"><button type="button" className="qmb-primary" onClick={createQuote}>+ New quote</button></footer>
    </>:page==='quote'&&quote?<div className="qmb-editor">
      <header className="qmb-pagehead">
        <button type="button" className="qmb-back" onClick={()=>setPage('library')}>‹ My quotes</button>
        <span className="qmb-chip">{quote.status}</span>
        <div className="qmb-headeractions"><AppMenu/><button type="button" className="qmb-quiet" onClick={()=>exitBeta(false)}>Classic</button></div>
      </header>
      <div className="qmb-pad qmb-titlepad">
        <div className="qmb-kicker">{displayQuoteNumber(quote)} · MOBILE BETA</div>
        <input className="qmb-titleinput" aria-label="Quote title" maxLength={300}
          disabled={!editable} placeholder="Untitled quote"
          value={quote.title==='Untitled quote'?'':quote.title}
          onChange={e=>update(quote.id,{title:e.target.value})}/>
        <p className="qmb-subtitle">{quote.companyName||'No customer yet'} · All sections can be completed in any order</p>
      </div>
      <nav className="qmb-tabs" aria-label="Quote views">
        {([['build','Build'],['details','Details'],['preview','Preview']] as const).map(([id,label])=>
          <button key={id} type="button" className={quoteTab===id?'active':''}
            aria-current={quoteTab===id?'page':undefined} onClick={()=>setQuoteTab(id)}>{label}</button>)}
      </nav>
      <div className="qmb-pad qmb-pagecontent">
        {quote.documentType==='pricing-schedule'&&<div className="qmb-card"><strong>Pricing Schedule</strong><p>Use Classic Quotes for the full schedule workbook. This Beta editor does not alter its special pricing data.</p>
          <button type="button" className="qmb-outline" onClick={()=>exitBeta(false)}>Open classic editor</button></div>}
        {quoteTab==='build'&&quote.documentType!=='pricing-schedule'&&<>
          <div className="qmb-totalcard"><small>Current quote total</small><strong>{money.format(quoteTotal(quote))}</strong>
            <span>{quote.sections.length} Areas · {quote.lines.length} lines · saved with SalesShop</span></div>
          <div className="qmb-section-head"><h3>Areas</h3><button className="qmb-quiet" type="button" disabled={!editable} onClick={newArea}>+ Add Area</button></div>
          {quote.sections.map(s=>{
            const lines=quote.lines.filter(l=>l.sectionId===s.id);
            return <button type="button" key={s.id} className="qmb-card qmb-area-card" onClick={()=>openArea(s.id)}>
              <span className="qmb-area-icon">▤</span><span className="qmb-area-text"><strong>{s.title.trim().toLowerCase()==='general takeoffs'?'General':s.title||'Untitled Area'}</strong>
                <small>{sf.format(s.scope?.countertopSf??0)} SF · {s.scope?.takeoffMaterial||'Material not selected'}</small>
                <small>{s.customerDisplayMode==='summary'?'One lump sum':'Itemized'}</small></span>
              <span className="qmb-area-price"><b>{money.format(quoteLinesTotal(lines))}</b><span>›</span></span>
            </button>;
          })}
          {!quote.sections.length&&<div className="qmb-empty">No Areas yet. Add a Kitchen, Bathroom, Unit Type—or jump to Details first.</div>}
          <div className="qmb-section-head"><h3>General charges</h3><small>Outside named Areas</small></div>
          {quote.lines.filter(l=>!l.sectionId||!quote.sections.some(s=>s.id===l.sectionId))
            .map(l=><BetaLine key={l.id} quote={quote} line={l} editable={editable}/>)}
          {editable&&<section className="qmb-card">
            <div className="qmb-two"><select aria-label="General line type" value={newLineKind}
              onChange={e=>setNewLineKind(e.target.value as QuoteLineKind)}>
              {([['item','Custom charge'],['material','Material'],['sink','Sink'],['rate','Rate'],['discount','Discount'],['note','Note']] as const)
                .map(([id,label])=><option value={id} key={id}>{label}</option>)}
            </select><button type="button" className="qmb-outline" onClick={()=>addLine(quote.id,newLineKind)}>+ Add line</button></div>
          </section>}
          <QuoteProjectMaterials quote={quote}/>
        </>}
        {quoteTab==='details'&&<>
          <div className="qmb-section-head"><h3>Customer & project</h3><span className="qmb-chip">Optional while drafting</span></div>
          <section className="qmb-card qmb-native-fields"><QuoteCrmFields quote={quote}/></section>
          <section className="qmb-card">
            <Field label="Project / quote title"><input disabled={!editable} maxLength={300} value={quote.title}
              onChange={e=>update(quote.id,{title:e.target.value})}/></Field>
            <Field label="Quote date"><input disabled={!editable} type="date" value={quote.quoteDate}
              onChange={e=>update(quote.id,{quoteDate:e.target.value})}/></Field>
            <Field label="Job address"><input disabled={!editable} value={quote.address??''}
              onChange={e=>update(quote.id,{address:e.target.value})} placeholder="Can be added later"/></Field>
          </section>
          <section className="qmb-card qmb-native-fields"><QuoteNotesFields customerNotes={quote.customerNotes}
            internalNotes={quote.internalNotes} onCustomerChange={v=>update(quote.id,{customerNotes:v})}
            onInternalChange={v=>update(quote.id,{internalNotes:v})}/></section>
        </>}
        {quoteTab==='preview'&&<>
          <div className="qmb-section-head"><h3>Customer preview</h3><span className="qmb-chip">Live totals</span></div>
          <div className="qmb-preview"><CustomerPreview quote={quote}/></div>
          <p className="qmb-help">This uses the same customer document renderer as Classic Quotes. Private internal notes and dimensions remain internal.</p>
          <QuoteShareControl/>
        </>}
      </div>
      <footer className="qmb-footer">
        <div><small>Total</small><strong>{money.format(quoteTotal(quote))}</strong></div>
        <button type="button" className="qmb-primary" onClick={()=>setPage('review')}>Review ›</button>
      </footer>
    </div>:page==='area'&&quote&&area?<AreaWorkspace key={area.id} quote={quote} section={area} tab={areaTab} setTab={setAreaTab} goBack={goBack}/>:page==='review'&&quote?<div className="qmb-editor">
      <header className="qmb-pagehead"><button type="button" className="qmb-back" onClick={()=>setPage('quote')}>‹ Quote</button><span className="qmb-chip">Review</span></header>
      <div className="qmb-pad qmb-pagecontent">
        <div className="qmb-kicker">FINAL CHECK · WHEN YOU'RE READY</div><h1>Ready to share?</h1>
        <p className="qmb-subtitle">Unfinished fields never prevent you from saving or returning to a draft.</p>
        <div className="qmb-totalcard"><small>Customer quote total</small><strong>{money.format(quoteTotal(quote))}</strong><span>{quote.sections.length} Areas</span></div>
        <div className="qmb-section-head"><h3>Things to review</h3><span className="qmb-chip">{reminders.length} reminders</span></div>
        {reminders.length?reminders.map((msg,i)=><div className="qmb-card" key={String(i)+msg}><strong>◌ {msg}</strong><p className="qmb-help">You can return to the appropriate tab and fill this in later.</p></div>):
          <div className="qmb-card"><strong>✓ No obvious missing details</strong><p className="qmb-help">Review your customer preview before issuing.</p></div>}
        {error&&<p role="alert" className="qmb-error">{error}</p>}
        <div className="qmb-card">
          <strong>Customer delivery</strong><p className="qmb-help">Share uses the same secure customer link as Classic Quotes. Marking sent records an issued revision.</p>
          <QuoteShareControl/>
          {(quote.status==='Draft'||quote.status==='Ready')&&<button type="button" className="qmb-outline qmb-block"
            disabled={sending||!canIssue} onClick={async()=>{setSending(true);setError('');try{await recordSent(quote.id);}catch(e){setError(e instanceof Error?e.message:'Could not issue quote');}finally{setSending(false);}}}>
            {sending?'Issuing…':'Mark quote sent / issue revision'}</button>}
        </div>
        <button type="button" className="qmb-outline qmb-block" onClick={()=>{setQuoteTab('preview');setPage('quote');}}>See full customer preview ›</button>
        <button type="button" className="qmb-quiet qmb-block" onClick={()=>{exitBeta(false);setView('quotes');}}>Continue in Classic Quotes</button>
      </div>
      <footer className="qmb-footer qmb-footer-single"><button type="button" className="qmb-primary" onClick={()=>setPage('quote')}>Back to draft</button></footer>
    </div>:null}
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
