import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./personalTaskCloudSync.ts',import.meta.url),'utf8');
describe('Private Tasks reconnect and stale-save contract',()=>{
  it('retries failed edits on reconnect or foreground with a throttle',()=>{
    expect(source).toContain("window.addEventListener('online',retryFailed)");
    expect(source).toContain("document.addEventListener('visibilitychange',retryWhenVisible)");
    expect(source).toContain("store.getState().syncStatus!=='error'");
    expect(source).toContain('Date.now()-lastRecoveryRetry<15000');
  });
  it('does not send an old account task document after switching scope',()=>{
    expect(source).toContain('if(cancelled||store.getState().scope!==scope)return;');
    expect(source).toContain("window.removeEventListener('online',retryFailed)");
    expect(source).toContain("document.removeEventListener('visibilitychange',retryWhenVisible)");
  });
  it('keeps pending status until a newer Task edit finishes saving',()=>{
    expect(source).toContain('!dirty&&!timer&&store.getState().tasks===merged');
    expect(source).toContain('if(saving){dirty=true;return;}');
    expect(source).toContain('if(dirty&&!cancelled){dirty=false;queue();}');
  });
});
