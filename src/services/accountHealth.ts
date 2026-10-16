import type { AccountStage, Activity, Company, Contact, Project } from '../types/crm';

export interface AccountHealth {
  stage: AccountStage;
  reason: string;
  lastActivityAt?: string;
  openProjectCount: number;
  quotedProjectCount: number;
  contactCount: number;
}

const DAY = 86_400_000;
const STALE_DAYS = 180;
const terminalStages = new Set(['Completed', 'Closed Lost', 'Discarded']);

function newestDate(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1);
}

export function inferAccountHealth(
  company: Company,
  contacts: Contact[],
  projects: Project[],
  activities: Activity[],
  currentTime = Date.now(),
): AccountHealth {
  const companyProjects = projects.filter((project) => project.companyId === company.id);
  const projectIds = new Set(companyProjects.map((project) => project.id));
  const companyContacts = contacts.filter((contact) => contact.companyId === company.id);
  const companyActivities = activities.filter((activity) => activity.companyId === company.id || Boolean(activity.projectId && projectIds.has(activity.projectId)));
  const lastActivityAt = newestDate([
    ...companyActivities.map((activity) => activity.occurredAt),
    ...companyProjects.map((project) => project.lastTouchpoint ? `${project.lastTouchpoint}T12:00:00` : project.updatedAt),
    company.updatedAt,
  ]);
  const daysSinceActivity = lastActivityAt ? Math.floor((currentTime - new Date(lastActivityAt).getTime()) / DAY) : Number.POSITIVE_INFINITY;
  const openProjects = companyProjects.filter((project) => !terminalStages.has(project.stage));
  const quotedProjects = companyProjects.filter((project) => project.stage === 'Bid Sent' || project.stage === 'Negotiation');
  const activeWon = companyProjects.filter((project) => project.stage === 'Closed Won');
  const completed = companyProjects.filter((project) => project.stage === 'Completed');
  const allDead = companyProjects.length > 0 && companyProjects.every((project) => project.stage === 'Closed Lost' || project.stage === 'Discarded');

  const base = {
    lastActivityAt,
    openProjectCount: openProjects.length,
    quotedProjectCount: quotedProjects.length,
    contactCount: companyContacts.length,
  };

  if (company.kind === 'non-customer') {
    return { ...base, stage: 'Non-Customer', reason: 'Marked as a non-customer business relationship.' };
  }
  if (activeWon.length) {
    const project = activeWon[0];
    return { ...base, stage: 'Active', reason: `${project.name} is won and still in progress.` };
  }
  if (quotedProjects.length) {
    const project = quotedProjects[0];
    return { ...base, stage: 'Quoted', reason: `${project.name} has an active ${project.stage === 'Negotiation' ? 'negotiation' : 'sent quote'}.` };
  }
  if (daysSinceActivity > STALE_DAYS && companyProjects.length > 0) {
    return { ...base, stage: 'Cold', reason: `No meaningful activity for ${daysSinceActivity} days.` };
  }
  if (completed.length) {
    return { ...base, stage: 'Won', reason: `${completed.length} completed ${completed.length === 1 ? 'project' : 'projects'} on record.` };
  }
  if (allDead) {
    return { ...base, stage: 'Lost', reason: 'All known projects are lost or discarded.' };
  }
  if (companyProjects.some((project) => project.stage === 'Bid Development')) {
    return { ...base, stage: 'Connected', reason: 'An opportunity is actively being developed.' };
  }
  if (companyProjects.some((project) => project.stage === 'Intent to Bid')) {
    return { ...base, stage: 'Outreach', reason: 'Sales interest exists, but no quote is active yet.' };
  }
  if (companyContacts.length) {
    return { ...base, stage: 'Connected', reason: `${companyContacts.length} known ${companyContacts.length === 1 ? 'contact' : 'contacts'} at this account.` };
  }
  return { ...base, stage: 'Discovery', reason: 'Known account with no deeper sales breadcrumb yet.' };
}
