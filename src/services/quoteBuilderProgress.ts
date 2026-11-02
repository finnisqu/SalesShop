import type {Quote} from '../types/quote';
import {auditQuoteDraft,type QuoteAuditReport} from './quoteDraftAudit';
import {isGeneralTakeoffSection} from './quoteCustomerPresentation';

export type QuoteBuilderStageId='details'|'areas'|'pricing'|'review'|'contract';
export type QuoteBuilderStageState='done'|'attention'|'pending';
export interface QuoteBuilderStage{id:QuoteBuilderStageId;label:string;status:string;state:QuoteBuilderStageState;}
/** Five milestones are navigation guidance only. Contract issuing still uses
 * the canonical audit and approval gate; a green milestone does not issue. */
export function quoteBuilderProgress(quote:Quote,report:QuoteAuditReport=auditQuoteDraft(quote)):{
 stages:QuoteBuilderStage[];readyCount:number;areas:Quote['sections'];
}{
 const areas=quote.sections.filter(s=>!isGeneralTakeoffSection(s));
 const hasCustomer=Boolean(quote.companyName?.trim()||quote.contactName?.trim());
 const hasJobContext=Boolean(quote.projectId?.trim()||quote.address?.trim());
 const pieces=quote.sections.reduce((n,s)=>n+(s.scope?.takeoffPieces?.length??0),0);
 const hasGeneral=quote.lines.some(l=>!l.sectionId||!areas.some(a=>a.id===l.sectionId));
 const hasTakeoffs=pieces>0||hasGeneral;
 const hasPrices=report.pricedLineCount>0;
 const blockers=report.blockers.length;
 const issued=['Sent','Viewed','Signed','Declined','Expired'].includes(quote.status);
 const stages:QuoteBuilderStage[]=[
  {id:'details',label:'Project details',status:hasCustomer?'Customer added':hasJobContext?'Job details added':'Optional',
    state:hasCustomer||hasJobContext?'done':'pending'},
  {id:'areas',label:'Takeoffs',status:pieces?pieces+(pieces===1?' piece':' pieces'):
    areas.length?areas.length+(areas.length===1?' Area':' Areas'):hasGeneral?'General scope':'Optional',
    state:hasTakeoffs||areas.length>0?'done':'pending'},
  {id:'pricing',label:'Selections & pricing',status:!hasPrices?'Add priced work':
    blockers?blockers+(blockers===1?' issue':' issues'):'Prices entered',
    state:hasPrices?(blockers?'attention':'done'):'pending'},
  {id:'review',label:'Pricing review',status:!hasPrices?'Awaiting prices':
    blockers?blockers+(blockers===1?' issue':' issues'):'Ready for review',
    state:hasPrices?(blockers?'attention':'done'):'pending'},
  {id:'contract',label:'Contract review',status:quote.status==='Signed'?'Signed':
    issued?'Issued':'Not issued',state:issued?'done':'pending'},
 ];
 return {stages,readyCount:stages.filter(s=>s.state==='done').length,areas};
}
