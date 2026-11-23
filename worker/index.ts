import {handleGmailPersistent396,type GmailPersistentEnv396} from './gmailPersistent396';
/** Cloudflare Workers static-assets entrypoint.
 * Only Gmail's one-time authorization code is exchanged here; no refresh token,
 * Gmail message, CRM data or Google client secret is stored in the browser.
 */
interface Env extends GmailPersistentEnv396{
 ASSETS:{fetch(request:Request):Promise<Response>};
 GMAIL_OAUTH_ORIGIN?:string;
}
const GMAIL_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const safeHeaders:Record<string,string>={
 'Cache-Control':'no-store, max-age=0',
 'Pragma':'no-cache',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
};
const json=(data:object,status=200)=>Response.json(data,{status,
 headers:{...safeHeaders,'Content-Type':'application/json; charset=utf-8'}});
const originFor=(env:Env)=>env.GMAIL_OAUTH_ORIGIN?.trim()||'https://app.salesshop.work';
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/gmail/persistent/'))
   return handleGmailPersistent396(request,env,originFor(env));
  if(url.pathname!=='/api/gmail/oauth/status'&&url.pathname!=='/api/gmail/oauth/exchange'){
   if(url.pathname.startsWith('/api/'))return json({error:'Not found.'},404);
   return env.ASSETS.fetch(request);
  }
  const origin=originFor(env);
  // Fail closed on preview domains and requests from foreign origins.
  if(url.origin!==origin)return json({error:'OAuth endpoint is not available for this origin.'},403);
  const configured=Boolean(env.GOOGLE_GMAIL_CLIENT_ID?.endsWith('.apps.googleusercontent.com')&&
   env.GOOGLE_GMAIL_CLIENT_SECRET);
  if(url.pathname==='/api/gmail/oauth/status'){
   if(request.method!=='GET')return json({error:'Method not allowed.'},405);
   return json({configured});
  }
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
   return json({error:'Expected JSON request.'},415);
  if(!configured)return json({error:'Gmail OAuth server credentials have not been configured.'},503);
  if(Number(request.headers.get('Content-Length')||0)>4096)return json({error:'Invalid OAuth request.'},413);
  let input:Record<string,unknown>;
  try{
   const raw=await request.text();
   if(raw.length>4096)return json({error:'Invalid OAuth request.'},413);
   input=JSON.parse(raw) as Record<string,unknown>;
  }catch{return json({error:'Invalid OAuth request.'},400);}
  const code=input.code,verifier=input.code_verifier,redirectUri=input.redirect_uri,
   clientId=input.client_id;
  const expectedRedirect=origin+'/gmail/callback';
  if(typeof code!=='string'||code.length<10||code.length>2048||
   typeof verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)||
   redirectUri!==expectedRedirect||clientId!==env.GOOGLE_GMAIL_CLIENT_ID)
   return json({error:'Invalid OAuth request or client configuration.'},400);
  const body=new URLSearchParams({
   client_id:env.GOOGLE_GMAIL_CLIENT_ID!,
   client_secret:env.GOOGLE_GMAIL_CLIENT_SECRET!,
   code,code_verifier:verifier,redirect_uri:expectedRedirect,grant_type:'authorization_code',
  });
  try{
   const result=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',body,headers:{'Content-Type':'application/x-www-form-urlencoded'},
    redirect:'error',signal:AbortSignal.timeout(12000),
   });
   const data=await result.json() as {
    access_token?:string;expires_in?:number;scope?:string;token_type?:string;
   };
   if(!result.ok||!data.access_token||data.token_type?.toLowerCase()!=='bearer')
    return json({error:'Google could not exchange the authorization code. Verify the OAuth client secret and exact redirect URI.'},502);
   if(!data.scope?.split(/\s+/).includes(GMAIL_SCOPE))
    return json({error:'Google did not grant the requested Gmail read-only permission.'},403);
   return json({access_token:data.access_token,expires_in:data.expires_in,scope:data.scope});
  }catch{return json({error:'Google authorization service could not be reached. Please retry.'},502);}
 },
};
