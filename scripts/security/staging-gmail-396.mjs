#!/usr/bin/env node
/**
 * #396: STAGING-ONLY, synthetic, destructive OAuth-credential permission audit.
 * Requires an isolated Supabase project (NOT pvchgibllozuwickhfqz) and a
 * staging Cloudflare Worker with #396 secrets configured.
 *
 * Uses one deliberately invalid synthetic ciphertext fixture. It exercises
 * the status endpoint only — NO Google login, refresh, Gmail APIs or revocation.
 * Only the created fixture row is deleted, even if assertions fail.
 * Never print JWTs, service keys, ciphertext or user email credentials.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const required=name=>{
 const val=process.env[name]?.trim();
 if(!val)throw new Error('Missing staging setting: '+name);
 return val;
};
const ack=required('STAGING_RELEASE_ACK');
assert.equal(ack,'isolated-gmail-credentials-fixtures',
 'Refusing to touch credentials without an isolated-fixture acknowledgement.');
const projectUrl=new URL(required('STAGING_SUPABASE_URL'));
assert(projectUrl.protocol==='https:'&&projectUrl.hostname.endsWith('.supabase.co'),
 'Supabase staging must use a dedicated HTTPS Supabase project.');
assert.notEqual(projectUrl.hostname,'pvchgibllozuwickhfqz.supabase.co',
 'Refusing the production SalesShop Supabase project.');
const appUrl=new URL(required('STAGING_GMAIL_APP_ORIGIN'));
assert(appUrl.protocol==='https:'&&appUrl.pathname==='/'&&!appUrl.search&&!appUrl.hash,
 'Use a dedicated HTTPS staging app origin.');
assert.notEqual(appUrl.origin,'https://app.salesshop.work',
 'Refusing to send synthetic requests to production SalesShop.');
assert.notEqual(appUrl.origin,'https://salesshop.work',
 'Refusing to send synthetic requests to production SalesShop.');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orgA=required('STAGING_GMAIL_ORG_A'),orgB=required('STAGING_GMAIL_ORG_B');
assert(uuid.test(orgA)&&uuid.test(orgB)&&orgA!==orgB,'Fixture orgs must be different UUIDs.');

const anon=required('STAGING_SUPABASE_PUBLISHABLE_KEY');
const secret=required('STAGING_SUPABASE_SERVICE_ROLE_KEY');
const base={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(projectUrl.origin,secret,base);
const clients={};
const sessions={};
for(const role of ['owner','colleague','outsider']){
 const client=createClient(projectUrl.origin,anon,base);
 const {data,error}=await client.auth.signInWithPassword({
  email:required('STAGING_GMAIL_'+role.toUpperCase()+'_EMAIL'),
  password:required('STAGING_GMAIL_'+role.toUpperCase()+'_PASSWORD'),
 });
 if(error||!data.user||!data.session)throw new Error('Could not authenticate synthetic '+role);
 clients[role]=client;sessions[role]={id:data.user.id,jwt:data.session.access_token};
}
assert(new Set(Object.values(sessions).map(s=>s.id)).size===3,'Fixture users must differ.');

const membership=async(org,user)=>{
 const {data,error}=await admin.from('organization_members')
  .select('user_id').eq('organization_id',org).eq('user_id',user).limit(1);
 if(error)throw new Error('Could not inspect synthetic membership.');
 return Boolean(data?.length);
};
assert(await membership(orgA,sessions.owner.id),'Owner must be in org A.');
assert(await membership(orgA,sessions.colleague.id),'Colleague must be in org A.');
assert(await membership(orgB,sessions.outsider.id),'Outsider must be in org B.');
assert(!(await membership(orgA,sessions.outsider.id)),'Outsider must not be in org A.');

const table='gmail_oauth_connections396';
const {data:preexisting,error:preError}=await admin.from(table)
 .select('organization_id,user_id').eq('organization_id',orgA)
 .eq('user_id',sessions.owner.id).limit(1);
if(preError)throw new Error('Staging credential table missing or inaccessible.');
assert.equal(preexisting.length,0,
 'Fixture owner already has a saved Gmail grant; refusing to overwrite it.');
const fakeMailbox='staging-'+randomUUID()+'@example.invalid';
const fake={
 organization_id:orgA,user_id:sessions.owner.id,mailbox:fakeMailbox,
 refresh_ciphertext:'AAAA'.repeat(20),refresh_nonce:'AAAA'.repeat(4),
 key_version:1,granted_scope:'https://www.googleapis.com/auth/gmail.readonly',
 status:'active',
};
let inserted=false;
let passes=0;
const verify=async(label,fn)=>{
 await fn();passes++;process.stdout.write('PASS '+label+'\n');
};
const status=async(role,org)=>{
 const response=await fetch(appUrl.origin+'/api/gmail/persistent/status?organization_id='+org,{
  headers:{Authorization:'Bearer '+sessions[role].jwt},
  cache:'no-store',redirect:'error',
 });
 let data;
 try{data=await response.json();}catch{data={};}
 return {code:response.status,data};
};
try{
 const {error}=await admin.from(table).insert(fake);
 if(error)throw new Error('Could not insert isolated staging credential.');
 inserted=true;
 await verify('Service role sees only the deliberately inserted fixture',async()=>{
  const {data,error:readError}=await admin.from(table).select('mailbox')
   .eq('organization_id',orgA).eq('user_id',sessions.owner.id).single();
  assert(!readError&&data?.mailbox===fakeMailbox);
 });
 for(const role of ['owner','colleague','outsider']){
  await verify('Browser '+role+' cannot read encrypted credentials',async()=>{
   const {data}=await clients[role].from(table).select('mailbox,refresh_ciphertext')
    .eq('organization_id',orgA).eq('user_id',sessions.owner.id);
   assert(!data?.length,'Browser could read stored credential fields.');
  });
 }
 await verify('Owner can see only own saved Gmail status',async()=>{
  const result=await status('owner',orgA);
  assert.equal(result.code,200);
  assert.equal(result.data.connected,true);
  assert.equal(result.data.mailbox,fakeMailbox);
  assert(!JSON.stringify(result.data).includes(fake.refresh_ciphertext));
 });
 await verify('Same-org colleague cannot see the owner mailbox',async()=>{
  const result=await status('colleague',orgA);
  assert.equal(result.code,200);
  assert.equal(result.data.connected,false);
  assert.equal(result.data.mailbox,null);
 });
 await verify('Outside-org user cannot access org A status',async()=>{
  assert.equal((await status('outsider',orgA)).code,403);
 });
 await verify('Outside-org user has valid access in own org',async()=>{
  const result=await status('outsider',orgB);
  assert.equal(result.code,200);
  assert.equal(result.data.connected,false);
 });
 await verify('Anonymous status does not reveal the mailbox',async()=>{
  const response=await fetch(appUrl.origin+'/api/gmail/persistent/status?organization_id='+orgA);
  assert.equal(response.status,401);
  assert(!(await response.text()).includes(fakeMailbox));
 });
}finally{
 if(inserted){
  const {error}=await admin.from(table).delete()
   .eq('organization_id',orgA).eq('user_id',sessions.owner.id)
   .eq('mailbox',fakeMailbox);
  if(error)throw new Error('SECURITY TEST CLEANUP FAILED: manually remove synthetic fixture.');
 }
}
process.stdout.write('Staging Gmail #396 audit passed '+passes+' checks. No Google tokens used.\n');
