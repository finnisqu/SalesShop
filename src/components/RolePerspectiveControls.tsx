import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useRolePerspectiveStore } from '../store/rolePerspectiveStore';
import { OWNER_PERSPECTIVES, allowedOwnerPerspective, resolveOwnerPerspective, type OwnerPerspectiveId } from '../services/rolePerspective';
import { TEAM_DEPARTMENT_DETAILS } from '../services/teamDepartments';
import { TEAM_ROLE_HELP } from '../services/teamAccess';

export function RolePerspectivePicker({ compact = false }: { compact?: boolean }) {
  const actualRole = useAuthStore((state) => state.teamRole);
  const mode = useAuthStore((state) => state.mode);
  const current = useRolePerspectiveStore((state) => state.activePerspective);
  const start = useRolePerspectiveStore((state) => state.startPerspective);
  const exit = useRolePerspectiveStore((state) => state.exitPerspective);
  if (!allowedOwnerPerspective(actualRole, mode) || current) return null;

  return <label className={`role-perspective-picker${compact ? ' is-compact' : ''}`}>
    <span className="role-perspective-picker-label">{compact ? 'Roles' : 'Preview as'}</span>
    <select aria-label="Preview SalesShop as a team role" value=""
      onChange={(event) => {
        const id = event.target.value as OwnerPerspectiveId;
        if (OWNER_PERSPECTIVES.some((item) => item.id === id)) start(id);
        else exit();
      }}>
      <option value="">Select role…</option>
      {OWNER_PERSPECTIVES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
  </label>;
}

export function RolePerspectiveBanner() {
  const actualRole = useAuthStore((state) => state.teamRole);
  const mode = useAuthStore((state) => state.mode);
  const current = useRolePerspectiveStore((state) => state.activePerspective);
  const start = useRolePerspectiveStore((state) => state.startPerspective);
  const exit = useRolePerspectiveStore((state) => state.exitPerspective);
  const isOwner = allowedOwnerPerspective(actualRole, mode);
  const item = resolveOwnerPerspective(current, actualRole, mode);

  useEffect(() => {
    if (!isOwner && current) exit();
  }, [current, isOwner, exit]);

  if (!item) return null;
  return <div className="role-perspective-banner" role="status" aria-label="Owner role preview active">
    <span className="role-perspective-symbol" aria-hidden="true">◉</span>
    <div className="role-perspective-banner-copy">
      <strong>Previewing: {item.label}</strong>
      <span>Safe view-only simulation. Your real account is still Owner; this does not test server permissions.</span>
    </div>
    <label className="role-perspective-banner-switch">
      <span>Switch</span>
      <select aria-label="Switch simulated role" value={item.id}
        onChange={(event) => {
          const next = event.target.value as OwnerPerspectiveId;
          if (OWNER_PERSPECTIVES.some((candidate) => candidate.id === next)) start(next);
        }}>
        {OWNER_PERSPECTIVES.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
      </select>
    </label>
    <button type="button" className="role-perspective-escape" onClick={exit} aria-label="Exit role preview and return to Owner">
      <span aria-hidden="true">↩</span> Exit Preview
    </button>
  </div>;
}

/** Preview-settings summary instead of live Owner settings and mutation controls. */
export function RolePerspectiveSettings() {
  const actualRole = useAuthStore((state) => state.teamRole);
  const mode = useAuthStore((state) => state.mode);
  const current = useRolePerspectiveStore((state) => state.activePerspective);
  const item = resolveOwnerPerspective(current, actualRole, mode);
  if (!item) return null;

  const readOnly = item.role === 'viewer';
  const dept = item.role === 'member' ? TEAM_DEPARTMENT_DETAILS[item.department] : null;
  const canEdit = (area: 'CRM & projects' | 'Quotes' | 'Suppliers') => {
    if (readOnly) return false;
    if (item.role === 'admin') return true;
    const key = area === 'CRM & projects' ? 'crm' : area === 'Quotes' ? 'quotes' : 'supplier';
    return Boolean(dept?.writableAreas.includes(key));
  };
  return <main className="role-perspective-settings">
    <div className="role-perspective-settings-card">
      <span className="board-eyebrow">Settings · Simulated team access</span>
      <h1>{item.label} perspective</h1>
      <p>{dept?.description || TEAM_ROLE_HELP[item.role]}</p>
      <div className="role-perspective-capability-grid">
        {(['CRM & projects', 'Quotes', 'Suppliers'] as const).map((area) =>
          <div key={area} className="role-perspective-capability">
            <strong>{area}</strong>
            <span>{canEdit(area) ? 'Editor interface' : 'Read-only interface'}</span>
          </div>)}
        <div className="role-perspective-capability">
          <strong>Issue customer quotes</strong>
          <span>{item.role === 'admin' || (item.role === 'member' && ['general','salesperson'].includes(item.department)) ? 'Allowed by role' : 'Not permitted'}</span>
        </div>
        <div className="role-perspective-capability">
          <strong>Team administration</strong>
          <span>{item.role === 'admin' ? 'Manage members and invitations' : 'Unavailable'}</span>
        </div>
      </div>
      <p className="role-perspective-settings-note">This is a non-editing preview of role capabilities. It does not impersonate a real teammate or change their database permissions. Use separate accounts for actual permission testing.</p>
    </div>
  </main>;
}
