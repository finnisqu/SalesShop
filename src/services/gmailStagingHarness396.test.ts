import {describe,it,expect} from 'vitest';
import harness from '../../worker/gmailStagingHarness396';

const stagingDb='https://lztviymnqplloarwywde.supabase.co';
const origin='https://salesshop-gmail-396-staging.example.workers.dev';
const statusUrl=origin+'/api/gmail/persistent/status?organization_id=68af5ab1-aa83-43c9-b442-93b0f3bb7ca7';
const env={GMAIL_OAUTH_ORIGIN:origin,SUPABASE_URL:stagingDb};
describe('#396 — staging-only Cloudflare API harness',()=>{
 it('does not serve a CRM app or any unrelated routes',async()=>{
  const response=await harness.fetch(new Request(origin+'/'),env);
  expect(response.status).toBe(404);
  expect((await response.text())).not.toContain('SalesShop');
 });
 it('remains fail-closed until Worker secrets are configured',async()=>{
  const response=await harness.fetch(new Request(statusUrl),env);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({configured:false,connected:false});
 });
 it('blocks requests without exact staging Worker origin',async()=>{
  for(const wrong of [undefined,'', 'https://app.salesshop.work',
   'https://salesshop.work','https://lookalike.example']){
   const response=await harness.fetch(new Request(statusUrl),
    {...env,GMAIL_OAUTH_ORIGIN:wrong});
   expect(response.status).toBe(503);
  }
 });
 it('rejects use of live Supabase even with correct Worker hostname',async()=>{
  const response=await harness.fetch(new Request(statusUrl),{
   ...env,SUPABASE_URL:'https://pvchgibllozuwickhfqz.supabase.co'});
  expect(response.status).toBe(503);
  const changed=await harness.fetch(new Request(statusUrl),{
   ...env,SUPABASE_URL:'https://another-project.supabase.co'});
  expect(changed.status).toBe(503);
 });
 it('never serves staging API from a production or mismatched request origin',async()=>{
  const response=await harness.fetch(
   new Request('https://app.salesshop.work/api/gmail/persistent/status'),
   env);
  expect(response.status).toBe(503);
 });
});
