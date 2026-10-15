import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const script=read('scripts/security/staging-role-matrix.mjs');
const workflow=read('.github/workflows/supabase-staging-privacy-matrix.yml');
const plan=read('docs/security/07-staging-auth-matrix-release.md');

describe('Batch 14F real Auth staging-only safety checks',()=>{
  it('rejects the live Supabase endpoint before any auth/API requests',()=>{
    expect(script).toContain("parsed.hostname==='pvchgibllozuwickhfqz.supabase.co'");
    expect(script).toContain("STAGING_RELEASE_ACK");
    expect(script).toContain("disposable-auth-fixtures");
    expect(script.indexOf('new URL(url)')).toBeLessThan(script.indexOf('await client.auth.signInWithPassword'));
    expect(script).not.toContain('SERVICE_ROLE');
    expect(script).not.toContain('SUPABASE_SECRET_KEY');
  });
  it('validates real role identity, direct table access and exact signed allowlist',()=>{
    expect(script).toContain('signInWithPassword');
    expect(script).toContain("from(table).select('id')");
    expect(script).toContain(".rpc('can_access_quote'");
    expect(script).toContain("['owner','admin']");
    expect(script).toContain("['salesperson_a','salesperson_b','viewer','outsider']");
    expect(script).toContain('Object.keys(row).every(k=>whitelist.has(k))');
  });
  it('is a manual-only workflow with staging environment-scoped secrets',()=>{
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: sales-shop-privacy-staging');
    expect(workflow).toContain('secrets.STAGING_OWNER_EMAIL');
    expect(workflow).toContain('secrets.STAGING_OUTSIDER_EMAIL');
    expect(workflow).not.toMatch(/^\s+push:/m);
    expect(workflow).not.toMatch(/^\s+pull_request:/m);
  });
  it('does not mark full release or billable staging environment complete',()=>{
    expect(plan).toContain('$0.01344 per hour');
    expect(plan).toContain('no Supabase branch created');
    expect(plan).toContain('Do not cut over without staging success');
  });
});
