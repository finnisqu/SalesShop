import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import type {Activity,Contact,Project} from '../types/crm';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {personLastContactIndex} from './personLastContact';
import {activityRelationsWithContext,primaryActivityRelations} from './activityRelations';
import {gmailActivityId,gmailActivitySourceKey,gmailMessageDate,gmailMessageDirection,loggedGmailActivity}
 from './gmailActivity363';
import type {GmailVisibleMessage} from './gmailRead359a';
import {readFileSync} from 'node:fs';

const data=new Map<string,string>();
beforeEach(()=>{
 vi.stubGlobal('crypto',webcrypto);data.clear();
 vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,
  setItem:(k:string,v:string)=>{data.set(k,v);}});
 useAuthStore.setState({mode:'local',organizationId:null,user:null});
 useCrmStore.setState({contacts:[],companies:[],projects:[],activities:[],hydrated:true});
});
afterEach(()=>vi.unstubAllGlobals());
const email:GmailVisibleMessage={id:'message123',from:'Jane <jane@builder.com>',
 to:'Rep <rep@salesshop.work>',date:'2026-11-15T12:00:00.000Z',
 subject:'Countertops',text:'Full private body'};
describe('Gmail explicit Activity logging #363',()=>{
 it('preserves original message timestamp and does not mark future/invalid messages',()=>{
  expect(gmailMessageDate(email,Date.parse('2026-11-16T12:00:00Z')))
   .toBe('2026-11-15T12:00:00.000Z');
  expect(gmailMessageDate({...email,id:'../evil'})).toBeNull();
  expect(gmailMessageDate({...email,date:'2099-01-01'})).toBeNull();
  expect(gmailMessageDirection(email,'rep@salesshop.work')).toBe('received');
  expect(gmailMessageDirection({...email,from:'Rep <REP@SALESSHOP.WORK>'},
   'rep@salesshop.work')).toBe('sent');
 });
 it('hashes message identity without saving raw mailbox, thread or message identifiers',async()=>{
  const sourceKey=await gmailActivitySourceKey('org1','REP@SALESSHOP.WORK','message123');
  expect(sourceKey).toMatch(/^[a-f0-9]{64}$/);
  expect(sourceKey).toBe(await gmailActivitySourceKey('org1','rep@salesshop.work','message123'));
  expect(sourceKey).not.toBe(await gmailActivitySourceKey('org2','rep@salesshop.work','message123'));
  expect(sourceKey).not.toBe(await gmailActivitySourceKey('org1','rep@salesshop.work','message124'));
  expect(sourceKey).not.toContain('rep@salesshop.work');
  expect(gmailActivityId(sourceKey)).toMatch(/^activity_gmail_[a-f0-9]{40}$/);
  await expect(gmailActivitySourceKey('org1','invalid','message123')).rejects.toThrow();
 });
 it('logs a real email touchpoint and updates Last Contacted without a separate mutation',async()=>{
  const person={id:'p1',name:'Jane',email:'jane@builder.com',companyId:'c1'} as Contact;
  const deal={id:'d1',name:'New Building',companyId:'c1'} as Project;
  const relations=activityRelationsWithContext([{type:'contact',id:'p1'},
   {type:'project',id:'d1'}],[person],[deal],[]);
  expect(relations.map(link=>link.type+':'+link.id))
   .toEqual(['contact:p1','project:d1','company:c1']);
  const primary=primaryActivityRelations(relations);
  const fingerprint=await gmailActivitySourceKey('org1','rep@salesshop.work',email.id);
  const activityId=gmailActivityId(fingerprint);
  const logged=useCrmStore.getState().recordActivity({
   id:activityId,type:'manual-touchpoint',summary:'Email with Jane',
   occurredAt:email.date,...primary,
   metadata:{interactionMethod:'email',relatedRecords:relations,
    gmailMessageFingerprint:fingerprint,gmailDirection:'received'},
  });
  expect(logged).toBe(activityId);
  expect(personLastContactIndex(useCrmStore.getState().activities).get('p1'))
   .toMatchObject({occurredAt:email.date,method:'email'});
  expect(loggedGmailActivity(useCrmStore.getState().activities,fingerprint)?.id).toBe(activityId);
  expect(JSON.stringify(useCrmStore.getState().activities)).not.toContain('Full private body');
  expect(JSON.stringify(useCrmStore.getState().activities)).not.toContain('message123');
 });
 it('retains no source matches for a different message; one thread can have multiple Activities',async()=>{
  const a=await gmailActivitySourceKey('org','mail@company.com','message123');
  const b=await gmailActivitySourceKey('org','mail@company.com','message124');
  expect(a).not.toBe(b);
  expect(loggedGmailActivity([],a)).toBeUndefined();
 });
 it('uses an explicit UI for Gmail and record detail; never logs merely on read',()=>{
  const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const ui=source('components/EmailActivityLogger363.tsx');
  expect(ui).toContain('Log email Activity');
  expect(ui).toContain('loggedGmailActivity');
  expect(ui).toContain('recordActivityOnce');
  expect(ui).toContain('validGmailToken(scope)');
  expect(ui).toContain('activityRelationsWithContext');
  expect(ui).not.toContain('localStorage.setItem(');
  expect(source('components/EmailWorkspace.tsx')).toContain('<EmailActivityLogger363');
  expect(source('components/RecordEmailThreadsPanel.tsx')).toContain('<EmailActivityLogger363');
 });
});
