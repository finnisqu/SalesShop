import {describe,expect,it} from 'vitest';
import {gmailAddressesInDetails395,gmailAddressFindings395,gmailThreadWithAddresses395}
 from './gmailBodyDiscovery395';
import type {GmailThreadDetails} from './gmailRead359a';
import type {Contact} from '../types/crm';
import {emailTargetSuggestions} from './emailThreadMatching359a';

const summary={
 id:'thread-test',subject:'Project notice',from:'updates@platform.example',
 date:'2026-11-23T12:00:00Z',snippet:'Review the plans',
 participants:['updates@platform.example','myinbox@gmail.com'],
 messageCount:2,
};
const details:GmailThreadDetails={summary,messages:[
 {id:'m1',from:'updates@platform.example',to:'myinbox@gmail.com',
  replyTo:'operations@builder.example',date:summary.date,subject:summary.subject,
  text:'Please review',searchText:[
   'Please review the attached project details.',
   'Forwarded message',
   'From: Jane Smith <jane.smith@builder.example>',
   'To: estimates@subcontractor.example',
   'Please send proposals to jane.smith@builder.example.',
   'See site https://builder.example/jane for context.',
   'Contract email: contracts@builder.example',
  ].join('\n')},
 {id:'m2',from:'myinbox@gmail.com',to:'updates@platform.example',
  date:summary.date,subject:summary.subject,text:'Thanks!'},
]};
const contacts:Contact[]=[{
 id:'p1',name:'Jane Smith',email:'jane.smith@builder.example',
 createdAt:summary.date,updatedAt:summary.date,
}];
describe('#395 — address discovery in live opened Gmail messages',()=>{
 it('discovers addresses deep in quoted chains, and ignores only the verified Gmail mailbox',()=>{
  const found=gmailAddressesInDetails395(details,'myinbox@gmail.com');
  expect(found.some(p=>p.address==='jane.smith@builder.example'&&p.evidence==='body')).toBe(true);
  expect(found.some(p=>p.address==='estimates@subcontractor.example')).toBe(true);
  expect(found.some(p=>p.address==='contracts@builder.example')).toBe(true);
  expect(found.some(p=>p.address==='myinbox@gmail.com')).toBe(false);
 });
 it('prioritizes real Reply-To over platform From and recognizes existing CRM People',()=>{
  const found=gmailAddressFindings395(details,contacts,'myinbox@gmail.com');
  expect(found[0].address).toBe('jane.smith@builder.example');
  expect(found[0].people.map(p=>p.name)).toEqual(['Jane Smith']);
  expect(found.find(p=>p.address==='operations@builder.example')?.evidence).toBe('reply-to');
  expect(found.find(p=>p.address==='updates@platform.example')?.evidence).toBe('header');
 });
 it('does not turn domain similarity into an automatic person match',()=>{
  const found=gmailAddressFindings395(details,contacts,'myinbox@gmail.com');
  expect(found.find(p=>p.address==='contracts@builder.example')?.people).toEqual([]);
 });
 it('enriches only the in-memory thread view for list matching',()=>{
  const known=gmailThreadWithAddresses395(summary,[{address:'jane.smith@builder.example'}]);
  expect(known.participants).toContain('jane.smith@builder.example');
  expect(summary.participants).not.toContain('jane.smith@builder.example');
 });
 it('finds a known Person even when a builder platform hid them from From/To',()=>{
  expect(emailTargetSuggestions(summary,contacts,[],[])).toEqual([]);
  const recognized=gmailThreadWithAddresses395(summary,[
   {address:'jane.smith@builder.example'},
  ]);
  expect(emailTargetSuggestions(recognized,contacts,[],[])
   .map(item=>item.kind+':'+item.id)).toContain('person:p1');
 });
 it('deduplicates case-insensitively and ignores invalid address lookalikes',()=>{
  const duplicate={...details,messages:[{...details.messages[0],
   searchText:'JANE.SMITH@BUILDER.EXAMPLE, jane.smith@builder.example and example.com'}]};
  expect(gmailAddressesInDetails395(duplicate,'myinbox@gmail.com')
   .filter(row=>row.address==='jane.smith@builder.example')).toHaveLength(1);
 });
});
