import { quoteTotal, type Quote, type QuoteStatus } from '../types/quote';

export type SalesDivision = { id: string; organization_id: string; name: string };
export type SalesTeam = { id: string; organization_id: string; name: string; division_id: string | null };
export type SalesTeamMember = { user_id: string; team_id: string; organization_id: string };
export type SalesMember = { user_id: string; displayName: string; role: string; jobFunction: string };

export type TeamQuoteFilters = {
  query: string;
  owner: string;
  division: string;
  team: string;
  status: 'all' | QuoteStatus;
  showArchived: boolean;
};

/** 'unassigned' means exactly missing metadata; never invent the old quote owner. */
export function filterTeamQuotes(quotes: readonly Quote[], filters: TeamQuoteFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return quotes.filter((quote) => {
    if (!filters.showArchived && quote.archivedAt) return false;
    if (filters.owner !== 'all' && (quote.ownerUserId ?? 'unassigned') !== filters.owner) return false;
    if (filters.division !== 'all' && (quote.divisionId ?? 'unassigned') !== filters.division) return false;
    if (filters.team !== 'all' && (quote.teamId ?? 'unassigned') !== filters.team) return false;
    if (filters.status !== 'all' && quote.status !== filters.status) return false;
    return !query || [quote.title, quote.companyName, quote.quoteNumber, quote.contactName, quote.status]
      .some((term) => term?.toLocaleLowerCase().includes(query));
  }).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function summarizeTeamQuotes(quotes: readonly Quote[]) {
  return {
    total: quotes.length,
    active: quotes.filter((q) => ['Draft', 'Ready'].includes(q.status)).length,
    sent: quotes.filter((q) => ['Sent', 'Viewed'].includes(q.status)).length,
    signed: quotes.filter((q) => q.status === 'Signed').length,
    value: quotes.reduce((sum, q) => sum + quoteTotal(q), 0),
    unassigned: quotes.filter((q) => !q.ownerUserId).length,
  };
}

export function validQuoteTeamAssignment(
  ownerId: string | null, divisionId: string | null, teamId: string | null,
  members: readonly SalesMember[], divisions: readonly SalesDivision[], teams: readonly SalesTeam[],
) {
  if (ownerId && !members.some((member) => member.user_id === ownerId)) return false;
  if (divisionId && !divisions.some((division) => division.id === divisionId)) return false;
  if (!teamId) return true;
  const team = teams.find((row) => row.id === teamId);
  return !!team && (!divisionId || team.division_id === divisionId);
}
