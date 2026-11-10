import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');

describe('Connections mobile record cards and Person quick contact actions',()=>{
 it('keeps mobile cards single-surface with independent full-page controls',()=>{
  const connections=read('src/components/Connections.tsx');
  const org=read('src/components/OurOrganizationDirectory.tsx');
  const css=read('src/mobile-connections-inline.css');
  expect(connections).toContain('connections-mobile-top-action');
  expect(connections).not.toContain('connections-mobile-inline connections-mobile-contact-actions');
  expect(connections).not.toContain('connections-record-arrow');
  expect(org).toContain('connections-mobile-top-action');
  expect(org).not.toContain('connections-record-arrow');
  expect(css).toContain('position:absolute;z-index:2;top:10px;right:10px;');
  expect(css).toContain('padding:12px 103px 12px 12px!important');
 });
 it('uses native deep links for phone, SMS and email in Person preview header',()=>{
  const preview=read('src/components/RecordPreviewDrawer.tsx');
  expect(preview).toContain('record-preview-person-quick-actions');
  expect(preview).toContain("method==='call'?'tel:':'sms:'");
  expect(preview).toContain("'mailto:'+encodeURIComponent(person.email.trim())");
  expect(preview).toContain('aria-label={method===');
  expect(preview).toContain('PersonQuickMethodIcon method="email"');
 });
 it('never logs automatically; a yes/no confirmation gates linked CRM Activity',()=>{
  const preview=read('src/components/RecordPreviewDrawer.tsx');
  expect(preview).toContain('pendingPersonMethod&&canLog');
  expect(preview).toContain('role="alertdialog" aria-modal="true"');
  expect(preview).toContain('Yes, log it');
  expect(preview).toContain('>No</button>');
  expect(preview).toContain('onClick={logConfirmedPersonInteraction}');
  expect(preview).toContain("type:'manual-touchpoint'");
  expect(preview).toContain('contactId:person.id,companyId:person.companyId');
  expect(preview).toContain('relatedRecords:contextualLinks.filter');
 });
});
