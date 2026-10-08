import type { Project, Company } from '../types/crm';
import type { Quote } from '../types/quote';

/** Explicit links only: matching names alone does not make a quote belong to a CRM record. */
export function quotesForProject<T extends Pick<Quote,'id'|'projectId'|'updatedAt'>>(
  project: Pick<Project,'id'>, quotes: readonly T[],
): T[] {
  return quotes.filter((quote) => quote.projectId === project.id)
    .slice().sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** A quote linked to a project is part of its company's history, even if the quote's
 * own company link has not been backfilled yet. */
export function quotesForCompany<T extends Pick<Quote,'id'|'projectId'|'companyId'|'updatedAt'>>(
  company: Pick<Company,'id'>, projects: readonly Pick<Project,'id'|'companyId'>[], quotes: readonly T[],
): T[] {
  const projectIds = new Set(projects.filter((project) => project.companyId === company.id).map((project) => project.id));
  return quotes.filter((quote) => quote.companyId === company.id || Boolean(quote.projectId && projectIds.has(quote.projectId)))
    .slice().sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}
