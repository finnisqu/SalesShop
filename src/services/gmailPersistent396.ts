/** #396 — Optional encrypted server-owned OAuth refresh.
 * Google's long-lived refresh token is NEVER visible to this client.
 * Only short-lived access tokens are returned, held by GmailSession in memory.
 */
import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';
import {emailWorkspaceScope} from './emailThreadLinks359a';
import {gmailClientId,GMAIL_READONLY_SCOPE,type GmailAccess} from './gmailRead359a';

export interface PersistentStatus396 {
 configured:boolean;connected:boolean;needsReconnect?:boolean;mailbox?:string|null;
}
interface SessionToken396 extends GmailAccess {mailbox:string}
function accountFor(scope:string){
 const a=useAuthStore.getState();
 if(a.mode!=='cloud'||!a.organizationId||!a.user?.id||
  emailWorkspaceScope(a.mode,a.organizationId,a.user.id)!==scope)
  throw new Error('The SalesShop account changed. Reopen Email to continue.');
 return {org:a.organizationId,user:a.user.id};
}
async function workerCall396(scope:string,action:'status'|'connect'|'refresh'|'disconnect',
 code?:string):Promise<Response>{
 if(!supabase)throw new Error('Sign in to SalesShop to connect Gmail.');
 const {org,user}=accountFor(scope);
 const {data,error}=await supabase.auth.getSession();
 if(error||!data.session||data.session.user.id!==user)
  throw new Error('Your SalesShop session expired. Sign in again.');
 accountFor(scope);
 const url='/api/gmail/persistent/'+action+
  (action==='status'?'?organization_id='+encodeURIComponent(org):'');
 const response=await fetch(url,{method:action==='status'?'GET':'POST',
  credentials:'same-origin',cache:'no-store',
  headers:{Authorization:'Bearer '+data.session.access_token,
   'X-Requested-With':'XMLHttpRequest',
   ...(action!=='status'?{'Content-Type':'application/json'}:{})},
  ...(action!=='status'?{body:JSON.stringify({
   organization_id:org,...(code?{code}:{})})}:{})});
 accountFor(scope);
 return response;
}
async function fromResponse396(response:Response):Promise<SessionToken396>{
 const raw=await response.json() as {
  error?:string;access_token?:string;mailbox?:string;expires_in?:number;
 };
 if(!response.ok||!raw.access_token||!raw.mailbox)
  throw new Error(raw.error||'Could not restore Gmail authorization.');
 const expires=Number(raw.expires_in);
 if(!Number.isFinite(expires)||expires<60)throw new Error('Invalid Gmail session expiry.');
 return {token:raw.access_token,mailbox:raw.mailbox,
  expiresAt:Date.now()+expires*1000-60_000};
}
export async function persistentStatus396(scope:string):Promise<PersistentStatus396>{
 const response=await workerCall396(scope,'status');
 const raw=await response.json() as PersistentStatus396&{error?:string};
 if(response.status===503&&raw.configured===false)
  return {configured:false,connected:false};
 if(!response.ok)throw new Error(raw.error||'Could not check Gmail connection.');
 return raw;
}
export async function refreshPersistent396(scope:string):Promise<SessionToken396>{
 return fromResponse396(await workerCall396(scope,'refresh'));
}
export async function exchangePersistent396(scope:string,code:string):Promise<SessionToken396>{
 if(!code||code.length>2048)throw new Error('Google did not provide an authorization code.');
 return fromResponse396(await workerCall396(scope,'connect',code));
}
export async function revokePersistent396(scope:string):Promise<void>{
 const response=await workerCall396(scope,'disconnect');
 if(!response.ok)throw new Error('Could not disconnect saved Gmail authorization.');
}
/** Init and trigger must occur in the same synchronous click stack. Do not
 * await network configuration checks before calling requestCode() or the popup
 * may be blocked by browser user-activation rules.
 */
export function requestPersistentCode396():Promise<string>{
 if(!gmailClientId) return Promise.reject(new Error('Google OAuth is not configured.'));
 type CodeClient={requestCode:()=>void};
 type OAuthCodeClient={initCodeClient:(config:{
  client_id:string;scope:string;ux_mode:'popup';select_account:boolean;
  include_granted_scopes:boolean;state:string;
  callback:(data:{code?:string;scope?:string;state?:string;error?:string})=>void;
  error_callback:(data:{type?:string})=>void;
 })=>CodeClient};
 const oauth=(window as Window&{google?:{accounts?:{oauth2?:OAuthCodeClient}}})
  .google?.accounts?.oauth2;
 if(!oauth)return Promise.reject(new Error('Google sign-in is still loading.'));
 return new Promise((resolve,reject)=>{
  let complete=false;
  let popupClosed=false;
  let grace:ReturnType<typeof setTimeout>|undefined;
  const nonce=new Uint8Array(24);
  crypto.getRandomValues(nonce);
  const expectedState=Array.from(nonce,b=>b.toString(16).padStart(2,'0')).join('');
  const cleanup=()=>{
   clearTimeout(timeout);clearTimeout(grace);
   window.removeEventListener('focus',checkPopupClosed);
  };
  const fail=(message:string)=>{
   if(complete)return;complete=true;cleanup();reject(new Error(message));
  };
  const checkPopupClosed=()=>{
   if(complete||!popupClosed||!document.hasFocus()||grace)return;
   grace=setTimeout(()=>{
    grace=undefined;
    if(!complete&&document.hasFocus())
     fail('Google popup closed without finishing authorization. Try again.');
   },4000);
  };
  const timeout=setTimeout(()=>fail('Google authorization took too long. Try again.'),90_000);
  window.addEventListener('focus',checkPopupClosed);
  try{
   const client=oauth.initCodeClient({
    client_id:gmailClientId,scope:GMAIL_READONLY_SCOPE,ux_mode:'popup',
    select_account:true,include_granted_scopes:false,state:expectedState,
    callback(data){
     if(data.error||!data.code){fail('Google did not grant Gmail access.');return;}
     if(data.state!==expectedState){fail('Google authorization state did not match. Retry.');return;}
     if(!data.scope?.split(/\s+/).includes(GMAIL_READONLY_SCOPE)){
      fail('Google did not grant Gmail read-only access.');return;
     }
     if(complete)return;
     complete=true;cleanup();resolve(data.code);
    },
    error_callback(data){
     if(data.type==='popup_failed_to_open')fail('Allow Google popups for SalesShop.');
     else if(data.type==='popup_closed'||data.type==='popup_closed_by_user'){
      popupClosed=true;checkPopupClosed();
     }else fail('Google authorization did not finish.');
    },
   });
   client.requestCode();
  }catch{fail('Google authorization popup could not start.');}
 });
}
