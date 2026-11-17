import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {PersonalTask} from '../store/personalTaskStore';
import type {Activity} from '../types/crm';
import {gmailActivitySourceKey} from './gmailActivity363';
import {gmailFollowUpSourceId} from './gmailFollowUp364';
import {summarizeGmailThread} from './gmailRead359a';
import {gmailTriageTaskLabel,gmailTriageWorkStatus} from './gmailTriageWork369';

const fingerprint='a'.repeat(64);
const task=(id:string,status:PersonalTask['status']):PersonalTask=>({
 id,createdAt:'2026-11-16T10:00:00Z',updatedAt:'2026-11-16T10:00:00Z',
 title:'Follow up',sourceObjectId:gmailFollowUpSourceId(fingerprint),
 status,dueDate:'2026-11-16',
});
const activity={id:'a1',type:'manual-touchpoint',
 metadata:{interactionMethod:'email',gmailMessageFingerprint:fingerprint},
 occurredAt:'2026-11-16T10:00:00Z'} as Activity;
describe('Gmail review queue honors existing follow-up Tasks #369',()=>{
 it('matches an existing open Task for the latest message and a separately logged Activity',()=>{
  const x=gmailTriageWorkStatus(fingerprint,[task('t1','open')],[activity]);
  expect(x).toMatchObject({outstanding:true,alreadyHandled:true});
  expect(x.task?.id).toBe('t1');
  expect(x.activity?.id).toBe('a1');
  expect(gmailTriageTaskLabel(x.task!,'2026-11-17'))
   .toBe('Follow-up overdue · 2026-11-16');
 });
 it('recognizes a completed Task but does not count it as outstanding',()=>{
  const x=gmailTriageWorkStatus(fingerprint,[task('t2','completed')],[]);
  expect(x).toMatchObject({outstanding:false,alreadyHandled:true});
  expect(gmailTriageTaskLabel(x.task!)).toBe('Follow-up completed');
 });
 it('allows canceled and deleted Tasks to re-enter review',()=>{
  expect(gmailTriageWorkStatus(fingerprint,[task('t2','canceled')],[]))
   .toMatchObject({outstanding:false,alreadyHandled:false});
  expect(gmailTriageWorkStatus(fingerprint,[{...task('t3','open'),deletedAt:'2026-11-17'}],[]))
   .toMatchObject({outstanding:false,alreadyHandled:false});
 });
 it('does not mistake unrelated, older-message, or other-account fingerprints for a Task',()=>{
  const x=gmailTriageWorkStatus('b'.repeat(64),[task('t1','open')],[activity]);
  expect(x).toMatchObject({outstanding:false,alreadyHandled:false,task:undefined,activity:undefined});
  expect(gmailTriageWorkStatus(null,[task('t1','open')],[activity]).outstanding).toBe(false);
 });
 it('supplies last Gmail message ID from the read-only metadata, without changing stored Task',async()=>{
  const summary=summarizeGmailThread({id:'thread369',messages:[
   {id:'messageFirst',internalDate:'1794873600000',payload:{headers:[
    {name:'From',value:'Rep <rep@shop.com>'},{name:'To',value:'Customer <customer@example.com>'}]}},
   {id:'messageLatest',internalDate:'1794960000000',payload:{headers:[
    {name:'From',value:'Customer <customer@example.com>'},{name:'To',value:'Rep <rep@shop.com>'}]}},
  ]});
  expect(summary.latestMessageId).toBe('messageLatest');
  const previous=await gmailActivitySourceKey('org','rep@shop.com','messageFirst');
  const latest=await gmailActivitySourceKey('org','rep@shop.com',summary.latestMessageId!);
  expect(latest).not.toBe(previous);
  expect(gmailTriageWorkStatus(latest,[{
   ...task('t1','open'),sourceObjectId:gmailFollowUpSourceId(previous),
  }],[]).outstanding).toBe(false);
 });
 it('renders work status and a direct Tasks destination without any automatic writes',()=>{
  const workspace=readFileSync(new URL('../components/EmailWorkspace.tsx',import.meta.url),'utf8');
  expect(workspace).toContain("title:'Follow-ups'");
  expect(workspace).toContain('gmailTriageWorkStatus');
  expect(workspace).toContain('View in Tasks');
  expect(workspace).toContain('rememberRecordsSection');
  expect(workspace).not.toContain('recordActivity(');
  expect(workspace).not.toContain('createTask(');
 });
});
