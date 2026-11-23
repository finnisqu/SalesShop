import {describe,expect,it} from 'vitest';
import {displayGmailThread,summarizeGmailThread} from './gmailRead359a';
import {gmailAddressesInDetails395} from './gmailBodyDiscovery395';

const base64url=(value:string)=>Buffer.from(value,'utf8').toString('base64url');
const headers=[
 {name:'From',value:'Platform <updates@builder-platform.example>'},
 {name:'To',value:'inbox@gmail.com'},
 {name:'Reply-To',value:'Actual Builder <jane@realbuilder.example>'},
 {name:'Subject',value:'Invitation to bid'},
];
const wrap=(payload:object)=>({id:'thread395',messages:[{
 id:'message395',internalDate:'1795440000000',snippet:'Invitation',
 payload:{headers,...payload},
}]});
describe('#395 — Gmail MIME reading and Reply-To extraction',()=>{
 it('keeps Reply-To from metadata in suggested participants',()=>{
  expect(summarizeGmailThread(wrap({mimeType:'text/plain'})).participants)
   .toContain('jane@realbuilder.example');
 });
 it('scans beyond the displayed 12k excerpt of a deeply quoted plain-text chain',()=>{
  const text='x'.repeat(15000)+'\nForwarded to deep.contact@builder.example';
  const result=displayGmailThread(wrap({mimeType:'multipart/mixed',parts:[
   {mimeType:'text/plain',body:{data:base64url('Initial response')}},
   {mimeType:'multipart/alternative',parts:[
    {mimeType:'text/plain',body:{data:base64url(text)}},
   ]},
  ]}));
  expect(result.messages[0].text.length).toBe(12000);
  expect(result.messages[0].searchText).toContain('deep.contact@builder.example');
  expect(gmailAddressesInDetails395(result,'inbox@gmail.com').map(item=>item.address))
   .toContain('deep.contact@builder.example');
 });
 it('does not scan the contents of attached text files',()=>{
  const result=displayGmailThread(wrap({mimeType:'multipart/mixed',parts:[
   {mimeType:'text/plain',body:{data:base64url('Please contact lead@builder.example')}},
   {mimeType:'text/plain',filename:'participants.txt',
    body:{data:base64url('secret@unrelated.example')}},
  ]}));
  const addresses=gmailAddressesInDetails395(result,'inbox@gmail.com')
   .map(item=>item.address);
  expect(addresses).toContain('lead@builder.example');
  expect(addresses).not.toContain('secret@unrelated.example');
 });
 it('finds addresses in HTML-only builders notifications without rendering HTML',()=>{
  const html='<div>Contact <a href="mailto:pm@builder.example">Project Manager</a></div>'+
   '<script>ignored@attacker.example</script><p>Send to bids@builder.example</p>';
  const result=displayGmailThread(wrap({mimeType:'text/html',
   body:{data:base64url(html)}}));
  const addresses=gmailAddressesInDetails395(result,'inbox@gmail.com')
   .map(item=>item.address);
  expect(addresses).toContain('pm@builder.example');
  expect(addresses).toContain('bids@builder.example');
  expect(addresses).not.toContain('ignored@attacker.example');
  expect(result.messages[0].text).not.toContain('<script>');
 });
});
