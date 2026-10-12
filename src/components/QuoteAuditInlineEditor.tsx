import {useEffect,useState,type FormEvent} from 'react';
import type {Quote,QuoteTakeoffPiece} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {useCrmStore} from '../store/crmStore';
import {parseInches} from '../services/quoteTakeoffsLite';
import {TakeoffMaterialCatalog} from './TakeoffCatalogPickers';
import {QuoteSfRateChoices} from './QuoteSfRateChoices';
import type {QuoteAuditDestination,QuoteAuditFinding} from '../services/quoteDraftAudit';

export type AuditQuickFix=
  |{kind:'customer'|'email'|'title'}
  |{kind:'line';id:string;field:'rate'|'amount'|'quantity'}
  |{kind:'sink';id:string}
  |{kind:'piece';id:string;field:'zero'|'dimensions'}
  |{kind:'material'|'visibility'|'breakout';areaId:string};

/** An explicit model separate from labels, so presentation text can change safely. */
export function quickFixForFinding(finding:QuoteAuditFinding):AuditQuickFix|undefined {
  if(finding.id==='quote:customer')return {kind:'customer'};
  if(finding.id==='quote:email')return {kind:'email'};
  if(finding.id==='quote:title')return {kind:'title'};
  const [prefix,id,field]=finding.id.split(':');
  if(prefix==='line'&&['rate','amount','quantity','zero'].includes(field))
    return {kind:'line',id,field:field==='zero'?'rate':field as 'rate'|'amount'|'quantity'};
  if(prefix==='sink'&&['price','complimentary'].includes(field))return {kind:'sink',id};
  if(prefix==='piece'&&(field==='zero'||field==='dimensions'))return {kind:'piece',id,field};
  if(prefix==='area'&&['material','visibility','breakout'].includes(field))
    return {kind:field as 'material'|'visibility'|'breakout',areaId:id};
  return undefined;
}

const toNumber=(s:string,min:number):number|undefined=>{
  if(!s.trim())return undefined;
  const n=Number(s);
  return Number.isFinite(n)&&n>=min?n:undefined;
};

export function QuoteAuditInlineEditor({quote,finding,onClose,onGoTo}:{
  quote:Quote;finding:QuoteAuditFinding;onClose:()=>void;
  onGoTo:(destination:QuoteAuditDestination)=>void;
}) {
  const fix=quickFixForFinding(finding);
  const updateQuote=useQuoteStore(s=>s.updateQuote);
  const crmCompanies=useCrmStore(s=>s.companies);
  const updateLine=useQuoteStore(s=>s.updateLine);
  const updateSinks=useQuoteStore(s=>s.updateTakeoffSinks);
  const updatePieces=useQuoteStore(s=>s.updateTakeoffPieces);
  const updateSection=useQuoteStore(s=>s.updateSection);
  const selectMaterial=useQuoteStore(s=>s.selectTakeoffMaterial);
  const areaId=fix&&'areaId' in fix?fix.areaId:
    finding.destination.view==='area'?finding.destination.areaId:undefined;
  const section=quote.sections.find(s=>s.id===areaId);
  const line=fix?.kind==='line'?quote.lines.find(l=>l.id===fix.id):undefined;
  const owner=fix?.kind==='sink'||fix?.kind==='piece'
    ?quote.sections.find(s=>(fix.kind==='sink'
      ?s.scope?.takeoffSinks?.some(x=>x.id===fix.id)
      :s.scope?.takeoffPieces?.some(x=>x.id===fix.id))):undefined;
  const sink=fix?.kind==='sink'?owner?.scope?.takeoffSinks?.find(x=>x.id===fix.id):undefined;
  const piece=fix?.kind==='piece'?owner?.scope?.takeoffPieces?.find(x=>x.id===fix.id):undefined;

  const [main,setMain]=useState(
    fix?.kind==='customer'?quote.companyName??'':
    fix?.kind==='email'?quote.contactEmail??'':
    fix?.kind==='title'?quote.title==='Untitled quote'?'':quote.title:
    fix?.kind==='line'?String(fix.field==='amount'?line?.amount??'':fix.field==='quantity'?line?.quantity??'':line?.rate??''):
    fix?.kind==='sink'?String(sink?.unitPrice??''):
    fix?.kind==='piece'?String(piece?.count??0):'');
  const [secondary,setSecondary]=useState(fix?.kind==='customer'?quote.contactName??'':String(piece?.lengthIn??''));
  const [tertiary,setTertiary]=useState(String(piece?.widthIn??''));
  const [materialDraft,setMaterialDraft]=useState(section?.scope?.takeoffMaterial??'');
  const [rateOptionsOpen,setRateOptionsOpen]=useState(false);
  const [error,setError]=useState('');
  const crmMatches=fix?.kind==='customer'&&main.trim().length>=2
    ?crmCompanies.filter(company=>company.name.toLowerCase().includes(main.trim().toLowerCase())
      ||company.aliases?.some(alias=>alias.toLowerCase().includes(main.trim().toLowerCase()))).slice(0,5)
    :[];
  // Remount by finding ID when a different issue is opened; don't reset a
  // partially typed draft on unrelated quote-store updates.
  useEffect(()=>setError(''),[finding.id]);

  const save=(event:FormEvent)=>{
    event.preventDefault();
    if(!fix)return;
    if(fix.kind==='customer'){
      if(!main.trim()&&!secondary.trim()){setError('Enter a customer or contact name.');return;}
      updateQuote(quote.id,{
        companyName:main.trim(),companyId:main.trim()===quote.companyName?quote.companyId:undefined,
        projectId:main.trim()===quote.companyName?quote.projectId:undefined,
        contactName:secondary.trim(),
        contactId:secondary.trim()===quote.contactName?quote.contactId:undefined,
      });
    }else if(fix.kind==='email'){
      if(main.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(main.trim())){
        setError('Enter a valid email address, or leave it blank.');return;
      }
      updateQuote(quote.id,{contactEmail:main.trim()});
    }else if(fix.kind==='title'){
      if(!main.trim()){setError('Enter a project title.');return;}
      updateQuote(quote.id,{title:main.trim(),projectId:main.trim()===quote.title?quote.projectId:undefined});
    }else if(fix.kind==='line'){
      if(!line){setError('The quote line was removed.');return;}
      const n=toNumber(main,fix.field==='quantity'?0:0);
      if(n===undefined){setError('Enter a valid non-negative number.');return;}
      if(fix.field==='quantity')updateLine(quote.id,line.id,{quantity:n});
      else if(fix.field==='amount')updateLine(quote.id,line.id,{amount:n});
      else updateLine(quote.id,line.id,{rate:n,rateReference:undefined});
    }else if(fix.kind==='sink'){
      if(!sink||!owner){setError('Sink is no longer on this quote.');return;}
      const n=toNumber(main,0);
      if(n===undefined){setError('Enter a selling price, or 0 for a complimentary sink.');return;}
      const latest=useQuoteStore.getState().quotes.find(q=>q.id===quote.id)
        ?.sections.find(s=>s.id===owner.id)?.scope?.takeoffSinks??[];
      updateSinks(quote.id,owner.id,latest.map(s=>s.id===sink.id?{...s,unitPrice:n}:s));
    }else if(fix.kind==='piece'){
      if(!piece||!owner){setError('Piece is no longer on this quote.');return;}
      let patch:Partial<QuoteTakeoffPiece>;
      if(fix.field==='zero'){
        const n=toNumber(main,0);
        if(n===undefined||!Number.isInteger(n)||n>1000){
          setError('Quantity must be a whole number from 0 to 1000.');return;
        }
        patch={count:n};
      }else{
        const l=parseInches(secondary),w=parseInches(tertiary);
        if(l===undefined||w===undefined||l<=0||w<=0){
          setError('Enter positive lengths and widths (fractions are accepted).');return;
        }
        patch={lengthIn:l,widthIn:w};
      }
      const latest=useQuoteStore.getState().quotes.find(q=>q.id===quote.id)
        ?.sections.find(s=>s.id===owner.id)?.scope?.takeoffPieces??[];
      updatePieces(quote.id,owner.id,latest.map(p=>p.id===piece.id?{...p,...patch}:p));
    }else if(fix.kind==='visibility'||fix.kind==='breakout'){
      if(!section){setError('This Area no longer exists.');return;}
      if(fix.kind==='visibility')updateSection(quote.id,section.id,{customerVisible:true});
      else updateSection(quote.id,section.id,{customerDisplayMode:'summary'});
    }
    onClose();
  };

  if(!fix)return null;
  const nonForm=fix.kind==='material';
  return <div className="qmb-audit-inline" role="region" aria-label={'Resolve '+finding.title}>
    {nonForm&&section?<>
      <label className="qmb-audit-input-label">Choose material or type a custom name</label>
      <TakeoffMaterialCatalog disabled={false} value={materialDraft}
        selected={section.scope?.takeoffMaterialReference} pinned={quote.projectMaterials??[]}
        onTextChange={setMaterialDraft}
        onSelect={(ref,label)=>{selectMaterial(quote.id,section.id,label,ref);onClose();}}/>
      <div className="qmb-audit-inline-actions">
        <button type="button" className="qmb-primary" disabled={!materialDraft.trim()}
          onClick={()=>{selectMaterial(quote.id,section.id,materialDraft.trim());onClose();}}>Save</button>
        <button type="button" className="qmb-outline" onClick={()=>onGoTo(finding.destination)}>Full editor ›</button>
        <button type="button" className="qmb-quiet" onClick={onClose}>Cancel</button>
      </div>
    </>:<form onSubmit={save} noValidate>
      {fix.kind==='customer'?<>
        <label>Customer / company
          <input autoFocus value={main} maxLength={200} placeholder="Customer or builder name"
            onChange={e=>setMain(e.target.value)}/>
        </label>
        {crmMatches.length>0&&<div className="qmb-audit-crm-suggestions" aria-label="Matching CRM customers">
          <small>Existing CRM customers</small>
          {crmMatches.map(company=><button key={company.id} type="button"
            onClick={()=>{updateQuote(quote.id,{
              companyId:company.id,companyName:company.name,
              projectId:quote.companyId===company.id?quote.projectId:undefined,
            });onClose();}}>
            <span>{company.name}</span><small>Select ›</small>
          </button>)}
        </div>}
        <label>Contact name <small>(optional)</small>
          <input value={secondary} maxLength={200} placeholder="Contact person"
            onChange={e=>setSecondary(e.target.value)}/>
        </label>
      </>:fix.kind==='email'?<label>Contact email
        <input autoFocus type="email" value={main} placeholder="name@company.com"
          onChange={e=>setMain(e.target.value)}/>
      </label>:fix.kind==='title'?<label>Project / quote title
        <input autoFocus value={main} maxLength={300} onChange={e=>setMain(e.target.value)}/>
      </label>:fix.kind==='line'?<div className="qmb-audit-rate-fix">
        <label>{fix.field==='quantity'?'Quantity':fix.field==='amount'?'Line amount ($)':'Selling rate ($/SF)'}
          <input autoFocus type="number" inputMode="decimal" step={fix.field==='quantity'?'1':'.01'}
            min="0" value={main} onChange={e=>setMain(e.target.value)}/>
        </label>
        {fix.field==='rate'&&line?.kind==='material'&&<div className="qmb-audit-rate-chooser">
          <button type="button" className="qmb-outline qmb-audit-rate-toggle"
            aria-label="Choose from Rates in Review" aria-expanded={rateOptionsOpen}
            onClick={()=>setRateOptionsOpen(open=>!open)}>
            Choose from Rates {rateOptionsOpen?'⌃':'▾'}
          </button>
          {rateOptionsOpen&&line&&<div className="qmb-audit-rate-panel">
            <QuoteSfRateChoices division={quote.pricingDivision}
              selectedRateId={line.rateReference?.rateBookItemId}
              materialType={line.materialReference?.snapshot?.materialType}
              materialCostPerSf={line.materialReference?.sourceCostPerSf??line.materialReference?.snapshot?.costPerSf}
              onSelect={(price,ref)=>{
                updateLine(quote.id,line.id,{rate:price,rateReference:ref});
                setRateOptionsOpen(false);
                onClose();
              }}/>
          </div>}
        </div>}
      </div>
      :fix.kind==='sink'?<label>Sink selling price / each ($)
        <input autoFocus type="number" inputMode="decimal" step=".01" min="0"
          value={main} onChange={e=>setMain(e.target.value)}/>
        <small>Includes this sink in the quote regardless of customer itemization.</small>
      </label>:fix.kind==='piece'&&fix.field==='zero'?<label>Piece quantity
        <input autoFocus type="number" inputMode="numeric" step="1" min="0" max="1000"
          value={main} onChange={e=>setMain(e.target.value)}/>
      </label>:fix.kind==='piece'?<div className="qmb-audit-inline-pair">
        <label>Length (in)
          <input autoFocus inputMode="decimal" value={secondary} placeholder="e.g. 73 1/2"
            onChange={e=>setSecondary(e.target.value)}/>
        </label>
        <label>Width (in)
          <input inputMode="decimal" value={tertiary} placeholder="e.g. 25 1/2"
            onChange={e=>setTertiary(e.target.value)}/>
        </label>
      </div>:fix.kind==='visibility'?<p>Show this Area on the customer's quote. Its charges are already in the total.</p>
        :fix.kind==='breakout'?<p>Switch this Area to one lump sum. All underlying priced work stays included.</p>:null}
      {error&&<small className="qmb-audit-input-error" role="alert">{error}</small>}
      <div className="qmb-audit-inline-actions">
        <button type="button" className="qmb-quiet" onClick={onClose}>Cancel</button>
        <button type="submit" className="qmb-primary">{fix.kind==='visibility'?'Show Area':fix.kind==='breakout'?'Use lump sum':'Save'}</button>
        <button type="button" className="qmb-outline" onClick={()=>onGoTo(finding.destination)}>Full editor ›</button>
      </div>
    </form>}
  </div>;
}
