/** #396 — isolated, opt-in API-only staging harness.
 * This is NOT the production SalesShop Worker and serves no CRM application.
 * Explicitly pinned to the disposable staging Supabase project. Do not route
 * production hostnames or credentials to this Worker.
 */
import {handleGmailPersistent396,type GmailPersistentEnv396} from './gmailPersistent396';

interface Env extends GmailPersistentEnv396 {
 GMAIL_OAUTH_ORIGIN?:string;
}
const STAGING_SUPABASE_ORIGIN='https://lztviymnqplloarwywde.supabase.co';
const forbiddenOrigins=new Set(['https://app.salesshop.work','https://salesshop.work']);
const deny=()=>Response.json({error:'Staging Gmail endpoint unavailable.'},{status:503,
 headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/gmail/persistent/'))
   return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  const allowedOrigin=env.GMAIL_OAUTH_ORIGIN?.trim();
  if(!allowedOrigin||forbiddenOrigins.has(allowedOrigin)||
   env.SUPABASE_URL?.trim()!==STAGING_SUPABASE_ORIGIN||
   url.origin!==allowedOrigin)return deny();
  return handleGmailPersistent396(request,env,allowedOrigin);
 },
};
