import {describe,it,expect} from 'vitest';
import {taskScope,type PersonalTask} from '../store/personalTaskStore';
import {buildHomeAgenda,nextLocalDay} from './homeAgenda';
import type {QuoteFollowUpItem} from './quoteFollowUps';
const task=(id:string,dueDate?:string):PersonalTask=>({id,title:id,createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-01T10:00:00Z',dueDate});
const quoteItem={quote:{id:'Q1',title:'Quote'} as QuoteFollowUpItem['quote'],
  label:'Follow up',reason:'Called',priority:'due' as const,dueDate:'2026-10-15'};
describe('personal Today task isolation',()=>{
 it('never shares a cloud task namespace across users or workspaces',()=>{
   expect(taskScope('cloud','org-A','user-A')).toBe('org:org-A:user:user-A');
   expect(taskScope('cloud','org-A','user-B')).not.toBe(taskScope('cloud','org-A','user-A'));
   expect(taskScope('cloud','org-B','user-A')).not.toBe(taskScope('cloud','org-A','user-A'));
   expect(taskScope('cloud','org-A',undefined)).toBeNull();
   expect(taskScope('local',null,undefined)).toBe('local:user');
 });
 it('orders overdue and today tasks ahead of quote suggestions, hiding snoozed/completed tasks',()=>{
   const rows=buildHomeAgenda([task('tomorrow','2026-10-16'),task('overdue','2026-10-10'),
     task('today','2026-10-15'),{...task('done','2026-10-15'),completedAt:'2026-10-15T09:00:00Z'}],
     [quoteItem as QuoteFollowUpItem], '2026-10-15');
   expect(rows.map(r=>r.id)).toEqual(['task:overdue','task:today','quote:Q1']);
 });
 it('handles day and year rollover when snoozing',()=>{
   expect(nextLocalDay('2026-12-31')).toBe('2027-01-01');
 });
});
