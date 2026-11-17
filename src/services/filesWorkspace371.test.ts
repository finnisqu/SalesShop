import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {FILE_LINK_CATEGORIES,fileLinkCategoryLabel,relatedFileTargetKeys,
 validateFileLinkDraft,type FileTarget} from './fileLinks357a';

const targets:FileTarget[]=[
 {kind:'company',id:'c1',title:'Company One'},
 {kind:'company',id:'c2',title:'Company Two'},
 {kind:'deal',id:'d1',title:'Deal One',companyId:'c1'},
 {kind:'deal',id:'d2',title:'Deal Two',companyId:'c2'},
 {kind:'quote',id:'q1',title:'Native Quote',projectId:'d1',companyId:'c1'},
 {kind:'externalQuote',id:'e1',title:'Builder Bid',projectId:'d1',companyId:'c1'},
 {kind:'quote',id:'q2',title:'Other Quote',projectId:'d2',companyId:'c2'},
];
const source=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
describe('Files + Quote Share workspace #371',()=>{
 it('supports document categories, with a backwards-compatible Other fallback',()=>{
  expect(FILE_LINK_CATEGORIES.map(item=>item.id))
   .toEqual(['drawing','bid','contract','spec','other']);
  expect(fileLinkCategoryLabel()).toBe('Other');
  expect(fileLinkCategoryLabel('bid')).toBe('Bid documents');
  const old={title:'Old file',url:'https://example.com/file',
   kind:'file' as const,targetKind:'deal' as const,targetId:'d1'};
  expect(validateFileLinkDraft(old).category).toBeUndefined();
  expect(validateFileLinkDraft({...old,category:'drawing'}).category).toBe('drawing');
  expect(()=>validateFileLinkDraft({...old,category:'untrusted' as 'drawing'})).toThrow();
 });
 it('finds all Company-linked Deals and Quotes by verified relationship IDs only',()=>{
  const related=relatedFileTargetKeys(targets[0],targets,true);
  expect([...related].sort()).toEqual([
   'company:c1','deal:d1','externalQuote:e1','quote:q1']);
  expect(related.has('quote:q2')).toBe(false);
  expect([...relatedFileTargetKeys(targets[0],targets,false)]).toEqual(['company:c1']);
 });
 it('Deal includes its Company and directly linked Quotes, not another customer',()=>{
  const related=relatedFileTargetKeys(targets[2],targets,true);
  expect(related.has('company:c1')).toBe(true);
  expect(related.has('quote:q1')).toBe(true);
  expect(related.has('externalQuote:e1')).toBe(true);
  expect(related.has('deal:d2')).toBe(false);
  expect(related.has('quote:q2')).toBe(false);
 });
 it('Files directory uses same linked-file CRUD, adds category and relationship filters',()=>{
  const manager=source('components/FileLinksManager.tsx');
  expect(manager).toContain('relatedFileTargetKeys(');
  expect(manager).toContain('Include files on related records');
  expect(manager).toContain('FILE_LINK_CATEGORIES.map(');
  expect(manager).toContain('edit(editingId,{title,url,kind,category})');
  expect(manager).toContain('fileLinkCategoryLabel(row.category)');
  expect(manager).toContain('not yet shared or synced across devices');
  const files=source('components/FilesWorkspace.tsx');
  expect(files).toContain('directory/>');
  expect(files).toContain('<QuoteShareReferences371');
  expect(files).toContain('projectId:row.projectId');
  expect(files).toContain('companyId:row.companyId');
  expect(source('components/ToolsWorkspace.tsx')).toContain("section==='files'");
 });
 it('Quote Share checks stay read-only, scoped and never become persisted File links',()=>{
  const reference=source('components/QuoteShareReferences371.tsx');
  expect(reference).toContain('getQuoteShare(');
  expect(reference).toContain('quoteShareUrl(');
  expect(reference).toContain('navigator.clipboard.writeText(');
  expect(reference).toContain('useAuthStore.getState()');
  expect(reference).toContain('useQuoteStore.getState()');
  expect(reference).not.toContain('createQuoteShare(');
  expect(reference).not.toContain('revokeQuoteShare(');
  expect(reference).not.toContain('localStorage.');
  expect(reference).not.toContain('saveFileLinks(');
  expect(reference).toContain('Copying does not confirm quote delivery');
 });
});
