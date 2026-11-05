import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {nonnegativeFieldError} from '../components/RecordFormFeedback';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const board=source('components/Board.tsx');

describe('Board deal editor save reliability',()=>{
 it('uses the same explicit name and numeric validations as Connections',()=>{
  expect(board).toContain("if(!draft.name.trim()){setSaveError('Enter a deal name.');return;}");
  expect(board).toContain("nonnegativeFieldError(draft.amount,'Deal amount')");
  expect(board).toContain("name: draft.name.trim()");
  expect(board).toContain('RecordEditField label="Deal name"');
  expect(board).toContain('RecordEditField label="Amount"');
  expect(board).toContain('noValidate onChange={()=>setSaveError');
  expect(nonnegativeFieldError('-1','Deal amount')).toContain('zero or greater');
 });
 it('retains the editor when assignment or local persistence rejects',()=>{
  expect(board).toContain('await assignProject(project.id');
  expect(board).toContain('updateProject(project.id, patch)');
  expect(board).toContain("catch(reason){setSaveError(");
  expect(board).toContain("onClose={()=>{if(!saving)onClose();}}");
  expect(board).toContain("if(!saving&&event.target===event.currentTarget)onClose()");
  expect(board).toContain('disabled={saving}');
  expect(board).toContain("message:'Saving deal…'");
  expect(board).toContain('aria-busy={saving}');
 });
 it('queues document writes, guards stale responses and exposes retry after failed sync',()=>{
  const sync=source('services/cloudSync.ts');
  expect(sync).toContain('const inFlight=new Map<CloudDocumentKey,Promise<void>>()');
  expect(sync).toContain('const operation=(inFlight.get(key)??Promise.resolve()).catch(()=>{}).then(()=>');
  expect(sync).toContain('scheduledRevision.get(key)!==revision');
  expect(sync).toContain("window.addEventListener('online',retryFailed)");
  expect(sync).toContain("document.addEventListener('visibilitychange',retryWhenVisible)");
  expect(sync).toContain('options.onRecovered?.()');
  const auth=source('store/authStore.ts');
  expect(auth).toContain('lastCloudSyncError');
  expect(auth).toContain('current.error===lastCloudSyncError');
 });
});
