/** #388a — Browser-only Gmail OAuth diagnostics.
 * No OAuth token, Gmail address, messages, or private CRM data is inspected. */
import {gmailClientId,gmailOAuthOrigin} from './gmailRead359a';

export interface GmailOAuthDiagnostics {
 origin:string;
 publicClientId:string;
 googleLibraryReady:boolean;
 embedded:boolean|null;
 coopHeader:string;
 coopStatus:'compatible'|'incompatible'|'missing'|'unavailable';
}
/** Google's popup flow requires a COOP policy that keeps the opener channel.
 * We check the *deployed HTML response* instead of assuming a source _headers
 * file is actually honored by the deployed Cloudflare asset response. */
export function assessGmailCoop(header:string|null):GmailOAuthDiagnostics['coopStatus']{
 if(header===null)return 'missing';
 const value=header.trim().toLowerCase();
 if(value==='same-origin-allow-popups'||value==='unsafe-none')return 'compatible';
 if(value==='same-origin'||value==='noopener-allow-popups')return 'incompatible';
 return 'unavailable';
}
export async function inspectGmailOAuthEnvironment():Promise<GmailOAuthDiagnostics>{
 const origin=gmailOAuthOrigin();
 if(typeof window==='undefined')return {
  origin,publicClientId:gmailClientId,googleLibraryReady:false,
  embedded:null,coopHeader:'Unavailable outside a browser',coopStatus:'unavailable',
 };
 const google=(window as Window&{google?:{
  accounts?:{oauth2?:{initTokenClient?:unknown}}
 }}).google;
 let embedded:boolean|null=null;
 try{embedded=window.top!==window.self;}catch{embedded=null;}
 let coopHeader='Could not inspect the deployed response',coopStatus:
  GmailOAuthDiagnostics['coopStatus']='unavailable';
 try{
  const response=await fetch(origin+'/',{
   method:'HEAD',cache:'no-store',credentials:'same-origin',
  });
  if(response.ok){
   const header=response.headers.get('Cross-Origin-Opener-Policy');
   coopHeader=header??'Not present';
   coopStatus=assessGmailCoop(header);
  }else coopHeader='HTTP '+response.status+' while checking the app response';
 }catch{/* A blocked HEAD request must not be misreported as a missing header. */}
 return {
  origin,publicClientId:gmailClientId,
  googleLibraryReady:typeof google?.accounts?.oauth2?.initTokenClient==='function',
  embedded,coopHeader,coopStatus,
 };
}
export function gmailOAuthDiagnosticReport(info:GmailOAuthDiagnostics):string{
 return [
  'SalesShop Gmail OAuth checks (no email or token data)',
  'Origin: '+info.origin,
  'Public OAuth Web client ID: '+(info.publicClientId||'Not configured'),
  'Google Identity Services loaded: '+(info.googleLibraryReady?'Yes':'No'),
  'Embedded page: '+(info.embedded===null?'Unknown':info.embedded?'Yes':'No'),
  'Deployed Cross-Origin-Opener-Policy: '+info.coopHeader,
  'COOP popup compatibility: '+info.coopStatus,
  'Check that this exact origin is authorized on this exact Google Cloud OAuth Web client.',
 ].join('\n');
}
