import {describe,expect,it} from 'vitest';
import {fileFolderOption391,filterFileInventory391,sortFileInventory,
 type FileInventoryItem} from './fileStorageInventory390';

const base={createdAt:'2026-11-19T09:00:00Z',updatedAt:'2026-11-19T09:00:00Z'};
const rows:FileInventoryItem[]=[
 {...base,id:'managed:1',source:'managed',provider:'supabase-managed',
  name:'Construction Plans.pdf',kind:'file',category:'drawing',
  targetKind:'company',targetId:'company-1',sizeBytes:8192,folderPath:'root'},
 {...base,id:'managed:2',source:'managed',provider:'supabase-managed',
  name:'Contract.pdf',kind:'file',category:'contract',
  targetKind:'deal',targetId:'deal-1',sizeBytes:16384,folderPath:'all'},
 {...base,id:'linked:3',source:'linked',provider:'google-drive',
  name:'External reference',kind:'file',category:'spec',
  targetKind:'company',targetId:'company-1',sizeBytes:null,
  openUrl:'https://drive.google.com/drive/file'},
];

const filters={provider:'all' as const,folder:'all',category:'all' as const,search:''};

describe('#391 — storage inventory and virtual folder filters',()=>{
 it('filters by category while preserving files from multiple providers',()=>{
  expect(filterFileInventory391(rows,{...filters,category:'contract'}).map(r=>r.id))
   .toEqual(['managed:2']);
  expect(filterFileInventory391(rows,{...filters,category:'spec'}).map(r=>r.id))
   .toEqual(['linked:3']);
 });
 it('filters by provider without manufacturing provider byte metadata',()=>{
  const result=filterFileInventory391(rows,{...filters,provider:'google-drive'});
  expect(result).toHaveLength(1);
  expect(result[0].sizeBytes).toBeNull();
 });
 it('does not confuse actual folders named root/all with unfiled links',()=>{
  expect(fileFolderOption391('root')).toBe('folder:root');
  expect(fileFolderOption391('all')).toBe('folder:all');
  expect(filterFileInventory391(rows,{...filters,folder:'unfiled'}).map(r=>r.id))
   .toEqual(['linked:3']);
  expect(filterFileInventory391(rows,{...filters,folder:fileFolderOption391('root')}).map(r=>r.id))
   .toEqual(['managed:1']);
  expect(filterFileInventory391(rows,{...filters,folder:fileFolderOption391('all')}).map(r=>r.id))
   .toEqual(['managed:2']);
 });
 it('combines category, provider, folder and search terms',()=>{
  expect(filterFileInventory391(rows,{
   ...filters,category:'drawing',provider:'supabase-managed',
   folder:fileFolderOption391('root'),search:'plans',
  }).map(r=>r.id)).toEqual(['managed:1']);
  expect(filterFileInventory391(rows,{
   ...filters,category:'drawing',provider:'google-drive',
  })).toEqual([]);
 });
 it('can search linked CRM record names without mixing identities',()=>{
  const found=filterFileInventory391(rows,{...filters,search:'jamestown'},
   row=>row.targetId==='deal-1'?'Jamestown Townhomes':'Other Company');
  expect(found.map(r=>r.id)).toEqual(['managed:2']);
 });
 it('sorts filtered files by verified byte size with unknown sizes last',()=>{
  const sorted=sortFileInventory(filterFileInventory391(rows,filters),'size-desc');
  expect(sorted.map(r=>r.id)).toEqual(['managed:2','managed:1','linked:3']);
 });
});
