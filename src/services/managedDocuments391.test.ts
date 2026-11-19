import {describe,expect,it,vi} from 'vitest';
vi.mock('../lib/supabase',()=>({supabase:null}));
vi.mock('../store/authStore',()=>({useAuthStore:{getState:()=>({
 mode:'local',organizationId:null,user:null,
})}}));
import {MANAGED_MAX_BYTES_391,MANAGED_ACCEPT_391,managedFileValidation391,
 managedFolder391,validManagedTarget391,managedToInventory391,
 type ManagedRow391} from './managedDocuments391';

describe('#391 — secure managed documents',()=>{
 it('permits common contract and drawing formats with deterministic MIME types',()=>{
  expect(managedFileValidation391({name:' Bid Drawing.PDF ',size:1024}))
   .toEqual({name:'Bid Drawing.PDF',mime:'application/pdf'});
  expect(managedFileValidation391({name:'Workbook.xlsx',size:500}).mime)
   .toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(MANAGED_ACCEPT_391).toContain('.docx');
 });
 it('rejects executable, HTML, traversal, oversized and empty upload input',()=>{
  expect(()=>managedFileValidation391({name:'script.html',size:200})).toThrow();
  expect(()=>managedFileValidation391({name:'malware.exe',size:300})).toThrow();
  expect(()=>managedFileValidation391({name:'../../private.pdf',size:300})).toThrow();
  expect(()=>managedFileValidation391({name:'folder\\child.pdf',size:300})).toThrow();
  expect(()=>managedFileValidation391({name:'real.pdf',size:0})).toThrow();
  expect(()=>managedFileValidation391({name:'real.pdf',size:MANAGED_MAX_BYTES_391+1})).toThrow();
 });
 it('keeps folder labels harmless and restricts targets to CRM Company/Deal',()=>{
  expect(managedFolder391(' Contracts   /  2026 ')).toBe('Contracts / 2026');
  expect(()=>managedFolder391('../another')).toThrow();
  expect(()=>managedFolder391('a\\b')).toThrow();
  expect(validManagedTarget391({kind:'deal',id:'deal-123'})).toBe(true);
  expect(validManagedTarget391({kind:'company',id:'company-123'})).toBe(true);
  expect(validManagedTarget391({kind:'quote',id:'quote-123'})).toBe(false);
  expect(validManagedTarget391({kind:'externalQuote',id:'external'})).toBe(false);
 });
 it('only maps ready objects with verified bytes into the shared library',()=>{
  const ready:ManagedRow391={
   id:'01234',organization_id:'org',uploaded_by:'user',
   target_kind:'company',target_id:'company-1',title:'Plans.pdf',
   category:'drawing',folder_path:'Construction / Plans',
   mime_type:'application/pdf',size_bytes:4096,status:'ready',
   object_path:'org/01234',
   created_at:'2026-11-18T12:00:00.000Z',
   updated_at:'2026-11-18T12:05:00.000Z',
  };
  expect(managedToInventory391(ready)).toMatchObject({
   source:'managed',provider:'supabase-managed',sizeBytes:4096,
   folderPath:'Construction / Plans',targetKind:'company',
   objectKey:'org/01234',bucket:'sales-documents',
  });
  expect(()=>managedToInventory391({...ready,status:'pending',size_bytes:null})).toThrow();
  expect(()=>managedToInventory391({...ready,size_bytes:null})).toThrow();
 });
});
