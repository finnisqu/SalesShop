import { describe, expect, it } from 'vitest';
import { OWNER_PERSPECTIVES, allowedOwnerPerspective, resolveOwnerPerspective, perspectiveAreaReadOnly } from './rolePerspective';

describe('Owner role perspectives', () => {
  it('offers an Admin, General Member, specialist members and Viewer', () => {
    expect(OWNER_PERSPECTIVES.map((item) => item.label)).toEqual([
      'Admin', 'General Member', 'Salesperson', 'Estimator',
      'Purchasing', 'Project Manager', 'Viewer',
    ]);
  });

  it('never activates for a non-owner or while offline', () => {
    expect(allowedOwnerPerspective('owner', 'cloud')).toBe(true);
    for (const actualRole of ['admin', 'member', 'viewer', null] as const) {
      expect(allowedOwnerPerspective(actualRole, 'cloud')).toBe(false);
      expect(resolveOwnerPerspective('viewer', actualRole, 'cloud')).toBeNull();
    }
    expect(resolveOwnerPerspective('viewer', 'owner', 'local')).toBeNull();
    expect(resolveOwnerPerspective('viewer', 'owner', 'cloud')?.role).toBe('viewer');
  });

  it('keeps department labels and role values matched for preview', () => {
    expect(resolveOwnerPerspective('estimator', 'owner', 'cloud')).toMatchObject({
      label: 'Estimator', role: 'member', department: 'estimator',
    });
    expect(resolveOwnerPerspective('admin', 'owner', 'cloud')).toMatchObject({
      label: 'Admin', role: 'admin', department: 'general',
    });
    expect(resolveOwnerPerspective(null, 'owner', 'cloud')).toBeNull();
  });

  it('mirrors the role-specific read-only area boundaries', () => {
    expect(perspectiveAreaReadOnly('viewer', 'general', 'quotes')).toBe(true);
    expect(perspectiveAreaReadOnly('admin', 'general', 'quotes')).toBe(false);
    expect(perspectiveAreaReadOnly('member', 'estimator', 'quotes')).toBe(false);
    expect(perspectiveAreaReadOnly('member', 'estimator', 'crm')).toBe(true);
    expect(perspectiveAreaReadOnly('member', 'purchasing', 'supplier')).toBe(false);
    expect(perspectiveAreaReadOnly('member', 'purchasing', 'quotes')).toBe(true);
    expect(perspectiveAreaReadOnly('member', 'project_manager', 'crm')).toBe(false);
    expect(perspectiveAreaReadOnly('member', 'project_manager', 'quotes')).toBe(true);
  });
});
