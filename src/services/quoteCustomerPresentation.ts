import type { QuoteLine, QuoteSection } from '../types/quote';
import { quoteLineAmount, quoteLinesTotal, roundCurrency } from '../types/quote';

/** A presentation-only row; the underlying quote lines and prices are never changed. */
export interface PresentedQuoteLine {
  id: string;
  kind: QuoteLine['kind'];
  description: string;
  /** Original line for its unaggregated quantity/rate, if applicable. */
  source?: QuoteLine;
  amount: number;
  aggregated: boolean;
  priced: boolean;
}

/** The historical General takeoff is a normal Area internally, but has no heading on customer documents. */
export function isGeneralTakeoffSection(section: Pick<QuoteSection,'title'>): boolean {
  return section.title.trim().toLowerCase()==='general takeoffs';
}

/**
 * Hidden billable line amounts roll into the first visible countertop/material
 * charge in the same Area. The seller's quote total is never recalculated here.
 * For an Area without a visible priced host, show one anonymous Included work row.
 * Hidden descriptions and internal prices are not exposed as separate entries.
 */
export function presentItemizedQuoteLines(lines: QuoteLine[]): PresentedQuoteLine[] {
  const visible=lines.filter(line=>line.customerVisible);
  const hiddenTotal=quoteLinesTotal(lines.filter(line=>!line.customerVisible));
  const candidates=visible.filter(line=>line.includeInTotal&&line.pricingMode!=='none');
  const host=candidates.find(line=>line.kind==='material'||line.kind==='item')
    ??candidates[0];
  const rows:PresentedQuoteLine[]=visible.map(line=>{
    const merged=Boolean(host&&line.id===host.id&&hiddenTotal!==0);
    return {
      id:line.id,kind:line.kind,description:line.description,
      source:line,amount:roundCurrency(quoteLineAmount(line)+(merged?hiddenTotal:0)),
      aggregated:merged,priced:line.pricingMode!=='none',
    };
  });
  if(hiddenTotal!==0&&!host)rows.push({
    id:'included-work-'+(lines[0]?.sectionId??'general'),
    kind:'item',description:'Included work',
    amount:hiddenTotal,aggregated:true,priced:true,
  });
  return rows;
}

/** General summary is one ordinary, description-led charge, not "General takeoffs". */
export function presentGeneralSummary(lines:QuoteLine[]): PresentedQuoteLine[] {
  const charge=lines.find(line=>line.customerVisible&&line.includeInTotal&&
    (line.kind==='material'||line.kind==='item'))
    ??lines.find(line=>line.customerVisible&&line.includeInTotal&&line.pricingMode!=='none');
  const total=quoteLinesTotal(lines);
  if(!lines.length)return [];
  return [{
    id:'general-summary',kind:'item',
    description:charge?.description?.trim()||'Countertops & included work',
    amount:total,aggregated:true,priced:true,
  }];
}
