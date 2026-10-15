#!/usr/bin/env node
/**
 * Real Supabase Auth + PostgREST + Edge Function integration gate.
 * Requires a separate, seeded *staging* project. Read-only: no test mutations.
 * Never accepts the live SalesShop Supabase project reference.
 */
import {createClient} from '@supabase/supabase-js';

const required=(name)=>{
  const value=process.env[name]?.trim();
  if(!value)throw new Error(`Missing staging-only environment variable: ${name}`);
  return value;
};
const url=required('STAGING_SUPABASE_URL');
const publicKey=required('STAGING_SUPABASE_ANON_KEY');
const orgId=required('STAGING_ORG_ID');
if(required('STAGING_RELEASE_ACK')!=='disposable-auth-fixtures')
  throw new Error('Refusing real-auth tests without explicit disposable fixture acknowledgement.');
const parsed=new URL(url);
if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')||
  parsed.hostname==='pvchgibllozuwickhfqz.supabase.co')
  throw new Error('Refusing non-Supabase or production SalesShop endpoint.');

const fixture={
  privateQuoteA:required('STAGING_PRIVATE_QUOTE_A'),
  privateQuoteB:required('STAGING_PRIVATE_QUOTE_B'),
  sharedQuoteA:required('STAGING_SHARED_QUOTE_A'),
  privateCompanyA:required('STAGING_PRIVATE_COMPANY_A'),
  privateContactA:required('STAGING_PRIVATE_CONTACT_A'),
  privateProjectA:required('STAGING_PRIVATE_PROJECT_A'),
  privateActivityA:required('STAGING_PRIVATE_ACTIVITY_A'),
  signedSignatureId:required('STAGING_SIGNED_SIGNATURE_ID'),
};
const roles=['owner','admin','salesperson_a','salesperson_b','viewer','outsider'];
const assert=(check,message)=>{if(!check)throw new Error(message);};
const clients={};
const sessions={};
for(const role of roles){
  const upper=role.toUpperCase();
  const email=required(`STAGING_${upper}_EMAIL`);
  const password=required(`STAGING_${upper}_PASSWORD`);
  const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await client.auth.signInWithPassword({email,password});
  assert(!error&&data.user&&data.session,`Failed to authenticate staging ${role} fixture`);
  clients[role]=client;
  sessions[role]=data.session;
}
// All fixture IDs are TEST ONLY. Never display names, snapshots, or emails.
async function rowVisible(role,table,id){
  const {data,error}=await clients[role].from(table).select('id').eq('organization_id',orgId).eq('id',id).maybeSingle();
  if(error)throw new Error(`Unexpected ${role}/${table} query error: ${error.code ?? 'unknown'}`);
  return Boolean(data);
}
async function canQuote(role,id,action){
  const {data,error}=await clients[role].rpc('can_access_quote',{
    p_organization_id:orgId,p_quote_id:id,p_action:action,
  });
  if(error)throw new Error(`Quote RPC denied unexpectedly for ${role}: ${error.code ?? 'unknown'}`);
  return data===true;
}
const expectVisibility=async(role,table,id,expected)=>{
  const got=await rowVisible(role,table,id);
  assert(got===expected,`${role} ${table} private visibility mismatch (expected ${expected})`);
};

await expectVisibility('salesperson_a','quotes',fixture.privateQuoteA,true);
await expectVisibility('salesperson_a','quotes',fixture.privateQuoteB,false);
await expectVisibility('salesperson_b','quotes',fixture.privateQuoteA,false);
await expectVisibility('salesperson_b','quotes',fixture.privateQuoteB,true);
await expectVisibility('owner','quotes',fixture.privateQuoteA,false);
await expectVisibility('admin','quotes',fixture.privateQuoteB,false);
await expectVisibility('viewer','quotes',fixture.privateQuoteA,false);
await expectVisibility('outsider','quotes',fixture.privateQuoteA,false);

assert(await canQuote('salesperson_a',fixture.privateQuoteA,'edit'),'A cannot edit own quote');
assert(!(await canQuote('salesperson_b',fixture.privateQuoteA,'read')),'B sees A private quote');
assert(await canQuote('salesperson_b',fixture.sharedQuoteA,'read'),'B cannot read explicitly shared quote');
assert(!(await canQuote('salesperson_b',fixture.sharedQuoteA,'edit')),'Read grant wrongly enables edit');
assert(!(await canQuote('admin',fixture.privateQuoteA,'read')),'Admin can bypass private quote authorization');

for(const [table,id] of [
  ['companies',fixture.privateCompanyA],['contacts',fixture.privateContactA],
  ['projects',fixture.privateProjectA],['activities',fixture.privateActivityA],
]){
  await expectVisibility('salesperson_a',table,id,true);
  for(const role of ['salesperson_b','owner','admin','viewer','outsider'])
    await expectVisibility(role,table,id,false);
}

async function outcomesResponse(role){
  const response=await fetch(`${url}/functions/v1/shop-outcomes`,{
    method:'POST',
    headers:{apikey:publicKey,Authorization:`Bearer ${sessions[role].access_token}`,
      'Content-Type':'application/json'},
    body:JSON.stringify({organizationId:orgId}),
  });
  const body=await response.json().catch(()=>null);
  return {status:response.status,body};
}
const whitelist=new Set(['kind','signatureId','quoteId','quoteNumber','revision',
  'documentType','title','projectId','companyName','acceptedAt','acceptedTotal']);
for(const role of ['owner','admin']){
  const {status,body}=await outcomesResponse(role);
  assert(status===200&&Array.isArray(body?.outcomes),`${role} signed outcomes endpoint unavailable`);
  assert(body.outcomes.some(row=>row.signatureId===fixture.signedSignatureId),
    `${role} missing seeded signed test commitment`);
  for(const row of body.outcomes){
    assert(row.kind==='signed-customer-commitment',`${role} received unsigned outcome`);
    assert(Object.keys(row).every(k=>whitelist.has(k)),`${role} received private outcome fields`);
    assert(Number.isFinite(row.acceptedTotal),`${role} received invalid outcome total`);
  }
}
for(const role of ['salesperson_a','salesperson_b','viewer','outsider']){
  const {status}=await outcomesResponse(role);
  assert(status===403,`${role} unexpectedly reached company signed outcomes`);
}

// Batch 17G: a preseeded, private Deal role must be visible only to its
// quote-owning salesperson. This staging check stays READ-ONLY and does not
// mutate customer, quote or role data.
async function privateDealRoles(role){
  const {data,error}=await clients[role].from('deal_contact_roles')
    .select('contact_id,owner_user_id,role')
    .eq('organization_id',orgId)
    .eq('deal_id',fixture.privateProjectA);
  if(error)throw new Error(`Deal role RLS query failed for ${role}: ${error.code ?? 'unknown'}`);
  return data??[];
}
const privateRolesForA=await privateDealRoles('salesperson_a');
assert(privateRolesForA.length===1 &&
  privateRolesForA[0].contact_id===fixture.privateContactA &&
  privateRolesForA[0].owner_user_id===sessions.salesperson_a.user.id &&
  privateRolesForA[0].role==='Estimator',
  'Salesperson A cannot read exactly their one preseeded private Estimator role');
for(const role of ['salesperson_b','owner','admin','viewer','outsider']){
  const records=await privateDealRoles(role);
  assert(records.length===0,`${role} can read salesperson A private Deal roles`);
}

for(const client of Object.values(clients))await client.auth.signOut();
console.log('PASS: staging JWT role matrix — quotes, CRM, grants, Deal roles and signed-only Shop Outcomes.');
