import { describe, expect, it } from 'vitest';
import { allowedInviteRoles, canManageTeamMember, roleName, maySeedCompanyFromLocal, canEditSharedData, canManageTeam, TEAM_ROLE_HELP } from './teamAccess';

describe('Team Access role guidance', () => {
  it('limits admin invitations to owner accounts', () => {
    expect(allowedInviteRoles('owner')).toEqual(['member','viewer','admin']);
    expect(allowedInviteRoles('admin')).toEqual(['member','viewer']);
    expect(allowedInviteRoles('member')).toEqual([]);
    expect(allowedInviteRoles('viewer')).toEqual([]);
    expect(allowedInviteRoles(null)).toEqual([]);
  });
  it('never permits self edits, owner removal or admin-to-admin escalation in the UI', () => {
    expect(canManageTeamMember('owner','owner',false)).toBe(false);
    expect(canManageTeamMember('owner','member',true)).toBe(false);
    expect(canManageTeamMember('owner','admin',false)).toBe(true);
    expect(canManageTeamMember('admin','admin',false)).toBe(false);
    expect(canManageTeamMember('admin','member',false)).toBe(true);
    expect(canManageTeamMember('admin','viewer',false)).toBe(true);
    expect(canManageTeamMember('member','viewer',false)).toBe(false);
    expect(canManageTeamMember('viewer','member',false)).toBe(false);
    expect(canManageTeamMember('member','member',false)).toBe(false);
  });
  it('never imports local sales data when joining or acting as a teammate', () => {
    expect(maySeedCompanyFromLocal('owner', false)).toBe(true);
    expect(maySeedCompanyFromLocal('owner', true)).toBe(false);
    expect(maySeedCompanyFromLocal('admin', false)).toBe(false);
    expect(maySeedCompanyFromLocal('member', false)).toBe(false);
    expect(maySeedCompanyFromLocal('member', true)).toBe(false);
    expect(maySeedCompanyFromLocal('viewer', false)).toBe(false);
  });
  it('renders familiar role names',()=> {
    expect(roleName('owner')).toBe('Owner');
    expect(roleName('member')).toBe('Member');
    expect(roleName('viewer')).toBe('Viewer');
    expect(TEAM_ROLE_HELP.viewer).toContain('Read shared records');
  });
  it('lets viewers read without editing, while preserving existing editor permissions', () => {
    expect(canEditSharedData('owner')).toBe(true);
    expect(canEditSharedData('admin')).toBe(true);
    expect(canEditSharedData('member')).toBe(true);
    expect(canEditSharedData('viewer')).toBe(false);
    expect(canManageTeam('viewer')).toBe(false);
    expect(canManageTeam('member')).toBe(false);
    expect(canManageTeam('admin')).toBe(true);
  });
});
