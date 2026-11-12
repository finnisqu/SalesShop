import {describe,expect,it} from 'vitest';
import type {PersonalTask} from '../store/personalTaskStore';
import {homeOutstandingTasks,outstandingDueLabel} from './homeOutstandingTasks';

const task=(id:string,dueDate?:string,patch:Partial<PersonalTask>={}):PersonalTask=>({
 id,title:id,dueDate,status:'open',createdAt:'2026-11-01T00:00:00.000Z',
 updatedAt:'2026-11-01T00:00:00.000Z',...patch,
});

describe('Home Recents outstanding Task queue',()=>{
 it('orders overdue, today, and future dates earliest first; undated last',()=>{
  const input=[task('undated'),task('future','2026-11-30'),
   task('today','2026-11-12'),task('old','2026-11-09'),
   task('earlier','2026-11-06')];
  expect(homeOutstandingTasks(input).map(t=>t.id)).toEqual([
   'earlier','old','today','future','undated',
  ]);
  expect(input[0].id).toBe('undated'); // sorting must not mutate the store
 });
 it('excludes completed, canceled and deleted Tasks without excluding waiting work',()=>{
  const tasks=[task('open'),task('waiting',undefined,{status:'waiting'}),
   task('completed',undefined,{status:'completed'}),
   task('finished',undefined,{completedAt:'2026-11-12T10:00:00Z'}),
   task('canceled',undefined,{status:'canceled'}),
   task('deleted',undefined,{deletedAt:'2026-11-12T10:00:00Z'})];
  expect(homeOutstandingTasks(tasks).map(t=>t.id)).toEqual(['open','waiting']);
 });
 it('sorts same-day tasks by due time and never uses the original deadline',()=>{
  const items=[task('late','2026-11-12',{dueTime:'16:00',originalDueDate:'2026-10-01'}),
   task('early','2026-11-12',{dueTime:'09:00',originalDueDate:'2026-11-10'})];
  expect(homeOutstandingTasks(items).map(t=>t.id)).toEqual(['early','late']);
 });
 it('labels overdue and unscheduled work against the selected current day',()=>{
  expect(outstandingDueLabel(task('past','2026-11-11'),'2026-11-12')).toContain('Overdue');
  expect(outstandingDueLabel(task('today','2026-11-12'),'2026-11-12')).toBe('Due today');
  expect(outstandingDueLabel(task('none'),'2026-11-12')).toBe('No due date');
 });
});
