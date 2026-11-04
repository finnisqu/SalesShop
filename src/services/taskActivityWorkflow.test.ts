import {describe,expect,it} from 'vitest';
import type {PersonalTask} from '../store/personalTaskStore';
import {taskActivityMethod,completedTaskActivityId} from './taskActivityWorkflow';
const task=(type:PersonalTask['type']):Pick<PersonalTask,'type'>=>({type});
describe('guided Task completion → Activity',()=>{
 it('prefills the matching activity method without copying private task notes',()=>{
  expect(taskActivityMethod(task('call'))).toBe('call');
  expect(taskActivityMethod(task('email'))).toBe('email');
  expect(taskActivityMethod(task('meeting'))).toBe('in-person');
  expect(taskActivityMethod(task('follow-up'))).toBe('call');
  expect(taskActivityMethod(task('todo'))).toBe('call');
 });
 it('retries a completion using the same Activity ID, avoiding duplicate logs',()=>{
  const owner='org:shop:user:owner',coworker='org:shop:user:coworker';
  expect(completedTaskActivityId('task-1',owner)).toBe(completedTaskActivityId('task-1',owner));
  expect(completedTaskActivityId('task-2',owner)).not.toBe(completedTaskActivityId('task-1',owner));
  expect(completedTaskActivityId('task_deal_submit_deal1',owner))
   .not.toBe(completedTaskActivityId('task_deal_submit_deal1',coworker));
 });
});
