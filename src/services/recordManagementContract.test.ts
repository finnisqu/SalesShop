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
 it('allows dependency drill-down with an intact parent/search context and safe personal task removal',()=>{
  expect(modal).toContain('setFocusTrail(current=>');
  expect(modal).toContain('sales-record-dependency-trail');
  expect(modal).toContain('recordManagementDependencies(focused.kind,focused.id');
  expect(modal).toContain('setFocusTrail(current=>current.slice(0,-1))');
  expect(modal).toContain('aria-label="Manage linked records"');
  expect(modal).toContain("aria-label={'Review links for '+item.name}");
  expect(modal).toContain("if(item.kind==='task')");
  expect(modal).toContain('usePersonalTaskStore.getState().remove(item.id)');
  expect(modal).toContain('if(!itemTask)throw new Error');
  expect(modal).toContain('onClick={()=>perform([row])}');
 });
 it('supports explicit signed-test purge with an atomic server gate',()=>{
  const service=source('src/services/practiceQuotePurge.ts');
  const sql=source('supabase/migrations/20261104171500_guarded_archived_practice_quote_purge.sql');
  const deps=source('src/services/recordManagementDependencies.ts');
  expect(modal).toContain('const q=visibleQuotes.map((quote:Quote)');
  expect(modal).toContain("action:quote.archivedAt?'purge'");
  expect(modal).toContain('planPracticeQuotePurge(current,allQuotes,crm.activities,own,');
  expect(modal).toContain("if(item.action==='purge'){");
  expect(modal).toContain("await purgeArchivedPracticeQuote(item.id,phrase)");
  expect(modal).toContain("const isPurging=Boolean(pending?.some(item=>item.action==='purge'))");
  expect(modal).toContain("const signedPurge=isPurging");
  expect(modal).toContain("signedPurge?'SIGNED ':'");
  expect(modal).toContain('practiceAcknowledged');
  expect(modal).toContain('Purge signed test contract');
  expect(deps).toContain("if(kind==='quote')");
  expect(service).toContain("await supabase.rpc('purge_archived_practice_quote'");
  expect(service).toContain("discardPurgedQuoteSignatures(quoteId)");
  expect(service).toContain("useCrmStore.getState().discardPurgedQuoteActivities(quoteId");
  expect(sql).toContain("m.role in ('owner','admin')");
  expect(sql).toContain("v_quote.owner_user_id <> (select auth.uid())");
  expect(sql).toContain("delete from public.signatures");
  expect(sql).toContain("delete from public.activities");
  expect(sql).toContain("delete from public.quotes");
 });
 it('keeps record-type tabs fitted and linked records vertically scrollable at normal zoom',()=>{
  const css=source('src/home-cleanup.css');
  expect(css).toContain('grid-template-columns:repeat(5,minmax(0,1fr))');
  expect(css).toContain('>.sales-record-dependency-panel');
  expect(css).toContain('flex:1 1 auto');
  expect(css).toContain('min-height:0');
  expect(css).toContain('overflow-y:auto');
  expect(css).toContain('max-height:none');
  expect(css).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
 });
 it('archives protected quotes and remotely verifies draft deletion before changing local state',()=>{
  expect(modal).toContain("if(item.action==='archive')archiveQuote(item.id)");
  expect(modal).toContain("await deleteQuoteFromManagement(item.id)");
  expect(quoteStore).toContain('deleteQuoteFromManagement:async(quoteId)');
  expect(quoteStore).toContain('await deleteConfirmedNormalizedQuote(organizationId,quoteId)');
  expect(normalized).toContain("if(!data?.length)throw new Error('The quote could not be deleted.");
 });
});
