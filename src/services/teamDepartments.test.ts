import { describe, it, expect } from 'vitest';
import { canEditTeamArea, canIssueTeamQuote, TEAM_DEPARTMENTS, TEAM_DEPARTMENT_DETAILS } from './teamDepartments';

describe('industry member department permissions', () => {
  it('preserves legacy General Member editing abilities', () => {
    for (const area of ['crm','quotes','supplier'] as const) {
      expect(canEditTeamArea('member','general',area)).toBe(true);
      expect(canEditTeamArea('owner','general',area)).toBe(true);
      expect(canEditTeamArea('admin','general',area)).toBe(true);
      expect(canEditTeamArea('viewer','general',area)).toBe(false);
    }
  });
  it('keeps CRM editing with Salesperson and Project Manager', () => {
    expect(canEditTeamArea('member','salesperson','crm')).toBe(true);
    expect(canEditTeamArea('member','project_manager','crm')).toBe(true);
    expect(canEditTeamArea('member','estimator','crm')).toBe(false);
    expect(canEditTeamArea('member','purchasing','crm')).toBe(false);
  });
  it('limits estimating and purchasing access by workspace area', () => {
    expect(canEditTeamArea('member','estimator','quotes')).toBe(true);
    expect(canEditTeamArea('member','estimator','supplier')).toBe(false);
    expect(canEditTeamArea('member','purchasing','supplier')).toBe(true);
    expect(canEditTeamArea('member','purchasing','quotes')).toBe(false);
    expect(canEditTeamArea('member','project_manager','quotes')).toBe(false);
  });
  it('keeps quote issuance separate from preparing an estimate', () => {
    expect(canIssueTeamQuote('owner','general')).toBe(true);
    expect(canIssueTeamQuote('admin','general')).toBe(true);
    expect(canIssueTeamQuote('member','general')).toBe(true);
    expect(canIssueTeamQuote('member','salesperson')).toBe(true);
    expect(canIssueTeamQuote('member','estimator')).toBe(false);
    expect(canIssueTeamQuote('member','purchasing')).toBe(false);
    expect(canIssueTeamQuote('member','project_manager')).toBe(false);
    expect(canIssueTeamQuote('viewer','general')).toBe(false);
  });

  it('supplies descriptions and a distinct preset for every department', () => {
    expect(TEAM_DEPARTMENTS).toHaveLength(5);
    for (const dept of TEAM_DEPARTMENTS) {
      expect(TEAM_DEPARTMENT_DETAILS[dept].name.length).toBeGreaterThan(4);
      expect(TEAM_DEPARTMENT_DETAILS[dept].description.length).toBeGreaterThan(10);
    }
  });
});
