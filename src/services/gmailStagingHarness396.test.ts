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
 it('serves synthetic browser audit only on the isolated Worker host',async()=>{
  const response=await harness.fetch(new Request(origin+'/audit'),env);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('Content-Security-Policy')).toContain("connect-src 'self' https://lztviymnqplloarwywde.supabase.co");
  const html=await response.text();
  expect(html).toContain('Only use the three synthetic');
  expect(html).toContain('src="/audit.js"');
  expect(html).not.toContain('sb_secret_');
  const script=await harness.fetch(new Request(origin+'/audit.js'),env);
  expect(script.status).toBe(200);
  const code=await script.text();
  expect(code).toContain("Synthetic staging sign-in failed");
  expect(code).toContain('fetch(STAGING_SUPABASE+');
  expect(code).not.toContain('localStorage');
  expect(code).not.toContain('sessionStorage');
 });
 it('publishes only a validated staging publishable key, never privileged secrets',async()=>{
  const url=origin+'/audit/config';
  const configured={...env,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_staging_test_396',
   SUPABASE_SECRET_KEY:'sb_secret_DO_NOT_EXPOSE',
   GOOGLE_GMAIL_CLIENT_SECRET:'google-secret-DO_NOT_EXPOSE',
   GMAIL_TOKEN_ENCRYPTION_KEY:'encrypted-key-DO_NOT_EXPOSE'};
  const response=await harness.fetch(new Request(url),configured);
  expect(response.status).toBe(200);
  const output=await response.text();
  expect(JSON.parse(output)).toEqual({supabaseUrl:stagingDb,
   publishableKey:'sb_publishable_staging_test_396'});
  expect(output).not.toContain('sb_secret_');
  expect(output).not.toContain('google-secret');
  expect(output).not.toContain('encrypted-key');
  for(const bad of ['','sb_secret_wrong','not-a-public-key']){
   const denial=await harness.fetch(new Request(url),{
    ...configured,SUPABASE_PUBLISHABLE_KEY:bad});
   expect(denial.status).toBe(503);
  }
 });
 it('requires GET and refuses serving audit data from production origins',async()=>{
  expect((await harness.fetch(new Request(origin+'/audit/config',{method:'POST'}),env)).status).toBe(405);
  expect((await harness.fetch(new Request('https://app.salesshop.work/audit'),env)).status).toBe(503);
  expect((await harness.fetch(new Request(origin+'/audit'),{
   ...env,SUPABASE_URL:'https://pvchgibllozuwickhfqz.supabase.co'})).status).toBe(503);
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
