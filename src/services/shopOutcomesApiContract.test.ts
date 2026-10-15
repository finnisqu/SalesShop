import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const edge=readFileSync(join(process.cwd(),'supabase/functions/shop-outcomes/index.ts'),'utf8');
const client=readFileSync(join(process.cwd(),'src/services/shopOutcomesService.ts'),'utf8');

/** Structural guards only; deployment requires real authenticated role tests. */
describe('Shop Outcomes server boundary (pre-deployment contract)',()=>{
  it('authenticates the JWT before privileged database reads',()=>{
    const auth=edge.indexOf('auth.getUser(jwt)');
    const membership=edge.indexOf(".from('organization_members')");
    const evidence=edge.indexOf(".from('signatures')");
    expect(auth).toBeGreaterThan(0);
    expect(membership).toBeGreaterThan(auth);
    expect(evidence).toBeGreaterThan(membership);
    expect(edge).toContain(".eq('user_id', identity.user.id)");
    expect(edge).toContain("!['owner', 'admin'].includes(membership.role)");
    expect(edge).toContain('return json({ error: \'Shop outcomes access denied.\' }, 403)');
  });
  it('selects only signed evidence and builds an explicit projection',()=>{
    expect(edge).toContain(".from('signatures')");
    expect(edge).toContain(".select('id,quote_id,revision,accepted_at,accepted_snapshot')");
    expect(edge).toContain(".eq('organization_id', organizationId)");
    expect(edge).toContain(".limit(100)");
    expect(edge).not.toContain(".from('quotes')");
    expect(edge).not.toContain(".from('quote_lines')");
    expect(edge).not.toContain(".select('*')");
    expect(edge).toContain('const outcomes = (signatures ?? [])');
    expect(edge).toContain('return json({ outcomes, limit: 100 })');
  });
  it('returns a strict signed outcome allowlist, not signature rows',()=>{
    for(const field of ['signatureId','quoteId','quoteNumber','revision','documentType',
      'title','projectId','companyName','acceptedAt','acceptedTotal']) {
      expect(edge).toContain(field);
    }
    expect(edge).not.toContain('...snapshot');
    expect(edge).not.toContain('...row');
    expect(edge).not.toContain('signerName:');
    expect(edge).not.toContain('signerEmail:');
    expect(edge).not.toContain('internalCost:');
    expect(edge).toContain("'Cache-Control': 'no-store'");
  });
  it('never uses broad quote stores as a substitute for server authorization',()=>{
    expect(client).toContain("supabase.functions.invoke<OutcomeResponse>('shop-outcomes'");
    expect(client).not.toContain('useQuoteStore');
    expect(client).not.toContain('useSignatureStore');
    expect(client).toContain("auth.teamRole!=='owner'&&auth.teamRole!=='admin'");
  });
});
