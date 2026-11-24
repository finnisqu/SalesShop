import {describe,it,expect,vi,afterEach} from 'vitest';
import harness from '../../worker/gmailStagingHarness396';

const stagingDb='https://lztviymnqplloarwywde.supabase.co';
const origin='https://salesshop-gmail-396-staging.example.workers.dev';
const statusUrl=origin+'/api/gmail/persistent/status?organization_id=68af5ab1-aa83-43c9-b442-93b0f3bb7ca7';
const env={GMAIL_OAUTH_ORIGIN:origin,SUPABASE_URL:stagingDb};
afterEach(()=>vi.unstubAllGlobals());
describe('#396 — staging-only Cloudflare API harness',()=>{
 it('probes staging Auth and private membership with manual redirects and no secrets returned',async()=>{
  const calls:RequestInit[]=[];
  vi.stubGlobal('fetch',vi.fn(async (_resource:string,init?:RequestInit)=>{
   calls.push(init??{});
   return new Response(null,{status:calls.length===1?401:200});
  }));
  const response=await harness.fetch(new Request(origin+'/audit/health'),{
   ...env,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_staging_test_396',
   SUPABASE_SECRET_KEY:'sb_secret_DO_NOT_EXPOSE'});
  expect(response.status).toBe(200);
  const payload=await response.text();
  expect(JSON.parse(payload)).toEqual({checks:{
   authEndpointStatus:401,privateMembershipReadStatus:200}});
  expect(payload).not.toContain('sb_secret_');
  expect(payload).not.toContain('sb_publishable_');
  expect(calls.length).toBe(2);
  expect(calls.every(call=>call.redirect==='manual')).toBe(true);
  expect(calls.every(call=>call.method==='GET')).toBe(true);
 });

 it('serves explicit staging-only OAuth code-popup test with Google-compatible CSP/COOP',async()=>{
  const html=await harness.fetch(new Request(origin+'/oauth-test'),env);
  expect(html.status).toBe(200);
  expect(html.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
  const csp=html.headers.get('Content-Security-Policy')??'';
  expect(csp).toContain("script-src 'self' https://accounts.google.com/gsi/client");
  expect(csp).toContain('frame-src https://accounts.google.com');
  expect(csp).toContain("connect-src 'self' https://lztviymnqplloarwywde.supabase.co");
  expect(html.headers.get('Cache-Control')).toBe('no-store');
  const markup=await html.text();
  expect(markup).toContain('Real Google consent is optional.');
  expect(markup).toContain('https://accounts.google.com/gsi/client');
  expect(markup).toContain('src="/oauth-test.js"');
  expect(markup).not.toContain('GOOGLE_GMAIL_CLIENT_SECRET');
  const script=await harness.fetch(new Request(origin+'/oauth-test.js'),env);
  expect(script.status).toBe(200);
  const code=await script.text();
  expect(code).toContain("ux_mode:'popup'");
  expect(code).toContain('state:expectedState');
  expect(code).toContain("data.state!==expectedState");
  expect(code).toContain('api(\'connect\',code)');
  expect(code).toContain("api('refresh')");
  expect(code).toContain("api('disconnect')");
  expect(code).toContain('client.requestCode()');
  expect(code).not.toContain('localStorage');
  expect(code).not.toContain('sessionStorage');
  expect(code).not.toContain('refresh_token');
  expect(code).not.toContain('console.log');
 });
 it('returns only public OAuth configuration and rejects production origins and unsafe methods',async()=>{
  const url=origin+'/oauth-test/config';
  const secretEnv={...env,
   SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_1234',
   GOOGLE_GMAIL_CLIENT_ID:'test.apps.googleusercontent.com',
   GOOGLE_GMAIL_CLIENT_SECRET:'DO_NOT_EXPOSE_GOOGLE_SECRET',
   SUPABASE_SECRET_KEY:'sb_secret_DO_NOT_EXPOSE',
   GMAIL_TOKEN_ENCRYPTION_KEY:'DO_NOT_EXPOSE_ENCRYPTION'};
  const response=await harness.fetch(new Request(url),secretEnv);
  expect(response.status).toBe(200);
  const payload=await response.text();
  expect(JSON.parse(payload)).toEqual({
   supabaseUrl:stagingDb,publishableKey:'sb_publishable_test_1234',
   googleClientId:'test.apps.googleusercontent.com'});
  for(const secret of ['DO_NOT_EXPOSE_GOOGLE_SECRET','sb_secret_DO_NOT_EXPOSE',
   'DO_NOT_EXPOSE_ENCRYPTION'])expect(payload).not.toContain(secret);
  expect((await harness.fetch(new Request(url,{method:'POST'}),secretEnv)).status).toBe(405);
  expect((await harness.fetch(new Request('https://app.salesshop.work/oauth-test'),secretEnv)).status).toBe(503);
  expect((await harness.fetch(new Request(url),{
   ...secretEnv,SUPABASE_URL:'https://pvchgibllozuwickhfqz.supabase.co'})).status).toBe(503);
  expect((await harness.fetch(new Request(url),{
   ...secretEnv,GOOGLE_GMAIL_CLIENT_ID:'invalid'})).status).toBe(503);
  expect((await harness.fetch(new Request(url),{
   ...secretEnv,SUPABASE_PUBLISHABLE_KEY:'sb_secret_instead'})).status).toBe(503);
 });
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
  expect(code).toContain("try{return await fetch(url,init);}");
  expect(code).toContain("stageFetch('Synthetic staging sign-in',STAGING_SUPABASE+'/auth/v1/token?grant_type=password'");
  expect(code).toContain("stageFetch('Direct credential read denial',STAGING_SUPABASE+'/rest/v1/gmail_oauth_connections396?select=mailbox,refresh_ciphertext&limit=1'");
  expect(code).not.toContain('localStorage');
  expect(code).not.toContain('sessionStorage');
  // A failed step should identify its operation and preserve preceding PASS
  // results instead of collapsing to the unhelpful "Failed to fetch".
  expect(code).toContain('async function stageFetch(label,url,init)');
  expect(code).toContain("onProgress([...assertions])");
  expect(code).toContain("output.textContent=(completed.length?completed.join");
  expect(code).toContain("stageFetch('Public staging configuration'");
  expect(code).toContain("stageFetch('Synthetic staging sign-in'");
  expect(code).toContain("stageFetch('Owner synthetic refresh refusal'");
  expect(code).toContain("stageFetch('Direct credential read denial'");
  // A dummy saved credential is always status=reauthorize: owner sees only
  // mailbox metadata, other members never share the grant, refresh is 409.
  expect(code).toContain('savedFixtureMode');
  expect(code).toContain('SAVED_FIXTURE_MAILBOX');
  expect(code).toContain('ownJson.needsReconnect!==true');
  expect(code).toContain('if(refresh.status!==409)');
  expect(code).toContain("role==='owner'");
  expect(code).not.toContain('refresh_token');
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
