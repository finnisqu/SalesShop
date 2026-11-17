import {describe,it,expect,vi,beforeEach} from 'vitest';
import {fileLinksScope,fileLinksStorageKey,normalizeFileLinkUrl,fileLinkProvider,
 fileTargetKey,validateFileLinkDraft,loadFileLinks,saveFileLinks} from './fileLinks357a';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const memory=new Map<string,string>();
beforeEach(()=>{
 memory.clear();
 vi.stubGlobal('localStorage',{
  getItem:(key:string)=>memory.get(key)??null,
  setItem:(key:string,value:string)=>{memory.set(key,value);},
 });
});
describe('Files prototype #357a',()=>{
 it('isolates browser-local identities and rejects missing cloud auth',()=>{
  expect(fileLinksScope('local')).toBe('local-browser');
  expect(fileLinksScope('cloud','org-a','user-a')).not.toBe(fileLinksScope('cloud','org-a','user-b'));
  expect(fileLinksScope('cloud','org-a',null)).toBeNull();
  expect(fileLinksStorageKey('org:a:user:b')).toContain('salesshop-file-links-v1:');
 });
 it('validates actual http(s) document links and strips unsafe schemes',()=>{
  expect(normalizeFileLinkUrl(' https://drive.google.com/file/d/123 ')).toBe('https://drive.google.com/file/d/123');
  for(const bad of ['javascript:alert(1)','data:text/html,a','file:///secret','https://user:pass@example.com/x','not a URL']){
   expect(()=>normalizeFileLinkUrl(bad)).toThrow();
  }
 });
 it('keeps native customer-share bearer URLs out of private File links',()=>{
  for(const url of [
   'https://salesshop.work/q/secretBearerToken',
   'https://app.salesshop.work/q/secretBearerToken',
   'https://salesshop.pages.dev/q/secretBearerToken',
  ])expect(()=>normalizeFileLinkUrl(url)).toThrow('Customer Quote links');
  expect(normalizeFileLinkUrl('https://salesshop.work/quotes')).toBe('https://salesshop.work/quotes');
 });
 it('recognizes common providers without granting OAuth or uploading',()=>{
  expect(fileLinkProvider('https://drive.google.com/file/d/a')).toBe('Google Drive');
  expect(fileLinkProvider('https://www.dropbox.com/s/a')).toBe('Dropbox');
  expect(fileLinkProvider('https://acme.sharepoint.com/docs/a')).toBe('OneDrive / SharePoint');
  expect(fileLinkProvider('https://example.com/a')).toBe('Web link');
 });
 it('supports Company/Deal/Quote and external bid target identifiers',()=>{
  expect(fileTargetKey({kind:'deal',id:'abc'})).toBe('deal:abc');
  expect(fileTargetKey({kind:'quote',id:'abc'})).not.toBe(fileTargetKey({kind:'externalQuote',id:'abc'}));
  expect(()=>validateFileLinkDraft({title:' ',url:'https://example.com',
    kind:'file',targetKind:'company',targetId:'1'})).toThrow();
 });
 it('persists and rehydrates valid links per namespace, discarding malformed records',()=>{
  const row={id:'id',title:'Bid package',url:'https://example.com/file',
   kind:'file' as const,targetKind:'deal' as const,targetId:'deal-1',
   createdAt:'2026-11-16',updatedAt:'2026-11-16'};
  saveFileLinks('a',[row]);
  expect(loadFileLinks('a')).toEqual([row]);
  expect(loadFileLinks('b')).toEqual([]);
  memory.set(fileLinksStorageKey('a'),JSON.stringify([...loadFileLinks('a'),{bad:'link'}]));
  expect(loadFileLinks('a')).toEqual([row]);
 });
 it('exposes a real Files directory and local record cards',()=>{
  expect(read('components/ToolsWorkspace.tsx')).toContain("id:'files',label:'Files'");
  const workspace=read('components/ToolsWorkspace.tsx');
  expect(workspace).toContain("section==='files'&&<FilesWorkspace");
  expect(read('components/DealRecordPage.tsx')).toContain("<RecordFilesPanel target={{kind:'deal'");
  expect(read('components/CompanyRecordPage.tsx')).toContain("<RecordFilesPanel target={{kind:'company'");
  expect(read('components/QuoteRecordMetadataPage.tsx')).toContain("<FileLinksManager target={{kind:'quote'");
 });
 it('opens existing URLs safely and describes browser-local scope without fake cloud claims',()=>{
  const ui=read('components/FileLinksManager.tsx');
  expect(ui).toContain('rel="noopener noreferrer"');
  expect(ui).toContain('not yet shared or synced across devices');
  expect(read('store/fileLinkStore.ts')).toContain('saveFileLinks(scope,next)');
 });
});
