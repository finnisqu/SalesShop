import type { TeamRole } from './teamAccess';

export const TEAM_DEPARTMENTS = ['general','salesperson','estimator','purchasing','project_manager'] as const;
export type TeamDepartment = typeof TEAM_DEPARTMENTS[number];
export type TeamArea = 'crm' | 'quotes' | 'supplier';

export const TEAM_DEPARTMENT_DETAILS: Record<TeamDepartment, {
  name: string; description: string; writableAreas: TeamArea[];
}> = {
  general: {
    name: 'General team member',
    description: 'Existing Member access: edit CRM, quotes and suppliers.',
    writableAreas: ['crm','quotes','supplier'],
  },
  salesperson: {
    name: 'Salesperson',
    description: 'Edit customers, projects and quotes. Browse suppliers without changing them.',
    writableAreas: ['crm','quotes'],
  },
  estimator: {
    name: 'Estimator',
    description: 'Build and edit quotes. CRM and suppliers are read-only.',
    writableAreas: ['quotes'],
  },
  purchasing: {
    name: 'Purchasing',
    description: 'Manage supplier records. CRM and quotes are read-only.',
    writableAreas: ['supplier'],
  },
  project_manager: {
    name: 'Project Manager',
    description: 'Update customers and projects. Quotes and suppliers are read-only.',
    writableAreas: ['crm'],
  },
};

/** UX hint only. Database RLS independently enforces the same area permission. */
export function canEditTeamArea(role: TeamRole | null, department: TeamDepartment, area: TeamArea) {
  if (role === 'owner' || role === 'admin') return true;
  if (role !== 'member') return false;
  return TEAM_DEPARTMENT_DETAILS[department].writableAreas.includes(area);
}

/** Local UX mirror; the server independently guards quote issuance. */
export function canIssueTeamQuote(role: TeamRole | null, department: TeamDepartment) {
  if (role === 'owner' || role === 'admin') return true;
  return role === 'member' && (department === 'general' || department === 'salesperson');
}

export function departmentName(value: TeamDepartment) {
  return TEAM_DEPARTMENT_DETAILS[value].name;
}
