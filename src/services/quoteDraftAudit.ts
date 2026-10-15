import type {Quote,QuoteSection} from '../types/quote';
import {quoteLinesTotal,quoteTotal} from '../types/quote';
import {totalBillableTakeoffSf} from './quoteTakeoffsLite';

/** Drafting is always free-form. These findings are evaluated only at Review/Issue. */
export type QuoteAuditSeverity='blocker'|'review'|'optional';
export type QuoteAuditDestination=
  |{view:'details'|'preview'|'build'}
  |{view:'area';areaId:string;tab:'measure'|'materials'|'pricing'};

export interface QuoteAuditFinding {
  id:string;
  severity:QuoteAuditSeverity;
  title:string;
  detail:string;
  destination:QuoteAuditDestination;
}
export interface QuoteAuditReport {
  findings:QuoteAuditFinding[];
  blockers:QuoteAuditFinding[];
  review:QuoteAuditFinding[];
  optional:QuoteAuditFinding[];
  pricedLineCount:number;
  total:number;
}

const isValidPrice=(value:number|undefined)=>value!==undefined&&Number.isFinite(value)&&value>=0;
const sectionName=(section:QuoteSection)=>
  section.title.trim().toLowerCase()==='general takeoffs'?'General':section.title.trim()||'Unnamed Area';

export function auditQuoteDraft(quote:Quote):QuoteAuditReport {
  const issues:QuoteAuditFinding[]=[];
  const add=(id:string,severity:QuoteAuditSeverity,title:string,detail:string,destination:QuoteAuditDestination)=>{
    issues.push({id,severity,title,detail,destination});
  };
  const priced=quote.lines.filter(l=>l.includeInTotal&&l.pricingMode!=='none');
  const total=quoteTotal(quote);
  if(!priced.length){
    add('quote:work','blocker','No priced work yet',
      'Add a priced Area or charge before issuing. You can keep this quote as a draft.',
      {view:'build'});
  } else if(total<=0){
    add('quote:total','blocker','Quote total is not positive',
      'Review discounts, quantities and selling prices before issuing this quote.',
      {view:'build'});
  }
  if(!quote.companyName?.trim()&&!quote.contactName?.trim()){
    add('quote:customer','review','Customer not selected',
      'Identify the customer before sending, or acknowledge that this is intentional.',
      {view:'details'});
  }
  if(!quote.contactEmail?.trim()){
    add('quote:email','optional','Contact email not provided',
      'An email is useful for delivery, but a customer link can be shared separately.',
      {view:'details'});
  }
  if(!quote.title.trim()||quote.title.trim().toLowerCase()==='untitled quote'){
    add('quote:title','optional','Quote title is still generic',
      'A project name helps the customer recognize the proposal.',
      {view:'details'});
  }
  for(const line of quote.lines){
    if(!line.includeInTotal||line.pricingMode==='none')continue;
    const where:QuoteAuditDestination=line.sectionId&&quote.sections.some(s=>s.id===line.sectionId)
      ?{view:'area',areaId:line.sectionId,tab:'pricing'}:{view:'build'};
    const title=line.description.trim()||'Unnamed charge';
    const takeoffSink=line.takeoffSinkId
      ?quote.sections.find(s=>s.id===line.sectionId)?.scope?.takeoffSinks
        ?.find(sink=>sink.id===line.takeoffSinkId&&sink.includeInPricing)
      :undefined;
    // A takeoff-owned sink has its own actionable selling-price finding below.
    // Avoid reporting the same missing/free price twice when snapshots agree.
    const sinkPriceCovered=!!takeoffSink&&takeoffSink.unitPrice===line.rate;
    if(line.pricingMode==='quantity-rate'){
      if(!isValidPrice(line.rate)&&!sinkPriceCovered){
        add('line:'+line.id+':rate','blocker','Missing sell rate: '+title,
          'This charge has no valid selling rate and is not fully priced.',where);
      } else if(line.rate===0&&(line.quantity??0)>0&&!sinkPriceCovered){
        add('line:'+line.id+':zero','review','Zero-price charge: '+title,
          'This item is included at $0. Confirm it is intentionally complimentary.',where);
      }
      if(!Number.isFinite(line.quantity??NaN)||(line.quantity??0)<=0){
        // An included material or sink with no billable units cannot be silently
        // approved as a $0 portion of a larger positive quote.
        add('line:'+line.id+':quantity',
          line.kind==='material'||line.kind==='sink'?'blocker':'review',
          'Zero or missing charge quantity: '+title,
          'The charge currently contributes nothing to the quote total.',
          line.quantitySource?.syncMode==='live'&&line.sectionId
            ?{view:'area',areaId:line.sectionId,tab:'measure'}:where);
      }
    }else if(line.pricingMode==='direct'||line.pricingMode==='slab-multiplier'){
      // Quote math normalizes discounts to -abs(amount); existing quotes can
      // store -$100 or +$100 for the same valid discount. Ordinary charges
      // must remain nonnegative, and all amounts must be finite.
      const amountValid=line.kind==='discount'
        ?line.amount!==undefined&&Number.isFinite(line.amount)
        :isValidPrice(line.amount);
      if(!amountValid){
        add('line:'+line.id+':amount','blocker','Missing amount: '+title,
          'This charge has no valid selling amount.',where);
      }else if(line.amount===0&&line.kind!=='discount'){
        add('line:'+line.id+':zero','review','Zero-price charge: '+title,
          'Confirm this charge is intentionally complimentary, not an unfinished price.',where);
      }
    }
  }
  for(const section of quote.sections){
    const label=sectionName(section);
    const pieces=section.scope?.takeoffPieces??[];
    const sinks=section.scope?.takeoffSinks??[];
    const lines=quote.lines.filter(line=>line.sectionId===section.id);
    const amount=quoteLinesTotal(lines);
    if(!section.customerVisible&&Math.abs(amount)>0.005){
      add('area:'+section.id+':visibility','review',label+' is hidden from the customer',
        'Its charges remain in the total. Confirm that hiding the entire Area is intentional.',
        {view:'area',areaId:section.id,tab:'pricing'});
    }
    if(section.customerDisplayMode==='detail'&&lines.some(l=>l.includeInTotal&&l.pricingMode!=='none')
        &&!lines.some(l=>l.includeInTotal&&l.customerVisible&&l.pricingMode!=='none')){
      add('area:'+section.id+':breakout','review',label+' has no visible priced line',
        'Itemized presentation will combine these charges as included work. Check the customer preview.',
        {view:'area',areaId:section.id,tab:'pricing'});
    }
    if(pieces.length){
      const areaSf=totalBillableTakeoffSf(pieces);
      if(!section.scope?.takeoffMaterial?.trim()&&areaSf>0){
        add('area:'+section.id+':material','review','Material not selected: '+label,
          'Measurements are present, but the Area has no material description.',
          {view:'area',areaId:section.id,tab:'materials'});
      }
      for(const [i,piece] of pieces.entries()){
        const pieceName=piece.name?.trim()||'Piece '+(i+1);
        if(piece.count===0){
          add('piece:'+piece.id+':zero','review',label+' · '+pieceName+' has quantity 0',
            'This piece contributes 0 SF. Keep it as an intentional placeholder or update its quantity.',
            {view:'area',areaId:section.id,tab:'measure'});
        }
        if(!Number.isFinite(piece.lengthIn??NaN)||!Number.isFinite(piece.widthIn??NaN)
          ||(piece.lengthIn??0)<=0||(piece.widthIn??0)<=0){
          add('piece:'+piece.id+':dimensions','review',label+' · '+pieceName+' has unfinished dimensions',
            'Length and width are needed for a measured price. Leave blank intentionally only if excluded.',
            {view:'area',areaId:section.id,tab:'measure'});
        }
      }
    }
    for(const [i,sink] of sinks.entries()){
      // Older, specification-only sink selections do not create a billable line.
      if(!sink.includeInPricing)continue;
      const name=sink.name.trim()||'Sink '+(i+1);
      // A blank price on a selected sink must never be mistaken for a free sink.
      if(!isValidPrice(sink.unitPrice)){
        add('sink:'+sink.id+':price','blocker',label+' · '+name+' needs a selling price',
          'Every selected sink belongs in the quote total. Enter $0 explicitly if complimentary.',
          {view:'area',areaId:section.id,tab:'materials'});
      }else if(sink.unitPrice===0){
        add('sink:'+sink.id+':complimentary','review',label+' · '+name+' is priced at $0',
          'Confirm that this sink is intentionally included at no charge.',
          {view:'area',areaId:section.id,tab:'materials'});
      }
    }
  }
  return {findings:issues,blockers:issues.filter(f=>f.severity==='blocker'),
    review:issues.filter(f=>f.severity==='review'),
    optional:issues.filter(f=>f.severity==='optional'),
    pricedLineCount:priced.length,total};
}

/** Shared safety gate for any path issuing a quote: Beta, Classic, or customer links.
 * Non-quote pricing schedules use their existing dedicated validator.
 * Optional and acknowledged review findings never prevent draft editing. */
export function assertQuoteHasNoPricingBlockers(quote:Quote):void {
  if(quote.documentType==='pricing-schedule')return;
  const blockers=auditQuoteDraft(quote).blockers;
  if(!blockers.length)return;
  throw new Error('Cannot issue quote: '+blockers.slice(0,3).map(item=>item.title).join('; ')+
    (blockers.length>3?' (and '+(blockers.length-3)+' more)':'')+
    '. Open Review to resolve pricing.');
}
