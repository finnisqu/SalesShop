/** Review-stage labels only: the canonical audit/approval services still gate issuing. */
export interface QuoteReviewJourneyInput {
  editable:boolean;issued:boolean;canIssue:boolean;needsRecheck:boolean;blockers:number;
  decisions:number;acknowledged:boolean;previewed:boolean;approved:boolean;
}
export type QuoteReviewNextKind='check'|'preview'|'delivery';
export function quoteReviewNextAction(s:QuoteReviewJourneyInput):{
  kind:QuoteReviewNextKind;label:string;description:string;
}{
  if(!s.editable)return s.issued
    ?{kind:'delivery',label:'Review revision and sharing',
      description:'This revision is frozen; sharing and delivery confirmation are separate.'}
    :{kind:'preview',label:'View read-only document',
      description:'This draft is not issued, and cannot be edited from Review.'};
  if(s.needsRecheck)return {kind:'check',label:'Recheck updated quote',
    description:'Amounts or scope changed since this review.'};
  if(s.blockers>0)return {kind:'check',label:'Resolve '+s.blockers+' pricing '+(s.blockers===1?'issue':'issues'),
    description:'Finish pricing before issuing; you can still edit the draft freely.'};
  if(s.decisions>0&&!s.acknowledged)return {kind:'check',label:'Review '+s.decisions+' remaining '+(s.decisions===1?'decision':'decisions'),
    description:'Resolve findings or acknowledge leaving these details as shown.'};
  if(!s.previewed)return {kind:'preview',label:'Preview customer copy',
    description:'Verify what the customer will see before approving.'};
  if(!s.approved)return {kind:'delivery',label:'Approve this draft',
    description:'Approve the exact version you previewed.'};
  if(!s.canIssue)return {kind:'delivery',label:'Review issuing permissions',
    description:'Your role cannot issue this quote. The draft stays saved.'};
  return {kind:'delivery',label:'Issue the approved revision',
    description:'Issuing freezes this version without creating a link or sending email.'};
}
