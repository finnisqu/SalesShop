import {describe,expect,it} from 'vitest';
import type {PersonalTask} from '../store/personalTaskStore';
import {mergePrivateTasks,preserveBidSubmissionProof,taskWinsMerge} from './personalTaskCloudSync';

const proof='2026-11-13T12:00:00.000Z';
const old='2026-11-13T11:00:00.000Z';
const newer='2026-11-13T13:00:00.000Z';
const task=(id:string,change:Partial<PersonalTask>={}):PersonalTask=>({
 id,title:'Submit quote',sourceObjectId:'deal-submit:deal-1',
 status:'open',workspaceScope:'org:company-1:user:rep-1',
 createdAt:old,updatedAt:old,...change,
});

describe('Batch 330: cross-device bid submission proof integrity',()=>{
 it('preserves confirmed proof even when another device has the later edit',()=>{
  const completed=task('t1',{updatedAt:proof,status:'completed',completedAt:proof,
   submissionConfirmedAt:proof});
  const stale=task('t1',{updatedAt:newer,title:'Updated deadline notes',
   dueDate:'2026-11-19'});
  expect(taskWinsMerge(stale,completed)).toBe(true);
  const [merged]=mergePrivateTasks([stale],[completed]);
  expect(merged).toMatchObject({
   status:'open',title:'Updated deadline notes',dueDate:'2026-11-19',
   submissionConfirmedAt:proof,updatedAt:newer,
  });
  // Recovery of evidence must not invent a completion or mutate the inputs.
  expect(merged.completedAt).toBeUndefined();
  expect(stale.submissionConfirmedAt).toBeUndefined();
  expect(completed.status).toBe('completed');
 });
 it('retains the earliest valid confirmation on equal timestamps and retries',()=>{
  const remote=task('t1',{submissionConfirmedAt:proof});
  const local=task('t1',{submissionConfirmedAt:'2026-11-13T12:30:00.000Z'});
  expect(mergePrivateTasks([local],[remote])[0].submissionConfirmedAt).toBe(proof);
  const duplicate=mergePrivateTasks([remote],[remote])[0];
  expect(duplicate.submissionConfirmedAt).toBe(proof);
 });
 it('never moves a submission proof across Deals, workspaces, or unrelated tasks',()=>{
  const confirmed=task('t1',{submissionConfirmedAt:proof});
  expect(preserveBidSubmissionProof(task('t1',{
   sourceObjectId:'deal-submit:deal-2'}),confirmed).submissionConfirmedAt).toBeUndefined();
  expect(preserveBidSubmissionProof(task('t1',{
   workspaceScope:'org:company-2:user:rep-1'}),confirmed).submissionConfirmedAt).toBeUndefined();
  expect(mergePrivateTasks([task('other')],[confirmed])).toHaveLength(2);
 });
 it('keeps newer deletion and cancellation semantics intact',()=>{
  const confirmed=task('t1',{submissionConfirmedAt:proof});
  const tombstone=task('t1',{deletedAt:newer,updatedAt:newer});
  expect(mergePrivateTasks([tombstone],[confirmed])[0]).toEqual(tombstone);
  const canceled=task('t1',{status:'canceled',updatedAt:newer});
  expect(mergePrivateTasks([canceled],[confirmed])[0]).toMatchObject({
   status:'canceled',submissionConfirmedAt:proof,
  });
 });
 it('ignores invalid proof timestamps on stale copies',()=>{
  const malformed=task('t1',{submissionConfirmedAt:'not-a-date'});
  const winner=task('t1',{updatedAt:newer});
  expect(mergePrivateTasks([winner],[malformed])[0].submissionConfirmedAt).toBeUndefined();
 });
});
