import {describe,it,expect} from 'vitest';
import {assigneeForCrmSync} from './normalizedCrmSync';
describe('server-authoritative Deal assignment',()=>{
 it('uses the cloud-assigned salesperson even when stale browser says unassigned',()=>{
  expect(assigneeForCrmSync(undefined,{assignedUserId:'user-a'})).toBe('user-a');
 });
 it('never restores a removed assignment from a stale local copy',()=>{
  expect(assigneeForCrmSync('user-a',{assignedUserId:undefined})).toBeNull();
 });
 it('does not leak local-only assignments into unrelated existing cloud Deals',()=>{
  expect(assigneeForCrmSync('user-b',{assignedUserId:'user-a'})).toBe('user-a');
  expect(assigneeForCrmSync('user-a')).toBe('user-a');
 });
});
