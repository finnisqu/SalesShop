import type { Activity, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';
import { quotesForCompany } from './quoteCrmLinks';

/** Relationship membership comes from stable IDs only, never a matching display name. */
export function companyRecordView(
  company: Company,
  contacts: readonly Contact[],
  projects: readonly Project[],
  activities: readonly Activity[],
  quotes: readonly Quote[],
) {
  const relatedContacts = contacts.filter((person) => person.companyId === company.id)
    .slice().sort((a, b) => a.name.localeCompare(b.name));
  const relatedProjects = projects.filter((project) => project.companyId === company.id)
    .slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const relatedQuotes = quotesForCompany(company, projects, quotes).filter((quote) => !quote.archivedAt);
  const projectIds = new Set(relatedProjects.map((project) => project.id));
  const contactIds = new Set(relatedContacts.map((contact) => contact.id));
  const quoteIds = new Set(relatedQuotes.map((quote) => quote.id));
  const relatedActivities = activities.filter((activity) =>
    activity.companyId === company.id ||
    Boolean(activity.projectId && projectIds.has(activity.projectId)) ||
    Boolean(activity.contactId && contactIds.has(activity.contactId)) ||
    Boolean(activity.quoteId && quoteIds.has(activity.quoteId))
  ).slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return { relatedContacts, relatedProjects, relatedQuotes, relatedActivities };
}
