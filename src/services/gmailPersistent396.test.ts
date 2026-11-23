import {describe,it,expect,vi,afterEach} from 'vitest';
import worker from '../../worker/index';
import {sealRefresh396,unsealRefresh396} from '../../worker/gmailPersistent396';

const origin='https://app.salesshop.work';
const orgA='00000000-0000-4000-a000-000000000001';
const orgB='00000000-0000-4000-a000-000000000002';
const userA='00000000-0000-4000-a000-000000000003';
const userB='00000000-0000-4000-a000-000000000004';
const id='test-client.apps.googleusercontent.com';
const jwt='Bearer '+('a'.repeat(64));
const jwtB='Bearer '+('b'.repeat(64));
const env={
 ASSETS:{fetch:async()=>new Response('SPA')},
 GOOGLE_GMAIL_CLIENT_ID:id,GOOGLE_GMAIL_CLIENT_SECRET:'fake-test-secret',
 GMAIL_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,11).toString('base64'),
 SUPABASE_URL:'https://tests.supabase.co',
 SUPABASE_PUBLISHABLE_KEY:'test-publishable',
 SUPABASE_SERVICE_ROLE_KEY:'test-service-role-secret',
};
const connections=new Map<string,Record<string,unknown>>();
const key=(org:string,user:string)=>org+'|'+user;
let revoked:string[]=[];
let refreshed=0;
let grantInvalid=false;
let grantScope:string|undefined='https://www.googleapis.com/auth/gmail.readonly';
const fetchMock=vi.fn(async (resource:string,init?:RequestInit)=>{
 const url=new URL(resource);
 if(url.pathname==='/auth/v1/user')
  return Response.json({id:init?.headers instanceof Headers?
   (init.headers.get('Authorization')===jwtB?userB:userA):
   ((init?.headers as Record<string,string>)?.Authorization===jwtB?userB:userA)});
 if(url.pathname==='/rest/v1/organization_members'){
  const org=url.searchParams.get('organization_id');
  const user=(url.searchParams.get('user_id')??'').replace(/^eq\./,'');
  return Response.json(org==='eq.'+orgA&&[userA,userB].includes(user)?
   [{user_id:user}]:[]);
 }
 if(url.pathname==='/rest/v1/gmail_oauth_connections396'){
  const mailbox=url.searchParams.get('mailbox');
  if(mailbox){
   const found=[...connections.values()].filter(row=>row.mailbox===mailbox.replace(/^eq\./,''));
   return Response.json(found.slice(0,1).map(row=>({organization_id:row.organization_id})));
  }
  const org=(url.searchParams.get('organization_id')??'').replace(/^eq\./,'');
  const user=(url.searchParams.get('user_id')??'').replace(/^eq\./,'');
  if(init?.method==='POST'){
   const data=JSON.parse(String(init.body)) as Record<string,unknown>;
   connections.set(key(String(data.organization_id),String(data.user_id)),data);
   return new Response(null,{status:201});
  }
  if(init?.method==='PATCH'){
   const prev=connections.get(key(org,user));
   if(prev)connections.set(key(org,user),{...prev,...JSON.parse(String(init.body))});
   return new Response(null,{status:204});
  }
  if(init?.method==='DELETE'){
   connections.delete(key(org,user));
   return new Response(null,{status:204});
  }
  return Response.json(connections.get(key(org,user))?[connections.get(key(org,user))]:[]);
 }
 if(url.pathname==='/token'){
  const body=init?.body as URLSearchParams;
  if(body.get('grant_type')==='authorization_code')
   return Response.json({access_token:'temporary-access-token',refresh_token:'secret-refresh-token-123',
    expires_in:3600,token_type:'Bearer',...(grantScope?{scope:grantScope}:{})});
  refreshed++;
  if(grantInvalid)return Response.json({error:'invalid_grant'},{status:400});
  expect(body.get('refresh_token')).toBe('secret-refresh-token-123');
  return Response.json({access_token:'renewed-access-token',expires_in:3600,token_type:'Bearer'});
 }
 if(url.pathname==='/gmail/v1/users/me/profile')
  return Response.json({emailAddress:'Client@builder.example'});
 if(url.pathname==='/revoke'){
  revoked.push(String((init?.body as URLSearchParams).get('token')));
  return new Response(null,{status:200});
 }
 throw new Error('Unexpected network destination: '+url.pathname);
});
const request=(action:string,org=orgA,method?:string,extra:Record<string,unknown>={},
 headerOverrides:Record<string,string>={})=>new Request(origin+
 '/api/gmail/persistent/'+action+(action==='status'?'?organization_id='+org:''),{
 method:method??(action==='status'?'GET':'POST'),
 headers:{Authorization:jwt,Origin:origin,'X-Requested-With':'XMLHttpRequest',
  'Content-Type':'application/json',...headerOverrides},
 ...(action==='status'?{}:{body:JSON.stringify({organization_id:org,
  ...(action==='connect'?{code:'4/0ABCDEF123456789'}:{}),...extra})}),
});
afterEach(()=>{vi.unstubAllGlobals();connections.clear();revoked=[];refreshed=0;
 grantInvalid=false;grantScope='https://www.googleapis.com/auth/gmail.readonly';
 fetchMock.mockClear();});
describe('#396 — persistent Gmail Worker authorization',()=>{
 it('requires complete server configuration, keeps temporary OAuth endpoints intact',async()=>{
  const unconfigured=await worker.fetch(request('status'),{...env,GMAIL_TOKEN_ENCRYPTION_KEY:undefined});
  expect(unconfigured.status).toBe(503);
  expect(await unconfigured.json()).toEqual({configured:false,connected:false});
  const legacy=await worker.fetch(new Request(origin+'/api/gmail/oauth/status'),env);
  expect(await legacy.json()).toEqual({configured:true});
 });
 it('blocks unauthorized and unrelated organizations before touching token endpoints',async()=>{
  vi.stubGlobal('fetch',fetchMock);
  expect((await worker.fetch(request('status',orgB),env)).status).toBe(403);
  expect((await worker.fetch(request('refresh',orgA,'POST',{},{
   Authorization:''}),env)).status).toBe(401);
  expect((await worker.fetch(request('connect',orgA,'POST',{},{
   Origin:'https://evil.example'}),env)).status).toBe(403);
  expect((await worker.fetch(request('connect',orgA,'POST',{},{
   'X-Requested-With':''}),env)).status).toBe(403);
  expect(fetchMock.mock.calls.every(call=>!String(call[0]).includes('oauth2.googleapis.com'))).toBe(true);
 });
 it('exchanges code, encrypts refresh token, restores and revokes a single-user connection',async()=>{
  vi.stubGlobal('fetch',fetchMock);
  const connect=await worker.fetch(request('connect'),env);
  expect(connect.status).toBe(200);
  const c=await connect.json() as Record<string,unknown>;
  expect(c).toMatchObject({connected:true,mailbox:'client@builder.example',
   access_token:'temporary-access-token',expires_in:3600});
  expect(JSON.stringify(c)).not.toContain('secret-refresh-token-123');
  const saved=connections.get(key(orgA,userA))!;
  expect(saved.mailbox).toBe('client@builder.example');
  expect(JSON.stringify(saved)).not.toContain('secret-refresh-token-123');
  expect(saved.refresh_ciphertext).not.toBe('secret-refresh-token-123');
  const status=await worker.fetch(request('status'),env);
  expect(await status.json()).toEqual({configured:true,connected:true,
   needsReconnect:false,mailbox:'client@builder.example'});
  const refreshedResponse=await worker.fetch(request('refresh'),env);
  expect(refreshedResponse.status).toBe(200);
  expect(await refreshedResponse.json()).toMatchObject({access_token:'renewed-access-token'});
  expect(refreshed).toBe(1);
  const disconnected=await worker.fetch(request('disconnect'),env);
  expect(disconnected.status).toBe(200);
  expect(connections.size).toBe(0);
  expect(revoked).toEqual(['secret-refresh-token-123']);
 });
 it('never exposes another team member\'s connected Gmail identity or ciphertext',async()=>{
  vi.stubGlobal('fetch',fetchMock);
  const connected=await worker.fetch(request('connect'),env);
  expect(connected.status).toBe(200);
  const second=await worker.fetch(request('status',orgA,'GET',{},{
   Authorization:jwtB}),env);
  expect(await second.json()).toEqual({configured:true,connected:false,
   needsReconnect:false,mailbox:null});
  const noAccess=await worker.fetch(request('refresh',orgA,'POST',{},{
   Authorization:jwtB}),env);
  expect(noAccess.status).toBe(404);
  expect(connections.has(key(orgA,userA))).toBe(true);
  expect(connections.has(key(orgA,userB))).toBe(false);
 });
 it('does not revoke a shared Google grant while another team member uses it',async()=>{
  vi.stubGlobal('fetch',fetchMock);
  expect((await worker.fetch(request('connect'),env)).status).toBe(200);
  expect((await worker.fetch(request('connect',orgA,'POST',{},{
   Authorization:jwtB}),env)).status).toBe(200);
  expect(connections.size).toBe(2);
  expect((await worker.fetch(request('disconnect'),env)).status).toBe(200);
  expect(connections.size).toBe(1);
  expect(revoked).toEqual([]);
  expect((await worker.fetch(request('refresh',orgA,'POST',{},{
   Authorization:jwtB}),env)).status).toBe(200);
  expect((await worker.fetch(request('disconnect',orgA,'POST',{},{
   Authorization:jwtB}),env)).status).toBe(200);
  expect(revoked).toEqual(['secret-refresh-token-123']);
 });
 it('rejects authorization code responses missing or lacking gmail.readonly',async()=>{
  vi.stubGlobal('fetch',fetchMock);
  for(const scope of [undefined,'openid email']){
   grantScope=scope;
   const response=await worker.fetch(request('connect'),env);
   expect(response.status).toBe(503);
   expect(JSON.stringify(await response.json())).not.toContain('temporary-access-token');
   expect(connections.size).toBe(0);
  }
 });
 it('binds ciphertext to organization/user via AES-GCM authenticated data',async()=>{
  const cipher=await sealRefresh396('secret-refresh-token-123',env,orgA,userA);
  const row={...cipher,organization_id:orgA,user_id:userA,key_version:1,
   mailbox:'client@builder.example',status:'active' as const,
   granted_scope:'https://www.googleapis.com/auth/gmail.readonly'};
  expect(await unsealRefresh396(row,env,orgA,userA)).toBe('secret-refresh-token-123');
  await expect(unsealRefresh396({...row,organization_id:orgB},env,orgB,userA)).rejects.toThrow();
  await expect(unsealRefresh396({...row,refresh_ciphertext:cipher.refresh_ciphertext.slice(0,-4)+'AAAA'},
   env,orgA,userA)).rejects.toThrow();
 });
 it('marks revoked Google access as requiring deliberate reconnection',async()=>{
  vi.stubGlobal('fetch',fetchMock);
  await worker.fetch(request('connect'),env);
  grantInvalid=true;
  const result=await worker.fetch(request('refresh'),env);
  expect(result.status).toBe(409);
  expect((connections.get(key(orgA,userA))??{}).status).toBe('reauthorize');
  const status=await (await worker.fetch(request('status'),env)).json();
  expect(status).toMatchObject({connected:false,needsReconnect:true});
 });
});
