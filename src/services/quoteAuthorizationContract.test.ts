import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sql=readFileSync(join(root,'supabase/migrations/202610110002_quote_scoped_rls.sql'),'utf8');
const edge=readFileSync(join(root,'supabase/functions/quote-share-admin/index.ts'),'utf8');
const legacyLock=readFileSync(join(root,'supabase/migrations/202610110003_lock_legacy_org_snapshots.sql'),'utf8');
const sync=readFileSync(join(root,'src/services/normalizedQuoteSync.ts'),'utf8');

describe('quote authorization defense in depth',()=>{
  it('moves all quote and quote-child SELECT policies off organization-wide read',()=>{
    for(const [table,policy] of [
      ['quotes','quotes_read_org'],
      ['quote_lines','quote_lines_read_org'],
      ['quote_sections','quote_sections_read_org'],
      ['quote_revisions','quote_revisions_members_select'],
      ['quote_shares','quote_shares_members_select'],
      ['signatures','signatures_members_select'],
    ]) {
      const start=sql.indexOf(`alter policy ${policy} on public.${table}`);
      expect(start,table).toBeGreaterThan(0);
      expect(sql.slice(start,start+250),table).toContain('private.can_read_quote(');
    }
  });
  it('denies unassigned quotes to ordinary users, except explicit access',()=>{
    expect(sql).toContain("m.role in ('owner','admin')");
    expect(sql).toContain('q.owner_user_id=(select auth.uid())');
    expect(sql).toContain("m.role='member' and q.team_id is not null");
    expect(sql).toContain('public.quote_access_grants');
    expect(sql).not.toContain("q.owner_user_id is null or");
  });
  it('closes legacy JSON and quote-activity alternate read paths',()=>{
    expect(sql).toContain("document_key not in ('quotes','signatures')");
    expect(legacyLock).toContain('alter policy org_documents_select_members');
    expect(legacyLock).toContain('using (private.is_org_admin(organization_id))');
    expect(sql).toContain('alter policy activities_read_org');
    expect(sql).toContain('private.can_read_quote(organization_id,quote_id)');
  });
  it('forces privileged share endpoint to check quote-level JWT access',()=>{
    const i=edge.indexOf("userClient.rpc('can_access_quote'");
    const j=edge.indexOf("if (action === 'get')",i);
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    expect(edge).toContain("p_action: action === 'get' ? 'read' : 'edit'");
  });
  it('never bulk-resubmits team read-only quotes or unchanged rows',()=>{
    expect(sync).toContain('quote.ownerUserId === actorId');
    expect(sync).toContain('return localTime > serverTime');
    expect(sync).toContain('return localValue > serverValue');
  });
  it('protects privileged quote numbering RPC',()=>{
    expect(sql).toContain('create or replace function public.assign_commercial_document_number');
    expect(sql).toContain('if not private.can_edit_quote(p_organization_id,p_quote_id)');
  });
});
