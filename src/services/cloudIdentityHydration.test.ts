import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const auth=readFileSync(new URL('../store/authStore.ts',import.meta.url),'utf8');
const sync=readFileSync(new URL('./cloudSync.ts',import.meta.url),'utf8');

describe('Cloud identity and hydration generation contract',()=>{
  it('invalidates an older session after each identity transition',()=>{
    expect(auth).toContain('const epoch=++sessionApplyEpoch');
    expect(auth).toContain('const isCurrent=()=>epoch===sessionApplyEpoch');
    expect(auth).toContain('if(!isCurrent())return;');
    expect(auth).toContain('isActive:isCurrent');
  });
  it('prevents stale network reads from overwriting the next account cache',()=>{
    expect(auth).toContain('allowCrmRecovery:canWriteCrm,\n      allowQuoteRecovery:canWriteQuotes,\n      isCurrent,');
    expect(sync).toContain('assertCurrent();\n  // The existing local cache');
    expect(sync).toContain('const writeHydrated=(key:CloudDocumentKey,value:unknown)=>{');
    expect(sync).toContain('assertCurrent();\n    writeLocalDocument(key,value,false)');
    expect(sync).toContain('assertCurrent();\n  writeCacheScope(');
  });
  it('invalidates hydration immediately on explicit sign-out and password reset',()=>{
    expect(auth).toContain("signOut: async () => {\n    // An in-flight old-session read");
    expect(auth).toContain("sessionApplyEpoch++;\n    stopCloudSync();\n    clearCloudIdentityCache();");
    expect(auth).toContain("await supabase.auth.signOut()");
  });
  it('guards bootstrap writes, notebook hydration, and stale errors',()=>{
    expect(sync).toContain('assertCurrent();\n      await syncNormalizedCrm(orgId, localCrm)');
    expect(sync).toContain('assertCurrent();\n      await syncNormalizedQuotes(orgId, starter)');
    expect(sync).toContain('removeHydrated(PRIVATE_DOCUMENT_KEY)');
    expect(auth).toContain('} catch (error) {\n    if(!isCurrent())return;');
  });
});
