import type { Activity, Company, Contact, Project } from '../types/crm';

/** A person's history must never silently inherit their company's activity log. */
export function personRecordView(
  person: Contact,
  companies: readonly Company[],
  projects: readonly Project[],
  activities: readonly Activity[],
) {
  const company = companies.find((item) => item.id === person.companyId) ?? null;
  const companyProjects = company
    ? projects.filter((item) => item.companyId === company.id)
      .slice().sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))
    : [];
  const directActivities = activities.filter((activity) => activity.contactId === person.id)
    .slice().sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
  return { company, companyProjects, directActivities };
}
