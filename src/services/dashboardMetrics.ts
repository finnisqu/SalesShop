import { inferAccountHealth } from './accountHealth';
import { projectAttentionFlags, type ProjectAttentionKind } from './boardIntegrity';
import {
  companyEstimatedAnnualWork,
  type Activity,
  type Company,
  type Contact,
  type Project,
  type ProjectStage,
} from '../types/crm';
import type { Quote } from '../types/quote';
import type { SignatureRecord } from '../types/signature';

export const OPEN_PIPELINE_STAGES = [
  'Discovery',
  'Intent to Bid',
  'Bid Development',
  'Bid Sent',
  'Negotiation',
] as const satisfies readonly ProjectStage[];

const DAY = 86_400_000;
const PRIORITY_SCORE = { high: 3, medium: 2, low: 1 } as const;

export interface PipelineStageMetric {
  stage: ProjectStage;
  projectCount: number;
  value: number;
  medianAgeDays?: number;
  oldestAgeDays?: number;
}

export interface QuoteFunnelMetrics {
  drafts: number;
  sent: number;
  viewed: number;
  signed: number;
  viewRate: number;
  closeRate: number;
  medianDaysToView?: number;
  medianDaysToSign?: number;
}

export type DashboardAttentionPriority = 'high' | 'medium' | 'low';
export type DashboardAttentionKind = 'project' | 'quote' | 'account';

export interface DashboardAttentionItem {
  id: string;
  kind: DashboardAttentionKind;
  priority: DashboardAttentionPriority;
  title: string;
  detail: string;
  amount?: number;
  projectId?: string;
  quoteId?: string;
  companyId?: string;
  timestamp?: string;
}

export interface DashboardAccountOpportunity {
  companyId: string;
  name: string;
  expectedAnnualWork: number;
  stage: string;
  reason: string;
  lastActivityAt?: string;
  daysSinceActivity?: number;
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
  quoteFunnel: QuoteFunnelMetrics;
  attention: DashboardAttentionItem[];
  accountsNeedingLove: DashboardAccountOpportunity[];
  recentActivity: Activity[];
}

function asTime(value?: string) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ageDays(value: string | undefined, currentTime: number) {
  const time = asTime(value);
  if (time === undefined) return undefined;
  return Math.max(0, Math.floor((currentTime - time) / DAY));
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function signedSalesQuoteIds(signatures: SignatureRecord[]) {
  return new Set(
    signatures
      .filter((signature) => signature.acceptedSnapshot.documentType !== 'change-order')
      .map((signature) => signature.quoteId),
  );
}

function activityQuoteIds(activities: Activity[], type: Activity['type']) {
  return new Set(
    activities
      .filter((activity) => activity.type === type && activity.quoteId)
      .map((activity) => activity.quoteId as string),
  );
}

function salesDocuments(quotes: Quote[]) {
  return quotes.filter((quote) => quote.documentType !== 'change-order');
}

export function quoteHasBeenSent(quote: Quote) {
  return Boolean(quote.sentAt || quote.history.length);
}

function reachedSent(quote: Quote, sentActivityIds: Set<string>) {
  return quoteHasBeenSent(quote) || sentActivityIds.has(quote.id);
}

function reachedViewed(quote: Quote, viewedActivityIds: Set<string>, signedIds: Set<string>) {
  return Boolean(quote.viewedAt)
    || quote.status === 'Viewed'
    || quote.status === 'Signed'
    || viewedActivityIds.has(quote.id)
    || signedIds.has(quote.id);
}

function pipelineAge(project: Project, currentTime: number) {
  return ageDays(project.stageChangedAt ?? project.updatedAt ?? project.createdAt, currentTime);
}

function projectAttentionPriority(kinds: ProjectAttentionKind[]): DashboardAttentionPriority {
  if (kinds.includes('overdue')) return 'high';
  if (kinds.includes('awaiting-response') || kinds.includes('won-no-next-action')) return 'medium';
  if (kinds.includes('due-soon')) return 'medium';
  return 'low';
}

function buildProjectAttention(projects: Project[], currentTime: number): DashboardAttentionItem[] {
  const now = new Date(currentTime);
  return projects.flatMap((project) => {
    const flags = projectAttentionFlags(project, now);
    if (!flags.length) return [];
    return [{
      id: `project:${project.id}`,
      kind: 'project' as const,
      priority: projectAttentionPriority(flags.map((flag) => flag.kind)),
      title: project.name,
      detail: flags.map((flag) => flag.label).join(' · '),
      amount: project.amount,
      projectId: project.id,
      timestamp: project.lastTouchpoint ?? project.stageChangedAt ?? project.updatedAt,
    }];
  });
}

function buildQuoteAttention(
  pendingSignatures: Quote[],
  currentTime: number,
): DashboardAttentionItem[] {
  return pendingSignatures.flatMap((quote) => {
    const waitingDays = ageDays(quote.sentAt ?? quote.updatedAt, currentTime) ?? 0;
    const viewed = quote.status === 'Viewed' || Boolean(quote.viewedAt);
    if (!viewed && waitingDays < 7) return [];

    const priority: DashboardAttentionPriority = viewed || waitingDays >= 14 ? 'high' : 'medium';
    const detail = viewed
      ? `Viewed by customer · ${waitingDays}d since sent`
      : `${waitingDays}d waiting for customer response`;
    return [{
      id: `quote:${quote.id}`,
      kind: 'quote' as const,
      priority,
      title: quote.title,
      detail,
      quoteId: quote.id,
      projectId: quote.projectId,
      companyId: quote.companyId,
      timestamp: quote.viewedAt ?? quote.sentAt ?? quote.updatedAt,
    }];
  });
}

function buildAccountsNeedingLove(
  companies: Company[],
  contacts: Contact[],
  projects: Project[],
  activities: Activity[],
  currentTime: number,
): DashboardAccountOpportunity[] {
  return companies
    .filter((company) => company.kind === 'customer')
    .flatMap((company) => {
      const expectedAnnualWork = companyEstimatedAnnualWork(company);
      if (!expectedAnnualWork || expectedAnnualWork <= 0) return [];
      const health = inferAccountHealth(company, contacts, projects, activities, currentTime);
      if (health.openProjectCount > 0) return [];
      const daysSinceActivity = health.lastActivityAt
        ? ageDays(health.lastActivityAt, currentTime)
        : undefined;
      if (health.stage !== 'Cold' && (daysSinceActivity === undefined || daysSinceActivity < 60)) return [];
      return [{
        companyId: company.id,
        name: company.name,
        expectedAnnualWork,
        stage: health.stage,
        reason: health.stage === 'Cold'
          ? health.reason
          : `No active opportunity · ${daysSinceActivity} days since meaningful activity.`,
        lastActivityAt: health.lastActivityAt,
        daysSinceActivity,
      }];
    })
    .sort((a, b) => b.expectedAnnualWork - a.expectedAnnualWork)
    .slice(0, 5);
}

function buildQuoteFunnel(
  quotes: Quote[],
  signatures: SignatureRecord[],
  activities: Activity[],
): QuoteFunnelMetrics {
  const sales = salesDocuments(quotes).filter((quote) => !quote.archivedAt);
  const sentActivityIds = activityQuoteIds(activities, 'quote-sent');
  const viewedActivityIds = activityQuoteIds(activities, 'quote-viewed');
  const signedIds = signedSalesQuoteIds(signatures);
  const sent = sales.filter((quote) => reachedSent(quote, sentActivityIds));
  const viewed = sent.filter((quote) => reachedViewed(quote, viewedActivityIds, signedIds));
  const signed = sent.filter((quote) => signedIds.has(quote.id));

  const viewDurations = viewed.flatMap((quote) => {
    const sentAt = asTime(quote.sentAt);
    const viewedAt = asTime(quote.viewedAt);
    return sentAt !== undefined && viewedAt !== undefined && viewedAt >= sentAt
      ? [(viewedAt - sentAt) / DAY]
      : [];
  });
  const signaturesByQuote = new Map<string, SignatureRecord>();
  signatures
    .filter((signature) => signature.acceptedSnapshot.documentType !== 'change-order')
    .forEach((signature) => {
      const existing = signaturesByQuote.get(signature.quoteId);
      if (!existing || signature.acceptedAt < existing.acceptedAt) signaturesByQuote.set(signature.quoteId, signature);
    });
  const signDurations = sent.flatMap((quote) => {
    const sentAt = asTime(quote.sentAt);
    const signedAt = asTime(signaturesByQuote.get(quote.id)?.acceptedAt);
    return sentAt !== undefined && signedAt !== undefined && signedAt >= sentAt
      ? [(signedAt - sentAt) / DAY]
      : [];
  });

  return {
    drafts: sales.filter((quote) => quote.status === 'Draft' || quote.status === 'Ready').length,
    sent: sent.length,
    viewed: viewed.length,
    signed: signed.length,
    viewRate: ratio(viewed.length, sent.length),
    closeRate: ratio(signed.length, sent.length),
    medianDaysToView: median(viewDurations),
    medianDaysToSign: median(signDurations),
  };
}

export function buildDashboardMetrics(
  quotes: Quote[],
  signatures: SignatureRecord[],
  projects: Project[],
  activities: Activity[],
  companies: Company[] = [],
  contacts: Contact[] = [],
  currentTime = Date.now(),
): DashboardMetrics {
  // Change Orders are modifications to business already won. They can require
  // signatures and contribute accepted value, but they do not inflate new-sale
  // quote counts or close-rate denominators.
  const sales = salesDocuments(quotes);
  const salesDocumentIds = new Set(sales.map((quote) => quote.id));
  const sentQuoteIds = new Set<string>();
  activities.forEach((activity) => {
    if (activity.type === 'quote-sent' && activity.quoteId) sentQuoteIds.add(activity.quoteId);
  });
  sales.filter(quoteHasBeenSent).forEach((quote) => sentQuoteIds.add(quote.id));

  const signedQuoteIds = new Set(
    signatures
      .filter((signature) => {
        if (salesDocumentIds.has(signature.quoteId)) return true;
        return signature.acceptedSnapshot.documentType !== 'change-order';
      })
      .map((signature) => signature.quoteId),
  );
  const signedSentQuotes = [...signedQuoteIds].filter((quoteId) => sentQuoteIds.has(quoteId)).length;

  const signaturesReceived = signatures.length;
  const acceptedValue = signatures.reduce((sum, signature) => sum + signature.acceptedSnapshot.acceptedTotal, 0);

  const pipelineByStage = OPEN_PIPELINE_STAGES.map((stage) => {
    const stageProjects = projects.filter((project) => project.stage === stage);
    const ages = stageProjects
      .map((project) => pipelineAge(project, currentTime))
      .filter((age): age is number => age !== undefined);
    return {
      stage,
      projectCount: stageProjects.length,
      value: stageProjects.reduce((sum, project) => sum + (project.amount ?? 0), 0),
      medianAgeDays: median(ages),
      oldestAgeDays: ages.length ? Math.max(...ages) : undefined,
    };
  });

  const openPipeline = pipelineByStage.reduce((sum, stage) => sum + stage.value, 0);
  const allSignedDocumentIds = new Set(signatures.map((signature) => signature.quoteId));
  const pendingSignatures = quotes
    .filter((quote) => !quote.archivedAt)
    .filter((quote) => (quote.status === 'Sent' || quote.status === 'Viewed') && !allSignedDocumentIds.has(quote.id))
    .sort((a, b) => (b.sentAt ?? b.updatedAt).localeCompare(a.sentAt ?? a.updatedAt));

  const recentSignatures = [...signatures]
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))
    .slice(0, 6);

  const accountsNeedingLove = buildAccountsNeedingLove(companies, contacts, projects, activities, currentTime);
  const accountAttention: DashboardAttentionItem[] = accountsNeedingLove.map((account) => ({
    id: `account:${account.companyId}`,
    kind: 'account',
    priority: account.expectedAnnualWork >= 250_000 ? 'medium' : 'low',
    title: account.name,
    detail: `${account.reason} · ${Math.round(account.expectedAnnualWork).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/yr expected`,
    amount: account.expectedAnnualWork,
    companyId: account.companyId,
    timestamp: account.lastActivityAt,
  }));

  const attention = [
    ...buildProjectAttention(projects, currentTime),
    ...buildQuoteAttention(pendingSignatures, currentTime),
    ...accountAttention,
  ]
    .sort((a, b) => {
      const priority = PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority];
      if (priority) return priority;
      const amount = (b.amount ?? 0) - (a.amount ?? 0);
      if (amount) return amount;
      return (a.timestamp ?? '').localeCompare(b.timestamp ?? '');
    })
    .slice(0, 8);

  const recentActivity = [...activities]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8);

  return {
    quotesSent: sentQuoteIds.size,
    signaturesReceived,
    closeRate: sentQuoteIds.size ? signedSentQuotes / sentQuoteIds.size : 0,
    openPipeline,
    acceptedValue,
    pendingSignatures,
    pipelineByStage,
    recentSignatures,
    quoteFunnel: buildQuoteFunnel(quotes, signatures, activities),
    attention,
    accountsNeedingLove,
    recentActivity,
  };
}
