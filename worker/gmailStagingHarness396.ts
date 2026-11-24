/** #396 — isolated, opt-in API-only staging harness.
 * This is NOT the production SalesShop Worker and serves no CRM application.
 * Explicitly pinned to the disposable staging Supabase project. Do not route
 * production hostnames or credentials to this Worker.
 */
import {handleGmailPersistent396,type GmailPersistentEnv396} from './gmailPersistent396';
import {GMAIL_STAGING_AUDIT_HTML_396,GMAIL_STAGING_AUDIT_JS_396} from './gmailStagingAuditPage396';

interface Env extends GmailPersistentEnv396 {
 GMAIL_OAUTH_ORIGIN?:string;
}
const STAGING_SUPABASE_ORIGIN='https://lztviymnqplloarwywde.supabase.co';
const forbiddenOrigins=new Set(['https://app.salesshop.work','https://salesshop.work']);
const auditSecurityHeaders={
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self' https://lztviymnqplloarwywde.supabase.co",
};
const deny=()=>Response.json({error:'Staging Gmail endpoint unavailable.'},{status:503,
 headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  const isAudit=url.pathname==='/audit'||url.pathname==='/audit.js'||
   url.pathname==='/audit/config';
  if(!url.pathname.startsWith('/api/gmail/persistent/')&&!isAudit)
   return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  const allowedOrigin=env.GMAIL_OAUTH_ORIGIN?.trim();
  if(!allowedOrigin||forbiddenOrigins.has(allowedOrigin)||
   env.SUPABASE_URL?.trim()!==STAGING_SUPABASE_ORIGIN||
   url.origin!==allowedOrigin)return deny();
  if(isAudit){
   if(request.method!=='GET')return new Response('Method not allowed',{status:405,
    headers:auditSecurityHeaders});
   if(url.pathname==='/audit')
    return new Response(GMAIL_STAGING_AUDIT_HTML_396,{headers:{
     ...auditSecurityHeaders,'Content-Type':'text/html; charset=utf-8'}});
   if(url.pathname==='/audit.js')
    return new Response(GMAIL_STAGING_AUDIT_JS_396,{headers:{
     ...auditSecurityHeaders,'Content-Type':'text/javascript; charset=utf-8'}});
   // A Supabase publishable key is designed for browser usage; never expose
   // a privileged sb_secret_, legacy service_role JWT or encryption key.
   const publishable=env.SUPABASE_PUBLISHABLE_KEY?.trim()??'';
   if(!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(publishable))return deny();
   return Response.json({supabaseUrl:STAGING_SUPABASE_ORIGIN,
    publishableKey:publishable},{headers:auditSecurityHeaders});
  }
  return handleGmailPersistent396(request,env,allowedOrigin);
 },
};
