import type { TeamRole } from './teamAccess';
import type { TeamDepartment } from './teamDepartments';

export const OWNER_PERSPECTIVES = [
  { id: 'admin', label: 'Admin', role: 'admin', department: 'general' },
  { id: 'member', label: 'General Member', role: 'member', department: 'general' },
  { id: 'salesperson', label: 'Salesperson', role: 'member', department: 'salesperson' },
  { id: 'estimator', label: 'Estimator', role: 'member', department: 'estimator' },
  { id: 'purchasing', label: 'Purchasing', role: 'member', department: 'purchasing' },
  { id: 'project_manager', label: 'Project Manager', role: 'member', department: 'project_manager' },
  { id: 'viewer', label: 'Viewer', role: 'viewer', department: 'general' },
] as const satisfies ReadonlyArray<{ id: string; label: string; role: TeamRole; department: TeamDepartment }>;

export type OwnerPerspectiveId = (typeof OWNER_PERSPECTIVES)[number]['id'];

export function allowedOwnerPerspective(actualRole: TeamRole | null, mode: string) {
  return actualRole === 'owner' && mode === 'cloud';
}

export function resolveOwnerPerspective(id: OwnerPerspectiveId | null, actualRole: TeamRole | null, mode: string) {
  return allowedOwnerPerspective(actualRole, mode) ? OWNER_PERSPECTIVES.find((item) => item.id === id) ?? null : null;
}

export function perspectiveAreaReadOnly(role: TeamRole, department: TeamDepartment, area: 'crm' | 'quotes' | 'supplier') {
  if (role === 'viewer') return true;
  if (role === 'owner' || role === 'admin') return false;
  if (department === 'general') return false;
  if (department === 'salesperson') return area === 'supplier';
  if (department === 'estimator') return area !== 'quotes';
  if (department === 'purchasing') return area !== 'supplier';
  return area !== 'crm';
}
