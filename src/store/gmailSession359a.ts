import {create} from 'zustand';
import {authorizeGmail,gmailProfile,gmailThreadPage,revokeGmailToken,
 type GmailThreadSummary,type GmailPage} from '../services/gmailRead359a';
import {beginGmailRedirect,consumeGmailRedirect,isGmailRedirectCallback,
 exchangeGmailRedirect} from '../services/gmailRedirect389';
import {persistentStatus396,requestPersistentCode396,exchangePersistent396,
 refreshPersistent396,revokePersistent396} from '../services/gmailPersistent396';
interface GmailState {
 scope:string|null;mailbox:string|null;token:string|null;expiresAt:number;
 status:'disconnected'|'connecting'|'connected';loading:boolean;error:string|null;
 query:string;threads:GmailThreadSummary[];nextPageToken?:string;
 persistentConfigured:boolean;persistent:boolean;restoring:boolean;needsReconnect:boolean;
 bindScope:(scope:string|null)=>void;
 restorePersistent:()=>Promise<void>;
 connectPersistent:()=>Promise<void>;
 renewPersistent:()=>Promise<void>;
 disconnectSaved:()=>Promise<void>;
 connect:()=>Promise<void>;
 connectWithRedirect:()=>Promise<void>;
 finishRedirect:()=>Promise<void>;
 disconnect:()=>void;
 search:(query:string,pageToken?:string)=>Promise<void>;
}
const reset=()=>({mailbox:null,token:null,expiresAt:0,status:'disconnected' as const,
 loading:false,error:null,query:'',threads:[] as GmailThreadSummary[],
 nextPageToken:undefined as string|undefined,
 persistentConfigured:false,persistent:false,restoring:false,needsReconnect:false});
// Increment even if a user leaves and later returns to the same workspace.
// Async OAuth requests from the previous identity generation then cannot
// reattach an old mailbox to the newly hydrated account.
let gmailIdentityEpoch396=0;
let gmailRenewal396:{scope:string;epoch:number;promise:Promise<void>}|null=null;
export const useGmailSessionStore=create<GmailState>((set,get)=>({
 scope:null,...reset(),
 bindScope(scope){
  if(get().scope===scope)return;
  ++gmailIdentityEpoch396;
  const {token,persistent}=get();
  set({scope,...reset()});
  // A stored, server-owned Gmail grant MUST NOT be revoked simply because
  // a SalesShop tab switched organization or the browser was reloaded.
  if(token&&!persistent)revokeGmailToken(token);
 },
 async restorePersistent(){
  const scope=get().scope,epoch=gmailIdentityEpoch396;
  if(!scope||get().restoring||get().status==='connecting'||get().token)return;
  set({restoring:true});
  try{
   const status=await persistentStatus396(scope);
   if(get().scope!==scope||gmailIdentityEpoch396!==epoch)return;
   if(!status.configured){
    set({persistentConfigured:false,restoring:false});return;
   }
   set({persistentConfigured:true,needsReconnect:!!status.needsReconnect});
   if(!status.connected){
    set({restoring:false});return;
   }
   const access=await refreshPersistent396(scope);
   if(get().scope!==scope||gmailIdentityEpoch396!==epoch||
    get().status==='connecting'||get().token)return;
   set({...reset(),persistentConfigured:true,persistent:true,status:'connected',
    mailbox:access.mailbox,token:access.token,expiresAt:access.expiresAt});
   await get().search('newer_than:90d');
  }catch(e){
   if(get().scope===scope&&gmailIdentityEpoch396===epoch&&!get().token){
    // Unknown Worker readiness is NOT proof persistence is configured.
    // Keep the known readiness flag rather than routing a working temporary
    // Gmail popup into an unavailable code-exchange service.
    set({restoring:false,
     needsReconnect:e instanceof Error&&/reconnect|expired|saved/i.test(e.message),
     error:e instanceof Error?e.message:'Could not restore saved Gmail.'});
   }
  }finally{
   if(get().scope===scope&&gmailIdentityEpoch396===epoch)set({restoring:false});
  }
 },
 async connectPersistent(){
  const scope=get().scope,epoch=gmailIdentityEpoch396;
  if(!scope||!get().persistentConfigured)
   throw new Error('Persistent Gmail is not configured for this workspace.');
  set({status:'connecting',error:null});
  try{
   // This must happen in the direct click stack, before the first await.
   const code=await requestPersistentCode396();
   if(get().scope!==scope||gmailIdentityEpoch396!==epoch)
    throw new Error('SalesShop account changed during Google authorization.');
   const access=await exchangePersistent396(scope,code);
   if(get().scope!==scope||gmailIdentityEpoch396!==epoch)return;
   set({...reset(),persistentConfigured:true,persistent:true,status:'connected',
    token:access.token,mailbox:access.mailbox,expiresAt:access.expiresAt});
   await get().search('newer_than:90d');
  }catch(e){
   if(get().scope===scope&&gmailIdentityEpoch396===epoch)
    set({...reset(),persistentConfigured:true,
     error:e instanceof Error?e.message:'Could not save Gmail authorization.'});
   throw e;
  }
 },
 async renewPersistent(){
  const {scope,persistent}=get(),epoch=gmailIdentityEpoch396;
  if(!scope||!persistent||get().status==='connecting')return;
  if(gmailRenewal396?.scope===scope&&gmailRenewal396.epoch===epoch)
   return gmailRenewal396.promise;
  if(get().expiresAt>Date.now()+4*60*1000)return;
  // Focus, expiry timer and Gmail search may all request a refresh in the
  // same tick. Coalesce them to avoid unnecessary Google refresh grants.
  const work=(async()=>{
   try{
    const access=await refreshPersistent396(scope);
    if(get().scope!==scope||gmailIdentityEpoch396!==epoch||!get().persistent)return;
    set({token:access.token,expiresAt:access.expiresAt,mailbox:access.mailbox,
     status:'connected',needsReconnect:false,error:null});
   }catch(e){
    if(get().scope!==scope||gmailIdentityEpoch396!==epoch||!get().persistent)return;
    const message=e instanceof Error?e.message:'Gmail renewal failed.';
    const reauthorize=/reconnect|authorization expired|no saved Gmail/i.test(message);
    if(reauthorize){
     set({...reset(),persistentConfigured:true,needsReconnect:true,error:message});
    }else{
     // A temporary Cloudflare/Google outage is not a revoked grant. Preserve
     // a still-valid access token and saved-grant mode so focus/search can retry.
     set({error:message});
    }
   }
  })();
  gmailRenewal396={scope,epoch,promise:work};
  try{await work;}finally{
   if(gmailRenewal396?.promise===work)gmailRenewal396=null;
  }
 },
 async disconnectSaved(){
  const {scope,persistent}=get();
  if(!scope){set(reset());return;}
  if(!persistent){get().disconnect();return;}
  // Explicit disconnect invalidates in-flight restores of this same identity.
  const epoch=++gmailIdentityEpoch396;
  try{
   await revokePersistent396(scope);
   if(get().scope===scope&&gmailIdentityEpoch396===epoch)
    set({...reset(),persistentConfigured:true});
  }catch(e){
   if(get().scope===scope&&gmailIdentityEpoch396===epoch)
    set({error:e instanceof Error?e.message:
     'Could not disconnect Gmail on the server.'});
   throw e;
  }
 },
 async connect(){
  const scope=get().scope,epoch=gmailIdentityEpoch396;
  if(!scope)throw new Error('Sign in to a SalesShop workspace before connecting Gmail.');
  set({status:'connecting',error:null});
  let access;
  try{
   access=await authorizeGmail();
   const mailbox=await gmailProfile(access.token);
   if(get().scope!==scope||gmailIdentityEpoch396!==epoch){
    revokeGmailToken(access.token);
    throw new Error('Your SalesShop workspace changed during Google authorization. Open Tools → Email and retry.');
   }
   set({...reset(),status:'connected',token:access.token,expiresAt:access.expiresAt,mailbox});
  }catch(error){
   if(access?.token)revokeGmailToken(access.token);
   if(get().scope===scope)set({...reset(),error:error instanceof Error?error.message:'Could not connect Gmail.'});
   throw error;
  }
 },
 async connectWithRedirect(){
  const scope=get().scope;
  if(!scope){set({error:'Sign in to a SalesShop workspace before connecting Gmail.'});return;}
  set({status:'connecting',error:null});
  try{
   const url=await beginGmailRedirect(scope);
   window.location.assign(url);
  }catch(error){
   if(get().scope===scope)set({...reset(),
    error:error instanceof Error?error.message:'Could not start Gmail redirect.'});
  }
 },
 async finishRedirect(){
  const scope=get().scope;
  if(!scope||!isGmailRedirectCallback())return;
  const result=consumeGmailRedirect(scope);
  if(!result)return;
  if(result.kind==='error'){
   set({...reset(),error:result.message});return;
  }
  set({status:'connecting',error:null});
  let access;
  try{
   access=await exchangeGmailRedirect(result.code,result.verifier,result.redirectUri);
   const mailbox=await gmailProfile(access.token);
   if(get().scope!==scope){
    revokeGmailToken(access.token);return;
   }
   set({...reset(),status:'connected',token:access.token,expiresAt:access.expiresAt,mailbox});
   await get().search('newer_than:90d');
  }catch(error){
   if(access?.token)revokeGmailToken(access.token);
   if(get().scope===scope)set({...reset(),
    error:error instanceof Error?error.message:'Could not complete Gmail redirect.'});
  }
 },
 disconnect(){
  const {token,persistent}=get();
  // For persisted connections, callers must use disconnectSaved, which
  // deletes the server-side grant and then lets the Worker revoke Google.
  if(persistent){set({error:'Use Disconnect saved Gmail to revoke this account.'});return;}
  ++gmailIdentityEpoch396;
  set(reset());
  if(token)revokeGmailToken(token);
 },
 async search(query,pageToken){
  if(get().persistent&&get().expiresAt<=Date.now()+4*60*1000)
   await get().renewPersistent();
  const {scope,token,expiresAt,mailbox}=get();
  if(!scope||!mailbox||!token||Date.now()>=expiresAt){
   set({...reset(),error:'Gmail session expired. Reconnect to read conversations.'});
   return;
  }
  const q=query.trim().slice(0,180);
  set({loading:true,error:null});
  try{
   const response:GmailPage=await gmailThreadPage(token,q,pageToken);
   if(get().scope!==scope||get().token!==token)return;
   set({loading:false,query:q,threads:pageToken?[...get().threads,...response.threads]:
    response.threads,nextPageToken:response.nextPageToken});
  }catch(error){
   if(get().scope===scope&&get().token===token)
    set({loading:false,error:error instanceof Error?error.message:'Could not load Gmail conversations.'});
  }
 },
}));
export function validGmailToken(scope:string|null):{token:string;mailbox:string}|null{
 const state=useGmailSessionStore.getState();
 return !!scope&&state.scope===scope&&state.token&&state.mailbox&&
   Date.now()<state.expiresAt?{token:state.token,mailbox:state.mailbox}:null;
}
