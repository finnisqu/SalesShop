import {describe,expect,it} from 'vitest';
import {personQuickFollowUp} from './personQuickFollowUp';

const options={
 activityId:'act-123',personName:'Jordan Smith',method:'call' as const,
 dueDate:'2026-11-11',today:'2026-11-10',
 associations:[{type:'contact' as const,id:'p1',label:'Person · Jordan Smith'},
  {type:'company' as const,id:'c1',label:'Company · Builder'}],
};
describe('Person quick-contact follow-up creation',()=>{
 it('creates a personal Follow-ups task preserving Person and Company links',()=>{
  const task=personQuickFollowUp(options);
  expect(task.title).toBe('Follow up · Jordan Smith');
  expect(task.changes).toMatchObject({
   type:'follow-up',queue:'Follow-ups',status:'open',
   dueDate:'2026-11-11',sourceObjectId:'activity-followup:act-123',
   associations:options.associations,
  });
 });
 it('derives the same activity idempotency key across retries',()=>{
  const a=personQuickFollowUp(options);
  const b=personQuickFollowUp(options);
  expect(a.changes.sourceObjectId).toBe(b.changes.sourceObjectId);
 });
 it('requires a real linked contact and valid future due date',()=>{
  expect(()=>personQuickFollowUp({...options,dueDate:'2026-11-09'})).toThrow();
  expect(()=>personQuickFollowUp({...options,associations:[]})).toThrow();
  expect(()=>personQuickFollowUp({...options,dueDate:'invalid'})).toThrow();
 });
});
