import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Contact} from '../types/crm';
import type {GmailThreadSummary} from './gmailRead359a';
import {classifyGmailTriage,filterGmailTriage,gmailTriageCounts,mayNeedGmailReplyReview}
 from './gmailTriage367';
const now=Date.parse('2026-11-17T12:00:00Z');
const contact=(id:string,email:string):Contact=>({id,name:id,email} as Contact);
const thread=(id:string,from:string,participants:string[],date='2026-11-15T12:00:00Z'):
 GmailThreadSummary=>({id,subject:'Private subject',from,participants,date,
  messageCount:2,snippet:'Private body snippet'});
const items=[
 thread('t1','Jane <jane@builder.com>',['rep@shop.com','jane@builder.com']),
 thread('t2','Rep <rep@shop.com>',['rep@shop.com','jane@builder.com']),
 thread('t3','Visitor <visitor@example.com>',['rep@shop.com','visitor@example.com']),
 thread('t4','No Reply <no-reply@systems.com>',['rep@shop.com','no-reply@systems.com']),
 thread('t5','Unknown',['rep@shop.com']),
 thread('t6','Jane <jane@builder.com>',['rep@shop.com','jane@builder.com','new@example.com']),
];
describe('Gmail triage #367',()=>{
 it('matches existing People by exact normalized email, not name or domain',()=>{
  const triage=classifyGmailTriage(items,[contact('p1',' JANE@BUILDER.COM '),
   contact('p2','janet@builder.com')],'REP@SHOP.COM',now);
  expect(triage[0].people.map(p=>p.id)).toEqual(['p1']);
  expect(triage[0].unknownAddresses).toEqual([]);
  expect(triage[2].people).toEqual([]);
  expect(triage[2].unknownAddresses).toEqual(['visitor@example.com']);
  expect(triage[5].people.map(p=>p.id)).toEqual(['p1']);
  expect(triage[5].unknownAddresses).toEqual(['new@example.com']);
 });
 it('counts the loaded rows only and allows overlap between Known and Unknown',()=>{
  const triage=classifyGmailTriage(items,[contact('p1','jane@builder.com')],
   'rep@shop.com',now);
  expect(gmailTriageCounts(triage)).toEqual({all:6,review:3,known:3,new:3});
  expect(filterGmailTriage(triage,'known').map(item=>item.thread.id))
   .toEqual(['t1','t2','t6']);
  expect(filterGmailTriage(triage,'new').map(item=>item.thread.id))
   .toEqual(['t3','t4','t6']);
  expect(filterGmailTriage(triage,'review').map(item=>item.thread.id))
   .toEqual(['t1','t3','t6']);
 });
 it('does not infer a reply is needed from outgoing, no-reply, invalid, old or recent summaries',()=>{
  expect(mayNeedGmailReplyReview(items[0],'rep@shop.com',now)).toBe(true);
  expect(mayNeedGmailReplyReview(items[1],'rep@shop.com',now)).toBe(false);
  expect(mayNeedGmailReplyReview(items[3],'rep@shop.com',now)).toBe(false);
  expect(mayNeedGmailReplyReview(items[0],'different@shop.com',now)).toBe(false);
  expect(mayNeedGmailReplyReview({...items[0],date:'2026-11-17T11:00:00Z'},
   'rep@shop.com',now)).toBe(false);
  expect(mayNeedGmailReplyReview({...items[0],date:'2026-10-01T12:00:00Z'},
   'rep@shop.com',now)).toBe(false);
 });
 it('does not persist email, make CRM writes or claim automatic Activity logging',()=>{
  const module=readFileSync(new URL('./gmailTriage367.ts',import.meta.url),'utf8');
  expect(module).not.toContain('localStorage.');
  expect(module).not.toContain('recordActivity(');
  expect(module).not.toContain('createTask(');
  const ui=readFileSync(new URL('../components/EmailWorkspace.tsx',import.meta.url),'utf8');
  expect(ui).toContain('filterGmailTriage');
  expect(ui).toContain('Unknown participants');
  expect(ui).toContain('Review replies');
  expect(ui).toContain('loaded conversations');
  expect(ui).toContain('<EmailPersonCreate362');
  expect(ui).toContain('<EmailActivityLogger363');
 });
});
