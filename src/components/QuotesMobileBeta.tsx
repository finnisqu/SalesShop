import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import {WorkspaceHeader,WorkspaceMoreMenu} from './WorkspaceHeader';
import { PHONE_LAYOUT_QUERY } from '../lib/mobileViewport';
import { useQuoteStore } from '../store/quoteStore';
import { useCrmStore } from '../store/crmStore';
import { useAuthStore } from '../store/authStore';
import { useQuoteLibraryStore } from '../store/quoteLibraryStore';
import { useQuotesMobileBetaStore } from '../store/quotesMobileBetaStore';
import {openDetailedQuoteEditor} from '../services/quoteEditorNavigation';
import { useNavigationStore } from '../store/navigationStore';
import { useRolePerspectiveStore } from '../store/rolePerspectiveStore';
import { canIssueTeamQuote } from '../services/teamDepartments';
import {quoteIsCommerciallyEditable,canPermanentlyDeleteQuote} from '../services/quoteIntegrity';
import {
  parseInches, newTakeoffPiece, takeoffCustomerSpecs,
  totalBillableTakeoffSf, totalSplashSf, totalTakeoffSf,
} from '../services/quoteTakeoffsLite';
import {
  displayQuoteNumber, quoteLineAmount, quoteLinesTotal, quoteTotal,
  type Quote, type QuoteSection, type QuoteLine, type QuoteLineKind, type QuoteTakeoffPiece,
} from '../types/quote';
import { QuoteBetaDetails } from './QuoteBetaDetails';
import '../quote-details-single-column.css';
import {quoteBetaPrimaryAction,quoteBetaStatusLabel} from '../services/quoteBetaLifecycleLanguage';
import { QuoteCustomerQuickEdit } from './QuoteCustomerQuickEdit';
import {SalesDocumentSaveStatus} from './SalesDocumentToolbar';
import {SalesDocumentActionsMenu} from './SalesDocumentActionsMenu';
import '../sales-document-ux-qc.css';
import { QuoteMaterialLineFields } from './QuoteMaterialLineFields';
import { QuoteSinkLineFields } from './QuoteSinkLineFields';
import { QuoteRateLineFields } from './QuoteRateLineFields';
import { QuoteBetaEditablePreview } from './QuoteBetaEditablePreview';
import {QuoteContractApproval} from './QuoteContractApproval';
import {approvedCustomerDraft,quoteDeliveryApprovalKey} from '../services/quoteDeliveryApproval';
import { TeamQuotesWorkspace } from './TeamQuotesWorkspace';
import { ShopOutcomesWorkspace } from './ShopOutcomesWorkspace';
import { signedShopOutcomesEnabled } from '../services/shopOutcomesPilot';
import {QuotesFollowUpDashboard} from './QuotesFollowUpDashboard';
import { TakeoffRatePicker } from './TakeoffRatePicker';
import { QuoteSfRateChoices } from './QuoteSfRateChoices';
import { QuoteTakeoffsLite } from './QuoteTakeoffsLite';
import { QuoteBetaMeasureGrid } from './QuoteBetaMeasureGrid';
import { QuoteBetaMaterials } from './QuoteBetaMaterials';
import {QuoteBetaCompactSinks} from './QuoteBetaCompactSinks';
import { QuoteBetaDesktopCommerce } from './QuoteBetaDesktopCommerce';
import { QuoteBetaAdditionalScope } from './QuoteBetaAdditionalScope';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { selectedMaterialCost } from '../services/selectedMaterialCost';
import { QuoteBetaSelections } from './QuoteBetaSelections';
import { QuoteBetaReview } from './QuoteBetaReview';
import { QuoteBetaReviewOverlay } from './QuoteBetaReviewOverlay';
import { QuoteBetaDesktopRails, QuoteBetaInspector } from './QuoteBetaDesktopRails';
import { QuoteBetaProgress } from './QuoteBetaProgress';
import { QuoteBetaAreaGuide } from './QuoteBetaAreaGuide';
import {QuoteAreaPresetPicker} from './QuoteAreaPresetPicker';
import {QuoteSaveAreaLayoutDialog} from './QuoteSaveAreaLayoutDialog';
import {QuoteInlineAreaName,QuoteInlineAreaRate,QuoteBulkAreaDialog} from './QuoteInlineAreaEditing';
import {QuoteMatrixBuilder} from './QuoteMatrixBuilder';
import {QuoteReuseAreaDialog} from './QuoteReuseAreaDialog';
import {QuoteAreaQuickPanel,type QuickAreaTab} from './QuoteAreaQuickPanel';
import {captureSavedAreaLayout,readSavedAreaLayouts,writeSavedAreaLayouts,
  savedAreaLayoutScope,upsertSavedAreaLayout,SAVED_AREA_LAYOUT_LIMIT,
  type SavedAreaLayout} from '../services/quoteSavedAreaLayouts';
import type {QuoteAreaPresetId} from '../services/quoteAreaPresets';
import './quotes-beta-control-polish.css';
import {quoteAreaDisclosure} from '../services/quoteAreaDisclosure';
import {InitialOpenDetails} from './InitialOpenDetails';
import {useAppContextMenu,type AppContextAction} from './AppContextMenu';
import {ConnectionsTable,type ConnectionTableRow,type ConnectionColumn} from './ConnectionsTable';
import {RecordPreviewDrawer} from './RecordPreviewDrawer';
import {requestQuoteMetadataPage} from '../services/quoteMetadataNavigation';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import '../sales-documents-table.css';
import './quote-beta-progressive.css';
import {useQuoteBetaAreaManager,QuoteBetaAreaModeButton,QuoteBetaAreaGrip,
  QuoteBetaAreaDeleteButton,QuoteBetaAreaDeleteDialog} from './QuoteBetaAreasMenu';
import {useQuoteBetaGeneralManager,QuoteBetaGeneralModeButton,QuoteBetaGeneralGrip,
  QuoteBetaGeneralDelete,QuoteBetaGeneralDeleteDialog} from './QuoteBetaGeneralManager';
import {useQuoteBetaCardReflow} from './quoteBetaCardMotion';
import { auditQuoteDraft, type QuoteAuditDestination } from '../services/quoteDraftAudit';
import {pricingScheduleValidationError} from '../services/pricingSchedule';
import {salesDocumentTemplate,salesTemplateLabel,SALES_DOCUMENT_TEMPLATES,createTemplateSchedule,
  type SalesTemplateStart} from '../services/salesDocumentTemplates';
import {filterSalesDocuments,salesDocumentCounts,
  type SalesDocumentStatusFilter,type SalesDocumentSort} from '../services/salesDocumentLibrary';
import {NewSalesDocumentPicker} from './NewSalesDocumentPicker';
import {useRateBookStore} from '../store/rateBookStore';
import {useMaterialLevelGuideStore} from '../store/materialLevelGuideStore';
import {snapshotStockBuilderLevels} from '../services/stockBuilderRateTemplate';
import type {SalesDocumentTemplate,SalesDocumentTemplateChoice} from '../types/quote';
import { isGeneralTakeoffSection } from '../services/quoteCustomerPresentation';
import { nextQuoteAreaShortcut, nextQuoteAreaAfter } from '../services/quoteWorkflowShortcut';
import { GlobalPostItLauncher } from './GlobalPostIt';
import { BuildBadge } from './BuildBadge';
import {formatPersonalDate,readPersonalDateTimePreferences} from '../services/personalDateTimePreferences';
import {nextReviewFocus} from '../services/quoteReviewReturn';
import './quote-beta-review-return.css';
import {defaultQuoteBuilderPreferences,readQuoteBuilderPreferences,writeQuoteBuilderPreferences,
  quoteBuilderPreferenceScope,QUOTE_GENERAL_QUICK_ADDS,QUOTE_GENERAL_QUICK_ADD_LABELS,
  type QuoteBuilderPreferences,type QuoteGeneralQuickAdd} from '../services/quoteBuilderPreferences';
import './quote-builder-tables.css';
import './quote-builder-tables-scoped.css';
import './quote-inline-bulk.css';
import '../quote-quick-mobile.css';

// Keep the advanced spreadsheet bundle out of the everyday Quick Quote path.
const PricingScheduleWorkspace=lazy(()=>import('./PricingDocumentEditor').then(module=>({default:module.PricingDocumentEditor})));

const money = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'});
const sf = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
const documentColumns:ConnectionColumn[]=[
 {key:'name',label:'Document'},{key:'number',label:'Number'},{key:'company',label:'Customer'},
 {key:'type',label:'Template'},{key:'status',label:'Status'},
 {key:'amount',label:'Amount'},{key:'updated',label:'Last edited'}];
type Page = 'library' | 'quote' | 'area' | 'review';
type QuoteTab = 'build' | 'details' | 'pricing' | 'preview';
type AreaTab = 'measure' | 'materials' | 'pricing' | 'calculator';

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
      <span className="qmb-builder-general-type">{line.kind}</span>
      <span className="qmb-builder-general-method">{textOnly?'Note':line.pricingMode==='quantity-rate'?'Qty × rate':'Amount'}</span>
      <strong className="qmb-builder-general-amount">{textOnly?'—':line.pricingMode==='quantity-rate'&&line.rate===undefined?'Rate missing':money.format(quoteLineAmount(line))}</strong>
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
              <Field label={line.kind==='sink'?"Sell price ($/each)":line.kind==='material'?"Sell rate ($/SF)":"Sell rate ($/unit)"}><input type="number" inputMode="decimal" min="0" step=".01"
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

function AreaWorkspace({quote,section,tab,setTab,goBack,onPricingOverview,onNextArea,onDuplicate,onSaveLayout,onReview,returnLabel}:{
  quote:Quote;section:QuoteSection;tab:AreaTab;setTab:(v:AreaTab)=>void;
  goBack:()=>void;onPricingOverview:()=>void;onNextArea:()=>void;onDuplicate:()=>void;onSaveLayout:()=>void;onReview:()=>void;
  returnLabel:string;
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
  useEffect(()=>{
    // Keep a useful tab visible when moving between desktop and phone widths.
    if(!desktopLab&&tab==='calculator')setTab('pricing');
    if(desktopLab&&tab==='pricing')setTab('materials');
  },[desktopLab,tab,setTab]);
  const areaScrollRef=useRef<HTMLDivElement>(null);
  const catalogMaterials=useCompanySettingsStore(state=>state.settings.stockMaterials);
  const selectedCost=selectedMaterialCost(
    section.scope?.takeoffMaterial??'',section.scope?.takeoffMaterialReference,catalogMaterials);
  const costPerSf=selectedCost.quotedCostPerSf??selectedCost.currentCatalogCostPerSf;
  const pieces=section.scope?.takeoffPieces??[];
  const lines=quote.lines.filter(l=>l.sectionId===section.id);
  const linked=lines.find(l=>l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf');
  const nextArea=nextQuoteAreaAfter(quote,section.id);
  const optionalSections=quoteAreaDisclosure(quote,section);
  const amount=quoteLinesTotal(lines);
  const measured=totalBillableTakeoffSf(pieces);
  // Keep unresolved priced work visible *inside* the Area, not only at the
  // final quote Review. The same shared audit still guards formal issuing.
  const areaPriceBlockers=useMemo(()=>auditQuoteDraft(quote).blockers.filter(f=>
    f.destination.view==='area'&&f.destination.areaId===section.id),[quote,section.id]);
  const goToPriceFix=()=>{
    const first=areaPriceBlockers[0];
    if(!first||first.destination.view!=='area')return;
    const target=first.destination.tab==='measure'?'measure':
      first.destination.tab==='materials'||desktopLab?'materials':'pricing';
    setTab(target);
    const scroll=areaScrollRef.current;
    const tabs=scroll?.querySelector<HTMLElement>('.qmb-tabs');
    if(scroll&&tabs)scroll.scrollTo({top:tabs.offsetTop,behavior:'auto'});
  };
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
  const chooseTab=(target:AreaTab)=>{
    setTab(target);
    const scroll=areaScrollRef.current;
    const tabs=scroll?.querySelector<HTMLElement>('.qmb-tabs');
    if(scroll&&tabs)scroll.scrollTo({top:tabs.offsetTop,behavior:'auto'});
  };
  const addFirstPiece=()=>{
    if(!editable||pieces.length>=500)return;
    savePieces([...pieces,{...newTakeoffPiece(pieces.length+1),
      splashHeightIn:section.scope?.takeoffDefaultSplashHeightIn??4,
      edgeProfile:section.scope?.takeoffDefaultEdgeProfile??'Flat'}]);
    chooseTab('measure');
  };
  return <div className="qmb-editor qmb-area-editor">
    <div ref={areaScrollRef} className="qmb-area-scroll">
    <header className="qmb-pagehead">
      <BuildBadge compact />
      <button type="button" className="qmb-back" onClick={goBack}>‹ Quote</button>
      <div className="qmb-area-header-actions">
        <GlobalPostItLauncher />
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
      {editable&&areaPriceBlockers.length>0&&<button type="button"
        className="qmb-area-pricing-alert" aria-label="Resolve Area pricing issues"
        onClick={goToPriceFix}>
        <span className="qmb-area-pricing-alert-icon" aria-hidden="true">!</span>
        <span><strong>{areaPriceBlockers.length} pricing {areaPriceBlockers.length===1?'item needs':'items need'} attention</strong>
          <small>{areaPriceBlockers[0].title}</small></span>
        <span aria-hidden="true">›</span>
      </button>}
    </div>
    {!general&&<QuoteBetaAreaGuide quote={quote} section={section} editable={editable}
      onAddPiece={addFirstPiece} onMeasure={()=>chooseTab('measure')}
      onMaterial={()=>chooseTab('materials')}
      onPricing={()=>chooseTab(desktopLab?'materials':'pricing')}
      onOverview={onPricingOverview} onSaveLayout={onSaveLayout}/>}
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
      {tab==='measure'&&<div className={desktopLab?'qmb-measure-rework':'qmb-mobile-measure-existing'}>
        {desktopLab&&<header className="qmb-workspace-intro"><div className="qmb-kicker">SCOPE WORKSPACE</div>
          <h2>Measure &amp; define work</h2>
          <p>Set dimensions, sink models and additional work first. Set customer selling prices in Materials.</p></header>}
        <section className={desktopLab?'qmb-commerce-segment qmb-scope-pieces-container':''}>
        <QuoteBetaMeasureGrid pieces={pieces} editable={editable}
        onSave={savePieces} onAdvanced={()=>setAdvanced(true)}
        defaults={{splashHeightIn:section.scope?.takeoffDefaultSplashHeightIn??4,
          edgeProfile:section.scope?.takeoffDefaultEdgeProfile??'Flat'}}
        onSetDefaults={(next,applyAll)=>{
          updateSection(quote.id,section.id,{scope:{...section.scope,
            takeoffDefaultSplashHeightIn:next.splashHeightIn,takeoffDefaultEdgeProfile:next.edgeProfile}});
          if(applyAll)savePieces(pieces.map(piece=>({...piece,splashHeightIn:next.splashHeightIn,
            edgeProfile:next.edgeProfile})));
        }}/>
        </section>
        {desktopLab&&<>
          <InitialOpenDetails key={section.id+'-scope-sinks'} className="qmb-optional-commerce" aria-label="Scope sinks"
            initialOpen={optionalSections.sinksOpen}>
            <summary><strong>Sinks</strong>
              <small>{optionalSections.sinks ? optionalSections.sinks+' selected' : 'Optional · Select models and quantities'}</small>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="qmb-optional-commerce-body">
              <QuoteBetaCompactSinks quote={quote} section={section} editable={editable} stage="measure"/>
            </div>
          </InitialOpenDetails>
          <InitialOpenDetails key={section.id+'-scope-addons'} className="qmb-optional-commerce" aria-label="Scope add-ons"
            initialOpen={optionalSections.extrasOpen}>
            <summary><strong>Add-ons</strong>
              <small>{optionalSections.extras ? optionalSections.extras+' items' : 'Optional · Add rates or custom work'}</small>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="qmb-optional-commerce-body">
              <QuoteBetaAdditionalScope quote={quote} section={section} editable={editable}/>
            </div>
          </InitialOpenDetails>
        </>}
      </div>}
      {tab==='materials'&&(desktopLab
        ?<QuoteBetaDesktopCommerce quote={quote} section={section} editable={editable} tab="materials"/>
        :<QuoteBetaMaterials quote={quote} section={section} editable={editable}/>)}
      {tab==='calculator'&&<QuoteBetaDesktopCommerce quote={quote} section={section}
        editable={editable} tab="calculator"/>}
      {tab==='pricing'&&<div className="qmb-mobile-pricing-legacy">
        <div className="qmb-section-head"><div><h3>Pricing & presentation</h3><p>Finish pricing here—or leave it undecided.</p></div></div>
        <section className="qmb-card">
          <div className="qmb-split"><span>Linked area SF</span><strong>{sf.format(measured)} SF</strong></div>
          <details className="qmb-buying-details qmb-mobile-buying" aria-label="Selected material cost reference">
            <summary>{selectedCost.catalogCostChanged?'Buying reference updated · internal':'Buying reference · internal'}
              <span aria-hidden="true">⌄</span></summary>
          <div className="qmb-area-material-cost">
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
          </details>
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
        {editable&&nextArea&&<button type="button" className="qmb-outline qmb-area-next"
          aria-label={tab==='pricing'||tab==='calculator'
            ?nextArea.kind==='open'?'Go to next Area: '+quote.sections.find(s=>s.id===nextArea.areaId)?.title:'Add another Area'
            :'Continue to next Area step'}
          title={tab==='pricing'||tab==='calculator'?nextArea.label:undefined}
          onClick={advanceArea}>
          {tab==='measure'?'Materials ›':tab==='materials'&&!desktopLab?'Pricing ›':
            tab==='materials'&&desktopLab?'Calculator ›':nextArea.label}
        </button>}
        <button type="button" className="qmb-outline qmb-area-review"
          aria-label="Review quote from Area" onClick={onReview}>Review ›</button>
        <button type="button" className="qmb-primary" onClick={goBack}>{returnLabel} ›</button>
      </div>
    </footer>
    {advanced&&<QuoteTakeoffsLite quote={quote} section={section} onClose={()=>setAdvanced(false)}/>}
  </div>;
}

export function QuotesMobileBeta() {
  const isPhoneLayout=useIsPhoneLayout();
  const [mobileActionsHost,setMobileActionsHost]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    setMobileActionsHost(isPhoneLayout?document.getElementById('mobile-quote-actions-slot'):null);
  },[isPhoneLayout]);
  const hydrate=useQuoteStore(s=>s.hydrate);
  const hydrated=useQuoteStore(s=>s.hydrated);
  const quotes=useQuoteStore(s=>s.quotes);
  const activeQuoteId=useQuoteStore(s=>s.activeQuoteId);
  const create=useQuoteStore(s=>s.createQuote);
  const duplicateDocument=useQuoteStore(s=>s.duplicateDocument);
  const createRevision=useQuoteStore(s=>s.createRevision);
  const select=useQuoteStore(s=>s.selectQuote);
  const update=useQuoteStore(s=>s.updateQuote);
  const addSection=useQuoteStore(s=>s.addSection);
  const addAreaFromPreset=useQuoteStore(s=>s.addAreaFromPreset);
  const addAreaFromSavedLayout=useQuoteStore(s=>s.addAreaFromSavedLayout);
  const duplicateArea=useQuoteStore(s=>s.duplicateArea);
  const ensureGeneralTakeoff=useQuoteStore(s=>s.ensureGeneralTakeoff);
  const addLine=useQuoteStore(s=>s.addLine);
  const undo=useQuoteStore(s=>s.undoQuote);
  const redo=useQuoteStore(s=>s.redoQuote);
  const recordSent=useQuoteStore(s=>s.recordSent);
  const undoDepth=useQuoteStore(s=>activeQuoteId?s.undoStacks[activeQuoteId]?.length??0:0);
  const redoDepth=useQuoteStore(s=>activeQuoteId?s.redoStacks[activeQuoteId]?.length??0:0);
  const hydrateCrm=useCrmStore(s=>s.hydrate);
  const authMode=useAuthStore(s=>s.mode);
  const teamRole=useAuthStore(s=>s.teamRole);
  const department=useAuthStore(s=>s.teamDepartment);
  const userId=useAuthStore(s=>s.user?.id);
  const organizationId=useAuthStore(s=>s.organizationId);
  const builderScope=quoteBuilderPreferenceScope(authMode,organizationId,userId??null);
  const quickAddMenuRef=useRef<HTMLDetailsElement>(null);
  const [pricingFooterTarget,setPricingFooterTarget]=useState<HTMLDivElement|null>(null);
  const [builderPrefsState,setBuilderPrefsState]=useState<{scope:string|null;prefs:QuoteBuilderPreferences}>(
    ()=>({scope:builderScope,prefs:readQuoteBuilderPreferences(builderScope)}));
  const builderPrefs=builderPrefsState.scope===builderScope
    ?builderPrefsState.prefs:defaultQuoteBuilderPreferences();
  useEffect(()=>{
    setBuilderPrefsState({scope:builderScope,prefs:readQuoteBuilderPreferences(builderScope)});
  },[builderScope]);
  const setBuilderPrefs=(next:QuoteBuilderPreferences)=>{
    if(!builderScope)return;
    if(writeQuoteBuilderPreferences(builderScope,next))
      setBuilderPrefsState({scope:builderScope,prefs:next});
  };
  useEffect(()=>{
    const close=(event:PointerEvent)=>{
      const menu=quickAddMenuRef.current;
      if(menu?.open&&!menu.contains(event.target as Node))menu.open=false;
    };
    const escape=(event:KeyboardEvent)=>{
      const menu=quickAddMenuRef.current;
      if(event.key==='Escape'&&menu?.open){
        event.preventDefault();menu.open=false;menu.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',close);
      document.removeEventListener('keydown',escape);};
  },[]);
  const toggleGeneralQuickAdd=(kind:QuoteGeneralQuickAdd)=>{
    const favorites=builderPrefs.favoriteQuickAdds.includes(kind)
      ?builderPrefs.favoriteQuickAdds.filter(k=>k!==kind)
      :QUOTE_GENERAL_QUICK_ADDS.filter(k=>k===kind||builderPrefs.favoriteQuickAdds.includes(k));
    setBuilderPrefs({...builderPrefs,favoriteQuickAdds:favorites});
  };
  const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
  const libraryMode=useQuoteLibraryStore(s=>s.mode);
  const setLibraryMode=useQuoteLibraryStore(s=>s.setMode);
  const setView=useNavigationStore(s=>s.setView);
  const openRoutedQuote=useNavigationStore(s=>s.openQuote);
  const routeQuoteId=useNavigationStore(s=>s.focusedQuoteId);
  const consumedRoute=useRef<string|null>(null);
  const restoredLocation=useRef(useQuotesMobileBetaStore.getState().location);
  // Preserve a deliberately chosen first screen for a newly named Quick Quote.
  // Deep links and ordinary document opens continue to use the saved Build path.
  const newQuoteDetailsRef=useRef<string|null>(null);
  const setLocation=useQuotesMobileBetaStore(s=>s.setLocation);
  const contextActions=useAppContextMenu();
  const beginTaskPromotion=usePersonalTaskStore(state=>state.beginPromotion);
  const [page,setPage]=useState<Page>(()=>restoredLocation.current.page);
  const [quoteTab,setQuoteTab]=useState<QuoteTab>(()=>restoredLocation.current.quoteTab);
  const [areaTab,setAreaTab]=useState<AreaTab>(()=>restoredLocation.current.areaTab);
  const [areaId,setAreaId]=useState<string|null>(()=>restoredLocation.current.areaId);
  const [search,setSearch]=useState('');
  const [documentToolbarHost,setDocumentToolbarHost]=useState<HTMLDivElement|null>(null);
  const [statusFilter,setStatusFilter]=useState<SalesDocumentStatusFilter>('active');
  const [documentSort,setDocumentSort]=useState<SalesDocumentSort>('recent');
  const [showNewDocument,setShowNewDocument]=useState(false);
  const [areaPresetsOpen,setAreaPresetsOpen]=useState(false);
  const [copyAreaOpen,setCopyAreaOpen]=useState(false);
  const [selectedBulkAreaIds,setSelectedBulkAreaIds]=useState<string[]>([]);
  const [bulkAreaOpen,setBulkAreaOpen]=useState(false);
  const [quickArea,setQuickArea]=useState<{id:string;tab:QuickAreaTab}|null>(null);
  const [savingLayoutAreaId,setSavingLayoutAreaId]=useState<string|null>(null);
  const layoutScope=savedAreaLayoutScope(authMode,organizationId,userId??null);
  const [layoutState,setLayoutState]=useState<{scope:string|null;items:SavedAreaLayout[]}>(()=>({
    scope:layoutScope,items:readSavedAreaLayouts(layoutScope),
  }));
  // On an account or organization switch, never render the previous user's list.
  const savedLayouts=layoutState.scope===layoutScope?layoutState.items:[];
  useEffect(()=>{
    setLayoutState({scope:layoutScope,items:readSavedAreaLayouts(layoutScope)});
    setSavingLayoutAreaId(null);setAreaPresetsOpen(false);
  },[layoutScope]);
  const [documentPreviewId,setDocumentPreviewId]=useState<string|null>(null);
  const [customerQuickOpen,setCustomerQuickOpen]=useState(false);
  const [documentFilter,setDocumentFilter]=useState<'all'|SalesDocumentTemplate>('all');
  // Keep the new-document library first; follow-ups are a secondary destination.
  const [followUpsTab,setFollowUpsTab]=useState(false);
  const stockRates=useRateBookStore(s=>s.items);
  const hydrateRateBook=useRateBookStore(s=>s.hydrate);
  const companyStock=useCompanySettingsStore(s=>s.settings.stockMaterials);
  const companyReady=useCompanySettingsStore(s=>s.hydrated);
  const hydrateCompany=useCompanySettingsStore(s=>s.hydrate);
  const levelGuide=useMaterialLevelGuideStore(s=>s.guide);
  const levelGuideReady=useMaterialLevelGuideStore(s=>s.hydrated);
  const hydrateLevelGuide=useMaterialLevelGuideStore(s=>s.hydrate);
  const stockLevelPreview=useMemo(()=>snapshotStockBuilderLevels(companyStock,levelGuide),
    [companyStock,levelGuide]);
  const [libraryAction,setLibraryAction]=useState<{id:string;kind:'archive'|'delete'}|null>(null);
  const [copyRequest,setCopyRequest]=useState<{id:string;title:string}|null>(null);
  const [copyName,setCopyName]=useState('');
  const archiveQuote=useQuoteStore(s=>s.archiveQuote);
  const restoreQuote=useQuoteStore(s=>s.restoreQuote);
  const deleteQuote=useQuoteStore(s=>s.deleteQuote);

  const [selectionsOpen,setSelectionsOpen]=useState(false);
  const [reviewOpen,setReviewOpen]=useState(false);
  const [reviewFocus,setReviewFocus]=useState<string|null>(null);
  const [reviewReturn,setReviewReturn]=useState<{quoteId:string;findingId:string|null}|null>(null);
  const [previewReturnQuoteId,setPreviewReturnQuoteId]=useState<string|null>(null);
  const [previewStartedKey,setPreviewStartedKey]=useState<string|null>(null);
  const [previewedDeliveryKey,setPreviewedDeliveryKey]=useState<string|null>(null);
  const [approvedDeliveryKey,setApprovedDeliveryKey]=useState<string|null>(null);
  const [reviewedDeliveryKey,setReviewedDeliveryKey]=useState<string|null>(null);
  const quoteScrollRef=useRef<HTMLDivElement>(null);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    hydrate();hydrateCrm();hydrateRateBook();
    void hydrateCompany();hydrateLevelGuide();
  },[hydrate,hydrateCrm,hydrateRateBook,hydrateCompany,hydrateLevelGuide]);
  useEffect(()=>{
    if(!hydrated)return;
    const previous=restoredLocation.current.quoteId;
    if(previous&&previous!==activeQuoteId&&page!=='library'){
      setPage('quote');
      if(newQuoteDetailsRef.current!==activeQuoteId)setQuoteTab('build');
      setAreaId(null);
      restoredLocation.current={...restoredLocation.current,quoteId:activeQuoteId??undefined};
      return;
    }
    setLocation({quoteId:activeQuoteId??undefined,page,quoteTab,areaTab,areaId});
  },[hydrated,activeQuoteId,page,quoteTab,areaTab,areaId,setLocation]);
  const myQuotes=useMemo(()=>authMode==='cloud'?quotes.filter(q=>q.ownerUserId===userId):quotes,
    [authMode,quotes,userId]);
  const quote=myQuotes.find(q=>q.id===activeQuoteId)??null;
  const generalTakeoff=quote?.sections.find(isGeneralTakeoffSection);
  const [showDeleteGeneralTakeoff,setShowDeleteGeneralTakeoff]=useState(false);
  const deleteGeneralTakeoff=useQuoteStore(s=>s.deleteSection);
  const areaManager=useQuoteBetaAreaManager(quote);
  const generalManager=useQuoteBetaGeneralManager(quote);
  const mobileAreaRef=useQuoteBetaCardReflow<HTMLDivElement>(
    (areaManager.editing?areaManager.orderedSections:quote?.sections.filter(s=>!isGeneralTakeoffSection(s))??[]).map(s=>s.id));
  const mobileGeneralRef=useQuoteBetaCardReflow<HTMLDivElement>(
    (generalManager.editing?generalManager.lines:(quote?.lines??[]).filter(l=>
      !l.sectionId||!quote?.sections.some(s=>s.id===l.sectionId))).map(l=>l.id));
  // A Home/Board/deep-link opening must reach the Beta editor instead of
  // remaining on a previously restored document-library tab. Consume once;
  // later quote edits must not bounce the user out of the library.
  useEffect(()=>{
    if(!routeQuoteId)consumedRoute.current=null;
  },[routeQuoteId]);
  useEffect(()=>{
    if(!hydrated||!routeQuoteId||consumedRoute.current===routeQuoteId)return;
    if(!quotes.some(q=>q.id===routeQuoteId&&!q.archivedAt))return;
    consumedRoute.current=routeQuoteId;
    if(activeQuoteId!==routeQuoteId)select(routeQuoteId);
    // Browser Back to the *same* quote should restore its last editor section.
    // Opening a different document should still begin at Build.
    const saved=useQuotesMobileBetaStore.getState().location;
    const newQuoteInDetails=newQuoteDetailsRef.current===routeQuoteId;
    if((saved.quoteId!==routeQuoteId||saved.page!=='quote')&&!newQuoteInDetails)setQuoteTab('build');
    if(newQuoteInDetails)newQuoteDetailsRef.current=null;
    setPage('quote');setAreaId(null);
  },[hydrated,routeQuoteId,quotes,activeQuoteId,select]);

  // Opening Beta must not silently change a Classic draft's sink billing.
  // Each Area now offers an explicit priced-versus-specification choice.
  const area=quote?.sections.find(s=>s.id===areaId)??null;
  const editable=Boolean(quote&&quoteIsCommerciallyEditable(quote));
  const canBrowseTeam=authMode==='cloud'&&(teamRole==='owner'||teamRole==='admin')&&!previewRole;
  const canIssue=authMode!=='cloud'||canIssueTeamQuote(teamRole,department);
  const canManageLibrary=authMode!=='cloud'||(!previewRole&&canIssueTeamQuote(teamRole,department));
  // Quick Create opens the template workflow, never a blank quote or just the Quotes index.
  useEffect(()=>{
    const launch=()=>{
      if(!canManageLibrary)return;
      let pending=false;
      try{
       pending=window.sessionStorage.getItem('salesshop-open-document-picker-v1')==='1';
       if(pending)window.sessionStorage.removeItem('salesshop-open-document-picker-v1');
      }catch{/* session storage may be disabled */}
      if(!pending)return;
      setPage('library');setShowNewDocument(true);
    };
    launch();
    window.addEventListener('salesshop:open-document-picker',launch);
    return()=>window.removeEventListener('salesshop:open-document-picker',launch);
  },[canManageLibrary]);

  const counts=salesDocumentCounts(myQuotes);
  const list=filterSalesDocuments(myQuotes,{
    query:search,template:documentFilter,status:statusFilter,sort:documentSort,
  });
  const documentTableRows:ConnectionTableRow[]=list.map(q=>({
    id:q.id,name:q.title||'Untitled document',archived:!!q.archivedAt,
    association:{type:'quote',id:q.id,label:'Quote · '+(q.title||displayQuoteNumber(q))},
    values:{name:q.title||'Untitled document',number:displayQuoteNumber(q),
      company:q.companyName||q.contactName||'',
      type:salesTemplateLabel(salesDocumentTemplate(q)),
      status:quoteBetaStatusLabel(q)+(q.archivedAt?' · Archived':''),
      amount:q.documentType==='pricing-schedule'
        ?String(q.pricingSchedule?.customerItems.length??0)+' price rows'
        :money.format(quoteTotal(q)),
      updated:formatPersonalDate(new Date(q.updatedAt),
        readPersonalDateTimePreferences(userId??null)),
    },
    sortValues:{amount:quoteTotal(q),updated:q.updatedAt},
  }));
  const hasLibraryFilters=search.trim().length>0||documentFilter!=='all'||statusFilter!=='active';
  const resetLibraryFilters=()=>{
    setSearch('');setDocumentFilter('all');setStatusFilter('active');setDocumentSort('recent');
  };
  const openQuote=(id:string,initialTab:QuoteTab='build')=>{
    if(initialTab==='details')newQuoteDetailsRef.current=id;
    openRoutedQuote(id);setQuoteTab(initialTab);setPage('quote');setAreaId(null);
    setSelectedBulkAreaIds([]);setBulkAreaOpen(false);setQuickArea(null);setSavingLayoutAreaId(null);setReviewReturn(null);setAreaPresetsOpen(false);setSelectionsOpen(false);setReviewOpen(false);setCopyAreaOpen(false);setCustomerQuickOpen(false);setPreviewReturnQuoteId(null);
    setPreviewStartedKey(null);setPreviewedDeliveryKey(null);setApprovedDeliveryKey(null);
    setReviewedDeliveryKey(null);setError('');
    if(quoteScrollRef.current)quoteScrollRef.current.scrollTop=0;
  };
  const showLibrary=()=>{
    setSelectedBulkAreaIds([]);setBulkAreaOpen(false);setQuickArea(null);setSavingLayoutAreaId(null);setReviewReturn(null);setAreaPresetsOpen(false);setSelectionsOpen(false);setPage('library');setAreaId(null);
    // Clearing the route ID makes Back reopen the selected editor, rather than
    // leaving a stale /quotes/:id URL on the document library.
    setView('quotes');
  };
  const navigateDocument=(tab:QuoteTab)=>{
    setCustomerQuickOpen(false);setPreviewReturnQuoteId(null);
    // Older stored routes used a full Materials & Pricing page. Send them to Review.
    if(tab==='pricing'&&quote?.documentType!=='pricing-schedule'){
      setQuoteTab('pricing');setReviewFocus(null);setReviewOpen(false);setPage('quote');
      if(quoteScrollRef.current)quoteScrollRef.current.scrollTop=0;
      return;
    }
    setPage('quote');setQuoteTab(tab);setAreaId(null);
    if(quoteScrollRef.current)quoteScrollRef.current.scrollTop=0;
  };
  // The shared mobile app bar owns Back while the Beta editor owns navigation.
  useEffect(()=>{
    const onBack=()=>{if(page==='area'||page==='review')navigateDocument('build');else if(page==='quote')showLibrary();};
    window.addEventListener('sales-shop:quotes-beta-back',onBack);
    return ()=>window.removeEventListener('sales-shop:quotes-beta-back',onBack);
  },[page,navigateDocument,showLibrary]);
  const requestCopy=(target:Quote)=>{
    if(!canManageLibrary||target.archivedAt)return;
    setCopyRequest({id:target.id,title:target.title});
    const name=(target.title||'Untitled').replace(/(?:\s*· Copy)+$/i,'').trim();
    setCopyName(name+' · Copy');
  };
  const quoteMenuActions=(target:Quote):AppContextAction[]=>{
    const actions:AppContextAction[]=[];
    if(!target.archivedAt)actions.push({label:'Open document',onSelect:()=>openQuote(target.id)});
    if(target.documentType!=='pricing-schedule'&&
       (!target.archivedAt||canManageLibrary))actions.push({
       label:'Open in Detailed Editor',onSelect:()=>openDetailedQuoteEditor(target.id),
    });
    if(canManageLibrary){
      if(target.archivedAt)actions.push({label:'Restore to active',onSelect:()=>restoreQuote(target.id)});
      else{
        actions.push({label:'Make independent copy…',onSelect:()=>requestCopy(target)});
        actions.push({label:'Archive…',dividerBefore:true,
          onSelect:()=>setLibraryAction({id:target.id,kind:'archive'})});
        if(canPermanentlyDeleteQuote(target,quotes))actions.push({
          label:'Delete unsent draft…',destructive:true,
          onSelect:()=>setLibraryAction({id:target.id,kind:'delete'})});
      }
    }
    return actions;
  };
  const areaMenuActions=(target:QuoteSection):AppContextAction[]=>{
    const actions:AppContextAction[]=[
      {label:'Open Area / measurements',onSelect:()=>openArea(target.id)},
      {label:'Materials & selling prices',onSelect:()=>{openArea(target.id);setAreaTab('materials');}},
    ];
    if(quote&&editable&&!areaManager.editing){
      actions.push({label:'Duplicate Area',dividerBefore:true,onSelect:()=>{
        const id=duplicateArea(quote.id,target.id);if(id)openArea(id);
      }});
      actions.push({label:target.customerVisible?'Hide from customer':'Show to customer',onSelect:()=>{
        useQuoteStore.getState().updateSection(quote.id,target.id,{customerVisible:!target.customerVisible});
      }});
      actions.push({label:'Reorder or delete Areas…',onSelect:()=>areaManager.start()});
    }
    return actions;
  };
  const copyCurrentDocument=()=>{
    if(!quote||!canManageLibrary)return;
    // Copy is never executed from a menu click. Explicit confirmation required.
    requestCopy(quote);
  };
  const confirmDocumentCopy=()=>{
    if(!copyRequest||!canManageLibrary||!copyName.trim())return;
    const newId=duplicateDocument(copyRequest.id,copyName.trim());
    if(newId){setCopyRequest(null);setCopyName('');openQuote(newId);}
    else setError('Could not create an independent document copy.');
  };
  const requestDocumentDelete=()=>{
    if(quote&&canManageLibrary&&canPermanentlyDeleteQuote(quote,quotes)){
      setLibraryAction({id:quote.id,kind:'delete'});
    }
  };
  const requestDocumentArchive=()=>{
    if(quote&&canManageLibrary){
      setLibraryAction({id:quote.id,kind:'archive'});
    }
  };
  const reviseCurrentDocument=()=>{
    if(!quote||!canIssue)return;
    createRevision(quote.id);
    navigateDocument('build');
  };
  const createFromTemplate=(
    template:Exclude<SalesDocumentTemplateChoice,'multifamily'>,
    start:SalesTemplateStart='blank',sourceId?:string,requestedTitle='',
  )=>{
    const source=myQuotes.find(item=>item.id===sourceId);
    if(start==='previous'&&!source)return;
    if(start==='company-rates'&&template==='builder-rates'&&(!companyReady||!levelGuideReady)){
      setError('Company stock materials and builder level pricing are not loaded yet.');
      return;
    }
    const documentType=template==='quick-quote'?'quote':'pricing-schedule';
    const title=requestedTitle.trim();
    if(!title){setError('Enter a document name before creating it.');return;}
    if(template==='quick-quote'&&start==='previous'&&source){
      // An independent draft keeps source measurements and selling snapshots,
      // but never inherits its quote identity, issued history or delivery.
      if(source.documentType!=='quote'||source.archivedAt)return;
      const newId=duplicateDocument(source.id,title);
      if(!newId){setError('Could not create a fresh quote from this document.');return;}
      setShowNewDocument(false);
      openQuote(newId,'details');
      return;
    }
    const id=create({documentType,title,
      ...(source?{companyId:source.companyId,companyName:source.companyName,
        contactId:source.contactId,contactName:source.contactName,
        contactEmail:source.contactEmail,projectId:source.projectId}:{})});
    useQuoteStore.getState().updateQuote(id,{
      templateId:template,
      ...(source?{templateOrigin:{sourceQuoteId:source.id,sourceRevision:source.revision,sourceTitle:source.title}}:{}),
      lines:[],
      ...(template!=='quick-quote'?{
        pricingSchedule:createTemplateSchedule(id,template,start,source,
          stockRates.filter(rate=>rate.active),companyStock,
          template==='builder-rates'?levelGuide:undefined),
      }:{}),
    });
    setShowNewDocument(false);
    // After naming a new Quick Quote, begin with customer/job details.
    // Customer/Deal is optional; the explicit next action goes straight to Area.
    openQuote(id,template==='quick-quote'?'details':'build');
  };
  const openArea=(id:string)=>{setCustomerQuickOpen(false);setAreaId(id);setAreaTab('measure');setPage('area');};
  const openAreaAt=(id:string,tab:AreaTab)=>{setQuickArea(null);openArea(id);setAreaTab(tab);};
  const openQuickArea=(id:string,tab:QuickAreaTab='overview')=>setQuickArea({id,tab});
  const goBack=()=>{navigateDocument('build');};
  const newArea=()=>{
    if(!quote||!editable)return;
    const id=addSection(quote.id);
    if(id){
      const jobDefaults=quote.sections.find(s=>s.scope?.takeoffDefaultSplashHeightIn!==undefined||
        s.scope?.takeoffDefaultEdgeProfile!==undefined)?.scope;
      useQuoteStore.getState().updateSection(quote.id,id,{
        ...(jobDefaults?{scope:{takeoffDefaultSplashHeightIn:jobDefaults.takeoffDefaultSplashHeightIn,
          takeoffDefaultEdgeProfile:jobDefaults.takeoffDefaultEdgeProfile}}:{}),
      });
      openArea(id);
    }
  };
  const newAreaPreset=(presetId:QuoteAreaPresetId)=>{
    if(!quote||!editable)return;
    const id=addAreaFromPreset(quote.id,presetId);
    if(id){setAreaPresetsOpen(false);openArea(id);}
  };
  const addPersonalAreaLayout=(id:string)=>{
    if(!quote||!editable||!layoutScope)return;
    const saved=readSavedAreaLayouts(layoutScope).find(item=>item.id===id);
    if(!saved)return;
    const nextId=addAreaFromSavedLayout(quote.id,saved);
    if(nextId){setAreaPresetsOpen(false);openArea(nextId);}
  };
  const deletePersonalAreaLayout=(id:string):boolean=>{
    if(!layoutScope)return false;
    const next=readSavedAreaLayouts(layoutScope).filter(item=>item.id!==id);
    if(!writeSavedAreaLayouts(layoutScope,next))return false;
    setLayoutState({scope:layoutScope,items:next});
    return true;
  };
  const savePersonalAreaLayout=(name:string):boolean=>{
    if(!quote||!editable||!layoutScope||!savingLayoutAreaId)return false;
    const target=quote.sections.find(section=>section.id===savingLayoutAreaId);
    if(!target||isGeneralTakeoffSection(target))return false;
    const existing=readSavedAreaLayouts(layoutScope);
    if(existing.length>=SAVED_AREA_LAYOUT_LIMIT)return false;
    const layout=captureSavedAreaLayout(target,name,crypto.randomUUID(),new Date().toISOString());
    if(!layout)return false;
    const next=upsertSavedAreaLayout(existing,layout);
    if(!writeSavedAreaLayouts(layoutScope,next))return false;
    setLayoutState({scope:layoutScope,items:next});
    return true;
  };
  const advanceToNextArea=()=>{
    if(!quote||!area)return;
    const next=nextQuoteAreaAfter(quote,area.id);
    if(next?.kind==='open')openArea(next.areaId);
    else if(next?.kind==='create')newArea();
  };
  const duplicateCurrentArea=()=>{
    if(!quote||!area||!editable)return;
    const copy=duplicateArea(quote.id,area.id);
    if(copy)openArea(copy);
  };
  useEffect(()=>{
    // A restored editor location must not be discarded before quote hydration
    // has supplied its saved active document.
    if(!hydrated)return;
    if(page==='area'&&!area)setPage('quote');
    if(page!=='library'&&!quote)setPage('library');
  },[hydrated,page,area,quote]);
  const audit=quote&&quote.documentType!=='pricing-schedule'?auditQuoteDraft(quote):null;
  const detailsNextArea=quote?nextQuoteAreaShortcut(quote):null;
  const primaryAction=quote?quoteBetaPrimaryAction(quote,audit?.blockers.length??0):null;
  const continueFromDetails=()=>{
    if(!detailsNextArea)return;
    if(detailsNextArea.kind==='open')openArea(detailsNextArea.areaId);
    else newArea();
  };
  const openReview=(focusId:string|null=null)=>{
    setReviewReturn(null);setError('');setSelectionsOpen(false);
    setReviewFocus(focusId);
    if(quote?.documentType==='quote'){
      setReviewOpen(false);setQuoteTab('pricing');setPage('quote');setAreaId(null);
      if(quoteScrollRef.current)quoteScrollRef.current.scrollTop=0;
    }else setReviewOpen(true);
  };
  const returnToReview=()=>{
    if(!quote||reviewReturn?.quoteId!==quote.id)return;
    openReview(nextReviewFocus(quote,reviewReturn.findingId));
  };
  // Stage shortcuts never mutate pricing or automatically issue a document.
  const openPricingStage=()=>{
    if(!quote||quote.documentType==='pricing-schedule')return;
    openReview();
  };
  const openReviewCategory=(kind:'blockers'|'review'|'optional')=>{
    const item=audit?.[kind][0];openReview(item?.id??null);
  };
  // Send is always a visible entry point. Drafts with issues drill into their
  // first finding; a clear draft opens delivery, never silently dispatches email.
  const openSend=()=>{
    if(quote?.documentType==='pricing-schedule'){
      openReview(pricingScheduleValidationError(quote.pricingSchedule)?null:'__delivery__');return;
    }
    if(audit?.blockers.length){openReview(audit.blockers[0].id);return;}
    if(audit?.review.length){openReview(audit.review[0].id);return;}
    navigateDocument('preview');
  };
  // Review launched this exact Preview. Both the small top button and the
  // persistent phone footer use the SAME path, so neither can bypass the
  // content-keyed preview/approval guard when the customer copy was edited.
  const returnFromReviewPreview=()=>{
    if(!quote||previewReturnQuoteId!==quote.id)return;
    setPreviewReturnQuoteId(null);
    setPreviewedDeliveryKey(previewStartedKey);
    openReview('__delivery__');
  };
  const fixAudit=(destination:QuoteAuditDestination)=>{
    if((reviewOpen||quoteTab==='pricing')&&quote)setReviewReturn({quoteId:quote.id,findingId:reviewFocus});
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
    if(!latest){setError('This document is no longer available.');return;}
    if(latest.documentType!=='pricing-schedule'&&
      !approvedCustomerDraft(latest,previewedDeliveryKey,approvedDeliveryKey)){
      setError('Open Contract Review and select “I approve this quote” before issuing.');return;
    }
    if(latest.documentType==='pricing-schedule'){
      const issue=pricingScheduleValidationError(latest.pricingSchedule);
      if(issue){setError(issue);return;}
    }else if(auditQuoteDraft(latest).blockers.length){
      setError('Resolve pricing blockers before issuing this quote.');return;
    }
    setSending(true);setError('');
    try{
      await recordSent(quote.id,latest.documentType==='pricing-schedule'?undefined:approvedDeliveryKey??undefined);
      setApprovedDeliveryKey(null);
    }
    catch(e){setError(e instanceof Error?e.message:'Could not issue quote');}
    finally{setSending(false);}
  };

  const quoteProgress=quote&&quote.documentType!=='pricing-schedule'?
    <QuoteBetaProgress
        key={quote.id} quote={quote} editable={editable}
        current={reviewOpen||page==='quote'&&quoteTab==='pricing'?'review':
          page==='quote'&&quoteTab==='preview'?'contract':
          page==='quote'&&quoteTab==='details'?'details':'areas'}
        onDetails={()=>navigateDocument('details')}
        onAreas={()=>navigateDocument('build')}
        onOpenArea={openArea} onAddArea={newArea} onPricing={openPricingStage}
        onReview={()=>navigateDocument('preview')}/> 
    :null;
  if(!hydrated)return <main className="qmb"><p className="qmb-loading">Opening sales documents…</p></main>;
  if(canBrowseTeam&&libraryMode==='team')return <main className="quotes-view qmb-team">
    <div className="qmb-team-back"><button type="button" onClick={()=>setLibraryMode('mine')}>‹ My Quotes</button></div>
    {signedShopOutcomesEnabled
      ? <ShopOutcomesWorkspace onShowMine={()=>setLibraryMode('mine')}/>
      : <TeamQuotesWorkspace quotes={quotes} onShowMine={()=>setLibraryMode('mine')}/>}
  </main>;
  return <main className={"quotes-view qmb"+(reviewOpen?" is-review-expanded":"")} aria-label="Quotes mobile beta">
    <div className={'qmb-desktop-frame'+(page==='library'?' is-library':'')+
      (page!=='library'&&quote?.documentType==='quote'?' is-quick-quote-frame':'')}>
      {quote&&page!=='library'&&<QuoteBetaDesktopRails
        quote={quote} page={page} quoteTab={quoteTab} areaTab={areaTab} areaId={areaId}
        areaManager={areaManager}
        onAreaContextMenu={(event,s)=>contextActions.openPointer(event,s.title||'Area',areaMenuActions(s))}
        onAreaContextKey={(event,s)=>contextActions.openKeyboard(event,s.title||'Area',areaMenuActions(s))}
        onLibrary={showLibrary}
        onQuoteTab={navigateDocument}
        onArea={id=>{if(page==='area'&&id===areaId)return;openQuickArea(id);}}
        onAreaTab={tab=>{setPage('area');setAreaTab(tab);}}
        onReview={()=>openReview()}
        onReviewFinding={openReviewCategory}
        onReviewIssue={id=>openReview(id)}
        onSend={openSend} canIssue={canIssue}
        onUndo={()=>undo(quote.id)} onRedo={()=>redo(quote.id)}
        undoDepth={undoDepth} redoDepth={redoDepth}
        onCopy={copyCurrentDocument} onDelete={requestDocumentDelete}
        onArchive={requestDocumentArchive} onRevise={reviseCurrentDocument}
        canManage={canManageLibrary}
        canDelete={canManageLibrary&&canPermanentlyDeleteQuote(quote,quotes)}
        onAddArea={newArea} onAreaPresets={()=>setAreaPresetsOpen(true)}
        onSelections={()=>setSelectionsOpen(true)}
        />}
      <div className="qmb-desktop-main">
      {quote&&page!=='library'&&!reviewOpen&&reviewReturn?.quoteId===quote.id
        &&!(page==='quote'&&quoteTab==='preview')&&
        <div className="qmb-review-return" role="status" aria-label="Return to quote Review">
          <div><strong>Editing a Review finding</strong>
            <small>Changes save as you work. Return to Review to check the updated quote.</small></div>
          <div className="qmb-review-return-actions">
            <button type="button" onClick={returnToReview}>Return to Review ›</button>
            <button type="button" className="is-dismiss"
              aria-label="Dismiss return to Review" onClick={()=>setReviewReturn(null)}>×</button>
          </div>
        </div>}
      {page==='area'&&quoteProgress}
    {page==='library'?<>
      <WorkspaceHeader title="Quotes" className="qmb-library-workspace-header"
        tabs={<nav className="qmb-library-filter-row" aria-label="Document library sections">
          {([
            {id:'all',title:'All'},
            {id:'quick-quote',title:'Quick Quote'},
            followUpsTab?{id:'follow-ups',title:'Follow-ups'}:
              documentFilter==='community-pricing'?{id:'community-pricing',title:'Community Plan Pricing'}:
              documentFilter==='spreadsheet'?{id:'spreadsheet',title:'Custom Spreadsheet'}:
              {id:'builder-rates',title:'Builder Rate Schedule'},
          ] as Array<{id:'all'|SalesDocumentTemplate|'follow-ups';title:string}>).map(item=>
            <button key={item.id} type="button"
              className={(item.id==='follow-ups'?followUpsTab:!followUpsTab&&documentFilter===item.id)?'active':''}
              aria-pressed={item.id==='follow-ups'?followUpsTab:!followUpsTab&&documentFilter===item.id}
              onClick={()=>{
                if(item.id==='follow-ups')setFollowUpsTab(true);
                else{setFollowUpsTab(false);setDocumentFilter(item.id);}
              }}>{item.title}</button>)}
        </nav>}
        more={<WorkspaceMoreMenu items={[
          {label:'Builder Rate Schedule',onClick:()=>{setFollowUpsTab(false);setDocumentFilter('builder-rates');},active:!followUpsTab&&documentFilter==='builder-rates'},
          {label:'Community Plan Pricing',onClick:()=>{setFollowUpsTab(false);setDocumentFilter('community-pricing');},active:!followUpsTab&&documentFilter==='community-pricing'},
          {label:'Custom Spreadsheet',onClick:()=>{setFollowUpsTab(false);setDocumentFilter('spreadsheet');},active:!followUpsTab&&documentFilter==='spreadsheet'},
          {label:'Follow-ups',onClick:()=>setFollowUpsTab(true),active:followUpsTab},
          {label:'Active documents',onClick:()=>{setFollowUpsTab(false);setStatusFilter('active');},active:statusFilter==='active'},
          {label:'Draft documents',onClick:()=>{setFollowUpsTab(false);setStatusFilter('drafts');},active:statusFilter==='drafts'},
          {label:'Issued documents',onClick:()=>{setFollowUpsTab(false);setStatusFilter('issued');},active:statusFilter==='issued'},
          {label:'Archived documents',onClick:()=>{setFollowUpsTab(false);setStatusFilter('archived');},active:statusFilter==='archived'},
          {label:'Detailed Editor',onClick:()=>openDetailedQuoteEditor(quote?.id)},
          {label:'Clear search and filters',onClick:resetLibraryFilters,disabled:!hasLibraryFilters},
        ]}/>}
        search={<input type="search" value={search} onChange={event=>setSearch(event.target.value)}
          aria-label="Search my documents" placeholder="Search documents…" disabled={followUpsTab}/>}
        primary={<button type="button" disabled={!canManageLibrary}
          onClick={()=>setShowNewDocument(true)}>+ Document</button>}
      />
      <div className="qmb-pad qmb-pagecontent">
         {followUpsTab
           ?<QuotesFollowUpDashboard quotes={myQuotes} onOpen={openQuote} canManage={canManageLibrary}/>
           :<>
         <div className="qmb-library-directory-controls" aria-label="Document directory controls">
           <p className="qmb-library-results-head qmb-library-directory-caption">
             {statusFilter==='archived'?'Archived documents':'My documents'} · {list.length} {list.length===1?'document':'documents'} · click a name to preview its record
           </p>
           <div className="qmb-library-toolbar-slot" ref={setDocumentToolbarHost}/>
           <div className="qmb-library-mobile-filters">
             <div className="qmb-library-tools">
             <label><span>Show</span>
               <select value={statusFilter} aria-label="Document status" onChange={e=>setStatusFilter(e.target.value as SalesDocumentStatusFilter)}>
                 <option value="active">Active ({counts.active})</option>
                 <option value="drafts">Drafts ({counts.drafts})</option>
                 <option value="issued">Issued ({counts.issued})</option>
                 <option value="archived">Archived ({counts.archived})</option>
               </select>
             </label>
             <label><span>Sort</span><select aria-label="Sort documents" value={documentSort}
               onChange={e=>setDocumentSort(e.target.value as SalesDocumentSort)}>
               <option value="recent">Recently edited</option>
               <option value="name">Document name</option>
               <option value="company">Customer / company</option>
               <option value="oldest">Oldest edited</option>
             </select></label>
           </div>
           </div>
         </div>
         <div className="qmb-documents-table">
           <ConnectionsTable tableKey="documents" columns={documentColumns} rows={documentTableRows}
             toolbarTarget={documentToolbarHost}
             toolbarControls={<div className="qmb-library-tools">
             <label><span>Show</span>
               <select value={statusFilter} aria-label="Document status" onChange={e=>setStatusFilter(e.target.value as SalesDocumentStatusFilter)}>
                 <option value="active">Active ({counts.active})</option>
                 <option value="drafts">Drafts ({counts.drafts})</option>
                 <option value="issued">Issued ({counts.issued})</option>
                 <option value="archived">Archived ({counts.archived})</option>
               </select>
             </label>
             <label><span>Sort</span><select aria-label="Sort documents" value={documentSort}
               onChange={e=>setDocumentSort(e.target.value as SalesDocumentSort)}>
               <option value="recent">Recently edited</option>
               <option value="name">Document name</option>
               <option value="company">Customer / company</option>
               <option value="oldest">Oldest edited</option>
             </select></label>
           </div>}
             onOpen={id=>setDocumentPreviewId(id)}
             onDocumentArchive={canManageLibrary?id=>setLibraryAction({id,kind:'archive'}):undefined}
             onDocumentRestore={canManageLibrary?id=>restoreQuote(id):undefined}
             onBulkTask={items=>beginTaskPromotion({
               target:'task',title:'Follow up on '+items.length+' sales documents',
               sourceLabel:'Sales Documents selection',
               associations:items.flatMap(x=>x.association?[x.association]:[]),
             })}/>
         </div>
         <div className="qmb-library-grid">
        {list.map(q=><div className="qmb-library-entry" key={q.id}>
          <button type="button" className="qmb-card qmb-listcard"
            onContextMenu={event=>contextActions.openPointer(event,q.title||'Quote',quoteMenuActions(q))}
            onKeyDown={event=>contextActions.openKeyboard(event,q.title||'Quote',quoteMenuActions(q))}
            aria-disabled={!!q.archivedAt}
            title={q.archivedAt?'Restore from Archived to reopen':'Open '+(q.title||'document')}
            onClick={()=>{if(!q.archivedAt)openQuote(q.id);}}>
            <div className="qmb-split"><small>{displayQuoteNumber(q)}</small>
              <span className="qmb-chip">{quoteBetaStatusLabel(q)}</span></div>
            <strong>{q.title||'Untitled document'}</strong>
            <div className="qmb-library-updated">Edited {formatPersonalDate(new Date(q.updatedAt),readPersonalDateTimePreferences(useAuthStore.getState().user?.id??null))}</div>
            <div className="qmb-split"><small>{q.companyName||'Customer not selected'} · {salesTemplateLabel(salesDocumentTemplate(q))}{q.documentType==='quote'?' · '+q.sections.length+' Areas':''}</small>
              <b>{q.documentType==='pricing-schedule'?`${q.pricingSchedule?.customerItems.length??0} published rows`:money.format(quoteTotal(q))}</b></div>
          </button>
          {canManageLibrary&&<div className="qmb-library-card-actions">
            {q.archivedAt?<button type="button" onClick={()=>restoreQuote(q.id)}>Restore to active</button>:
              <>
                <button type="button" onClick={()=>setLibraryAction({id:q.id,kind:'archive'})}>Archive</button>
                {canPermanentlyDeleteQuote(q,quotes)&&<button type="button" className="is-danger"
                  onClick={()=>setLibraryAction({id:q.id,kind:'delete'})}>Delete draft</button>}
              </>}
          </div>}
        </div>)}
        </div>
        {!list.length&&<div className="qmb-empty">
          {statusFilter==='archived'&&!search.trim()&&documentFilter==='all'?
            'No archived documents yet. Archiving keeps agreements available for later.':
            hasLibraryFilters?'No documents match these filters. Try clearing the search or selecting a different status.':
              'No documents yet. Start with a purpose-built template.'}
          {hasLibraryFilters&&<button type="button" className="qmb-library-reset" onClick={resetLibraryFilters}>
            Clear filters
          </button>}
        </div>}
        {canBrowseTeam&&<button type="button" className="qmb-outline qmb-block" onClick={()=>setLibraryMode('team')}>{signedShopOutcomesEnabled ? 'Shop Outcomes ›' : 'Team Quotes ›'}</button>}
         </>}
      </div>
      <footer className="qmb-footer qmb-footer-single"><button type="button" className="qmb-primary"
          onClick={()=>setShowNewDocument(true)}>+ New document</button></footer>
    </>:page==='quote'&&quote?<div className={'qmb-editor qmb-quote-editor'+
  (quote.documentType!=='pricing-schedule'?' is-quick-quote':'')}>
      <div className="qmb-quote-chrome">
        <div className="qmb-quote-sticky">
          <div className="qmb-quote-identity">
            <div className="qmb-quote-title-group">
              <input className="qmb-quote-name" aria-label="Quote title" maxLength={300}
                disabled={!editable} placeholder="Document name" value={quote.title}
                onChange={e=>update(quote.id,{title:e.target.value})}/>
              <button type="button" className="qmb-document-customer-link"
                aria-label="Quick edit quote customer" aria-haspopup="dialog"
                aria-expanded={customerQuickOpen} onClick={()=>setCustomerQuickOpen(true)}
                title={[quote.companyName,quote.contactName].filter(Boolean).join(' · ')||'Assign customer'}>
                {quote.companyName||quote.contactName||'Assign customer'}
                {quote.companyName&&quote.contactName?' · '+quote.contactName:''}
              </button>
            </div>
            <div className="qmb-quote-price-group">
              <strong className="qmb-quote-total"
                aria-label={quote.documentType==='pricing-schedule'?'Published pricing rows':'Current quote total'}>
                {quote.documentType==='pricing-schedule'?`${quote.pricingSchedule?.customerItems.length??0} price rows`:money.format(quoteTotal(quote))}
              </strong>
              <div className="qmb-quote-price-meta" aria-label="Quote status, revision and cloud save">
                <span className="qmb-editor-status">{quoteBetaStatusLabel(quote)}</span>
                <span className="qmb-quote-revision" aria-label={`Revision ${quote.revision}`}
                  title={`Revision ${quote.revision}`}>
                  <span className="qmb-revision-full">Revision </span>
                  <span className="qmb-revision-short" aria-hidden="true">R</span>{quote.revision}
                </span>
                <SalesDocumentSaveStatus quote={quote} cloudMode={authMode==='cloud'} compact/>
              </div>
            </div>
          </div>
          {quote.templateOrigin&&<div className="qmb-pad qmb-document-origin">
            <span>Based on {quote.templateOrigin.sourceTitle} · Rev {quote.templateOrigin.sourceRevision}</span>
            <span>· Independent working copy</span>
          </div>}
          <header className="qmb-pagehead qmb-desktop-fallback-toolbar" aria-label="Document navigation and history">
            <button type="button" className="qmb-back" onClick={showLibrary}>‹ Documents</button>
            <div role="toolbar" aria-label="Quote editing history">
              <button type="button" disabled={!editable||undoDepth===0}
                onClick={()=>undo(quote.id)} aria-label="Undo quote edit" title="Undo">↶ Undo</button>
              <button type="button" disabled={!editable||redoDepth===0}
                onClick={()=>redo(quote.id)} aria-label="Redo quote edit" title="Redo">↷ Redo</button>
              <SalesDocumentActionsMenu quote={quote} canManage={canManageLibrary} canIssue={canIssue}
                canDelete={canManageLibrary&&canPermanentlyDeleteQuote(quote,quotes)}
                onCopy={copyCurrentDocument} onDelete={requestDocumentDelete}
                onArchive={requestDocumentArchive} onRevise={reviseCurrentDocument}/>
            </div>
          </header>
          <nav className="qmb-tabs" aria-label="Quote views">
            {(quote.documentType==='pricing-schedule'
              ?([['build','Editor'],['details','Details'],['preview','Preview']] as const)
              :([['details','Details'],['build','Takeoffs & selections'],['preview','Contract review']] as const)
            ).map(([id,label])=>
              <button key={id} type="button" className={quoteTab===id?'active':''}
                aria-current={quoteTab===id?'page':undefined}
                onClick={()=>navigateDocument(id)}>{id==='build'&&quote.documentType==='pricing-schedule'?'Editor':label}</button>)}
            {quote.documentType!=='pricing-schedule'&&<button type="button" className="qmb-selections-tab"
              aria-label="Open quote selections" onClick={()=>setSelectionsOpen(true)}>◇ Selections</button>}
          </nav>
        </div>
        {quoteProgress}
      </div>
      {isPhoneLayout&&mobileActionsHost&&createPortal(
        <SalesDocumentActionsMenu quote={quote} canManage={canManageLibrary} canIssue={canIssue}
          canDelete={canManageLibrary&&canPermanentlyDeleteQuote(quote,quotes)}
          onCopy={copyCurrentDocument} onDelete={requestDocumentDelete}
          onArchive={requestDocumentArchive} onRevise={reviseCurrentDocument}/>,
        mobileActionsHost)}
      <div className="qmb-quote-scroll" ref={quoteScrollRef}>
        <div className="qmb-pad qmb-pagecontent">
        {quoteTab==='build'&&quote.documentType==='pricing-schedule'&&
          <section className="qmb-pricing-schedule-beta" aria-label="Pricing Schedule workspace">
            <Suspense fallback={<div className="qmb-card">Opening Pricing Schedule…</div>}>
              <PricingScheduleWorkspace key={quote.id} quote={quote}/>
            </Suspense>
          </section>}
        {quoteTab==='build'&&quote.documentType!=='pricing-schedule'&&<>
          <QuoteMatrixBuilder quote={quote} onAddArea={()=>{addSection(quote.id);}}
            onLayouts={()=>setAreaPresetsOpen(true)}
            onCopyArea={()=>setCopyAreaOpen(true)}
            onAdvanced={id=>openArea(id)}
            onGeneralTakeoff={()=>{ensureGeneralTakeoff(quote.id);}}/>


        </>}
        {quoteTab==='pricing'&&quote.documentType!=='pricing-schedule'&&
          <QuoteBetaReview quote={quote} initialFindingId={reviewFocus}
            onBack={()=>navigateDocument('build')} onFix={fixAudit}
            onPreview={()=>{
              setPreviewReturnQuoteId(null);
              setQuoteTab('preview');setPage('quote');setAreaId(null);
              if(quoteScrollRef.current)quoteScrollRef.current.scrollTop=0;
            }}
            canIssue={canIssue} sending={sending} error={error} onIssue={issueQuote}
            previewedKey={previewedDeliveryKey} approvedKey={approvedDeliveryKey}
            onApprove={approved=>setApprovedDeliveryKey(approved?quoteDeliveryApprovalKey(quote):null)}
            reviewedKey={reviewedDeliveryKey} onReview={setReviewedDeliveryKey}
            footerTarget={pricingFooterTarget}/>}
        {quoteTab==='details'&&<QuoteBetaDetails quote={quote}/>} 
        {quoteTab==='preview'&&<>
          <QuoteBetaEditablePreview quote={quote}
            onReturnToReview={quote.documentType==='pricing-schedule'&&previewReturnQuoteId===quote.id
              ?returnFromReviewPreview:undefined}/>
          {quote.documentType!=='pricing-schedule'&&<QuoteContractApproval
            quote={quote} canIssue={canIssue} sending={sending} error={error}
            previewedKey={previewedDeliveryKey} approvedKey={approvedDeliveryKey}
            reviewedKey={reviewedDeliveryKey}
            onApprove={next=>{
              if(next){
                const contentKey=quoteDeliveryApprovalKey(quote);
                setPreviewedDeliveryKey(contentKey);
                setApprovedDeliveryKey(contentKey);
              }else setApprovedDeliveryKey(null);
            }}
            onIssue={issueQuote} onPricingReview={()=>navigateDocument('pricing')}/>} 
        </>}
        </div>
      </div>
      {quoteTab==='pricing'&&quote.documentType!=='pricing-schedule'&&
       <div className="qmb-pricing-footer-slot" ref={setPricingFooterTarget}/>}
      {quoteTab!=='pricing'&&(quoteTab!=='preview'||quote.documentType==='pricing-schedule')&&<footer className="qmb-footer qmb-quote-footer">
        <div className="qmb-guided-footer-left">
          <button type="button" className="qmb-guided-back" onClick={()=>
           quoteTab==='details'?showLibrary():navigateDocument(quoteTab==='preview'?'build':'details')}>
           ‹ Back</button>
          <span className="qmb-guided-footer-meta">
           <SalesDocumentSaveStatus quote={quote} cloudMode={authMode==='cloud'}/>
           <strong>{money.format(quoteTotal(quote))}</strong>
          </span>
        </div>
        {quoteTab==='preview'&&previewReturnQuoteId===quote.id
          ?<button type="button" className="qmb-primary"
            onClick={returnFromReviewPreview}>Done previewing · Back to Review ›</button>
          :quote.documentType!=='pricing-schedule'&&quoteTab==='details'
            ?<button type="button" className="qmb-primary"
              onClick={()=>navigateDocument('build')}>
              Continue to Build Quote ›</button>
          :quote.documentType!=='pricing-schedule'&&quoteTab==='build'
            ?<button type="button" className="qmb-primary"
              onClick={openPricingStage}>Continue to Pricing Review ›</button>
          :<button type="button" className="qmb-primary" onClick={openSend}>
            {primaryAction?.mobile??'Review document ›'}</button>}
      </footer>}
    </div>:page==='area'&&quote&&area?<AreaWorkspace key={area.id} quote={quote} section={area} tab={areaTab}
      setTab={setAreaTab} goBack={goBack} onPricingOverview={openPricingStage}
      returnLabel="Done · Takeoffs"
      onNextArea={advanceToNextArea} onReview={openSend} onDuplicate={duplicateCurrentArea}
       onSaveLayout={()=>{if(area)setSavingLayoutAreaId(area.id);}}
      />:null}
      </div>
    </div>
    {quote&&page==='quote'&&customerQuickOpen&&<QuoteCustomerQuickEdit
      quote={quote} editable={editable}
      onClose={()=>setCustomerQuickOpen(false)}
      onDetails={()=>navigateDocument('details')}/>}
    {quote&&page!=='library'&&selectionsOpen&&<QuoteBetaSelections quote={quote} onClose={()=>setSelectionsOpen(false)}/>}
    {showDeleteGeneralTakeoff&&generalTakeoff&&quote&&createPortal(
      <div className="qmb qmb-area-manager-backdrop" onPointerDown={e=>{
        if(e.target===e.currentTarget)setShowDeleteGeneralTakeoff(false);}}>
        <section className="qmb-area-manager qmb-inline-delete-dialog"
          role="dialog" aria-modal="true" aria-label="Delete General takeoff"
          data-general-takeoff-delete>
          <header className="qmb-area-manager-head"><div>
            <strong>Remove General takeoff</strong>
            <small>Choose what happens to its contents.</small>
          </div><button type="button" aria-label="Cancel General takeoff deletion"
            onClick={()=>setShowDeleteGeneralTakeoff(false)}>×</button></header>
          <div className="qmb-area-manager-delete">
            <button type="button" className="qmb-area-deletion-choice" onClick={()=>{
              deleteGeneralTakeoff(quote.id,generalTakeoff.id,'transfer');
              setShowDeleteGeneralTakeoff(false);}}>
              <strong>Remove takeoff, keep charges</strong>
              <small>Preserve its line items as regular General charges.</small>
            </button>
            <button type="button" className="qmb-area-deletion-choice is-destructive" onClick={()=>{
              deleteGeneralTakeoff(quote.id,generalTakeoff.id,'delete');
              setShowDeleteGeneralTakeoff(false);}}>
              <strong>Remove takeoff and charges</strong>
              <small>Remove the measurements and all of its quote lines. Undo is available.</small>
            </button>
          </div>
          <footer className="qmb-area-manager-foot"><button type="button"
            onClick={()=>setShowDeleteGeneralTakeoff(false)}>Cancel</button></footer>
        </section>
      </div>,document.body)}
    {documentPreviewId&&<RecordPreviewDrawer
      record={{kind:'quote',id:documentPreviewId}}
      onClose={()=>setDocumentPreviewId(null)}
      onGoToQuotePage={id=>{
        setDocumentPreviewId(null);
        requestQuoteMetadataPage(id,()=>setView('dashboard'));
      }}/>}
    {quote&&page!=='library'&&editable&&areaPresetsOpen&&<QuoteAreaPresetPicker
      savedLayouts={savedLayouts} onSelectSaved={addPersonalAreaLayout}
      onDeleteSaved={deletePersonalAreaLayout}
      onSelect={newAreaPreset}
      onBlank={()=>{setAreaPresetsOpen(false);newArea();}}
      onClose={()=>setAreaPresetsOpen(false)}/>}
    {quote&&page==='quote'&&quickArea&&quote.sections.some(a=>a.id===quickArea.id)&&
      <QuoteAreaQuickPanel quote={quote} areaId={quickArea.id} initialTab={quickArea.tab}
        onTab={tab=>setQuickArea(value=>value?{...value,tab}:null)}
        onSelect={id=>setQuickArea(value=>value?{...value,id}:null)}
        onClose={()=>setQuickArea(null)}
        onFull={tab=>openAreaAt(quickArea.id,tab)}/>}
    {quote&&page==='quote'&&bulkAreaOpen&&<QuoteBulkAreaDialog quote={quote}
      ids={selectedBulkAreaIds.filter(id=>quote.sections.some(s=>s.id===id))}
      onClose={()=>setBulkAreaOpen(false)}
      onApplied={()=>{setBulkAreaOpen(false);setSelectedBulkAreaIds([]);}}/>}
    {quote&&page==='area'&&editable&&savingLayoutAreaId
      &&quote.sections.some(section=>section.id===savingLayoutAreaId)
      &&<QuoteSaveAreaLayoutDialog
        section={quote.sections.find(section=>section.id===savingLayoutAreaId)!}
        onSave={savePersonalAreaLayout} onClose={()=>setSavingLayoutAreaId(null)}/>}
    {showNewDocument&&<NewSalesDocumentPicker quotes={myQuotes}
      stockRateCount={stockRates.filter(item=>item.active).length}
      stockLevelReady={companyReady&&levelGuideReady}
      stockMaterialCount={stockLevelPreview.summary.stockCount}
      stockLevelCount={stockLevelPreview.summary.levelCount}
      unassignedStockCount={stockLevelPreview.summary.unassigned.length}
      onClose={()=>setShowNewDocument(false)} onCreate={createFromTemplate}/>}
    {copyRequest&&createPortal(<div className="qmb qmb-area-manager-backdrop"
      onPointerDown={e=>{if(e.currentTarget===e.target)setCopyRequest(null);}}>
      <section className="qmb-area-manager qmb-document-confirm-dialog" role="dialog"
        aria-modal="true" aria-label="Copy document">
        <header className="qmb-area-manager-head"><div>
          <strong>Make an independent copy</strong>
          <small>Nothing will be copied until you confirm.</small></div>
          <button type="button" aria-label="Close copy dialog" onClick={()=>setCopyRequest(null)}>×</button>
        </header>
        <div className="qmb-document-confirm-body">
          <p>Copying <strong>{copyRequest.title}</strong> creates a separate draft.
            The original document, its issued revisions, and signatures remain unchanged.</p>
          <label><span>New document name</span><input autoFocus required maxLength={300}
            aria-label="New document name" value={copyName}
            onChange={e=>setCopyName(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();confirmDocumentCopy();}}}/></label>
        </div>
        <footer className="qmb-area-manager-foot">
          <button type="button" onClick={()=>setCopyRequest(null)}>Cancel</button>
          <button type="button" disabled={!copyName.trim()} onClick={confirmDocumentCopy}>Create independent copy</button>
        </footer>
      </section>
    </div>,document.body)}
    {libraryAction&&(()=>{
      const chosen=quotes.find(q=>q.id===libraryAction.id);
      if(!chosen)return null;
      const removing=libraryAction.kind==='delete';
      return createPortal(<div className="qmb qmb-area-manager-backdrop" onPointerDown={e=>{
        if(e.target===e.currentTarget)setLibraryAction(null);}}>
        <section className="qmb-area-manager qmb-inline-delete-dialog" role="dialog"
          aria-modal="true" aria-label={removing?'Delete draft quote':'Archive quote'}>
          <header className="qmb-area-manager-head"><div>
            <strong>{removing?'Delete unsent draft?':'Archive this quote?'}</strong>
            <small>{chosen.title||'Untitled quote'}</small></div>
            <button type="button" aria-label="Close quote action" onClick={()=>setLibraryAction(null)}>×</button>
          </header>
          <div className="qmb-area-manager-delete">
            <p>{removing?'This draft has never been issued. Permanent deletion cannot be undone.':
              'The quote and its revisions will be retained, and you can restore them from Show archived.'}</p>
            <button type="button"
              className={'qmb-area-deletion-choice'+(removing?' is-destructive':'')}
              onClick={()=>{
                if(removing){
                  if(canPermanentlyDeleteQuote(chosen,useQuoteStore.getState().quotes)){
                    deleteQuote(chosen.id);
                    if(quote?.id===chosen.id)showLibrary();
                  }
                }else {
                  archiveQuote(chosen.id);
                  if(quote?.id===chosen.id)showLibrary();
                }
                setLibraryAction(null);
              }}>
              <strong>{removing?'Permanently delete draft':'Archive quote'}</strong>
            </button>
          </div>
          <footer className="qmb-area-manager-foot">
            <button type="button" onClick={()=>setLibraryAction(null)}>Keep quote</button>
          </footer>
        </section>
      </div>,document.body);
    })()}
    {quote&&copyAreaOpen&&<QuoteReuseAreaDialog quote={quote} sources={myQuotes}
      onClose={()=>setCopyAreaOpen(false)}/>}
    {contextActions.menu}
    <QuoteBetaAreaDeleteDialog manager={areaManager} quote={quote}/>
    <QuoteBetaGeneralDeleteDialog manager={generalManager} quote={quote}/>
    {quote&&page!=='library'&&reviewOpen&&<QuoteBetaReviewOverlay quote={quote} focusId={reviewFocus}
      inspector={<QuoteBetaInspector quote={quote} page={page} areaTab={areaTab} areaId={areaId}
        onAreaTab={tab=>{setPage('area');setAreaTab(tab);}} onReview={()=>openReview()}
        onReviewFinding={openReviewCategory} onReviewIssue={id=>openReview(id)}
        onSend={openSend} canIssue={canIssue}/>}
      canIssue={canIssue} sending={sending} error={error} onIssue={issueQuote}
      previewedKey={previewedDeliveryKey} approvedKey={approvedDeliveryKey}
      onApprove={approved=>setApprovedDeliveryKey(approved?quoteDeliveryApprovalKey(quote):null)}
      reviewedKey={reviewedDeliveryKey} onReview={setReviewedDeliveryKey}
      onClose={()=>{setReviewOpen(false);setReviewFocus(null);}}
      onFix={fixAudit} onPreview={()=>{
        setReviewOpen(false);setPreviewReturnQuoteId(quote.id);
        setPreviewStartedKey(quoteDeliveryApprovalKey(quote));
        setQuoteTab('preview');setPage('quote');setAreaId(null);
      }}
      />}

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
