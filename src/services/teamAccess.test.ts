import { describe, expect, it } from 'vitest';
import { allowedInviteRoles, canManageTeamMember, roleName, maySeedCompanyFromLocal } from './teamAccess';

describe('Team Access role guidance', () => {
  it('limits admin invitations to owner accounts', () => {
    expect(allowedInviteRoles('owner')).toEqual(['member','admin']);
    expect(allowedInviteRoles('admin')).toEqual(['member']);
    expect(allowedInviteRoles('member')).toEqual([]);
    expect(allowedInviteRoles(null)).toEqual([]);
  });
  it('never permits self edits, owner removal or admin-to-admin escalation in the UI', () => {
    expect(canManageTeamMember('owner','owner',false)).toBe(false);
    expect(canManageTeamMember('owner','member',true)).toBe(false);
    expect(canManageTeamMember('owner','admin',false)).toBe(true);
    expect(canManageTeamMember('admin','admin',false)).toBe(false);
    expect(canManageTeamMember('admin','member',false)).toBe(true);
    expect(canManageTeamMember('member','member',false)).toBe(false);
  });
  it('never imports local sales data when joining or acting as a teammate', () => {
    expect(maySeedCompanyFromLocal('owner', false)).toBe(true);
    expect(maySeedCompanyFromLocal('owner', true)).toBe(false);
    expect(maySeedCompanyFromLocal('admin', false)).toBe(false);
    expect(maySeedCompanyFromLocal('member', false)).toBe(false);
    expect(maySeedCompanyFromLocal('member', true)).toBe(false);
  });
  it('renders familiar role names',()=> {
    expect(roleName('owner')).toBe('Owner');
    expect(roleName('member')).toBe('Member');
  });
});
