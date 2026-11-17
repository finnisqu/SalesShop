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
export function authorizeGmail(clientId=gmailClientId):Promise<GmailAccess>{
 if(!clientId||!clientId.endsWith('.apps.googleusercontent.com'))
  return Promise.reject(new Error('SalesShop needs a Google OAuth Web client ID before Gmail can connect.'));
 const google=googleIdentity();
 if(!google)return Promise.reject(new Error('Google sign-in is still loading. Please try Connect again.'));
 return new Promise((resolve,reject)=>{
  let settled=false;
  const fail=(message:string)=>{if(!settled){settled=true;reject(new Error(message));}};
  const client=google.accounts.oauth2.initTokenClient({
   client_id:clientId,scope:GMAIL_READONLY_SCOPE,
   callback(response){
    if(response.error||!response.access_token){
     fail(response.error_description||response.error||'Gmail connection was canceled.');return;
    }
    if(!google.accounts.oauth2.hasGrantedAllScopes(response,GMAIL_READONLY_SCOPE)){
     fail('The Gmail read-only permission was not granted.');return;
    }
    if(!settled){
     settled=true;
     resolve({token:response.access_token,expiresAt:Date.now()+Math.max(
      60,Number(response.expires_in)||3600)*1000-60_000});
    }
   },
   error_callback(response){fail(response.message||response.type||'Google sign-in could not start.');},
  });
  // Called synchronously from a real Connect click to preserve popup permission.
  client.requestAccessToken({prompt:'consent'});
 });
}
export function revokeGmailToken(token:string):void{
 try{googleIdentity()?.accounts.oauth2.revoke(token,()=>{});}catch{/* expire locally regardless */}
}
interface GmailApiHeader {name?:string;value?:string}
interface GmailApiPayload {
 mimeType?:string;headers?:GmailApiHeader[];body?:{data?:string;size?:number};
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
function parsePlainText(part?:GmailApiPayload):string{
 if(!part)return '';
 if(part.mimeType?.toLowerCase()==='text/plain'&&part.body?.data){
  try{
   const decoded=part.body.data.replace(/-/g,'+').replace(/_/g,'/');
   const raw=atob(decoded);
   const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
   return new TextDecoder().decode(bytes).slice(0,12000);
  }catch{return '';}
 }
 for(const child of part.parts??[]){
  const text=parsePlainText(child);
  if(text)return text;
 }
 return '';
}
export function displayGmailThread(thread:GmailApiThread):GmailThreadDetails{
 const summary=summarizeGmailThread(thread);
 return {summary,messages:(thread.messages??[]).slice(-40).map(m=>{
  const timestamp=Number(m.internalDate);
  return {id:m.id??'',from:gmailHeader(m,'From')||'Unknown',
   to:gmailHeader(m,'To'),subject:gmailHeader(m,'Subject')||summary.subject,
   date:Number.isFinite(timestamp)&&timestamp>0?new Date(timestamp).toISOString():summary.date,
   text:parsePlainText(m.payload)||(m.snippet??'').slice(0,12000)};
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
  '&metadataHeaders=Date&metadataHeaders=Subject',signal);
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
