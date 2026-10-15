import type { Activity, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';
import { quotesForProject } from './quoteCrmLinks';

/** Strict ID relationships: no name matching, no company-wide activity inheritance. */
export function dealRecordView(
  deal: Project,
  companies: readonly Company[],
  contacts: readonly Contact[],
  quotes: readonly Quote[],
  activities: readonly Activity[],
) {
  const company = companies.find(item => item.id === deal.companyId) ?? null;
  const linkedQuotes = quotesForProject(deal, quotes).filter(quote => !quote.archivedAt);
  const explicitContactIds = new Set(linkedQuotes.map(quote => quote.contactId).filter((id): id is string => Boolean(id)));
  const quoteContacts = contacts.filter(contact => explicitContactIds.has(contact.id))
    .slice().sort((a, b) => a.name.localeCompare(b.name));
  const linkedQuoteIds = new Set(linkedQuotes.map(quote => quote.id));
  const directHistory = activities.filter(activity =>
    activity.projectId === deal.id ||
    Boolean(activity.quoteId && linkedQuoteIds.has(activity.quoteId))
  ).slice().sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
  return { company, linkedQuotes, quoteContacts, directHistory };
}
