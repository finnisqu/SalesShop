import type { Quote } from '../types/quote';
import { auditQuoteDraft, type QuoteAuditReport } from './quoteDraftAudit';
import { isGeneralTakeoffSection } from './quoteCustomerPresentation';

export type QuoteBuilderStageId = 'details' | 'areas' | 'pricing' | 'review';
export type QuoteBuilderStageState = 'done' | 'attention' | 'pending';
export interface QuoteBuilderStage {
  id: QuoteBuilderStageId;
  label: string;
  status: string;
  state: QuoteBuilderStageState;
}

/** This is presentation guidance, not an issuing gate or a required checklist.
 * For a flat-fee quote the Areas stage can remain optional. The existing
 * quote audit remains the only source of blocking price findings. */
export function quoteBuilderProgress(quote: Quote, report: QuoteAuditReport = auditQuoteDraft(quote)): {
  stages: QuoteBuilderStage[];
  readyCount: number;
  areas: Quote['sections'];
} {
  const areas = quote.sections.filter(section => !isGeneralTakeoffSection(section));
  const hasCustomer = Boolean(quote.companyName?.trim() || quote.contactName?.trim());
  const hasJobContext = Boolean(quote.projectId?.trim() || quote.address?.trim());
  const hasGeneralWork = quote.lines.some(line =>
    !line.sectionId || !areas.some(area => area.id === line.sectionId));
  const hasWork = report.pricedLineCount > 0;
  const issued = ['Sent', 'Viewed', 'Signed', 'Declined', 'Expired'].includes(quote.status);
  const blockers = report.blockers.length;
  const stages: QuoteBuilderStage[] = [
    {
      id: 'details', label: 'Project details',
      status: hasCustomer ? 'Customer added' : hasJobContext ? 'Job details added' : 'Optional',
      state: hasCustomer || hasJobContext ? 'done' : 'pending',
    },
    {
      id: 'areas', label: 'Areas',
      status: areas.length ? areas.length + (areas.length === 1 ? ' Area' : ' Areas')
        : hasGeneralWork ? 'General scope' : 'Optional',
      state: areas.length || hasGeneralWork ? 'done' : 'pending',
    },
    {
      id: 'pricing', label: 'Materials & pricing',
      status: !hasWork ? 'Add priced work' : blockers
        ? blockers + (blockers === 1 ? ' issue' : ' issues') : 'Ready to review',
      state: blockers && hasWork ? 'attention' : hasWork ? 'done' : 'pending',
    },
    {
      id: 'review', label: 'Review',
      status: quote.status === 'Signed' ? 'Signed' : issued ? 'Issued' : 'Not reviewed',
      state: issued ? 'done' : 'pending',
    },
  ];
  return { stages, readyCount: stages.filter(stage => stage.state === 'done').length, areas };
}
