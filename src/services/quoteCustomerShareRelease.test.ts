import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const code=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('18E links and issue are distinct, client + Edge',()=>{
  it('client never calls recordSent as a side effect of link creation',()=>{
    const service=code('src/services/quoteShareService.ts');
    expect(service).toContain('customerShareCreationBlocker(quote)');
    expect(service).not.toContain('state.recordSent(');
    expect(service).toContain('assertCurrentQuoteRevision');
    expect(service).toContain('response.share.quoteId!==quote.id||response.share.revision!==quote.revision');
  });
  it('service-role edge requires an issued status as well as exact frozen revision',()=>{
    const edge=code('supabase/functions/quote-share-admin/index.ts');
    expect(edge).toContain("['Sent', 'Viewed', 'Signed'].includes(String(quote.status))");
    expect(edge).toContain("Only an issued quote revision can have a customer link.");
    expect(edge).toContain("if (revision !== Number(quote.revision))");
    expect(edge).toContain("if (!frozenRevision)");
  });
  it('share UI does not display stale links for a different revision',()=>{
    const ui=code('src/components/QuoteShareControl.tsx');
    expect(ui).toContain('const currentShare=');
    expect(ui).toContain('shareMatchesQuoteRevision(quote,share)');
    expect(ui).toContain('customerShareCreationBlocker(quote)');
    expect(ui).not.toContain('Creating the link will issue and freeze');
  });
});
