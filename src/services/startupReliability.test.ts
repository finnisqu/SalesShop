import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {timeStartupStep} from './appLifecycleDiagnostics';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('boot reliability and safe cloud hydration',()=>{
 const auth=source('src/store/authStore.ts');
 const cloud=source('src/services/cloudSync.ts');
 const gate=source('src/components/AuthGate.tsx');
 const diag=source('src/services/appLifecycleDiagnostics.ts');
 it('defers all session work outside the Supabase auth callback',()=>{
  const listener=auth.slice(auth.indexOf('supabase.auth.onAuthStateChange('),
   auth.indexOf("const { data, error } = await timeStartupStep('session'"));
  expect(listener).toContain("if(event==='INITIAL_SESSION')return;");
  expect(listener).toContain('window.setTimeout(()=>{void applySession(session,event);},0)');
  expect(listener).not.toMatch(/\n\s*void applySession\(session,event\);/);
  expect(auth).toContain('if (activeSessionApplication && activeSessionUserId === userId)');
 });
 it('fetches independent records together but retains the ordered write and recovery path',()=>{
  const reads=cloud.slice(cloud.indexOf('const [normalizedCrm, normalizedQuotes, normalizedSignatures, notebookResult]'),
   cloud.indexOf('if (normalizedCrm)'));
  expect(reads).toContain('await Promise.all([');
  for(const phase of ['crm','quotes','signatures','notebook']){
   expect(reads).toContain("timeStartupStep('"+phase+"'");
  }
  expect(cloud.indexOf('if (normalizedCrm)')).toBeLessThan(cloud.indexOf('if (recoveredQuotes)'));
  expect(cloud.indexOf('if (recoveredQuotes)')).toBeLessThan(cloud.indexOf('if (normalizedSignatures)'));
  expect(cloud.indexOf('if (normalizedSignatures)')).toBeLessThan(cloud.indexOf('if (notebookRow?.document !== undefined)'));
  expect(cloud).toContain('mergePendingQuoteDrafts(normalizedQuotes,localQuotes,pendingQuoteSync)');
  expect(cloud).toContain('allowCompanySeed');
  expect(cloud).toContain('allowNotebookSeed');
 });
 it('displays an actionable slow-loading message and stores only phase/duration diagnostics',()=>{
  expect(gate).toContain("useAuthStore((state) => state.loadingStep)");
  expect(gate).toContain('setSlowStart(true),12000');
  expect(gate).toContain('Taking longer than expected.');
  expect(diag).toContain('sessionStorage');
  expect(diag).toContain('durationMs:Math.max(0,Math.round(performance.now()-started))');
 });
 it('preserves successful results and propagates load errors through timing instrumentation',async()=>{
  await expect(timeStartupStep('crm',async()=>42)).resolves.toBe(42);
  await expect(timeStartupStep('quotes',async()=>{throw new Error('read failed')})).rejects.toThrow('read failed');
 });
});
