import {describe,expect,it} from 'vitest';
import {dealNeedsSubmission} from '../store/personalTaskStore';
import type {Project} from '../types/crm';
const deal=(stage:Project['stage'],dueDate?:string)=>({
 id:'d',name:'Example Deal',stage,dueDate,
 createdAt:'2026-11-03T12:00:00Z',updatedAt:'2026-11-03T12:00:00Z',
}) satisfies Project;
describe('automatic bid submission obligations',()=>{
 it('creates submissions only while a bid still needs to be sent',()=>{
  expect(dealNeedsSubmission(deal('Discovery','2026-11-05'))).toBe(true);
  expect(dealNeedsSubmission(deal('Intent to Bid','2026-11-05'))).toBe(true);
  expect(dealNeedsSubmission(deal('Bid Development','2026-11-05'))).toBe(true);
  expect(dealNeedsSubmission(deal('Bid Sent','2026-11-05'))).toBe(false);
  expect(dealNeedsSubmission(deal('Closed Won','2026-11-05'))).toBe(false);
  expect(dealNeedsSubmission(deal('Discarded','2026-11-05'))).toBe(false);
  expect(dealNeedsSubmission(deal('Bid Development'))).toBe(false);
 });
});
