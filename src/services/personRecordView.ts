import type { Activity, Company, Contact } from '../types/crm';

/** A person's history must never silently inherit their company's activity log. */
export function personRecordView(
  person: Contact,
  companies: readonly Company[],
  activities: readonly Activity[],
) {
  const company = companies.find((item) => item.id === person.companyId) ?? null;
  const directActivities = activities.filter((activity) => activity.contactId === person.id)
    .slice().sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
  return { company, directActivities };
}
