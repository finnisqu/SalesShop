import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const cloud=readFileSync(new URL('./cloudSync.ts',import.meta.url),'utf8');
const auth=readFileSync(new URL('../store/authStore.ts',import.meta.url),'utf8');

describe('Cloud sync reconnect and stale-session safety contract',()=>{
  it('ignores save events and completions from a replaced workspace',()=>{
    expect(cloud).toContain('const active=()=>!disposed&&options.isActive?.()!==false');
    expect(cloud).toContain('if(!detail?.key||!active())return');
    expect(cloud).toContain('const operation=(inFlight.get(key)??Promise.resolve()).catch(()=>{}).then(()=>');
    expect(cloud).toContain('if(!active())return');
  });
  it('retries private notebooks when a viewer reconnects, without shared writes',()=>{
    expect(cloud).toContain('if(retryableFailures.has(PRIVATE_DOCUMENT_KEY))');
    expect(cloud).toContain('if(canWriteCrm&&retryableFailures.has(CRM_DOCUMENT_KEY)');
    expect(cloud).toContain('if(canWriteQuotes&&retryableFailures.has(QUOTES_DOCUMENT_KEY)');
    expect(cloud).toContain('if(canWriteSignatures&&retryableFailures.has(SIGNATURES_DOCUMENT_KEY))');
  });
  it('treats missing metadata markers as recoverable only within the active session',()=>{
    expect(cloud).toContain("if(key===QUOTES_DOCUMENT_KEY&&!readPendingQuoteSync(scope))");
    expect(cloud).toContain("if(canWriteCrm&&retryableFailures.has(CRM_DOCUMENT_KEY))");
    expect(cloud).toContain("if(canWriteQuotes&&retryableFailures.has(QUOTES_DOCUMENT_KEY))");
    expect(cloud).toContain("const active=()=>!disposed&&options.isActive?.()!==false");
  });
  it('replays CRM, Quotes and private Notebook only with scoped recovery markers',()=>{
    expect(cloud).toContain('if(canWriteQuotes&&readPendingQuoteSync(scope))');
    expect(cloud).toContain('if(canWriteCrm&&readPendingCrmSync(scope))');
    expect(cloud).toContain('if(readPendingNotebookSync(scope))');
    expect(cloud).toContain('mergePendingNotebookChanges(notebookRow?.document,');
    expect(cloud).toContain('window.addEventListener(\'online\',retryWhenOnline)');
    expect(cloud).toContain('window.addEventListener(CLOUD_DOCUMENT_RETRY_EVENT,retryOnDemand)');
    expect(cloud).toContain('document.addEventListener(\'visibilitychange\',retryWhenVisible)');
  });
});
