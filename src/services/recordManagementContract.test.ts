import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Settings record management safety contract',()=>{
 const settings=source('src/components/CompanySettings.tsx');
 const connections=source('src/components/Connections.tsx');
 const modal=source('src/components/CleanupCenter.tsx');
 const quoteStore=source('src/store/quoteStore.ts');
 const normalized=source('src/services/normalizedQuoteSync.ts');

 it('moves test cleanup out of Connections and into a collapsed Settings maintenance section',()=>{
  expect(connections).not.toContain('Clean up test records');
  expect(settings).toContain("title: 'Data Management'");
  expect(settings).toContain('settings-maintenance-tools');
  expect(settings).toContain('<summary>Maintenance and test data</summary>');
  expect(settings).toContain('Clean up test records');
 });
 it('provides per-kind management without granting shared deletion to ordinary Members',()=>{
  expect(settings).toContain('Manage {label}');
  expect(settings).toContain("actualRole === 'owner' || actualRole === 'admin'");
  expect(modal).toContain("role==='owner'||role==='admin'");
  expect(modal).toContain("salesshop:open-cleanup-center");
  expect(modal).toContain('detail?.kind');
 });
 it('requires deliberate typed confirmation and rechecks dependencies',()=>{
  expect(modal).toContain("'DELETE':'ARCHIVE'");
  expect(modal).toContain('confirmation.trim()!==confirmWord');
  expect(modal).toContain("confirmation.trim()!==phrase");
  expect(modal).toContain('crmDeletionBlockers(item.kind,item.id,refs)');
  expect(modal).toContain('Unlink dependent records first.');
  expect(modal).toContain('openRecord(item)');
 });
 it('archives protected quotes and remotely verifies draft deletion before changing local state',()=>{
  expect(modal).toContain("if(item.action==='archive')archiveQuote(item.id)");
  expect(modal).toContain("await deleteQuoteFromManagement(item.id)");
  expect(quoteStore).toContain('deleteQuoteFromManagement:async(quoteId)');
  expect(quoteStore).toContain('await deleteConfirmedNormalizedQuote(organizationId,quoteId)');
  expect(normalized).toContain("if(!data?.length)throw new Error('The quote could not be deleted.");
 });
});
