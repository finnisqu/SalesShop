import {describe,it,expect,vi,afterEach} from 'vitest';
import worker from '../../worker/index';

const origin='https://app.salesshop.work';
const id='test-client.apps.googleusercontent.com';
const env={
 ASSETS:{fetch:vi.fn(async()=>new Response('SPA'))},
 GOOGLE_GMAIL_CLIENT_ID:id,GOOGLE_GMAIL_CLIENT_SECRET:'fake-test-only-secret',
};
const request=(method='POST',data:Record<string,unknown>={
 code:'4/0ABCDEF123456789',code_verifier:'x'.repeat(64),
 redirect_uri:origin+'/gmail/callback',client_id:id,
},from=origin)=>new Request(origin+'/api/gmail/oauth/exchange',{
 method,headers:{Origin:from,'Content-Type':'application/json'},
 body:method==='POST'?JSON.stringify(data):undefined,
});
afterEach(()=>vi.unstubAllGlobals());

describe('#389 — full-page Gmail OAuth Worker code exchange',()=>{
 it('keeps normal SPA assets and exposes only configured boolean',async()=>{
  expect(await (await worker.fetch(new Request(origin+'/home'),env)).text()).toBe('SPA');
  const info=await worker.fetch(new Request(origin+'/api/gmail/oauth/status'),env);
  expect(await info.json()).toEqual({configured:true});
  expect(info.headers.get('Cache-Control')).toContain('no-store');
  expect(JSON.stringify(await (await worker.fetch(new Request(origin+'/api/gmail/oauth/status'),
   {...env,GOOGLE_GMAIL_CLIENT_SECRET:undefined})).json())).toBe('{"configured":false}');
 });
 it('rejects unrelated origins, wrong client IDs, redirect URIs and verbs',async()=>{
  expect((await worker.fetch(request('POST',undefined,'https://foreign.example'),env)).status).toBe(403);
  expect((await worker.fetch(request('POST',{
   code:'4/0ABCDEF123456789',code_verifier:'x'.repeat(64),
   redirect_uri:'https://evil.example/callback',client_id:id,
  }),env)).status).toBe(400);
  expect((await worker.fetch(request('GET'),env)).status).toBe(405);
 });
 it('exchanges code server-side without returning secret or refresh tokens',async()=>{
  const mock=vi.fn(async (_url:string,init:RequestInit)=>{
   const body=init.body as URLSearchParams;
   expect(body.get('client_secret')).toBe('fake-test-only-secret');
   expect(body.get('code_verifier')).toBe('x'.repeat(64));
   return Response.json({access_token:'temporary-test-token',expires_in:3600,
    token_type:'Bearer',scope:'https://www.googleapis.com/auth/gmail.readonly',
    refresh_token:'must-not-leak'});
  });
  vi.stubGlobal('fetch',mock);
  const response=await worker.fetch(request(),env);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
   access_token:'temporary-test-token',expires_in:3600,
   scope:'https://www.googleapis.com/auth/gmail.readonly',
  });
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(mock).toHaveBeenCalledOnce();
 });
 it('refuses a response without the requested Gmail scope',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({
   access_token:'wrong-scope',expires_in:3600,token_type:'Bearer',scope:'openid'})));
  const response=await worker.fetch(request(),env);
  expect(response.status).toBe(403);
  expect(JSON.stringify(await response.json())).not.toContain('wrong-scope');
 });
});
