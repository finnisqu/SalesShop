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
    expect(cloud).toContain('if(!options.readOnlyShared&&retryableFailures.has(CRM_DOCUMENT_KEY)');
    expect(cloud).toContain('if(!options.readOnlyShared&&retryableFailures.has(QUOTES_DOCUMENT_KEY)');
    expect(cloud).toContain('if(!options.readOnlyShared&&retryableFailures.has(SIGNATURES_DOCUMENT_KEY))');
  });
  it('only replays CRM and Quotes after restart with scoped pending markers',()=>{
    expect(cloud).toContain('if(!options.readOnlyShared&&readPendingQuoteSync(scope))');
    expect(cloud).toContain('if(!options.readOnlyShared&&readPendingCrmSync(scope))');
    expect(cloud).toContain('window.addEventListener(\'online\',retryFailed)');
    expect(cloud).toContain('document.addEventListener(\'visibilitychange\',retryWhenVisible)');
  });
});
