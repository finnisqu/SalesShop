import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {PersonalTask} from '../store/personalTaskStore';
import {taskCompletionBlocker,taskBulkCompletionPlan} from './taskCompletionEligibility';

type Candidate=Pick<PersonalTask,
 'id'|'status'|'completedAt'|'subtasks'|'sourceObjectId'|'submissionConfirmedAt'>;
const task=(id:string,changes:Partial<Candidate>={}):Candidate=>({
 id,status:'open',...changes,
});
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 339 — Task completion matches checklist and bid guards',()=>{
 it('requires confirmed submission for protected bid tasks',()=>{
  const protectedBid=task('bid',{sourceObjectId:'deal-submit:deal-1'});
  expect(taskCompletionBlocker(protectedBid)).toBe('bid-submission');
  expect(taskCompletionBlocker({...protectedBid,submissionConfirmedAt:'2026-11-13T10:00:00Z'})).toBeNull();
 });
 it('refuses to mark tasks finished until their checklist is complete',()=>{
  const unfinished=task('task-1',{subtasks:[
   {id:'1',title:'Confirm sizes',completed:true},
   {id:'2',title:'Email customer',completed:false},
  ]});
  expect(taskCompletionBlocker(unfinished)).toBe('incomplete-checklist');
  expect(taskCompletionBlocker({...unfinished,subtasks:unfinished.subtasks?.map(s=>({...s,completed:true}))})).toBeNull();
 });
 it('completes only eligible current tasks and counts every blocker accurately',()=>{
  const eligible=task('ready');
  const approvedBid=task('confirmed',{sourceObjectId:'deal-submit:deal-2',
   submissionConfirmedAt:'2026-11-13T10:00:00Z'});
  const protectedBid=task('blocked-bid',{sourceObjectId:'deal-submit:deal-1'});
  const unfinished=task('checklist',{subtasks:[{id:'check',title:'Finish',completed:false}]});
  const alreadyDone=task('done',{status:'completed'});
  const canceled=task('canceled',{status:'canceled'});
  const datedDone=task('dated',{completedAt:'2026-11-13T00:00:00Z'});
  const plan=taskBulkCompletionPlan([
   eligible,approvedBid,protectedBid,unfinished,alreadyDone,canceled,datedDone,
  ]);
  expect(plan.eligible.map(t=>t.id)).toEqual(['ready','confirmed']);
  expect(plan.bidBlocked).toBe(1);
  expect(plan.checklistBlocked).toBe(1);
 });
 it('prioritizes the bid submission guard if both blockers apply',()=>{
  const both=task('both',{sourceObjectId:'deal-submit:deal-1',
   subtasks:[{id:'item',title:'Confirm',completed:false}]});
  expect(taskCompletionBlocker(both)).toBe('bid-submission');
  expect(taskBulkCompletionPlan([both])).toMatchObject({
   eligible:[],bidBlocked:1,checklistBlocked:0,
  });
 });
 it('uses the same guard in single-task and bulk-task actions',()=>{
  const tasks=src('components/TasksWorkspace.tsx');
  expect(tasks).toContain("const blocker=taskCompletionBlocker(task)");
  expect(tasks).toContain("const plan=taskBulkCompletionPlan(own.filter(task=>selectedIds.has(task.id)))");
  expect(tasks).toContain('plan.eligible.forEach(task=>complete(task.id))');
  expect(tasks).toContain("plan.checklistBlocked?plan.checklistBlocked+' task(s) still have unfinished checklist items.");
  expect(tasks).toContain('unfinished checklist items.');
  expect(tasks).toContain('record an external quote');
  const store=src('store/personalTaskStore.ts');
  expect(store).toContain("deriveSubtaskStatus(patch.status??task.status??'open'");
  expect(store).toContain("isProtectedBidTask(task)&&!task.submissionConfirmedAt");
 });
});
