/** Gmail read-only provider adapter. OAuth tokens and message contents are never persisted.
 * A configured Google OAuth Web client and consent screen are prerequisites.
 * Only request Gmail read-only access. Do not send, modify, delete or label mail.
 */
export const GMAIL_READONLY_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
export const gmailClientId=(import.meta.env.VITE_GOOGLE_GMAIL_CLIENT_ID??'').trim();
interface GoogleOAuthResponse{
 access_token?:string;expires_in?:number;scope?:string;error?:string;error_description?:string;
}
interface GoogleTokenClient {requestAccessToken:(overrides?:{prompt?:string})=>void}
interface GoogleIdentity {
 accounts:{oauth2:{
  initTokenClient:(args:{
   client_id:string;scope:string;callback:(response:GoogleOAuthResponse)=>void;
   error_callback?:(response:{type?:string;message?:string})=>void;
  })=>GoogleTokenClient;
  hasGrantedAllScopes:(response:GoogleOAuthResponse,...scopes:string[])=>boolean;
  revoke:(token:string,callback?:(response:unknown)=>void)=>void;
 }};
}
function googleIdentity():GoogleIdentity|null{
 if(typeof window==='undefined')return null;
 return (window as Window&{google?:GoogleIdentity}).google??null;
}
export interface GmailAccess {token:string;expiresAt:number}
export type GmailOAuthPhase='requested'|'popup_closed'|'popup_blocked'|
 'oauth_response'|'oauth_denied'|'token_accepted'|'failed';
export interface GmailOAuthTraceEntry{
 phase:GmailOAuthPhase;elapsedMs:number;parentFocused:boolean|null;
}
/** Only fixed event names, duration and focus state are retained in memory.
 * Never include tokens, Google responses, mailbox data or account names. */
let recentGmailOAuthTrace:GmailOAuthTraceEntry[]=[];
export function gmailOAuthTrace():GmailOAuthTraceEntry[]{
 return recentGmailOAuthTrace.map(entry=>({...entry}));
}
function isSalesShopFocused():boolean{
 try{
  return typeof document==='undefined'||typeof document.hasFocus!=='function'
   ?true:document.hasFocus();
 }catch{return true;}
}
function traceGmailOAuth(phase:GmailOAuthPhase,startedAt:number){
 recentGmailOAuthTrace.push({
  phase,elapsedMs:Math.max(0,Date.now()-startedAt),
  parentFocused:typeof document==='undefined'?null:isSalesShopFocused(),
 });
 recentGmailOAuthTrace=recentGmailOAuthTrace.slice(-12);
}

/** The exact origin must be whitelisted on the OAuth Web client in Google Cloud.
 * It is intentionally shown in errors; client IDs and tokens never are. */
export function gmailOAuthOrigin():string{
 return typeof window==='undefined'?'the SalesShop website':window.location.origin;
}
export function authorizeGmail(clientId=gmailClientId):Promise<GmailAccess>{
 if(!clientId||!clientId.endsWith('.apps.googleusercontent.com'))
  return Promise.reject(new Error('SalesShop needs a Google OAuth Web client ID before Gmail can connect.'));
 const google=googleIdentity();
 if(!google)return Promise.reject(new Error('Google sign-in is still loading. Please try Connect again.'));
 return new Promise((resolve,reject)=>{
  let settled=false;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  let popupCloseGrace:ReturnType<typeof setTimeout>|undefined;
  let cleanupFocus:(()=>void)|undefined;
  let popupCloseReported=false;
  const startedAt=Date.now();
  recentGmailOAuthTrace=[];
  traceGmailOAuth('requested',startedAt);
  const clearTimers=()=>{
   clearTimeout(timeout);clearTimeout(popupCloseGrace);
   cleanupFocus?.();cleanupFocus=undefined;
  };
  const fail=(message:string)=>{
   if(settled)return;
   settled=true;traceGmailOAuth('failed',startedAt);
   clearTimers();reject(new Error(message));
  };
  const success=(token:string,expiresIn?:number)=>{
   if(settled){revokeGmailToken(token);return;}
   settled=true;traceGmailOAuth('token_accepted',startedAt);
   clearTimers();
   resolve({token,expiresAt:Date.now()+Math.max(60,Number(expiresIn)||3600)*1000-60_000});
  };
  // Google can report popup_closed while another Google consent screen
  // is still the foreground window. Do not fail while SalesShop lacks focus:
  // wait until the parent regains focus and provide time for a late callback.
  const verifyPopupClosed=()=>{
   if(settled||!popupCloseReported||!isSalesShopFocused())return;
   if(popupCloseGrace)clearTimeout(popupCloseGrace);
   popupCloseGrace=setTimeout(()=>{
    popupCloseGrace=undefined;
    if(settled)return;
    if(!isSalesShopFocused())return; // Google UI is still in foreground.
    fail('Google reported that the authorization popup closed without returning a token. '+
     'SalesShop waited for the popup to finish. Open Connection checks for the '+
     'OAuth event sequence, then verify the Google Cloud client and consent settings.');
   },4_000);
  };
  if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
   const onFocus=()=>verifyPopupClosed();
   window.addEventListener('focus',onFocus);
   cleanupFocus=()=>window.removeEventListener('focus',onFocus);
  }
  timeout=setTimeout(()=>fail('Google did not return an authorization result within 90 seconds. '+
   'Use Connection checks to inspect the OAuth event sequence. Also verify '+
   'browser popup permissions and the Google Cloud Web OAuth client.'),90_000);
  try{
   const client=google.accounts.oauth2.initTokenClient({
    client_id:clientId,scope:GMAIL_READONLY_SCOPE,
    callback(response){
     traceGmailOAuth('oauth_response',startedAt);
     if(response.error||!response.access_token){
      traceGmailOAuth('oauth_denied',startedAt);
      fail(response.error_description||response.error||'Gmail connection was canceled.');return;
     }
     try{
      if(!google.accounts.oauth2.hasGrantedAllScopes(response,GMAIL_READONLY_SCOPE)){
       revokeGmailToken(response.access_token);
       fail('The Gmail read-only permission was not granted.');return;
      }
      success(response.access_token,response.expires_in);
     }catch{
      revokeGmailToken(response.access_token);
      fail('Google could not confirm Gmail access. Retry and check the OAuth client settings.');
     }
    },
    error_callback(response){
     const kind=response.type??'';
     if(kind==='popup_closed'||kind==='popup_closed_by_user'){
      traceGmailOAuth('popup_closed',startedAt);
      popupCloseReported=true;
      verifyPopupClosed(); // No timer while Google's popup retains focus.
      return;
     }
     if(kind==='popup_failed_to_open'){
      traceGmailOAuth('popup_blocked',startedAt);
      fail('Your browser blocked the Google popup. Allow popups for SalesShop and retry.');
      return;
     }
     fail(response.message||kind||'Google did not complete authorization. '+
      'Verify your OAuth client configuration and retry.');
    },
   });
   // A direct user click is required for Google to open its authorization popup.
   client.requestAccessToken({prompt:'consent'});
  }catch(error){
   fail(error instanceof Error?error.message:'Google could not start authorization.');
  }
 });
}
export function revokeGmailToken(token:string):void{
 try{googleIdentity()?.accounts.oauth2.revoke(token,()=>{});}catch{/* expire locally regardless */}
}
interface GmailApiHeader {name?:string;value?:string}
interface GmailApiPayload {
 mimeType?:string;filename?:string;headers?:GmailApiHeader[];
 body?:{data?:string;size?:number;attachmentId?:string};
 parts?:GmailApiPayload[];
}
export interface GmailApiMessage{
 id?:string;threadId?:string;internalDate?:string;snippet?:string;
 payload?:GmailApiPayload;
}
interface GmailApiThread {id?:string;messages?:GmailApiMessage[];snippet?:string}
interface GmailListResponse {threads?:Array<{id?:string}>;nextPageToken?:string}
export interface GmailThreadSummary{
 id:string;subject:string;from:string;date:string;snippet:string;
 participants:string[];messageCount:number;
 /** Latest Gmail message identity, held in memory for per-message Task/Activity status.
  * Never persist this raw ID to CRM or browser review storage. */
 latestMessageId?:string;
}
export interface GmailVisibleMessage{
 id:string;from:string;to:string;date:string;subject:string;text:string;
 /** Reply-To can differ from bulk-mailer / builder-platform From addresses. */
 replyTo?:string;cc?:string;
 /** Longer readable body for in-memory address discovery; never persisted. */
 searchText?:string;
}
export interface GmailThreadDetails {
 summary:GmailThreadSummary;messages:GmailVisibleMessage[];
}
const gmailRoot='https://gmail.googleapis.com/gmail/v1/users/me/';
async function gmailGet<T>(token:string,path:string,signal?:AbortSignal):Promise<T>{
 if(!token)throw new Error('Connect Gmail to read messages.');
 const response=await fetch(gmailRoot+path,{headers:{Authorization:'Bearer '+token},
  cache:'no-store',signal});
 if(!response.ok){
  if(response.status===401)throw new Error('Gmail access expired. Reconnect your account.');
  if(response.status===403)throw new Error('Google denied Gmail access. Check OAuth consent, API access and organization approval.');
  throw new Error('Gmail request failed ('+response.status+').');
 }
 return response.json() as Promise<T>;
}
export async function gmailProfile(token:string,signal?:AbortSignal):Promise<string>{
 const profile=await gmailGet<{emailAddress?:string}>(token,'profile',signal);
 if(!profile.emailAddress||!profile.emailAddress.includes('@'))throw new Error('Gmail did not return an account address.');
 return profile.emailAddress.toLowerCase();
}
export function gmailHeader(message:GmailApiMessage,name:string):string{
 return message.payload?.headers?.find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value??'';
}
export function extractAddresses(text:string):string[]{
 const matches=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)??[];
 return [...new Set(matches.map(value=>value.toLowerCase()))];
}
export function summarizeGmailThread(thread:GmailApiThread):GmailThreadSummary{
 const messages=thread.messages??[];
 const last=messages[messages.length-1]??{};
 const first=messages[0]??last;
 const participants=[...new Set(messages.flatMap(message=>[
  ...extractAddresses(gmailHeader(message,'From')),
  ...extractAddresses(gmailHeader(message,'To')),
  ...extractAddresses(gmailHeader(message,'Cc')),
  ...extractAddresses(gmailHeader(message,'Reply-To')),
 ]))];
 const received=Number(last.internalDate);
 const day=Number.isFinite(received)&&received>0?
  new Date(received).toISOString():new Date(0).toISOString();
 return {id:thread.id??'',subject:gmailHeader(first,'Subject')||
  gmailHeader(last,'Subject')||'(No subject)',
  from:gmailHeader(last,'From')||'Unknown sender',date:day,
  snippet:(last.snippet??thread.snippet??'').slice(0,260),
  participants,messageCount:messages.length,
  ...(/^[A-Za-z0-9_-]{3,128}$/.test(last.id??'')?{latestMessageId:last.id}:{})};
}
/** Read bounded body text from MIME parts, including multipart/forwarded chains.
 * Never download attachments or render untrusted HTML. */
function decodedGmailPart(data?:string):string{
 if(!data)return '';
 try{
  const decoded=data.replace(/-/g,'+').replace(/_/g,'/');
  const bytes=Uint8Array.from(atob(decoded),c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes).slice(0,100_000);
 }catch{return '';}
}
function gmailHtmlAsText(source:string):string{
 // HTML-only builder notifications often have the only useful address in
 // mailto links. Extract those before dropping every tag/attribute.
 const mailtos=[...source.matchAll(/mailto:([^\s"'<>?]+)/gi)]
  .map(match=>match[1].replace(/%40/gi,'@'));
 const plain=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<(?:br|\/p|\/div|\/tr|\/li)\b[^>]*>/gi,'\n')
  .replace(/<[^>]+>/g,' ')
  .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_match,hex,decimal)=>
   String.fromCodePoint(Math.min(0x10ffff,Number.parseInt(hex??decimal,hex?16:10)||32)))
  .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gi,m=>({
   '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",
  } as Record<string,string>)[m.toLowerCase()]??m);
 return (plain+'\n'+mailtos.join('\n')).slice(0,100_000);
}
function readableGmailBody(part?:GmailApiPayload):string{
 if(!part)return '';
 const plain:string[]=[],html:string[]=[];
 let visited=0;
 const collect=(item:GmailApiPayload,depth:number)=>{
  if(++visited>160||depth>18||item.filename||item.body?.attachmentId)return;
  const mime=item.mimeType?.toLowerCase()??'';
  if(mime==='text/plain'&&item.body?.data)plain.push(decodedGmailPart(item.body.data));
  if(mime==='text/html'&&item.body?.data)html.push(gmailHtmlAsText(decodedGmailPart(item.body.data)));
  for(const child of item.parts??[])collect(child,depth+1);
 };
 collect(part,0);
 // Prefer text/plain over HTML alternate representations, so one email is not
 // counted twice. Preserve multiple plain parts, including nested forwards.
 return (plain.length?plain:html).filter(Boolean).join('\n\n').slice(0,100_000);
}
export function displayGmailThread(thread:GmailApiThread):GmailThreadDetails{
 const summary=summarizeGmailThread(thread);
 return {summary,messages:(thread.messages??[]).slice(-40).map(m=>{
  const timestamp=Number(m.internalDate);
  const readable=readableGmailBody(m.payload)||(m.snippet??'').slice(0,12000);
  return {id:m.id??'',from:gmailHeader(m,'From')||'Unknown',
   to:gmailHeader(m,'To'),replyTo:gmailHeader(m,'Reply-To'),cc:gmailHeader(m,'Cc'),
   subject:gmailHeader(m,'Subject')||summary.subject,
   date:Number.isFinite(timestamp)&&timestamp>0?new Date(timestamp).toISOString():summary.date,
   text:readable.slice(0,12000),searchText:readable};
 })};
}
export async function gmailThreadDetails(token:string,id:string,signal?:AbortSignal):Promise<GmailThreadDetails>{
 if(!/^[A-Za-z0-9_-]{3,128}$/.test(id))throw new Error('Invalid Gmail thread identifier.');
 const response=await gmailGet<GmailApiThread>(token,'threads/'+encodeURIComponent(id)+'?format=full',signal);
 return displayGmailThread(response);
}
export async function gmailThreadSummary(token:string,id:string,signal?:AbortSignal):Promise<GmailThreadSummary>{
 if(!/^[A-Za-z0-9_-]{3,128}$/.test(id))throw new Error('Invalid Gmail thread identifier.');
 const response=await gmailGet<GmailApiThread>(token,'threads/'+encodeURIComponent(id)+
  '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc'+
  '&metadataHeaders=Reply-To&metadataHeaders=Date&metadataHeaders=Subject',signal);
 return summarizeGmailThread(response);
}
export interface GmailPage {threads:GmailThreadSummary[];nextPageToken?:string}
export async function gmailThreadPage(token:string,query:string,pageToken?:string,
 signal?:AbortSignal):Promise<GmailPage>{
 const search=query.trim().slice(0,900)||'newer_than:90d';
 const params=new URLSearchParams({q:search,maxResults:'20'});
 if(pageToken)params.set('pageToken',pageToken);
 const result=await gmailGet<GmailListResponse>(token,'threads?'+params.toString(),signal);
 const references=(result.threads??[]).map(row=>row.id).filter((id):id is string=>Boolean(id));
 const summaries:GmailThreadSummary[]=[];
 // Bound concurrency to avoid creating a burst of 20 parallel Gmail API calls.
 for(let i=0;i<references.length;i+=4){
  const batch=references.slice(i,i+4);
  const rows=await Promise.all(batch.map(id=>gmailThreadSummary(token,id,signal)));
  summaries.push(...rows);
 }
 return {threads:summaries.sort((a,b)=>b.date.localeCompare(a.date)),
  nextPageToken:result.nextPageToken};
}
