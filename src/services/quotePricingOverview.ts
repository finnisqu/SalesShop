import type { Quote, QuoteSection } from '../types/quote';
import { quoteLinesTotal } from '../types/quote';
import { auditQuoteDraft, type QuoteAuditReport } from './quoteDraftAudit';
import { isGeneralTakeoffSection } from './quoteCustomerPresentation';
import { totalBillableTakeoffSf } from './quoteTakeoffsLite';

export interface PricingAreaRow {
  section: QuoteSection;
  measuredSf: number;
  material: string;
  amount: number;
  sinkCount: number;
  blockers: number;
  reviewItems: number;
}

/** Presentation-only model; the shared audit and quote price engine own truth. */
export function quotePricingOverview(quote: Quote, report: QuoteAuditReport = auditQuoteDraft(quote)) {
  const areas = quote.sections.filter(section => !isGeneralTakeoffSection(section));
  const areaIds = new Set(areas.map(s => s.id));
  // Index line ownership and audit destinations once. Earlier rendering
  // filtered every line and finding again for EACH Area (O(A × (L + F))).
  // Keep the same quoteLinesTotal function to preserve exact billing math.
  const areaLines=new Map<string,typeof quote.lines>();
  const generalLines:typeof quote.lines=[];
  for(const line of quote.lines){
    if(line.sectionId&&areaIds.has(line.sectionId)){
      const lines=areaLines.get(line.sectionId);
      if(lines)lines.push(line);
      else areaLines.set(line.sectionId,[line]);
    }else generalLines.push(line);
  }
  const countAreaFindings=(findings:typeof report.blockers)=>{
    const counts=new Map<string,number>();
    for(const finding of findings){
      const target=finding.destination;
      if(target.view!=='area'||!target.areaId)continue;
      counts.set(target.areaId,(counts.get(target.areaId)??0)+1);
    }
    return counts;
  };
  const blockerCounts=countAreaFindings(report.blockers);
  const reviewCounts=countAreaFindings(report.review);
  const rows: PricingAreaRow[] = areas.map(section => ({
    section,
    measuredSf: totalBillableTakeoffSf(section.scope?.takeoffPieces ?? []),
    material: section.scope?.takeoffMaterial?.trim() || 'Material not selected',
    amount: quoteLinesTotal(areaLines.get(section.id)??[]),
    sinkCount: (section.scope?.takeoffSinks ?? []).reduce((n,s) => n + s.count, 0),
    blockers: blockerCounts.get(section.id)??0,
    reviewItems: reviewCounts.get(section.id)??0,
  }));
  return {
    rows,
    generalAmount: quoteLinesTotal(generalLines),
    generalLineCount: generalLines.length,
    blockers: report.blockers,
    reviewItems: report.review,
  };
}
