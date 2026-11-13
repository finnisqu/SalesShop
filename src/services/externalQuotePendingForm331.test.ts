import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../components/ExternalQuoteSentForm.tsx',import.meta.url),'utf8');
describe('Batch 331 external Quote retry form',()=>{
 it('restores the original ID and fields from scoped pending storage',()=>{
  expect(source).toContain('readPendingExternalQuoteSubmission(identity)');
  expect(source).toContain('pendingAttempt?String(pendingAttempt.amount)');
  expect(source).toContain('pendingAttempt?.bidSentDate');
  expect(source).toContain('pendingAttempt?.format');
  expect(source).toContain('pendingAttempt?.id');
  expect(source).toContain('pendingAttempt?.recordedAt');
 });
 it('stores a pending record before cloud writes, clears after cloud acknowledgement',()=>{
  const save=source.indexOf('savePendingExternalQuoteSubmission(attempt)');
  const cloud=source.indexOf('const saved=await recordExternalQuoteSent(');
  const clear=source.indexOf('clearPendingExternalQuoteSubmission(attempt)');
  expect(save).toBeGreaterThanOrEqual(0);
  expect(cloud).toBeGreaterThan(save);
  expect(clear).toBeGreaterThan(cloud);
  expect(source).toContain('if(!historical)completeSubmissionTasks(deal.id)');
 });
 it('guards against an alternate tab or changed pending values',()=>{
  expect(source).toContain('else if(stored){');
  expect(source).toContain('stored.id!==attempt.id');
  expect(source).toContain('disabled={locked}');
  expect(source).toContain('window.confirm(');
  expect(source).toContain("pendingAttempt?'Retry confirmation':'Mark bid sent'");
 });
});
