import {describe,expect,it} from 'vitest';
import type {PersonalTask} from '../store/personalTaskStore';
import {matchesPersonAttentionFilter,personFollowUpIndex} from './personFollowUpIntelligence';
import type {PersonLastContact} from './personLastContact';
const today='2026-11-10';
const task=(id:string,options:Partial<PersonalTask>={}):PersonalTask=>({
 id,title:'Follow up',type:'follow-up',status:'open',createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z',
 ...options,
});
const recent=new Map<string,PersonLastContact>([
 ['never-contacted-other',{occurredAt:'2026-11-01T10:00:00Z'}],
 ['stale',{occurredAt:'2026-10-10T10:00:00'}],
 ['boundary',{occurredAt:'2026-10-11T09:00:00'}],
 ['active',{occurredAt:'2026-11-09T12:00:00'}],
]);
describe('Person follow-up attention summary',()=>{
 it('indexes earliest pending person follow-up across association and legacy link',()=>{
  const tasks=[
   task('later',{dueDate:'2026-11-20',linked:{type:'contact',id:'person'}}),
   task('soon',{dueDate:'2026-11-08',associations:[
    {type:'contact',id:'person'},{type:'company',id:'company'}]}),
   task('complete',{dueDate:'2026-11-05',status:'completed',
    associations:[{type:'contact',id:'person'}]}),
   task('deleted',{dueDate:'2026-11-01',deletedAt:'2026-11-09T12:00:00Z',
    associations:[{type:'contact',id:'person'}]}),
   task('no-date',{linked:{type:'contact',id:'other'}}),
   task('not-followup',{type:'todo',dueDate:'2026-11-01',
    linked:{type:'contact',id:'unrelated'}}),
  ];
  const index=personFollowUpIndex(tasks,today);
  expect(index.get('person')).toEqual({taskId:'soon',dueDate:'2026-11-08',overdue:true});
  expect(index.get('other')).toEqual({taskId:'no-date',dueDate:undefined,overdue:false});
  expect(index.has('company')).toBe(false);
  expect(index.has('unrelated')).toBe(false);
 });
 it('keeps never, 30-day inactivity, and overdue as separate filters',()=>{
  const followUps=personFollowUpIndex([task('overdue',{dueDate:'2026-11-09',
   linked:{type:'contact',id:'active'}})],today);
  expect(matchesPersonAttentionFilter('unknown','never',recent,followUps,today)).toBe(true);
  expect(matchesPersonAttentionFilter('unknown','stale',recent,followUps,today)).toBe(false);
  expect(matchesPersonAttentionFilter('stale','stale',recent,followUps,today)).toBe(true);
  expect(matchesPersonAttentionFilter('boundary','stale',recent,followUps,today)).toBe(true);
  expect(matchesPersonAttentionFilter('active','stale',recent,followUps,today)).toBe(false);
  expect(matchesPersonAttentionFilter('active','overdue',recent,followUps,today)).toBe(true);
  expect(matchesPersonAttentionFilter('stale','overdue',recent,followUps,today)).toBe(false);
 });
});
