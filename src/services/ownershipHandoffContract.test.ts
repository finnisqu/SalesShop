import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const migration=read('supabase/migrations/202610110006_ownership_handoff.sql');
const component=read('src/components/OwnershipTransferPanel.tsx');
const team=read('src/components/TeamAccessSettings.tsx');
describe('secure company ownership handoff contracts',()=>{
  it('limits each company to one Owner and one pending transfer',()=>{
    expect(migration).toContain("where role='owner'");
    expect(migration).toContain("where status='pending'");
    expect(migration).toContain('create unique index organization_exactly_one_owner_at_most');
    expect(migration).toContain('create unique index one_pending_ownership_transfer_per_org');
  });
  it('accepts only after verified named successor and atomic demotion',()=>{
    const code=migration.slice(migration.indexOf('create function public.accept_ownership_transfer'));
    expect(code).toContain("req.successor_id<>actor");
    expect(code).toContain('email_confirmed_at is not null');
    expect(code).toContain('for update');
    expect(code).toContain("current_owners<>1");
    expect(code.indexOf("where organization_id=req.organization_id and user_id=req.current_owner_id and role='owner'"))
      .toBeLessThan(code.indexOf("update public.organization_members set role='owner'"));
    expect(code).toContain("private.ownership_transfer_audit");
    expect(code).not.toContain('commit;');
  });
  it('prevents creating a new workspace after former Owner leaves',()=>{
    expect(migration).toContain("private.tenant_offboarded_accounts");
    expect(migration).toContain("raise exception 'This account has left its previous workspace");
    expect(migration).toContain('Developer accounts cannot create or enter customer workspaces');
  });
  it('safely lets initiator revoke and successor decline, without impersonation',()=>{
    expect(migration).toContain('create function public.cancel_ownership_transfer');
    expect(migration).toContain('actor<>req.current_owner_id and actor<>req.successor_id');
    expect(migration).toContain("case when actor=req.successor_id then 'declined' else 'cancelled' end");
    expect(migration).toContain("if actor=successor_user_id then");
    expect(migration).not.toContain('insert into public.organization_members(organization_id,user_id,role) values');
  });
  it('has deliberate typed, two-account UI confirmation, never one-click reassignment',()=>{
    expect(component).toContain("initiateText.trim().toUpperCase()!=='TRANSFER'");
    expect(component).toContain("acceptText.trim().toUpperCase()!=='ACCEPT'");
    expect(component).toContain("supabase.rpc('request_ownership_transfer'");
    expect(component).toContain("supabase.rpc('accept_ownership_transfer'");
    expect(component).toContain("window.location.reload()");
    expect(team).toContain('<OwnershipTransferPanel');
  });
});
