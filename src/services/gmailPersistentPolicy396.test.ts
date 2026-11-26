import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(relative:string)=>readFileSync(new URL(relative,import.meta.url),'utf8');
const sql=read('../../docs/platform/sql/396-gmail-persistent-staging.sql');
const worker=read('../../worker/gmailPersistent396.ts');
const entry=read('../../worker/index.ts');
const state=read('../store/gmailSession359a.ts');
const service=read('./gmailPersistent396.ts');
const boundary=read('../components/EmailAccountBoundary.tsx');
const email=read('../components/EmailWorkspace.tsx');
describe('#396 — encryption and tenancy policies',()=>{
 it('stages a service-role-only refresh credential table outside production migration paths',()=>{
  expect(sql).toContain('STAGING ONLY');
  expect(sql).toContain('primary key(organization_id,user_id)');
  expect(sql).toContain('on delete cascade');
  expect(sql).toContain('enable row level security');
  expect(sql).toContain('revoke all on public.gmail_oauth_connections396 from PUBLIC,anon,authenticated');
  expect(sql).toContain('grant select,insert,update,delete on public.gmail_oauth_connections396 to service_role');
  expect(sql).not.toMatch(/create policy.*gmail_oauth_connections396/i);
  expect(sql).not.toMatch(/grant.*gmail_oauth_connections396 to authenticated/i);
 });
 it('requires verified Supabase Auth user and org membership before reading saved tokens',()=>{
  expect(worker).toContain("'/auth/v1/user'");
  expect(worker).toContain('await belongsToOrg(env,org,user)');
  expect(worker).toContain("'/rest/v1/'");
  expect(worker).toContain("rowPath(org,user)");
  expect(worker).toContain('if(row.key_version!==1||row.organization_id!==org||row.user_id!==user)');
  expect(worker).toContain("additionalData:additionalData(org,user)");
  expect(worker).toContain("key_version:1,status:'active'");
 });
 it('never exposes a refresh credential to browser code',()=>{
  expect(service).not.toContain('refresh_token');
  expect(service).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  expect(service).not.toContain('GMAIL_TOKEN_ENCRYPTION_KEY');
  expect(state).not.toContain('refresh_token');
  expect(worker).toContain("refresh_ciphertext");
  expect(worker).toContain("return json({connected:true,mailbox,access_token:tokens.access_token");
  expect(worker).toContain("if(!refresh)return error");
  expect(worker).toContain('Cache-Control');
 });
 it('keeps a temporary popup fallback until persistence is configured',()=>{
  expect(email).toContain("if(useGmailSessionStore.getState().persistentConfigured)");
  expect(email).toContain('await connectPersistent();');
  expect(email).toContain('await connect();');
  expect(state).toContain('requestPersistentCode396()');
  expect(boundary).toContain('restorePersistent()');
  expect(boundary).toContain('renewPersistent()');
  expect(state).toContain('if(token&&!persistent)revokeGmailToken(token)');
 });
 it('uses the documented GIS code-popup configuration and confirms a unique state',()=>{
  expect(service).toContain("ux_mode:'popup'");
  expect(service).toContain("select_account:true,include_granted_scopes:false,state:expectedState");
  expect(service).toContain("data.state!==expectedState");
  expect(service).toContain("data.scope?.split(/\\s+/).includes(GMAIL_READONLY_SCOPE)");
  expect(service).not.toContain("prompt:'consent'");
  expect(service).toContain("popupClosed=true;checkPopupClosed()");
 });
 it('does not erase connected Gmail on a transient Worker error',()=>{
  expect(state).toContain('gmailRenewal396');
  expect(state).toContain('if(gmailRenewal396?.scope===scope&&gmailRenewal396.epoch===epoch)');
  expect(state).toContain('temporary Cloudflare/Google outage');
  expect(state).toContain("if(get().persistent||get().needsReconnect)");
  expect(state).toContain("needsReconnect:true,error:message");
 });
 it('revokes only with explicit saved disconnect and never during account switching',()=>{
  expect(worker).toContain("if(action==='disconnect')");
  expect(worker).toContain('await removeConnection(env,org,user)');
  expect(worker).toContain('await revokeGoogle(refresh)');
  expect(state).toContain('async disconnectSaved()');
  expect(email).toContain('await disconnectSaved()');
  expect(state).toContain('++gmailIdentityEpoch396');
 });
 it('uses redirect manual, because Cloudflare Workers reject redirect error before making a request',()=>{
  expect(worker).not.toContain("redirect:'error'");
  expect(worker.match(/redirect:'manual'/g)).toHaveLength(5);
 });
 it('validates cross-origin postbacks and enforces no-store headers',()=>{
  expect(worker).toContain("request.headers.get('Origin')!==origin");
  expect(worker).toContain("request.headers.get('X-Requested-With')!=='XMLHttpRequest'");
  expect(worker).toContain("'Cache-Control':'no-store, max-age=0'");
  expect(entry).toContain('handleGmailPersistent396(request,env,originFor(env))');
 });
});
