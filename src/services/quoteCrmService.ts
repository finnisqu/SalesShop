import { useCrmStore } from '../store/crmStore';
import { displayQuoteNumber, quoteTotal, type Quote, type QuoteStatus } from '../types/quote';
import type { Project, ProjectStage } from '../types/crm';

const CLOSED_STAGES = new Set<ProjectStage>(['Closed Won', 'Closed Lost', 'Discarded']);
const EARLY_STAGES = new Set<ProjectStage>(['Discovery', 'Intent to Bid', 'Bid Development']);

function amountText(quote: Quote) {
  const total = quoteTotal(quote);
  return total ? ` · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(total)}` : '';
}

function getCrm() {
  const crm = useCrmStore.getState();
  crm.hydrate();
  return useCrmStore.getState();
}

function existingProject(quote: Quote): Project | undefined {
  if (!quote.projectId) return undefined;
  return getCrm().projects.find((project) => project.id === quote.projectId);
}

function syncQuoteDetails(projectId: string, quote: Quote) {
  const crm = getCrm();
  crm.updateProject(projectId, {
    ...(quote.companyName?.trim() ? { companyName: quote.companyName } : {}),
    amount: quoteTotal(quote),
    lastTouchpoint: new Date().toISOString().slice(0, 10),
  });
}

function moveForSentQuote(projectId: string, quote: Quote) {
  const crm = getCrm();
  const project = crm.projects.find((candidate) => candidate.id === projectId);
  if (!project || CLOSED_STAGES.has(project.stage)) return;

  if (quote.revision > 0) {
    if (project.stage !== 'Negotiation') {
      crm.moveProject(projectId, 'Negotiation', {
        source: 'quote', quoteId: quote.id, quoteNumber: displayQuoteNumber(quote),
      });
    }
    return;
  }

  if (EARLY_STAGES.has(project.stage)) {
    crm.moveProject(projectId, 'Bid Sent', {
      source: 'quote', quoteId: quote.id, quoteNumber: displayQuoteNumber(quote),
    });
  }
}

export function recordQuoteCreated(quote: Quote) {
  const crm = getCrm();
  crm.recordActivity({
    type: 'quote-created',
    summary: `Quote ${displayQuoteNumber(quote)} created`,
    quoteId: quote.id,
    projectId: quote.projectId,
    metadata: { quoteNumber: displayQuoteNumber(quote), revision: quote.revision, amount: quoteTotal(quote) },
  });
}

export function recordQuoteLinked(quote: Quote) {
  if (!quote.projectId) return;
  const crm = getCrm();
  const project = crm.projects.find((candidate) => candidate.id === quote.projectId);
  crm.recordActivity({
    type: 'quote-linked',
    summary: `Quote ${displayQuoteNumber(quote)} linked${project ? ` to ${project.name}` : ''}`,
    quoteId: quote.id,
    projectId: quote.projectId,
    metadata: { quoteNumber: displayQuoteNumber(quote), revision: quote.revision },
  });
}

export function recordRevisionCreated(quote: Quote) {
  const crm = getCrm();
  crm.recordActivity({
    type: 'quote-revision-created',
    summary: `${displayQuoteNumber(quote)} revision created${quote.revisionLabel ? ` · ${quote.revisionLabel}` : ''}`,
    quoteId: quote.id,
    projectId: quote.projectId,
    metadata: { quoteNumber: displayQuoteNumber(quote), revision: quote.revision, amount: quoteTotal(quote) },
  });
}

export function applyQuoteSent(quote: Quote): string {
  let crm = getCrm();
  let project = existingProject(quote);
  let projectId = project?.id;
  const targetStage: ProjectStage = quote.revision > 0 ? 'Negotiation' : 'Bid Sent';

  if (!projectId) {
    projectId = crm.createProject(quote.title, targetStage, {
      companyName: quote.companyName,
      amount: quoteTotal(quote),
      lastTouchpoint: new Date().toISOString().slice(0, 10),
      source: 'quote',
      quoteId: quote.id,
      quoteNumber: displayQuoteNumber(quote),
    }) ?? undefined;
    crm = getCrm();
    project = projectId ? crm.projects.find((candidate) => candidate.id === projectId) : undefined;
  } else {
    syncQuoteDetails(projectId, quote);
    moveForSentQuote(projectId, quote);
  }

  crm = getCrm();
  crm.recordActivity({
    type: 'quote-sent',
    summary: `Quote ${displayQuoteNumber(quote)} sent${amountText(quote)}`,
    quoteId: quote.id,
    projectId,
    companyId: project?.companyId,
    metadata: { quoteNumber: displayQuoteNumber(quote), revision: quote.revision, amount: quoteTotal(quote) },
  });

  return projectId ?? quote.projectId ?? '';
}

export function applyQuoteStatusChange(quote: Quote, previousStatus: QuoteStatus): string | undefined {
  if (quote.status === previousStatus) return quote.projectId;
  const crm = getCrm();

  if (quote.status === 'Viewed') {
    crm.recordActivity({
      type: 'quote-viewed',
      summary: `Quote ${displayQuoteNumber(quote)} viewed`,
      quoteId: quote.id,
      projectId: quote.projectId,
      metadata: { quoteNumber: displayQuoteNumber(quote), revision: quote.revision },
    });
    return quote.projectId;
  }

  if (quote.status === 'Signed') {
    let projectId = quote.projectId;
    let project = existingProject(quote);
    if (!projectId || !project) {
      projectId = crm.createProject(quote.title, 'Closed Won', {
        companyName: quote.companyName,
        amount: quoteTotal(quote),
        source: 'quote',
        quoteId: quote.id,
        quoteNumber: displayQuoteNumber(quote),
      }) ?? undefined;
    } else {
      syncQuoteDetails(projectId, quote);
      getCrm().moveProject(projectId, 'Closed Won', {
        source: 'quote', quoteId: quote.id, quoteNumber: displayQuoteNumber(quote),
      });
    }
    getCrm().recordActivity({
      type: 'quote-signed',
      summary: `Quote ${displayQuoteNumber(quote)} signed${amountText(quote)}`,
      quoteId: quote.id,
      projectId,
      metadata: { quoteNumber: displayQuoteNumber(quote), revision: quote.revision, amount: quoteTotal(quote) },
    });
    return projectId;
  }

  if (quote.status === 'Declined' || quote.status === 'Expired') {
    crm.recordActivity({
      type: quote.status === 'Declined' ? 'quote-declined' : 'quote-expired',
      summary: `Quote ${displayQuoteNumber(quote)} ${quote.status.toLowerCase()}`,
      quoteId: quote.id,
      projectId: quote.projectId,
      metadata: { quoteNumber: displayQuoteNumber(quote), revision: quote.revision },
    });
  }

  return quote.projectId;
}
