import {describe,it,expect} from 'vitest';
import {fileSizeLabel,inventoryFromLinks,normalizeManagedFiles,providerFromLink,
 sortFileInventory,summarizeFileInventory,FILE_PROVIDER_CAPABILITIES,
 type FileInventoryItem,type FileStorageObject} from './fileStorageInventory390';
import type {FileLinkRecord} from './fileLinks357a';

const now='2026-11-18T12:00:00.000Z';
const link=(id:string,url:string):FileLinkRecord=>({
 id,title:id,url,kind:'file',category:'drawing',
 targetKind:'deal',targetId:'d1',createdAt:now,updatedAt:now,
});
const managed=(id:string,bytes:number):FileInventoryItem=>({
 id,provider:'supabase-managed',name:id,kind:'file',
 category:'drawing',targetKind:'deal',targetId:'d1',
 sizeBytes:bytes,createdAt:now,updatedAt:now,source:'managed',
});
describe('#390 — provider-neutral file inventory',()=>{
 it('recognizes existing SaaS link providers without pretending to know sizes',()=>{
  const docs=inventoryFromLinks([
   link('plans','https://drive.google.com/file/d/123/view'),
   link('shared','https://www.dropbox.com/s/abc/contract.pdf'),
   link('sharepoint','https://acme.sharepoint.com/:f:/g/foo'),
  ]);
  expect(docs.map(row=>row.provider)).toEqual(['google-drive','dropbox','onedrive']);
  expect(docs.every(row=>row.sizeBytes===null&&row.source==='linked')).toBe(true);
  expect(providerFromLink('https://example.com/doc')).toBe('web-link');
  expect(FILE_PROVIDER_CAPABILITIES.some(p=>p.provider==='supabase-byo')).toBe(true);
  expect(FILE_PROVIDER_CAPABILITIES.some(p=>p.provider==='r2-byo')).toBe(true);
 });
 it('sorts reliable byte metadata and puts unknown sizes last in both directions',()=>{
  const unknown=inventoryFromLinks([link('external','https://example.com/a')])[0];
  const rows=[managed('large',5*1024*1024),unknown,managed('empty',0),managed('small',1024)];
  expect(sortFileInventory(rows,'size-asc').map(row=>row.name))
   .toEqual(['empty','small','large','external']);
  expect(sortFileInventory(rows,'size-desc').map(row=>row.name))
   .toEqual(['large','small','empty','external']);
  expect(rows[1].sizeBytes).toBeNull();
 });
 it('distinguishes known inventory size from unknown/provider billing',()=>{
  const rows=[managed('one',1048576),managed('zero',0),
   inventoryFromLinks([link('external','https://example.com/a')])[0]];
  const stats=summarizeFileInventory(rows);
  expect(stats).toMatchObject({items:3,files:3,knownFiles:2,unknownSize:1,
   knownBytes:1048576,providerCount:2});
  expect(stats.byProvider.find(p=>p.provider==='web-link')?.unknownSize).toBe(1);
  expect(fileSizeLabel(1048576)).toBe('1 MB');
  expect(fileSizeLabel(null)).toBe('Unknown');
  expect(fileSizeLabel(-1)).toBe('Unknown');
 });
 it('requires exact nonnegative sizes before counting managed uploads',()=>{
  const safe:FileStorageObject={
   id:'a',provider:'supabase-managed',name:'drawing.pdf',kind:'file',category:'drawing',
   targetKind:'deal',targetId:'deal-1',sizeBytes:2,createdAt:now,updatedAt:now,
  };
  expect(normalizeManagedFiles([safe])[0]).toMatchObject({source:'managed',sizeBytes:2});
  expect(()=>normalizeManagedFiles([{...safe,sizeBytes:-1}])).toThrow();
  expect(()=>normalizeManagedFiles([{...safe,sizeBytes:NaN}])).toThrow();
  expect(()=>normalizeManagedFiles([{...safe,provider:'google-drive'}])).toThrow();
 });
});
