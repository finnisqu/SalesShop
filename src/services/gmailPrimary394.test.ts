import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../components/EmailWorkspace.tsx',import.meta.url),'utf8');
const session=readFileSync(new URL('../store/gmailSession359a.ts',import.meta.url),'utf8');
const legacyWorker=readFileSync(new URL('../../worker/index.ts',import.meta.url),'utf8');

describe('#394 — Gmail connection method priority',()=>{
 it('never uses Cloudflare-unsupported redirect error in legacy Gmail OAuth exchange',()=>{
  expect(legacyWorker).toContain("redirect:'manual'");
  expect(legacyWorker).not.toContain("redirect:'error'");
 });

 it('runs the browser popup flow from the primary Connect Gmail button',()=>{
  expect(workspace).toMatch(/onClick=\{\(\)=>\{void connectPopup\(\);\}\}>Connect Gmail<\/button>/);
  expect(workspace).not.toMatch(/onClick=\{\(\)=>\{void connectRedirect\(\);\}\}>Connect Gmail<\/button>/);
  expect(workspace).toContain('await connect();');
  expect(workspace).toContain('await useGmailSessionStore.getState().search(query);');
 });
 it('keeps the Worker redirect available but clearly marked as an alternative',()=>{
  expect(workspace).toMatch(/onClick=\{\(\)=>\{void connectRedirect\(\);\}\}>Try redirect instead<\/button>/);
  expect(workspace).toContain('await connectWithRedirect();');
  expect(workspace).toContain('requires Cloudflare Worker configuration');
 });
 it('preserves account-scoped token handling and explicit disconnection',()=>{
  expect(session).toContain("scope:string|null;mailbox:string|null;token:string|null");
  expect(session).toContain("revokeGmailToken(token)");
  expect(workspace).toContain("onClick={()=>{void disconnectAccount();}}");
  expect(workspace).toContain('await disconnectSaved();');
  expect(workspace).toContain('else disconnect();');
 });
});
