import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {bidReminderDate,bidReminderTitle} from './bidReminderPlanning353d';
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Batch 353d — opt-in bid reminders and guided task follow-up',()=>{
 it('substracts calendar dates over DST/month/year correctly',()=>{
  expect(bidReminderDate('2026-03-10',3)).toBe('2026-03-07');
  expect(bidReminderDate('2027-01-02',7)).toBe('2026-12-26');
  expect(bidReminderDate('2026-11-20',1)).toBe('2026-11-19');
 });
 it('rejects invalid dates and preserves the title',()=>{
  expect(bidReminderDate('2026-02-30',1)).toBeNull();
  expect(bidReminderDate('2026-11-32',3)).toBeNull();
  expect(bidReminderDate('bad',7)).toBeNull();
  expect(bidReminderTitle('  Oak Homes  ')).toBe('Prepare bid · Oak Homes');
 });
 it('task-linked Activity preselects the optional follow-up but still requires a save',()=>{
  expect(src('components/TaskModalHost.tsx')).toContain('openActivityComposer({taskId:task.id,planFollowUp:true})');
  expect(src('components/QuickActivityLauncher.tsx')).toContain('setCreateFollowUp(Boolean(request.planFollowUp))');
  expect(src('components/QuickActivityLauncher.tsx')).toContain('if(createFollowUp)');
  expect(src('components/QuickActivityLauncher.tsx')).toContain('if(workflowTaskId)completeTask(workflowTaskId)');
 });
 it('new reminders remain private, avoid duplicate open tasks and respect prebid restrictions',()=>{
  const comp=src('components/DealBidReminder.tsx');
  expect(comp).toContain('dealNeedsSubmission(deal)');
  expect(comp).toContain('workspaceScope===scope');
  expect(comp).toContain("mode:'preview',id:existing.id");
  expect(comp).toContain("mode:'create',title,dueDate:date,type:'follow-up'");
  expect(comp).toContain("link.type==='project'&&link.id===deal.id");
  expect(src('components/RecordTasksPanel.tsx')).toContain('{quickActions}');
  expect(src('components/DealRecordPage.tsx')).toContain('quickActions={<DealBidReminder deal={deal}/>}');
 });
});
