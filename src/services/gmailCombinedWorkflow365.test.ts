import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Activity} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {GmailThreadDetails,GmailVisibleMessage} from './gmailRead359a';
import {gmailCombinedSaveState,suggestGmailReply} from './gmailCombinedWorkflow365';
import {gmailFollowUpSourceId} from './gmailFollowUp364';
import {gmailActivityId} from './gmailActivity363';
import {recordActivityOnce} from './activitySaveRecovery351d';

const fingerprint='a'.repeat(64);
const message=(from:string,to:string,date:string,id='message365'):GmailVisibleMessage=>
 ({id,from,to,date,subject:'Bid documents',text:'Private email body'});
const thread=(messages:GmailVisibleMessage[]):GmailThreadDetails=>({
 summary:{id:'thread365',subject:'Bid documents',from:messages.at(-1)?.from??'',
  date:messages.at(-1)?.date??'',participants:['me@shop.com','client@builder.com'],
  messageCount:messages.length,snippet:'Potential private details'},messages,
});
const now=Date.parse('2026-11-16T20:00:00Z');
describe('Gmail combined log and follow-up #365',()=>{
 it('suggests an optional reply for an unanswered-looking incoming message older than one day',()=>{
  const details=thread([
   message('Me <me@shop.com>','Client <client@builder.com>','2026-11-12T09:00:00Z','earlier'),
   message('Client <client@builder.com>','Me <me@shop.com>','2026-11-14T09:00:00Z'),
  ]);
  expect(suggestGmailReply(details,'ME@SHOP.COM',now)).toMatchObject({
   messageId:'message365',daysOld:2});
 });
 it('does not suggest when newest message is a reply sent by us, too recent or old',()=>{
  const received=message('client@builder.com','me@shop.com','2026-11-14T09:00:00Z');
  expect(suggestGmailReply(thread([received,
   message('me@shop.com','client@builder.com','2026-11-15T12:00:00Z','sent')]),
   'me@shop.com',now)).toBeNull();
  expect(suggestGmailReply(thread([message('client@builder.com','me@shop.com',
   '2026-11-16T15:00:00Z')]),'me@shop.com',now)).toBeNull();
  expect(suggestGmailReply(thread([message('client@builder.com','me@shop.com',
   '2026-10-01T10:00:00Z')]),'me@shop.com',now)).toBeNull();
 });
 it('ignores notifications, CC-only messages and other mailboxes',()=>{
  expect(suggestGmailReply(thread([message('no-reply@builder.com','me@shop.com',
   '2026-11-14T09:00:00Z')]),'me@shop.com',now)).toBeNull();
  expect(suggestGmailReply(thread([message('client@builder.com','other@shop.com',
   '2026-11-14T09:00:00Z')]),'me@shop.com',now)).toBeNull();
 });
 it('is idempotent if the Activity saves but the Task step fails; retries only create the Task',()=>{
  const activities:Activity[]=[];const tasks:PersonalTask[]=[];
  let state=gmailCombinedSaveState(activities,tasks,fingerprint,true);
  expect(state).toMatchObject({needsActivity:true,needsTask:true,canSubmit:true});
  const id=gmailActivityId(fingerprint);
  let writes=0;
  const log=(candidate:string)=>{writes++;activities.push({id:candidate,
   type:'manual-touchpoint',occurredAt:'2026-11-14T09:00:00Z',
   metadata:{interactionMethod:'email',gmailMessageFingerprint:fingerprint}} as Activity);return candidate;};
  recordActivityOnce(id,activities,log);
  // A simulated Task failure occurs after Activity persistence.
  state=gmailCombinedSaveState(activities,tasks,fingerprint,true);
  expect(state).toMatchObject({needsActivity:false,needsTask:true,canSubmit:true});
  recordActivityOnce(id,activities,log);
  expect(writes).toBe(1);
  tasks.push({id:'task365',title:'Follow up · Client',createdAt:'2026-11-16',
   updatedAt:'2026-11-16',sourceObjectId:gmailFollowUpSourceId(fingerprint)} as PersonalTask);
  expect(gmailCombinedSaveState(activities,tasks,fingerprint,true))
   .toMatchObject({needsActivity:false,needsTask:false,canSubmit:false});
  expect(gmailCombinedSaveState(activities,tasks,fingerprint,false))
   .toMatchObject({needsActivity:false,needsTask:false,canSubmit:false});
 });
 it('retains a standalone Task-only control alongside the combined action',()=>{
  const ui=readFileSync(new URL('../components/EmailActivityLogger363.tsx',import.meta.url),'utf8');
  expect(ui).toContain('Log email + create follow-up');
  expect(ui).toContain('gmailCombinedSaveState');
  expect(ui).toContain('recordActivityOnce');
  expect(ui).toContain('Log this email as an Activity (optional)');
  expect(ui.indexOf('ss-email-activity-targets')).toBeLessThan(ui.indexOf('<EmailFollowUp364'));
  expect(ui.indexOf('<EmailFollowUp364')).toBeLessThan(ui.indexOf('ss-email-log-panel'));
  expect(ui).toContain('suggestGmailReply');
  expect(ui).toContain('validGmailToken(scope)');
  expect(ui).not.toContain('localStorage.setItem(');
  expect(ui).not.toContain('message.text');
 });
});
