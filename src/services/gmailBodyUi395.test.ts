import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const file=(relative:string)=>readFileSync(new URL(relative,import.meta.url),'utf8');
const workspace=file('../components/EmailWorkspace.tsx');
const createPerson=file('../components/EmailPersonCreate362.tsx');
const linkPicker=file('../components/EmailLinkPicker395.tsx');
const matching=file('./gmailBodyDiscovery395.ts');

describe('#395 — Gmail body matches and safe contact/record flows',()=>{
 it('checks opened messages and optionally scans all loaded conversations',()=>{
  expect(workspace).toContain('gmailAddressesInDetails395(result,session.mailbox)');
  expect(workspace).toContain('Find People in message contents');
  expect(workspace).toContain('gmailThreadWithAddresses395(');
  expect(workspace).toContain('gmailBodyKey395(thread)');
  expect(workspace).toContain('++bodyScanEpoch.current');
 });
 it('keeps matched People visible and allows deliberate creation from body findings',()=>{
  expect(workspace).toContain('Recognized People in this conversation');
  expect(workspace).toContain('gmailEvidenceLabel395(item.evidence)');
  expect(workspace).toContain('setPersonSeed(item.address);setEmailAction(\'person\')');
  expect(workspace).toContain('details={details?.summary.id===current.id?details:null}');
  expect(createPerson).toContain('gmailAddressesInDetails395(details,mailbox)');
 });
 it('keeps discovered content in account-scoped memory, never saves it',()=>{
  expect(workspace).toContain('setBodyDiscovery({identity:null,byId:{}})');
  expect(workspace).toContain('validGmailToken(expectedScope)?.token!==session.token');
  expect(matching).not.toMatch(/localStorage|sessionStorage|\.from\(|\.insert\(/);
 });
 it('uses the common searchable CRM record picker and staged creation',()=>{
  expect(linkPicker).toContain('<UnifiedRecordPicker kind="CRM record"');
  expect(linkPicker).toContain('onCreate={startCreate}');
  expect(linkPicker).toContain('onLink={key=>{onSelect(key);');
  expect(linkPicker).toContain('Create Deal and select');
  expect(linkPicker).toContain('<EmailPersonCreate362');
  expect(workspace).toContain('<EmailLinkPicker395');
  expect(workspace).toContain('onClick={applyLink}');
 });
 it('rechecks live Gmail and CRM permissions before creating a Person or Deal',()=>{
  expect(createPerson).toContain('session.scope!==scope');
  expect(createPerson).toContain('bodyIsCurrent&&details');
  expect(linkPicker).toContain('validGmailToken(scope)');
  expect(linkPicker).toContain('canEditTeamArea(state.teamRole,state.teamDepartment,\'crm\')');
  expect(linkPicker).toContain('useRolePerspectiveStore.getState().activePerspective');
 });
});
