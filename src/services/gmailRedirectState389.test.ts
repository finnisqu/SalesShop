import {afterEach,describe,expect,it,vi} from 'vitest';
import {consumeGmailRedirect} from './gmailRedirect389';

const origin='https://app.salesshop.work';
const path='/gmail/callback';
const key='salesshop-gmail-redirect-389';
function fakeCallback(url:string,saved:unknown){
 const history={state:null,replaceState:vi.fn()};
 const storage={getItem:vi.fn((item:string)=>item===key?JSON.stringify(saved):null),
  removeItem:vi.fn()};
 vi.stubGlobal('window',{location:{origin,pathname:path,href:url},history});
 vi.stubGlobal('sessionStorage',storage);
 return {history,storage};
}
afterEach(()=>vi.unstubAllGlobals());

describe('#389 — Gmail redirect CSRF and identity guard',()=>{
 it('consumes a valid callback exactly once and strips the browser URL',()=>{
  const scope='org:example:user:alice';
  const saved={state:'nonce-123',scope,verifier:'a'.repeat(64),
   redirectUri:origin+path,startedAt:Date.now()};
  const {history,storage}=fakeCallback(origin+path+'?code=4%2F0ABCDEFGHIJKLM&state=nonce-123',saved);
  expect(consumeGmailRedirect(scope)).toEqual({
   kind:'code',code:'4/0ABCDEFGHIJKLM',verifier:'a'.repeat(64),redirectUri:origin+path});
  expect(history.replaceState).toHaveBeenCalledWith(null,'','/tools');
  expect(storage.removeItem).toHaveBeenCalledWith(key);
 });
 it('refuses cross-account callbacks and mismatched state before exchange',()=>{
  const scope='org:example:user:alice';
  const saved={state:'expected',scope,verifier:'a'.repeat(64),
   redirectUri:origin+path,startedAt:Date.now()};
  fakeCallback(origin+path+'?code=4%2F0ABCDEFGHIJKLM&state=unexpected',saved);
  expect(consumeGmailRedirect(scope)).toMatchObject({kind:'error'});
  fakeCallback(origin+path+'?code=4%2F0ABCDEFGHIJKLM&state=expected',saved);
  expect(consumeGmailRedirect('org:other:user:bob')).toMatchObject({kind:'error'});
 });
 it('rejects expired state and denies without retaining a Google code',()=>{
  const scope='org:example:user:alice';
  const saved={state:'nonce',scope,verifier:'a'.repeat(64),
   redirectUri:origin+path,startedAt:Date.now()-11*60*1000};
  fakeCallback(origin+path+'?error=access_denied&state=nonce',saved);
  expect(consumeGmailRedirect(scope)).toMatchObject({kind:'error'});
 });
});
