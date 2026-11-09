import {describe,it,expect} from 'vitest';
import {taskScope,milestoneTaskId} from './personalTaskStore';
describe('personal task ownership',()=>{
 it('never loads unscoped cloud tasks before user and organization are known',()=>{
  expect(taskScope('cloud',null,'user')).toBeNull();
  expect(taskScope('cloud','org',undefined)).toBeNull();
  expect(taskScope('cloud','org','alice')).toBe('org:org:user:alice');
  expect(taskScope('cloud','org','bob')).not.toBe(taskScope('cloud','org','alice'));
 });
 it('keeps the existing local task scope',()=>expect(taskScope('local',null,undefined)).toBe('local:user'));
});
describe('stable linked milestone tasks',()=>{
 it('uses the same identity for the same Deal milestone across browsers',()=>{
  const source='deal-schedule:deal-42:building-2-invoice';
  expect(milestoneTaskId(source)).toBe('task_schedule_deal-42_building-2-invoice');
  expect(milestoneTaskId(source)).toBe(milestoneTaskId(source));
 });
 it('does not alter IDs for other task creation workflows',()=>{
  expect(milestoneTaskId(undefined)).toBeUndefined();
  expect(milestoneTaskId('deal-submit:deal-42')).toBeUndefined();
  expect(milestoneTaskId('notebook:entry')).toBeUndefined();
 });
});
