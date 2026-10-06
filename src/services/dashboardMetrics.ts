import type { Activity, Project, ProjectStage } from '../types/crm';
import type { Quote } from '../types/quote';
import type { SignatureRecord } from '../types/signature';

export const OPEN_PIPELINE_STAGES = [
  'Discovery',
  'Intent to Bid',
  'Bid Development',
  'Bid Sent',
  'Negotiation',
] as const satisfies readonly ProjectStage[];

export interface PipelineStageMetric {
  stage: ProjectStage;
  projectCount: number;
  value: number;
}

export interface DashboardMetrics {
  quotesSent: number;
  signaturesReceived: number;
  closeRate: number;
  openPipeline: number;
  acceptedValue: number;
  pendingSignatures: Quote[];
  pipelineByStage: PipelineStageMetric[];
  recentSignatures: SignatureRecord[];
}

export function quoteHasBeenSent(quote: Quote) {
  return Boolean(quote.sentAt || quote.history.length);
}

export function buildDashboardMetrics(
  quotes: Quote[],
  signatures: SignatureRecord[],
  projects: Project[],
  activities: Activity[],
): DashboardMetrics {
  // Change Orders are modifications to business already won. They can require
  // signatures and contribute accepted value, but they must not inflate the
  // number of new Quotes sent or the sales close-rate denominator/numerator.
  const salesDocuments = quotes.filter((quote) => quote.documentType !== 'change-order');
  const salesDocumentIds = new Set(salesDocuments.map((quote) => quote.id));

  const sentQuoteIds = new Set<string>();
  activities.forEach((activity) => {
    if (activity.type === 'quote-sent' && activity.quoteId) sentQuoteIds.add(activity.quoteId);
  });
  salesDocuments.filter(quoteHasBeenSent).forEach((quote) => sentQuoteIds.add(quote.id));

  const signedQuoteIds = new Set(
    signatures
      .filter((signature) => {
        if (salesDocumentIds.has(signature.quoteId)) return true;
        return signature.acceptedSnapshot.documentType !== 'change-order';
      })
      .map((signature) => signature.quoteId),
  );
  const signedSentQuotes = [...signedQuoteIds].filter((quoteId) => sentQuoteIds.has(quoteId)).length;

  // These two metrics intentionally include COs: they answer how many customer
  // commitments were signed and the total value represented by those signatures.
  const signaturesReceived = signatures.length;
  const acceptedValue = signatures.reduce((sum, signature) => sum + signature.acceptedSnapshot.acceptedTotal, 0);

  const pipelineByStage = OPEN_PIPELINE_STAGES.map((stage) => {
    const stageProjects = projects.filter((project) => project.stage === stage);
    return {
      stage,
      projectCount: stageProjects.length,
      value: stageProjects.reduce((sum, project) => sum + (project.amount ?? 0), 0),
    };
  });

  const openPipeline = pipelineByStage.reduce((sum, stage) => sum + stage.value, 0);
  const allSignedDocumentIds = new Set(signatures.map((signature) => signature.quoteId));
  const pendingSignatures = quotes
    .filter((quote) => (quote.status === 'Sent' || quote.status === 'Viewed') && !allSignedDocumentIds.has(quote.id))
    .sort((a, b) => (b.sentAt ?? b.updatedAt).localeCompare(a.sentAt ?? a.updatedAt));

  const recentSignatures = [...signatures]
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))
    .slice(0, 6);

  return {
    quotesSent: sentQuoteIds.size,
    signaturesReceived,
    closeRate: sentQuoteIds.size ? signedSentQuotes / sentQuoteIds.size : 0,
    openPipeline,
    acceptedValue,
    pendingSignatures,
    pipelineByStage,
    recentSignatures,
  };
}
