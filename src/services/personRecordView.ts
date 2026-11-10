import type { Activity, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';
import {activityRelations} from './activityRelations';

/** A person's history must never silently inherit their company's activity log. */
export function personRecordView(
  person: Contact,
  companies: readonly Company[],
  activities: readonly Activity[],
  projects: readonly Project[] = [],
  quotes: readonly Quote[] = [],
) {
  const company = companies.find((item) => item.id === person.companyId) ?? null;
  // Multiple People can participate in one interaction; later-added
  // associations must appear in every explicitly linked Person's history.
  const directActivities = activities.filter(activity =>
    activity.contactId===person.id||
    activityRelations(activity).some(link=>link.type==='contact'&&link.id===person.id))
    .slice().sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
  // A matching company or name is never evidence that someone participates
  // in a Deal. Only this person's explicit, accessible Quote contact link counts.
  const ownQuotes = quotes.filter(quote =>
    !quote.archivedAt && quote.contactId === person.id && Boolean(quote.projectId));
  const linkedDeals = projects.flatMap(project => {
    const projectQuotes = ownQuotes.filter(quote => quote.projectId === project.id);
    return projectQuotes.length ? [{ project, quoteCount: projectQuotes.length }] : [];
  }).sort((a,b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
  return { company, directActivities, linkedDeals };
}
