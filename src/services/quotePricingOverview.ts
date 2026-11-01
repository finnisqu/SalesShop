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
  const rows: PricingAreaRow[] = areas.map(section => ({
    section,
    measuredSf: totalBillableTakeoffSf(section.scope?.takeoffPieces ?? []),
    material: section.scope?.takeoffMaterial?.trim() || 'Material not selected',
    amount: quoteLinesTotal(quote.lines.filter(l => l.sectionId === section.id)),
    sinkCount: (section.scope?.takeoffSinks ?? []).reduce((n,s) => n + s.count, 0),
    blockers: report.blockers.filter(f => f.destination.view === 'area' && f.destination.areaId === section.id).length,
    reviewItems: report.review.filter(f => f.destination.view === 'area' && f.destination.areaId === section.id).length,
  }));
  const generalLines = quote.lines.filter(line => !line.sectionId || !areaIds.has(line.sectionId));
  return {
    rows,
    generalAmount: quoteLinesTotal(generalLines),
    generalLineCount: generalLines.length,
    blockers: report.blockers,
    reviewItems: report.review,
  };
}
