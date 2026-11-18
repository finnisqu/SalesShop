import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {assessGmailCoop,inspectGmailOAuthEnvironment,
 gmailOAuthDiagnosticReport} from './gmailOAuthDiagnostics388';
const src=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

beforeEach(()=>{
 vi.stubGlobal('window',{
  location:{origin:'https://app.salesshop.work'},
  self:'browser-window',top:'browser-window',
  google:{accounts:{oauth2:{initTokenClient:()=>({})}}},
 });
});
afterEach(()=>vi.unstubAllGlobals());

describe('#388a — Gmail popup OAuth diagnosis and recovery',()=>{
 it('classifies deployed COOP responses rather than assuming a static file works',()=>{
  expect(assessGmailCoop('same-origin-allow-popups')).toBe('compatible');
  expect(assessGmailCoop('Unsafe-None')).toBe('compatible');
  expect(assessGmailCoop('same-origin')).toBe('incompatible');
  expect(assessGmailCoop('noopener-allow-popups')).toBe('incompatible');
  expect(assessGmailCoop(null)).toBe('missing');
  expect(assessGmailCoop('nonsense')).toBe('unavailable');
 });
 it('uses an on-demand same-origin HEAD request to inspect actual HTML policy',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({
   ok:true,status:200,headers:{get:(name:string)=>name==='Cross-Origin-Opener-Policy'
    ?'same-origin-allow-popups':null},
  });
  vi.stubGlobal('fetch',fetchMock);
  const result=await inspectGmailOAuthEnvironment();
  expect(fetchMock).toHaveBeenCalledWith('https://app.salesshop.work/',{
   method:'HEAD',cache:'no-store',credentials:'same-origin',
  });
  expect(result).toMatchObject({
   origin:'https://app.salesshop.work',
   googleLibraryReady:true,embedded:false,
   coopHeader:'same-origin-allow-popups',coopStatus:'compatible',
  });
  const report=gmailOAuthDiagnosticReport(result);
  expect(report).toContain('Origin: https://app.salesshop.work');
  expect(report).not.toContain('access_token');
  expect(report).not.toContain('mailbox');
 });
 it('reports unavailable rather than falsely claiming a missing header on HEAD failure',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Blocked')));
  const info=await inspectGmailOAuthEnvironment();
  expect(info.coopStatus).toBe('unavailable');
  expect(info.coopHeader).toContain('Could not inspect');
 });
 it('detects a missing Google script or an embedded browser context',async()=>{
  vi.stubGlobal('window',{
   location:{origin:'https://app.salesshop.work'},
   top:'parent-window',self:'child-window',
  });
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:true,status:200,headers:{get:()=>null},
  }));
  const info=await inspectGmailOAuthEnvironment();
  expect(info.googleLibraryReady).toBe(false);
  expect(info.embedded).toBe(true);
  expect(info.coopStatus).toBe('missing');
 });
 it('exposes diagnostics only on demand after a failed authorization',()=>{
  const ui=src('components/EmailWorkspace.tsx');
  const panel=src('components/GmailConnectionChecks388.tsx');
  const client=src('services/gmailRead359a.ts');
  expect(ui).toContain('{error&&<GmailConnectionChecks388/>}');
  expect(panel).toContain('Check this browser');
  expect(panel).toContain('Google Auth Platform');
  expect(panel).toContain('Copy safe report');
  expect(panel).not.toContain('gmailProfile(');
  expect(client).toContain('let popupCloseGrace:ReturnType<typeof setTimeout>');
  expect(client).toContain('clearTimers()');
  expect(client).toContain('client.requestAccessToken({prompt:\'consent\'})');
  expect(client).toContain('GMAIL_READONLY_SCOPE');
  expect(client).not.toContain('refresh_token');
 });
});
