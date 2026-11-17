import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {authorizeGmail,GMAIL_READONLY_SCOPE,gmailOAuthOrigin} from './gmailRead359a';

type Response={access_token?:string;expires_in?:number;scope?:string;error?:string;error_description?:string};
type PopupError={type?:string;message?:string};
const clientId='example.apps.googleusercontent.com';
let complete:(response:Response)=>void=()=>{};
let failPopup:(response:PopupError)=>void=()=>{};
let prompt:string|undefined;
let revoke:ReturnType<typeof vi.fn>;

beforeEach(()=>{
 vi.useFakeTimers();
 revoke=vi.fn();
 vi.stubGlobal('window',{
  location:{origin:'https://app.salesshop.work'},
  google:{accounts:{oauth2:{
   initTokenClient:(options:{callback:(response:Response)=>void;
      error_callback?:(response:PopupError)=>void})=>{
    complete=options.callback;
    failPopup=options.error_callback??(()=>{});
    return {requestAccessToken:(settings?:{prompt?:string})=>{prompt=settings?.prompt;}};
   },
   hasGrantedAllScopes:(response:Response,scope:string)=>Boolean(
    response.access_token&&response.scope?.includes(scope)),
   revoke,
  }}},
 });
 prompt=undefined;
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();vi.clearAllMocks();});

describe('Gmail popup completion and recovery',()=>{
 it('accepts only consented Gmail read access and clears the timeout on success',async()=>{
  const pending=authorizeGmail(clientId);
  expect(prompt).toBe('consent');
  complete({access_token:'temporary-token',expires_in:3600,scope:GMAIL_READONLY_SCOPE});
  const result=await pending;
  expect(result.token).toBe('temporary-token');
  expect(result.expiresAt).toBeGreaterThan(Date.now());
  expect(vi.getTimerCount()).toBe(0);
  expect(revoke).not.toHaveBeenCalled();
 });
 it('returns an actionable error if Google closes the popup',async()=>{
  const pending=authorizeGmail(clientId);
  const rejected=expect(pending).rejects.toThrow('https://app.salesshop.work');
  failPopup({type:'popup_closed'});
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
 });
 it('never hangs indefinitely if Google does not send either callback',async()=>{
  const pending=authorizeGmail(clientId);
  const rejected=expect(pending).rejects.toThrow('Authorized JavaScript origins');
  await vi.advanceTimersByTimeAsync(90_000);
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
 });
 it('refuses insufficient scope and revokes the unaccepted token',async()=>{
  const pending=authorizeGmail(clientId);
  const rejected=expect(pending).rejects.toThrow('read-only permission');
  complete({access_token:'wrong-scope-token',expires_in:3600,scope:'openid'});
  await rejected;
  expect(revoke).toHaveBeenCalledWith('wrong-scope-token',expect.any(Function));
 });
 it('reports the actual browser origin without exposing tokens',()=>{
  expect(gmailOAuthOrigin()).toBe('https://app.salesshop.work');
 });
});
