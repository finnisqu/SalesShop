import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const admin=readFileSync(new URL('../../supabase/functions/quote-share-admin/index.ts',import.meta.url),'utf8');
const customer=readFileSync(new URL('../../supabase/functions/quote-share-public/index.ts',import.meta.url),'utf8');

describe('Customer link server-error disclosures',()=>{
 it('keeps privileged JWT and quote authorization checks before share operations',()=>{
   expect(admin).toContain("userClient.rpc('can_access_quote'");
   expect(admin).toContain("userClient.rpc('can_issue_team_quote'");
   expect(admin).toContain("userClient.rpc('can_edit_team_area'");
 });
 it('returns generic server errors while preserving private diagnostics',()=>{
   expect(admin).toContain("console.error(error);");
   expect(customer).toContain("console.error(error);");
   expect(admin).toContain("error: 'Customer link service is temporarily unavailable. Please retry.'");
   expect(customer).toContain("error: 'Document service is temporarily unavailable. Please retry.'");
   expect(admin).not.toContain("error instanceof Error ? error.message");
   expect(customer).not.toContain("error instanceof Error ? error.message");
 });
 it('keeps actionable client errors and invalid token responses',()=>{
   expect(admin).toContain("return json({ error: 'Authentication required.' }, 401)");
   expect(admin).toContain("return json({ error: 'Quote access denied.' }, 403)");
   expect(customer).toContain("return json({ error: 'Invalid share request.' }, 400)");
   expect(customer).toContain("return json({ error: 'This document link is not valid.' }, 404)");
 });
});
