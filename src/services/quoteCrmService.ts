import { useCrmStore } from '../store/crmStore';
import { commercialDocumentLabel, displayQuoteNumber, quoteTotal, type Quote, type QuoteStatus } from '../types/quote';
import type { ActivityType, Project, ProjectStage } from '../types/crm';

const CLOSED_STAGES = new Set<ProjectStage>(['Closed Won', 'Completed', 'Closed Lost', 'Discarded']);
const EARLY_STAGES = new Set<ProjectStage>(['Discovery', 'Intent to Bid', 'Bid Development']);

export interface QuoteIdentitySync {
  projectId?: string;
  companyId?: string;
  contactId?: string;
}

const clean = (value?: string) => value?.trim().toLowerCase();
const isChangeOrder = (quote: Quote) => quote.documentType === 'change-order';

function amountText(quote: Quote) {
  const total = quoteTotal(quote);
  return total ? ` · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(total)}` : '';
}

function metadata(quote: Quote) {
  return {
    quoteNumber: displayQuoteNumber(quote),
    revision: quote.revision,
    amount: quoteTotal(quote),
    documentType: quote.documentType,
    parentQuoteId: quote.parentQuoteId,
  };
}

function getCrm() {
  const crm = useCrmStore.getState();
  crm.hydrate();
  return useCrmStore.getState();
}

function resolveIdentity(quote: Quote) {
  let crm = getCrm();
  const linkedCompany = quote.companyId ? crm.companies.find((company) => company.id === quote.companyId) : undefined;
  const existingCompany = linkedCompany && (!clean(quote.companyName) || clean(linkedCompany.name) === clean(quote.companyName))
    ? linkedCompany.id
    : undefined;
  const companyId = existingCompany ?? crm.resolveCompany(quote.companyName);

  crm = getCrm();
  const linkedContact = quote.contactId ? crm.contacts.find((contact) => contact.id === quote.contactId) : undefined;
  const contactStillMatches = linkedContact &&
    (!clean(quote.contactEmail) || clean(linkedContact.email) === clean(quote.contactEmail)) &&
    (!clean(quote.contactName) || clean(linkedContact.name) === clean(quote.contactName));
  const contactId = contactStillMatches ? linkedContact.id : crm.resolveContact({
    companyId,
    name: quote.contactName,
    email: quote.contactEmail,
    source: 'quote',
    quoteId: quote.id,
  });
  return { companyId, contactId };
}

function existingProject(quote: Quote): Project | undefined {
  const crm = getCrm();
  if (quote.projectId) {
    const direct = crm.projects.find((project) => project.id === quote.projectId);
    if (direct) return direct;
  }

  const title = clean(quote.title);
  if (!title) return undefined;
  const company = clean(quote.companyName);
  const candidates = crm.projects.filter((project) => clean(project.name) === title);
  if (!candidates.length) return undefined;
  if (company) {
    const companyMatch = candidates.find((project) => clean(project.companyName) === company);
    if (companyMatch) return companyMatch;
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

function syncQuoteDetails(projectId: string, quote: Quote) {
  getCrm().updateProject(projectId, {
    ...(quote.companyName?.trim() ? { companyName: quote.companyName } : {}),
    amount: quoteTotal(quote),
    lastTouchpoint: new Date().toISOString().slice(0, 10),
  });
}

function touchProject(projectId?: string) {
  if (!projectId) return;
  getCrm().updateProject(projectId, { lastTouchpoint: new Date().toISOString().slice(0, 10) });
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

function recordCommercialActivity(quote: Quote, type: ActivityType, summary: string, identity: QuoteIdentitySync = {}) {
  getCrm().recordActivity({
    type,
    summary,
    quoteId: quote.id,
    projectId: identity.projectId ?? quote.projectId,
    companyId: identity.companyId ?? quote.companyId,
    contactId: identity.contactId ?? quote.contactId,
    metadata: metadata(quote),
  });
}

export function recordQuoteCreated(quote: Quote) {
  if (isChangeOrder(quote)) {
    recordCommercialActivity(quote, 'change-order-created', 'Change Order draft created');
    return;
  }
  recordCommercialActivity(quote, 'quote-created', `${commercialDocumentLabel(quote)} ${displayQuoteNumber(quote)} created`);
}

export function recordQuoteLinked(quote: Quote) {
  if (!quote.projectId || isChangeOrder(quote)) return;
  const crm = getCrm();
  const project = crm.projects.find((candidate) => candidate.id === quote.projectId);
  crm.recordActivity({
    type: 'quote-linked',
    summary: `${commercialDocumentLabel(quote)} ${displayQuoteNumber(quote)} linked${project ? ` to ${project.name}` : ''}`,
    quoteId: quote.id,
    projectId: quote.projectId,
    companyId: project?.companyId,
    metadata: metadata(quote),
  });
}

export function recordRevisionCreated(quote: Quote) {
  recordCommercialActivity(
    quote,
    isChangeOrder(quote) ? 'change-order-revision-created' : 'quote-revision-created',
    `${displayQuoteNumber(quote)} revision created${quote.revisionLabel ? ` · ${quote.revisionLabel}` : ''}`,
  );
}

export function applyQuoteSent(quote: Quote): QuoteIdentitySync {
  const identity = resolveIdentity(quote);

  if (isChangeOrder(quote)) {
    const project = existingProject(quote);
    const projectId = project?.id ?? quote.projectId;
    const companyId = project?.companyId ?? identity.companyId ?? quote.companyId;
    touchProject(projectId);
    recordCommercialActivity(
      quote,
      'change-order-sent',
      `Change Order ${displayQuoteNumber(quote)} sent${amountText(quote)}`,
      { projectId, companyId, contactId: identity.contactId ?? quote.contactId },
    );
    return { projectId, companyId, contactId: identity.contactId ?? quote.contactId };
  }

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
    project = getCrm().projects.find((candidate) => candidate.id === projectId);
  }

  const companyId = project?.companyId ?? identity.companyId;
  recordCommercialActivity(
    quote,
    'quote-sent',
    `${commercialDocumentLabel(quote)} ${displayQuoteNumber(quote)} sent${amountText(quote)}`,
    { projectId, companyId, contactId: identity.contactId },
  );

  return { projectId: projectId ?? quote.projectId, companyId, contactId: identity.contactId };
}

export function applyQuoteStatusChange(quote: Quote, previousStatus: QuoteStatus): QuoteIdentitySync {
  if (quote.status === previousStatus) return { projectId: quote.projectId, companyId: quote.companyId, contactId: quote.contactId };
  const identity = resolveIdentity(quote);

  if (quote.status === 'Viewed') {
    const type: ActivityType = isChangeOrder(quote) ? 'change-order-viewed' : 'quote-viewed';
    recordCommercialActivity(
      quote,
      type,
      `${commercialDocumentLabel(quote)} ${displayQuoteNumber(quote)} viewed`,
      { projectId: quote.projectId, ...identity },
    );
    return { projectId: quote.projectId, ...identity };
  }

  if (quote.status === 'Signed' && isChangeOrder(quote)) {
    touchProject(quote.projectId);
    recordCommercialActivity(
      quote,
      'change-order-signed',
      `Change Order ${displayQuoteNumber(quote)} signed${amountText(quote)}`,
      { projectId: quote.projectId, companyId: identity.companyId ?? quote.companyId, contactId: identity.contactId ?? quote.contactId },
    );
    return { projectId: quote.projectId, companyId: identity.companyId ?? quote.companyId, contactId: identity.contactId ?? quote.contactId };
  }

  if (quote.status === 'Signed') {
    const crm = getCrm();
    let project = existingProject(quote);
    let projectId = project?.id;
    if (!projectId || !project) {
      projectId = crm.createProject(quote.title, 'Closed Won', {
        companyName: quote.companyName,
        amount: quoteTotal(quote),
        source: 'quote',
        quoteId: quote.id,
        quoteNumber: displayQuoteNumber(quote),
      }) ?? undefined;
      project = projectId ? getCrm().projects.find((candidate) => candidate.id === projectId) : undefined;
    } else {
      syncQuoteDetails(projectId, quote);
      getCrm().moveProject(projectId, 'Closed Won', {
        source: 'quote', quoteId: quote.id, quoteNumber: displayQuoteNumber(quote),
      });
    }
    const companyId = project?.companyId ?? identity.companyId;
    recordCommercialActivity(
      quote,
      'quote-signed',
      `${commercialDocumentLabel(quote)} ${displayQuoteNumber(quote)} signed${amountText(quote)}`,
      { projectId, companyId, contactId: identity.contactId },
    );
    return { projectId, companyId, contactId: identity.contactId };
  }

  if (quote.status === 'Declined' || quote.status === 'Expired') {
    const type: ActivityType = isChangeOrder(quote)
      ? quote.status === 'Declined' ? 'change-order-declined' : 'change-order-expired'
      : quote.status === 'Declined' ? 'quote-declined' : 'quote-expired';
    recordCommercialActivity(
      quote,
      type,
      `${commercialDocumentLabel(quote)} ${displayQuoteNumber(quote)} ${quote.status.toLowerCase()}`,
      { projectId: quote.projectId, ...identity },
    );
  }

  return { projectId: quote.projectId, ...identity };
}
