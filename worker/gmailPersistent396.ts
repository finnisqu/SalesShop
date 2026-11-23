/** #396 — Persistent per-user Gmail OAuth, Worker-only refresh credentials.
 * NEVER log request bodies, authorization headers, decrypted refresh values,
 * Google profile contents or PostgREST responses.
 */
export interface GmailPersistentEnv396 {
 GOOGLE_GMAIL_CLIENT_ID?:string;
 GOOGLE_GMAIL_CLIENT_SECRET?:string;
 GMAIL_TOKEN_ENCRYPTION_KEY?:string; // base64-encoded 32 random bytes (Cloudflare secret)
 SUPABASE_URL?:string;
 SUPABASE_PUBLISHABLE_KEY?:string;
 SUPABASE_SERVICE_ROLE_KEY?:string; // server secret, never VITE_ or browser
}
const OAUTH_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const ORG_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE=/^[a-zA-Z0-9\/._~+-]{10,2048}$/;
const jsonHeaders={'Cache-Control':'no-store, max-age=0','Pragma':'no-cache',
 'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(data:object,status=200)=>Response.json(data,{status,headers:jsonHeaders});
const error=(msg:string,status=400)=>json({error:msg},status);
interface StoredConnection {
 organization_id:string;user_id:string;mailbox:string;refresh_ciphertext:string;
 refresh_nonce:string;key_version:number;status:'active'|'reauthorize';granted_scope:string;
}
function bytesToBase64(bytes:Uint8Array):string{
 let text='';for(const byte of bytes)text+=String.fromCharCode(byte);
 return btoa(text);
}
function base64ToBytes(value:string):Uint8Array{
 return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
}
function apiBase(env:GmailPersistentEnv396):string{
 const url=new URL(env.SUPABASE_URL??'');
 if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||
  url.username||url.password||url.port||url.pathname!=='/'||
  url.search||url.hash)throw new Error('Invalid Supabase configuration');
 return url.origin;
}
function isConfigured(env:GmailPersistentEnv396):boolean{
 try{
  return !!(env.GOOGLE_GMAIL_CLIENT_ID?.endsWith('.apps.googleusercontent.com')&&
   env.GOOGLE_GMAIL_CLIENT_SECRET&&env.SUPABASE_SERVICE_ROLE_KEY&&
   env.SUPABASE_PUBLISHABLE_KEY&&base64ToBytes(env.GMAIL_TOKEN_ENCRYPTION_KEY??'').length===32&&
   apiBase(env));
 }catch{return false;}
}
async function keyFor(env:GmailPersistentEnv396):Promise<CryptoKey>{
 const key=base64ToBytes(env.GMAIL_TOKEN_ENCRYPTION_KEY??'');
 if(key.length!==32)throw new Error('Encryption is not configured');
 return crypto.subtle.importKey('raw',key,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
function additionalData(org:string,user:string):Uint8Array{
 return new TextEncoder().encode('salesshop:gmail:396:v1:'+org+':'+user);
}
export async function sealRefresh396(refresh:string,env:GmailPersistentEnv396,
 org:string,user:string):Promise<{refresh_ciphertext:string;refresh_nonce:string}>{
 if(refresh.length<12||refresh.length>4096)throw new Error('Invalid refresh token');
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const result=await crypto.subtle.encrypt({name:'AES-GCM',iv,
  additionalData:additionalData(org,user)},await keyFor(env),new TextEncoder().encode(refresh));
 return {refresh_ciphertext:bytesToBase64(new Uint8Array(result)),
  refresh_nonce:bytesToBase64(iv)};
}
export async function unsealRefresh396(row:StoredConnection,env:GmailPersistentEnv396,
 org:string,user:string):Promise<string>{
 if(row.key_version!==1||row.organization_id!==org||row.user_id!==user)
  throw new Error('Credential mismatch');
 const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',
  iv:base64ToBytes(row.refresh_nonce),additionalData:additionalData(org,user)},
 await keyFor(env),base64ToBytes(row.refresh_ciphertext));
 return new TextDecoder().decode(decrypted);
}
function serviceHeaders(env:GmailPersistentEnv396):Record<string,string>{
 // Modern sb_secret_ keys must be sent in apikey, never as Bearer tokens:
 // the gateway translates them to the service JWT for PostgREST.
 return {'apikey':env.SUPABASE_SERVICE_ROLE_KEY!,
  'Content-Type':'application/json'};
}
async function serviceFetch(env:GmailPersistentEnv396,path:string,init:RequestInit={}):Promise<Response>{
 return fetch(apiBase(env)+'/rest/v1/'+path,{...init,
  headers:{...serviceHeaders(env),...(init.headers as Record<string,string>??{})},
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
}
function rowPath(org:string,user:string):string{
 return 'gmail_oauth_connections396?organization_id=eq.'+org+'&user_id=eq.'+user;
}
async function readConnection(env:GmailPersistentEnv396,org:string,user:string):
 Promise<StoredConnection|null>{
 const response=await serviceFetch(env,rowPath(org,user)+'&select=*'+'&limit=1');
 if(!response.ok)throw new Error('Storage temporarily unavailable');
 const rows=await response.json() as StoredConnection[];
 return rows[0]??null;
}
async function writeConnection(env:GmailPersistentEnv396,row:StoredConnection):Promise<void>{
 const response=await serviceFetch(env,'gmail_oauth_connections396?on_conflict=organization_id,user_id',{
  method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
  body:JSON.stringify({...row,updated_at:new Date().toISOString(),
   last_verified_at:new Date().toISOString()})});
 if(!response.ok)throw new Error('Could not save Gmail authorization');
}
/** A compare-and-swap PATCH: require the nonce of the credential used to
 * start this refresh, so an old request cannot overwrite a replacement or
 * restore an already-disconnected grant. Returning one row confirms exactly
 * one saved connection was updated; no ciphertext leaves the Worker.
 */
async function updateConnection(env:GmailPersistentEnv396,org:string,user:string,
 expectedNonce:string,patch:Record<string,unknown>):Promise<boolean>{
 const path=rowPath(org,user)+'&refresh_nonce=eq.'+encodeURIComponent(expectedNonce);
 const response=await serviceFetch(env,path,{method:'PATCH',
  headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
 if(!response.ok)throw new Error('Could not update Gmail authorization');
 const rows=await response.json() as StoredConnection[];
 return rows.length===1;
}
async function removeConnection(env:GmailPersistentEnv396,org:string,user:string):Promise<void>{
 const response=await serviceFetch(env,rowPath(org,user),{method:'DELETE'});
 if(!response.ok)throw new Error('Could not disconnect Gmail');
}
/** Google may revoke an entire grant for a Gmail user+OAuth client. Only call
 * its revocation endpoint if no other saved SalesShop connection references
 * the same mailbox. On lookup errors, preserve other users' grants and still
 * delete this personal SalesShop credential.
 */
async function noOtherMailboxConnections(env:GmailPersistentEnv396,mailbox:string):Promise<boolean>{
 try{
  const response=await serviceFetch(env,'gmail_oauth_connections396?select=organization_id'+
   '&mailbox=eq.'+encodeURIComponent(mailbox)+'&limit=1');
  if(!response.ok)return false;
  const rows=await response.json() as {organization_id:string}[];
  return rows.length===0;
 }catch{return false;}
}
async function identifyUser(env:GmailPersistentEnv396,authHeader:string|null):Promise<string|null>{
 if(!authHeader||!/^Bearer [A-Za-z0-9._~+\/-]{30,8192}$/.test(authHeader))return null;
 const response=await fetch(apiBase(env)+'/auth/v1/user',{
  headers:{Authorization:authHeader,apikey:env.SUPABASE_PUBLISHABLE_KEY!},
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)return null;
 const user=await response.json() as {id?:string};
 return typeof user.id==='string'&&ORG_ID.test(user.id)?user.id:null;
}
async function belongsToOrg(env:GmailPersistentEnv396,org:string,user:string):Promise<boolean>{
 const response=await serviceFetch(env,'organization_members?select=user_id'+
  '&organization_id=eq.'+org+'&user_id=eq.'+user+'&limit=1');
 if(!response.ok)throw new Error('Membership temporarily unavailable');
 const members=await response.json() as {user_id:string}[];
 return members.some(row=>row.user_id===user);
}
async function googleToken(env:GmailPersistentEnv396,form:URLSearchParams):
 Promise<{access_token:string;expires_in:number;refresh_token?:string;scope:string}>{
 const response=await fetch('https://oauth2.googleapis.com/token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:form,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 const payload=await response.json() as {
  access_token?:string;refresh_token?:string;expires_in?:number;
  token_type?:string;scope?:string;error?:string;
 };
 if(!response.ok||!payload.access_token||payload.token_type?.toLowerCase()!=='bearer')
  throw new Error(payload.error==='invalid_grant'?'invalid_grant':'Google authorization failed');
 if(form.get('grant_type')==='authorization_code'&&
  !payload.scope?.split(/\s+/).includes(OAUTH_SCOPE))
  throw new Error('Insufficient Google scope');
 if(form.get('grant_type')==='refresh_token'&&payload.scope&&
  !payload.scope.split(/\s+/).includes(OAUTH_SCOPE))
  throw new Error('Insufficient Google scope');
 if(!Number.isFinite(payload.expires_in)||Number(payload.expires_in)<60)
  throw new Error('Invalid Google token expiry');
 return {access_token:payload.access_token,expires_in:Number(payload.expires_in),
  refresh_token:payload.refresh_token,scope:payload.scope??OAUTH_SCOPE};
}
async function googleMailbox(token:string):Promise<string>{
 const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{
  headers:{Authorization:'Bearer '+token},
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Could not verify Gmail mailbox');
 const data=await response.json() as {emailAddress?:string};
 const mailbox=data.emailAddress?.toLowerCase().trim();
 if(!mailbox||mailbox.length>254||!/^[^ @]+@[^ @]+\.[^ @]+$/.test(mailbox))
  throw new Error('Gmail mailbox is invalid');
 return mailbox;
}
async function revokeGoogle(refresh:string):Promise<void>{
 try{await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({token:refresh}),redirect:'error',
  signal:AbortSignal.timeout(8000)});}catch{/* Disconnection is local-first. */}
}
async function requestJson(request:Request):Promise<Record<string,unknown>>{
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
  throw new Error('Expected JSON request');
 if(Number(request.headers.get('Content-Length')||0)>4096)throw new Error('Request too large');
 const body=await request.text();
 if(body.length>4096)throw new Error('Request too large');
 const parsed=JSON.parse(body) as unknown;
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
  throw new Error('Invalid request');
 return parsed as Record<string,unknown>;
}
export async function handleGmailPersistent396(request:Request,env:GmailPersistentEnv396,
 origin:string):Promise<Response>{
 const url=new URL(request.url);
 const action=url.pathname.slice('/api/gmail/persistent/'.length);
 if(url.origin!==origin)return error('Unavailable for this origin',403);
 if(!['status','connect','refresh','disconnect'].includes(action))
  return error('Unknown action',404);
 if(request.method!==(action==='status'?'GET':'POST'))return error('Method not allowed',405);
 // Rollout gate. Never expose connected state or attempt refresh before all
 // backend secrets and table policy are configured.
 if(!isConfigured(env))return json({configured:false,connected:false},503);
 if(action!=='status'&&(request.headers.get('Origin')!==origin||
    request.headers.get('X-Requested-With')!=='XMLHttpRequest'))
  return error('Invalid request origin',403);
 let input:Record<string,unknown>;
 try{input=action==='status'?{organization_id:url.searchParams.get('organization_id')}:
   await requestJson(request);}catch{return error('Invalid request');}
 const org=input.organization_id;
 if(typeof org!=='string'||!ORG_ID.test(org))return error('Invalid organization');
 try{
  // Never trust organization/user submitted from browser; user ID comes only
  // from an Auth-server verification of the current Supabase access token.
  const user=await identifyUser(env,request.headers.get('Authorization'));
  if(!user)return error('Sign in to SalesShop again',401);
  if(!await belongsToOrg(env,org,user))return error('No workspace access',403);
  const prior=await readConnection(env,org,user);
  if(action==='status')return json({configured:true,connected:prior?.status==='active',
   needsReconnect:prior?.status==='reauthorize',mailbox:prior?.mailbox??null});
  if(action==='disconnect'){
   await removeConnection(env,org,user);
   if(prior&&await noOtherMailboxConnections(env,prior.mailbox)){
    try{
     const refresh=await unsealRefresh396(prior,env,org,user);
     await revokeGoogle(refresh);
    }catch{/* Deleted locally; leave other account authorizations untouched. */}
   }
   return json({disconnected:true});
  }
  if(action==='connect'){
   if(typeof input.code!=='string'||!CODE.test(input.code))return error('Invalid OAuth code');
   const form=new URLSearchParams({client_id:env.GOOGLE_GMAIL_CLIENT_ID!,
    client_secret:env.GOOGLE_GMAIL_CLIENT_SECRET!,code:input.code,
    redirect_uri:origin,grant_type:'authorization_code'});
   const tokens=await googleToken(env,form);
   const mailbox=await googleMailbox(tokens.access_token);
   const refresh=tokens.refresh_token??(prior?.mailbox===mailbox&&prior.status==='active'?
     await unsealRefresh396(prior,env,org,user):undefined);
   if(!refresh)return error('Google did not grant offline access. Reauthorize with consent.',409);
   const encrypted=await sealRefresh396(refresh,env,org,user);
   await writeConnection(env,{organization_id:org,user_id:user,mailbox,
    ...encrypted,key_version:1,status:'active',granted_scope:OAUTH_SCOPE});
   return json({connected:true,mailbox,access_token:tokens.access_token,
    expires_in:tokens.expires_in});
  }
  if(!prior)return error('No saved Gmail connection',404);
  if(prior.status!=='active')return error('Reconnect Gmail to restore access',409);
  let tokens;
  try{
   const refresh=await unsealRefresh396(prior,env,org,user);
   const form=new URLSearchParams({client_id:env.GOOGLE_GMAIL_CLIENT_ID!,
    client_secret:env.GOOGLE_GMAIL_CLIENT_SECRET!,
    refresh_token:refresh,grant_type:'refresh_token'});
   tokens=await googleToken(env,form);
  }catch(e){
   if(e instanceof Error&&e.message==='invalid_grant'){
    if(!await updateConnection(env,org,user,prior.refresh_nonce,{
     status:'reauthorize',updated_at:new Date().toISOString()}))
     return error('Saved Gmail connection changed. Retry.',409);
    return error('Google authorization expired. Reconnect Gmail.',409);
   }
   throw e;
  }
  if(tokens.refresh_token){
   const updated=await sealRefresh396(tokens.refresh_token,env,org,user);
   if(!await updateConnection(env,org,user,prior.refresh_nonce,{
    ...updated,updated_at:new Date().toISOString(),
    last_verified_at:new Date().toISOString()}))
    return error('Saved Gmail connection changed. Retry.',409);
  }else{
   if(!await updateConnection(env,org,user,prior.refresh_nonce,{
    last_verified_at:new Date().toISOString()}))
    return error('Saved Gmail connection changed. Retry.',409);
  }
  return json({connected:true,mailbox:prior.mailbox,access_token:tokens.access_token,
   expires_in:tokens.expires_in});
 }catch{
  // Deliberately do not include Google/DB provider responses or ciphertext.
  return error('Gmail connection service unavailable. Retry later.',503);
 }
}
