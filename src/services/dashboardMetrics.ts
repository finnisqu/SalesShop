import type { Project, ProjectStage } from '../types/crm';
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
): DashboardMetrics {
  const sentQuotes = quotes.filter(quoteHasBeenSent);
  const signedQuoteIds = new Set(signatures.map((signature) => signature.quoteId));
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
  const pendingSignatures = quotes
    .filter((quote) => (quote.status === 'Sent' || quote.status === 'Viewed') && !signedQuoteIds.has(quote.id))
    .sort((a, b) => (b.sentAt ?? b.updatedAt).localeCompare(a.sentAt ?? a.updatedAt));

  const recentSignatures = [...signatures]
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))
    .slice(0, 6);

  return {
    quotesSent: sentQuotes.length,
    signaturesReceived,
    closeRate: sentQuotes.length ? signedQuoteIds.size / sentQuotes.length : 0,
    openPipeline,
    acceptedValue,
    pendingSignatures,
    pipelineByStage,
    recentSignatures,
  };
}
