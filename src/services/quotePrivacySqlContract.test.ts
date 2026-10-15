import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const sql=readFileSync(join(process.cwd(),'supabase/migrations/20261015151800_private_quote_ownership_gate.sql'),'utf8');
const section=(start:string,end:string)=>sql.slice(sql.indexOf(start),sql.indexOf(end,sql.indexOf(start)+1));

describe('Batch 14B staged quote privacy RLS contract (not live-deployed)',()=>{
  it('redefines current SQL helpers with membership, owner and explicit-grant checks',()=>{
    const read=section('create or replace function private.can_read_quote','create or replace function private.can_edit_quote');
    expect(read).toContain('security definer set search_path');
    expect(read).toContain('q.owner_user_id=(select auth.uid())');
    expect(read).toContain("m.role in ('owner','admin','member')");
    expect(read).toContain('public.quote_access_grants');
    expect(read).toContain('g.user_id=(select auth.uid())');
    expect(read).toContain("q.owner_user_id is null and m.role in ('owner','admin')");
    expect(read).not.toContain("m.role in ('owner','admin')\n        or");
    expect(read).not.toContain('sales_team_members');
    expect(read).toContain('m.user_id=(select auth.uid())');
  });
  it('rejects read-only grants and general admin status as reasons to edit owned quotes',()=>{
    const edit=section('create or replace function private.can_edit_quote','revoke all on function private.can_read_quote');
    expect(edit).toContain('q.owner_user_id=(select auth.uid())');
    expect(edit).toContain("private.can_edit_org_area(q.organization_id,'quotes')");
    expect(edit).toContain("q.owner_user_id is null and m.role in ('owner','admin')");
    expect(edit).not.toContain('quote_access_grants');
    expect(edit).not.toContain('sales_team_members');
  });
  it('closes the privileged quote-numbering helper bypass',()=>{
    const numbering=section('CREATE OR REPLACE FUNCTION private.assign_commercial_document_number',
      '-- Existing child SELECT/UPDATE policies already refer to these two functions.');
    expect(numbering.toLowerCase()).toContain('security definer');
    expect(numbering).toContain('private.can_issue_org_quotes(p_organization_id)');
    expect(numbering).toContain('if not private.can_edit_quote(p_organization_id,p_quote_id) then');
    expect(numbering).toContain("using errcode='42501'");
  });
  it('keeps quote inserts personal and quote grants explicit',()=>{
    expect(sql).toContain("owner_user_id=(select auth.uid())");
    expect(sql).toContain('alter policy quotes_insert_editor');
    for(const p of ['quote_access_grants_read','quote_access_grants_insert_admin',
      'quote_access_grants_update_admin','quote_access_grants_delete_admin']){
      const statement=sql.slice(sql.indexOf('alter policy '+p),sql.indexOf(';',sql.indexOf('alter policy '+p)));
      expect(statement).toContain('private.can_edit_quote(');
    }
  });
  it('does not leak private full snapshots through the legacy JSON bridge',()=>{
    expect(sql).toContain("document_key not in ('quotes','signatures','crm')");
    for(const p of ['org_documents_select_members','org_documents_insert_members','org_documents_update_members','org_documents_delete_admins']){
      expect(sql).toContain('alter policy '+p);
    }
    expect(sql).toContain('alter policy activities_insert_editor');
    expect(sql).toContain('(quote_id is null or private.can_edit_quote(organization_id,quote_id))');
  });
  it('permits ONLY audited admin assignment of genuinely unowned legacy quotes',()=>{
    const assign=section('create or replace function public.assign_unowned_quote','revoke all on function public.assign_unowned_quote');
    expect(assign).toContain("m.role in ('owner','admin')");
    expect(assign).toContain("m.job_function in ('general','salesperson','estimator')");
    expect(assign).toContain('actor uuid := auth.uid()');
    expect(assign).toContain('owner_user_id is null');
    expect(assign).toContain('insert into private.quote_recovery_assignments');
    expect(sql).toContain('alter table private.quote_recovery_assignments enable row level security');
    expect(sql).toContain('revoke all on private.quote_recovery_assignments from public,anon,authenticated');
    expect(sql).toContain('grant execute on function public.assign_unowned_quote(uuid,text,uuid) to authenticated');
    expect(sql).not.toContain('delete from public.quotes');
  });
  it('is explicitly transactional and does not change customer shares or signed evidence',()=>{
    expect(sql.trim().startsWith('-- Batch 14B STAGED ONLY')).toBe(true);
    expect(sql).toMatch(/\nbegin;\n/);
    expect(sql.trim().endsWith('commit;')).toBe(true);
    expect(sql).not.toContain('delete from public.signatures');
    expect(sql).not.toContain('update public.quote_shares');
  });
});
