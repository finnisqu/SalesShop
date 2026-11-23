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
/** Modern sb_secret_ keys authenticate in apikey only; do not put an opaque
 * secret in Authorization: Bearer where Supabase would parse it as a JWT.
 * All admin requests are confined to this separately verified staging URL.
 */
const adminRest=async (table,query='',method='GET',body)=>{
 const response=await fetch(projectUrl.origin+'/rest/v1/'+table+query,{
  method,headers:{apikey:secret,'Content-Type':'application/json',
   Prefer:'return=representation'},
  ...(body?{body:JSON.stringify(body)}:{}),
  cache:'no-store',redirect:'error',
 });
 if(!response.ok)throw new Error('Staging service access failed: '+table);
 const raw=await response.text();
 return raw?JSON.parse(raw):[];
};
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
 const data=await adminRest('organization_members',
  '?select=user_id&organization_id=eq.'+org+'&user_id=eq.'+user+'&limit=1');
 return Boolean(data?.length);
};
assert(await membership(orgA,sessions.owner.id),'Owner must be in org A.');
assert(await membership(orgA,sessions.colleague.id),'Colleague must be in org A.');
assert(await membership(orgB,sessions.outsider.id),'Outsider must be in org B.');
assert(!(await membership(orgA,sessions.outsider.id)),'Outsider must not be in org A.');

const table='gmail_oauth_connections396';
const preexisting=await adminRest(table,
 '?select=organization_id,user_id&organization_id=eq.'+orgA+
 '&user_id=eq.'+sessions.owner.id+'&limit=1');
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
const negativeMailbox='staging-write-'+randomUUID()+'@example.invalid';
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
 await adminRest(table,'','POST',fake);
 inserted=true;
 await verify('Service role sees only the deliberately inserted fixture',async()=>{
  const data=await adminRest(table,'?select=mailbox&organization_id=eq.'+
   orgA+'&user_id=eq.'+sessions.owner.id+'&limit=1');
  assert(data?.length===1&&data[0]?.mailbox===fakeMailbox);
 });
 for(const role of ['owner','colleague','outsider']){
  await verify('Browser '+role+' cannot read encrypted credentials',async()=>{
   const {data}=await clients[role].from(table).select('mailbox,refresh_ciphertext')
    .eq('organization_id',orgA).eq('user_id',sessions.owner.id);
   assert(!data?.length,'Browser could read stored credential fields.');
  });
 }
 await verify('Same-org browser user cannot overwrite a saved credential',async()=>{
  const original=await adminRest(table,'?select=mailbox&organization_id=eq.'+
   orgA+'&user_id=eq.'+sessions.owner.id+'&limit=1');
  const attempt=await clients.owner.from(table).update({mailbox:negativeMailbox})
   .eq('organization_id',orgA).eq('user_id',sessions.owner.id);
  const after=await adminRest(table,'?select=mailbox&organization_id=eq.'+
   orgA+'&user_id=eq.'+sessions.owner.id+'&limit=1');
  assert(original.length===1&&after.length===1);
  assert.equal(after[0].mailbox,fakeMailbox,
   'Authenticated browser illegally modified encrypted credential metadata.');
  assert(attempt.error||!attempt.data,
   'Expected browser UPDATE to be denied by grants/RLS.');
 });
 await verify('Signed-in browser cannot insert a forged encrypted credential',async()=>{
  const candidate={...fake,user_id:sessions.colleague.id,mailbox:negativeMailbox};
  const attempt=await clients.colleague.from(table).insert(candidate);
  assert(attempt.error,'Browser INSERT unexpectedly succeeded despite RLS/grants.');
  const rows=await adminRest(table,'?select=mailbox&organization_id=eq.'+
   orgA+'&user_id=eq.'+sessions.colleague.id+'&mailbox=eq.'+
   encodeURIComponent(negativeMailbox));
  assert.equal(rows.length,0,'Browser inserted unauthorized token metadata.');
 });
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
  try{
   await adminRest(table,'?organization_id=eq.'+orgA+
    '&user_id=eq.'+sessions.owner.id+
    '&mailbox=eq.'+encodeURIComponent(fakeMailbox),'DELETE');
   // Remove this audit's extra negative-write fixture if any policy mistake
   // allowed it to be inserted. Never touch preexisting rows.
   await adminRest(table,'?organization_id=eq.'+orgA+
    '&user_id=eq.'+sessions.colleague.id+
    '&mailbox=eq.'+encodeURIComponent(negativeMailbox),'DELETE');
  }catch{
   throw new Error('SECURITY TEST CLEANUP FAILED: remove synthetic fixtures manually.');
  }
 }
}
process.stdout.write('Staging Gmail #396 audit passed '+passes+' checks. No Google tokens used.\n');
