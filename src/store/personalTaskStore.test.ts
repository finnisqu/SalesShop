import {describe,it,expect} from 'vitest';
import {taskScope} from './personalTaskStore';
describe('personal task ownership',()=>{
 it('never loads unscoped cloud tasks before user and organization are known',()=>{
  expect(taskScope('cloud',null,'user')).toBeNull();
  expect(taskScope('cloud','org',undefined)).toBeNull();
  expect(taskScope('cloud','org','alice')).toBe('org:org:user:alice');
  expect(taskScope('cloud','org','bob')).not.toBe(taskScope('cloud','org','alice'));
 });
 it('keeps the existing local task scope',()=>expect(taskScope('local',null,undefined)).toBe('local:user'));
});