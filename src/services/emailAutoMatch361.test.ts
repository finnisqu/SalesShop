import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {gmailPersonQuery,matchingPersonThreads,mergePersonThreads,personEmailAddress,
 personEmailPreferencesKey,readPersonEmailPreferences,savePersonEmailPreferences}
 from './emailAutoMatch361';
import {gmailThreadPage,type GmailThreadSummary} from './gmailRead359a';
const values=new Map<string,string>();
beforeEach(()=>{
 vi.unstubAllGlobals();
 values.clear();
 vi.stubGlobal('localStorage',{
  getItem:(key:string)=>values.get(key)??null,
  setItem:(key:string,value:string)=>{values.set(key,value);},
 });
});
const thread=(id:string,participants:string[],date='2026-11-16T12:00:00Z'):GmailThreadSummary=>
 ({id,participants,date,subject:'Private subject',from:'Someone',snippet:'Private text',messageCount:1});
describe('Person Gmail auto association #361',()=>{
 it('normalizes exact Person email and searches From, To and Cc without a date limit',()=>{
  expect(personEmailAddress('  JOHN+Bid@Example.COM ')).toBe('john+bid@example.com');
  expect(personEmailAddress('invalid')).toBeNull();
  expect(gmailPersonQuery('John+Bid@Example.com'))
   .toBe('{from:john+bid@example.com to:john+bid@example.com cc:john+bid@example.com}');
  expect(gmailPersonQuery('bad address')).toThrow();
 });
 it('rejects subject/body-only coincidences and partial or neighboring addresses',()=>{
  const records=[thread('thread1',['john@example.com','sales@example.com']),
   thread('thread2',['johnny@example.com']),thread('thread3',['other@example.com']),
   thread('thread4',['JOHN@EXAMPLE.COM']),thread('../unsafe',['john@example.com'])];
  expect(matchingPersonThreads(records,'john@example.com').map(item=>item.id))
   .toEqual(['thread1','thread4']);
 });
 it('deduplicates manually linked threads and paginated matching threads newest-first',()=>{
  const a=thread('thread1',['a@example.com'],'2026-11-15');
  const b=thread('thread2',['a@example.com'],'2026-11-16');
  expect(mergePersonThreads([a],[a,b]).map(item=>item.id)).toEqual(['thread2','thread1']);
 });
 it('keeps auto-off and per-thread hiding private to each SalesShop user, mailbox and Person',()=>{
  const scope='org:a:user:u1',other='org:a:user:u2';
  const key=personEmailPreferencesKey(scope,'rep@example.com','person1');
  expect(personEmailPreferencesKey(other,'rep@example.com','person1')).not.toBe(key);
  expect(readPersonEmailPreferences(scope,'rep@example.com','person1'))
   .toEqual({enabled:true,hiddenThreadIds:[]});
  savePersonEmailPreferences(scope,'rep@example.com','person1',
   {enabled:false,hiddenThreadIds:['thread1','../bad']});
  expect(readPersonEmailPreferences(scope,'rep@example.com','person1'))
   .toEqual({enabled:false,hiddenThreadIds:['thread1']});
  expect(readPersonEmailPreferences(scope,'other@example.com','person1').enabled).toBe(true);
  expect(readPersonEmailPreferences(other,'rep@example.com','person1').enabled).toBe(true);
  expect(values.get(key)).not.toContain('Private subject');
  expect(values.get(key)).not.toContain('Private text');
 });
 it('calls Gmail only when requested, with metadata not message bodies',async()=>{
  const urls:string[]=[];
  vi.stubGlobal('fetch',async(url:string)=>{
   urls.push(url);
   return {ok:true,json:async()=>url.includes('/threads/thread1?')?
    {id:'thread1',messages:[{id:'m1',internalDate:'1794859200000',payload:{headers:[
     {name:'From',value:'John <john@example.com>'},
     {name:'To',value:'rep@example.com'},
     {name:'Subject',value:'Subject'}]}}]}:{threads:[{id:'thread1'}]}};
  });
  const page=await gmailThreadPage('token',gmailPersonQuery('john@example.com'));
  expect(matchingPersonThreads(page.threads,'john@example.com')).toHaveLength(1);
  expect(urls).toHaveLength(2);
  expect(urls[0]).toContain('from%3Ajohn%40example.com');
  expect(urls[1]).toContain('format=metadata');
  expect(urls.some(url=>url.includes('format=full'))).toBe(false);
 });
 it('is displayed on People, not auto-applied to Deals or logged as Activities',()=>{
  const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  expect(read('components/PersonRecordPage.tsx'))
   .toContain('kind="person" id={person.id} email={person.email}');
  const panel=read('components/RecordEmailThreadsPanel.tsx');
  expect(panel).toContain('matchingPersonThreads(page.threads,personEmail)');
  expect(panel).toContain('Auto-matched');
  expect(panel).not.toContain('recordActivity(');
  expect(read('components/DealRecordPage.tsx')).toContain('kind="deal"');
 });
});
