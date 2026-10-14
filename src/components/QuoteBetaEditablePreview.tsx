import {useEffect,useState} from 'react';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {slabReferencePatch} from './QuoteMaterialLineFields';
import {QuoteSfRateChoices} from './QuoteSfRateChoices';
import {CustomerPreview,type CustomerPreviewEditing} from './Quotes';
import {QuoteBetaCustomerOptions} from './QuoteBetaCustomerOptions';
import {useMaterialLevelGuideStore} from '../store/materialLevelGuideStore';
import {useQuoteStore} from '../store/quoteStore';
import {quoteLineAmount,quoteLinesTotal,quoteTotal,type Quote,type QuoteLine,type QuotePricingMode} from '../types/quote';

type PriceTarget={kind:'line'|'area'|'general';id:string};
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

function QuotePreviewPriceForm({quote,line}:{quote:Quote;line:QuoteLine}){
  const update=useQuoteStore(s=>s.updateLine);
  const reorder=useQuoteStore(s=>s.reorderLine);
  const moveLine=useQuoteStore(s=>s.moveLine);
  const multiplier=useMaterialLevelGuideStore(s=>s.guide.slabPricingMultiplier);
  const [showLevels,setShowLevels]=useState(false);
  const linkedSF=line.quantitySource?.syncMode==='live';
  const managedSink=Boolean(line.takeoffSinkId);
  const managed=linkedSF||managedSink;
  const canMove=!managed;
  const material=line.kind==='material';
  const peers=quote.lines.filter(candidate=>candidate.sectionId===line.sectionId);
  const position=peers.findIndex(candidate=>candidate.id===line.id);
  const changeMode=(mode:QuotePricingMode)=>{
    if(managed)return;
    if(mode==='slab-multiplier'&&material){
      const next=slabReferencePatch(line,multiplier,{
        sourceSlabCost:line.materialReference?.sourceSlabCost??line.materialReference?.catalogSlabCost,
        slabMultiplier:line.materialReference?.slabMultiplier??multiplier,
        slabCount:line.materialReference?.slabCount,
      });
      update(quote.id,line.id,{pricingMode:mode,quantity:undefined,quantitySource:undefined,rate:undefined,
        amount:next.amount,materialReference:next.materialReference});
      return;
    }
    const base=material&&line.materialReference?{
      materialReference:{...line.materialReference,
        pricingSource:'manual-line-rate' as const,
        sourceSlabCost:undefined,slabCount:undefined,slabMultiplier:undefined,
        slabCostOverride:undefined,customerPricePerSlab:undefined},
    }:{};
    update(quote.id,line.id,{
      ...base,pricingMode:mode,
      amount:mode==='direct'?quoteLineAmount(line):undefined,
      quantitySource:undefined,
    });
  };
  const changeSlab=(patch:Parameters<typeof slabReferencePatch>[2])=>{
    const next=slabReferencePatch(line,multiplier,patch);
    update(quote.id,line.id,{materialReference:next.materialReference,amount:next.amount});
  };
  return <div className="qmb-preview-price-form" aria-label={'Pricing '+line.description}>
    <div className="qmb-preview-edit-total"><span>Current line amount</span><strong>{money.format(quoteLineAmount(line))}</strong></div>
    {!managed&&<div className="qmb-preview-mode-picker" role="group" aria-label="Price method">
      <button type="button" aria-pressed={line.pricingMode==='quantity-rate'} onClick={()=>changeMode('quantity-rate')}>Rate</button>
      {material&&<button type="button" aria-pressed={line.pricingMode==='slab-multiplier'} onClick={()=>changeMode('slab-multiplier')}>Multiplier</button>}
      <button type="button" aria-pressed={line.pricingMode==='direct'} onClick={()=>changeMode('direct')}>Manual</button>
      <button type="button" aria-pressed={line.pricingMode==='none'} onClick={()=>changeMode('none')}>No price</button>
    </div>}
    {managed&&<small className="qmb-preview-pricing-info">
      {linkedSF?'Quantity is controlled by Area measurements. Edit the sell rate here.':
        'Sink quantity and source details remain connected to the Area Materials tab.'}
    </small>}
    {line.pricingMode==='quantity-rate'&&<div className="qmb-preview-price-fields">
      <label>Quantity <input type="number" step="any" aria-label="Preview quantity" value={line.quantity??''}
        disabled={managed}
        onChange={e=>update(quote.id,line.id,{quantity:e.target.value===''?undefined:Number(e.target.value)})}/></label>
      <label>Sell rate <input type="number" step=".01" aria-label="Preview sell rate" value={line.rate??''}
        onChange={e=>update(quote.id,line.id,{
          rate:e.target.value===''?undefined:Number(e.target.value),rateReference:undefined,
        })}/></label>
    </div>}
    {line.pricingMode==='quantity-rate'&&material&&<>
      <button type="button" className="qmb-preview-levels-toggle" aria-expanded={showLevels}
        onClick={()=>setShowLevels(!showLevels)}>Builder Levels / Rate Book {showLevels?'⌃':'▾'}</button>
      {showLevels&&<div className="qmb-preview-rate-choices"><QuoteSfRateChoices
        division={quote.pricingDivision} selectedRateId={line.rateReference?.rateBookItemId}
        materialType={line.materialReference?.snapshot?.materialType}
        materialCostPerSf={line.materialReference?.sourceCostPerSf??line.materialReference?.snapshot?.costPerSf}
        onSelect={(price,ref)=>{update(quote.id,line.id,{rate:price,rateReference:ref});setShowLevels(false);}}/></div>}
    </>}
    {line.pricingMode==='direct'&&<label className="qmb-preview-money-field">Manual amount
      <input type="number" step=".01" aria-label="Preview manual amount" value={line.amount??''}
        onChange={e=>update(quote.id,line.id,{amount:e.target.value===''?undefined:Number(e.target.value)})}/>
    </label>}
    {line.pricingMode==='slab-multiplier'&&<div className="qmb-preview-slab-fields">
      <label>Slab cost <input type="number" step=".01" min="0" aria-label="Preview slab cost"
        value={line.materialReference?.sourceSlabCost??''}
        onChange={e=>changeSlab({sourceSlabCost:e.target.value===''?undefined:Number(e.target.value)})}/></label>
      <label>Multiplier <input type="number" step=".01" min="0" aria-label="Preview slab multiplier"
        value={line.materialReference?.slabMultiplier??multiplier}
        onChange={e=>changeSlab({slabMultiplier:e.target.value===''?undefined:Number(e.target.value)})}/></label>
      <label>Slabs <input type="number" step="1" min="1" aria-label="Preview slab count"
        value={line.materialReference?.slabCount??''}
        onChange={e=>changeSlab({slabCount:e.target.value===''?undefined:Number(e.target.value)})}/></label>
    </div>}
    <div className="qmb-preview-line-tools">
      <strong>Line arrangement</strong>
      <button type="button" disabled={position<=0} aria-label="Preview move line up"
        onClick={()=>reorder(quote.id,line.id,-1)}>↑ Up</button>
      <button type="button" disabled={position===peers.length-1} aria-label="Preview move line down"
        onClick={()=>reorder(quote.id,line.id,1)}>↓ Down</button>
    </div>
    {canMove&&<label className="qmb-preview-money-field">Move to
      <select aria-label="Preview move line to Area" value={line.sectionId??''}
        onChange={e=>moveLine(quote.id,line.id,e.target.value||undefined)}>
        <option value="">General charges</option>
        {quote.sections.map(s=><option key={s.id} value={s.id}>{s.title||'Untitled Area'}</option>)}
      </select>
    </label>}
    <label className="qmb-check"><input type="checkbox" checked={line.customerVisible}
      onChange={e=>update(quote.id,line.id,{customerVisible:e.target.checked})}/>
      Show this line to customer</label>
  </div>;
}

export function QuoteBetaEditablePreview({quote,onReturnToReview}:{quote:Quote;onReturnToReview?:()=>void}){
  const editable=quoteIsCommerciallyEditable(quote)&&quote.documentType!=='pricing-schedule';
  const updateSection=useQuoteStore(s=>s.updateSection);
  const [editing,setEditing]=useState(false);
  const [device,setDevice]=useState<'desktop'|'phone'>('desktop');
  const [nameId,setNameId]=useState<string|null>(null);
  const [target,setTarget]=useState<PriceTarget|null>(null);
  const [selectedLineId,setSelectedLineId]=useState('');
  useEffect(()=>{setEditing(false);setNameId(null);setTarget(null);},[quote.id]);
  useEffect(()=>{
    if(!target)return;
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setTarget(null);setNameId(null);}};
    document.addEventListener('keydown',key);
    return ()=>document.removeEventListener('keydown',key);
  },[target]);
  const changeTarget=(next:PriceTarget)=>{
    setTarget(current=>current?.kind===next.kind&&current.id===next.id?null:next);
    const first=quote.lines.find(line=>
      (next.kind==='line'?line.id===next.id:next.kind==='area'?line.sectionId===next.id:
        !line.sectionId||!quote.sections.some(s=>s.id===line.sectionId))&&
      line.includeInTotal&&line.pricingMode!=='none');
    setSelectedLineId(first?.id??'');
  };
  const areaTitle:NonNullable<CustomerPreviewEditing['areaTitle']>=(section)=>{
    if(!editing)return section.title;
    return nameId===section.id?<span className="qmb-preview-name-edit">
      <input aria-label="Edit Area name in preview" value={section.title} maxLength={200}
        onChange={e=>updateSection(quote.id,section.id,{title:e.target.value})}
        onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')setNameId(null);}}/>
      <button type="button" onClick={()=>setNameId(null)} aria-label="Done editing Area name">✓</button>
    </span>:<button type="button" className="qmb-preview-title-edit"
      aria-label={'Edit Area name '+section.title} onClick={()=>setNameId(section.id)}>
      {section.title||'New Area'} <span aria-hidden="true">✎</span>
    </button>;
  };
  const priceButton=(next:PriceTarget,label:string)=>
    editing?<button type="button" className="qmb-preview-edit-trigger" aria-label={label}
      onClick={()=>changeTarget(next)}>✎</button>:null;
  const paperEditing:CustomerPreviewEditing|undefined=editing?{
    areaTitle,
    areaPrice:section=>priceButton({kind:'area',id:section.id},'Edit Area price '+section.title),
    linePrice:line=>line.pricingMode!=='none'
      ?priceButton({kind:'line',id:line.id},'Edit line price '+line.description):null,
    generalPrice:()=>priceButton({kind:'general',id:'general'},'Edit General price'),
  }:undefined;
  const candidateLines=target?quote.lines.filter(line=>
    (target.kind==='line'?line.id===target.id:target.kind==='area'?line.sectionId===target.id:
      !line.sectionId||!quote.sections.some(s=>s.id===line.sectionId))&&
    line.includeInTotal&&line.pricingMode!=='none'):[];
  const selected=candidateLines.find(line=>line.id===selectedLineId)??candidateLines[0];
  const activeSection=target?.kind==='area'?quote.sections.find(s=>s.id===target.id):null;
  const title=target?.kind==='area'?activeSection?.title||'Area charges':
    target?.kind==='general'?'General':selected?.description||'Line price';
  return <div className="qmb-editable-preview">
    <div className="qmb-preview-seller-toolbar">
      <div className="qmb-preview-view-label"><strong>Customer document</strong>
        {editing&&<small>Live quote editing</small>}</div>
      <div className="qmb-preview-action-group">
        {onReturnToReview&&<button type="button" className="qmb-preview-back-review"
          onClick={onReturnToReview} aria-label="Back to Review">‹ Back to Review</button>}
        <div className="qmb-preview-device-toggle" role="group" aria-label="Customer preview device">
          <button type="button" aria-label="Desktop quote preview" aria-pressed={device==='desktop'}
            onClick={()=>setDevice('desktop')}>▣ Desktop</button>
          <button type="button" aria-label="Phone quote preview" aria-pressed={device==='phone'}
            onClick={()=>setDevice('phone')}>▯ Phone</button>
        </div>
        {editable&&<button type="button" aria-pressed={editing} onClick={()=>{
          setEditing(current=>!current);setTarget(null);setNameId(null);
        }}>{editing?'✓ Done editing':'✎ Make edits'}</button>}
      </div>
    </div>
    <QuoteBetaCustomerOptions quote={quote}/>
    <div className={'qmb-preview'+(editing?' is-live-editing':'')+(device==='phone'?' is-phone-view':'')}>
      <CustomerPreview quote={quote} editing={paperEditing}/>
    </div>
    {target&&editing&&<div className="qmb-preview-edit-backdrop"
      onPointerDown={e=>{if(e.target===e.currentTarget)setTarget(null);}}>
      <section role="dialog" aria-modal="true" aria-label="Edit quote price from preview" className="qmb-preview-edit-dialog">
        <header className="qmb-preview-edit-head">
          <div><strong>Price · {title}</strong><small>Changes update the actual quote, not just its preview.</small></div>
          <button type="button" aria-label="Close preview price editor" onClick={()=>setTarget(null)}>×</button>
        </header>
        <div className="qmb-preview-edit-body">
          {target.kind!=='line'&&<div className="qmb-preview-context-total">
            <small>{title} total</small>
            <strong>{money.format(quoteLinesTotal(candidateLines))}</strong>
          </div>}
          {target.kind!=='line'&&candidateLines.length>1&&<label className="qmb-preview-money-field">Charge to edit
            <select aria-label="Preview charge to edit" value={selected?.id??''}
              onChange={e=>setSelectedLineId(e.target.value)}>
              {candidateLines.map(line=><option key={line.id} value={line.id}>
                {line.description||'Untitled line'} · {money.format(quoteLineAmount(line))}
              </option>)}
            </select>
          </label>}
          {selected?<QuotePreviewPriceForm key={selected.id} quote={quote} line={selected}/>:
            <p className="qmb-help">There are no priced lines in this Area. Add a charge from Build to set a price.</p>}
          <div className="qmb-preview-quote-total">Quote total <strong>{money.format(quoteTotal(quote))}</strong></div>
        </div>
        <footer className="qmb-preview-edit-foot"><button className="qmb-primary" type="button"
          onClick={()=>setTarget(null)}>Done</button></footer>
      </section>
    </div>}
  </div>;
}
