import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Activity} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import {gmailCombinedSaveState} from './gmailCombinedWorkflow365';
import {gmailFollowUpSourceId} from './gmailFollowUp364';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fingerprint='b'.repeat(64);
const logged:Activity={id:'activity_gmail_'+fingerprint.slice(0,40),type:'manual-touchpoint',
 occurredAt:'2026-11-15T13:00:00Z',metadata:{
  gmailMessageFingerprint:fingerprint,interactionMethod:'email'}} as Activity;
describe('Gmail independent follow-up UX #366',()=>{
 it('automatic Person matching never implies an email was logged',()=>{
  expect(gmailCombinedSaveState([],[],fingerprint,false))
   .toMatchObject({needsActivity:true,needsTask:false,canSubmit:true});
  const personPanel=read('components/RecordEmailThreadsPanel.tsx');
  expect(personPanel).toContain('matchingPersonThreads(page.threads,personEmail)');
  expect(personPanel).toContain('<EmailActivityLogger363');
  expect(personPanel).not.toContain('recordActivity(');
 });
 it('already logged email leaves a separate follow-up available',()=>{
  expect(gmailCombinedSaveState([logged],[],fingerprint,true))
   .toMatchObject({needsActivity:false,needsTask:true,canSubmit:true});
  expect(gmailCombinedSaveState([logged],[],fingerprint,false))
   .toMatchObject({needsActivity:false,needsTask:false,canSubmit:false});
 });
 it('a preexisting Task is recognized independently from email Activity status',()=>{
  const task={id:'t1',title:'Follow up',createdAt:'2026-11-16T10:00:00Z',
   updatedAt:'2026-11-16T10:00:00Z',sourceObjectId:gmailFollowUpSourceId(fingerprint)} as PersonalTask;
  expect(gmailCombinedSaveState([], [task],fingerprint,true))
   .toMatchObject({needsActivity:true,needsTask:false,canSubmit:true});
  expect(gmailCombinedSaveState([logged],[task],fingerprint,true))
   .toMatchObject({needsActivity:false,needsTask:false,canSubmit:false});
 });
 it('renders Task action before the expandable Activity logger',()=>{
  const logger=read('components/EmailActivityLogger363.tsx');
  const shared=logger.indexOf('ss-email-activity-targets');
  const followUp=logger.indexOf('<EmailFollowUp364');
  const logPanel=logger.indexOf('ss-email-log-panel');
  expect(shared).toBeGreaterThan(0);
  expect(followUp).toBeGreaterThan(shared);
  expect(logPanel).toBeGreaterThan(followUp);
  expect(logger).toContain('Email Activity already logged · View details');
  expect(logger).toContain('Log this email as an Activity (optional)');
  expect(logger).toContain('Log email + create follow-up');
  expect(logger).not.toContain('localStorage.setItem(');
  const standalone=read('components/EmailFollowUp364.tsx');
  expect(standalone).toContain('createTask(');
  expect(standalone).toContain('existingGmailFollowUp');
  expect(standalone).not.toContain('recordActivity(');
 });
 it('clarifies that matched emails are NOT Activities in Gmail workspace',()=>{
  expect(read('components/EmailWorkspace.tsx'))
   .toContain('Automatically matched Gmail conversations are NOT CRM Activities');
 });
});
