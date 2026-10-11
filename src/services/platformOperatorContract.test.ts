import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),'utf8');
const migration=read('supabase/migrations/202610110005_platform_operator_foundation.sql');
const auth=read('src/store/authStore.ts');
const gate=read('src/components/AuthGate.tsx');
const consoleSource=read('src/components/DeveloperConsole.tsx');

describe('platform operator vs company tenant boundaries',()=>{
  it('does not overload company Owner/Admin with platform developer',()=>{
    expect(migration).toContain('private.platform_operators');
    expect(migration).toContain('private.platform_tenant_status');
    expect(migration).not.toMatch(/insert into private\.platform_operators/i);
    expect(migration).not.toContain("alter table public.organization_members add");
    expect(migration).not.toContain("'developer'::text");
  });
  it('rejects mixed developer and company identities in both directions',()=>{
    expect(migration).toContain('trigger platform_operator_tenant_separation');
    expect(migration).toContain('trigger tenant_member_platform_separation');
    expect(migration).toContain('Platform developer accounts cannot hold a tenant membership');
    expect(migration).toContain('Platform developer accounts cannot join company workspaces');
  });
  it('only returns metadata and protects privileged overview by the JWT identity',()=>{
    expect(migration).toContain('if not private.is_platform_developer()');
    expect(migration).toContain("using errcode='42501'");
    expect(migration).toContain("'organizationCount'");
    for(const forbidden of ['public.quotes','public.quote_lines','public.contacts','public.organization_members m join','public.activities','public.signatures']){
      expect(migration).not.toContain(forbidden);
    }
  });
  it('routes developers before workspace bootstrapping, seeding and syncing',()=>{
    const check=auth.indexOf("supabase.rpc('is_platform_developer')");
    const bootstrap=auth.indexOf('const organizationId = await ensureCurrentWorkspace()');
    const hydrate=auth.indexOf('await hydrateCloudDocuments(organizationId');
    expect(check).toBeGreaterThan(0);
    expect(bootstrap).toBeGreaterThan(check);
    expect(hydrate).toBeGreaterThan(bootstrap);
    expect(auth).toContain("platformRole:'developer'");
    expect(auth).toContain('Developer accounts cannot join company workspaces');
  });
  it('renders the platform console without mounting tenant App and stores',()=>{
    expect(gate).toContain("if (user && platformRole === 'developer' && !passwordRecovery) return <DeveloperConsole />");
    expect(consoleSource).toContain("supabase.rpc('platform_console_overview')");
    for(const forbidden of ['useQuoteStore','useCrmStore','useNotebookStore','useCompanySettingsStore',
      "from('quotes')","from('organization_members')","from('contacts')"]) {
      expect(consoleSource).not.toContain(forbidden);
    }
  });
});
