/** #389 — Full-page Gmail OAuth authorization-code + PKCE flow.
 * Only a short-lived verifier, CSRF nonce and SalesShop identity stay in sessionStorage.
 * Google codes are removed from the URL before network activity; tokens stay in memory.
 */
import {GMAIL_READONLY_SCOPE,gmailClientId,type GmailAccess} from './gmailRead359a';

const PENDING_KEY='salesshop-gmail-redirect-389';
const CALLBACK_PATH='/gmail/callback';
const MAX_AGE_MS=10*60*1000;
type Pending={state:string;verifier:string;scope:string;startedAt:number;redirectUri:string};
export type GmailRedirectResult=
 |{kind:'code';code:string;verifier:string;redirectUri:string}
 |{kind:'error';message:string};

function base64url(bytes:Uint8Array):string{
 let raw='';
 for(const byte of bytes)raw+=String.fromCharCode(byte);
 return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function nonce(length:number):string{
 const bytes=new Uint8Array(length);
 crypto.getRandomValues(bytes);
 return base64url(bytes);
}
function callbackUri():string{
 return new URL(CALLBACK_PATH,window.location.origin).toString();
}
export function isGmailRedirectCallback():boolean{
 return typeof window!=='undefined'&&window.location.pathname===CALLBACK_PATH;
}
/** Do not navigate until server readiness has been confirmed. */
export async function beginGmailRedirect(scope:string):Promise<string>{
 if(!scope||!gmailClientId)throw new Error('Sign in to SalesShop and configure the Gmail client ID.');
 if(!window.isSecureContext)throw new Error('Gmail redirect requires HTTPS.');
 const status=await fetch('/api/gmail/oauth/status',{credentials:'same-origin',cache:'no-store'});
 if(!status.ok)throw new Error('The Gmail redirect service is unavailable. Check the Cloudflare deployment.');
 const ready=await status.json() as {configured?:boolean};
 if(!ready.configured)throw new Error('Gmail redirect is not enabled on the Cloudflare Worker. Configure the server-side Google OAuth client ID and secret, then redeploy.');
 const verifier=nonce(48),state=nonce(32),redirectUri=callbackUri();
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
 const challenge=base64url(new Uint8Array(hash));
 const pending:Pending={state,verifier,scope,startedAt:Date.now(),redirectUri};
 sessionStorage.setItem(PENDING_KEY,JSON.stringify(pending));
 const params=new URLSearchParams({
  client_id:gmailClientId,redirect_uri:redirectUri,response_type:'code',
  scope:GMAIL_READONLY_SCOPE,state,code_challenge:challenge,code_challenge_method:'S256',
  access_type:'online',include_granted_scopes:'false',prompt:'consent',
 });
 return 'https://accounts.google.com/o/oauth2/v2/auth?'+params;
}
/** Called after SalesShop authentication and scope hydration, once per callback. */
export function consumeGmailRedirect(scope:string):GmailRedirectResult|null{
 if(!isGmailRedirectCallback())return null;
 const url=new URL(window.location.href);
 // Remove the code/error and state from address bar and browser history immediately.
 window.history.replaceState(window.history.state,'','/tools');
 const raw=sessionStorage.getItem(PENDING_KEY);
 sessionStorage.removeItem(PENDING_KEY);
 if(!raw)return {kind:'error',message:'Gmail redirect session was missing or already used. Start a new connection.'};
 let pending:Pending;
 try{pending=JSON.parse(raw) as Pending;}catch{
  return {kind:'error',message:'Invalid Gmail redirect session. Please connect again.'};
 }
 if(!pending||pending.scope!==scope||!pending.state||
  Date.now()-pending.startedAt>MAX_AGE_MS||pending.startedAt>Date.now()+30_000||
  pending.redirectUri!==callbackUri()){
  return {kind:'error',message:'Gmail redirect expired or the SalesShop account changed. Please connect again.'};
 }
 if(url.searchParams.get('state')!==pending.state)
  return {kind:'error',message:'Gmail redirect state did not match. Please connect again.'};
 const denied=url.searchParams.get('error');
 if(denied)return {kind:'error',message:denied==='access_denied'
  ?'Google Gmail permission was declined.':'Google returned an authorization error. Please retry.'};
 const code=url.searchParams.get('code');
 if(!code||!/^[A-Za-z0-9_./~-]{10,2048}$/.test(code))
  return {kind:'error',message:'Google did not provide a usable authorization code.'};
 return {kind:'code',code,verifier:pending.verifier,redirectUri:pending.redirectUri};
}
export async function exchangeGmailRedirect(code:string,verifier:string,
 redirectUri:string):Promise<GmailAccess>{
 const response=await fetch('/api/gmail/oauth/exchange',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({code,code_verifier:verifier,redirect_uri:redirectUri}),
 });
 const payload=await response.json() as {
  access_token?:string;expires_in?:number;scope?:string;error?:string;
 };
 if(!response.ok)throw new Error(payload.error||'Could not complete Gmail authorization.');
 if(!payload.access_token||!payload.scope?.split(/\s+/).includes(GMAIL_READONLY_SCOPE))
  throw new Error('Google did not grant Gmail read-only access.');
 return {token:payload.access_token,
  expiresAt:Date.now()+Math.max(60,Number(payload.expires_in)||3600)*1000-60_000};
}
