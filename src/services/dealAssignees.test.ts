import {describe,it,expect} from 'vitest';
import {eligibleDealAssignee,dealAssigneeLabel} from './dealAssignees';

describe('Deal salesperson options',()=>{
 it('includes quote-issuing teammates and excludes read-only/non-quoting roles',()=>{
  expect(eligibleDealAssignee('owner','general')).toBe(true);
  expect(eligibleDealAssignee('admin','purchasing')).toBe(true);
  expect(eligibleDealAssignee('member','salesperson')).toBe(true);
  expect(eligibleDealAssignee('member','general')).toBe(true);
  expect(eligibleDealAssignee('member','estimator')).toBe(false);
  expect(eligibleDealAssignee('member','project_manager')).toBe(false);
  expect(eligibleDealAssignee('viewer','general')).toBe(false);
 });
 it('labels unassigned and removed members without showing raw identifiers',()=>{
  const members=[{userId:'user-a',name:'Avery',role:'member' as const,department:'salesperson' as const}];
  expect(dealAssigneeLabel(undefined,members)).toContain('Unassigned');
  expect(dealAssigneeLabel('user-a',members)).toBe('Avery');
  expect(dealAssigneeLabel('user-b',members)).toBe('Assigned teammate');
 });
});
