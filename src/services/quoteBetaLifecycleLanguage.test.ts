import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {quoteBetaPrimaryAction,quoteBetaStatusLabel} from './quoteBetaLifecycleLanguage';

const doc=(status:Quote['status'],documentType:Quote['documentType']='quote',archivedAt?:string)=>
  ({status,documentType,archivedAt} as Pick<Quote,'status'|'documentType'|'archivedAt'>);

describe('18G — consistent quote action language',()=>{
  it('keeps Draft/Ready review entry points and only mentions issuing explicitly',()=>{
    expect(quoteBetaPrimaryAction(doc('Draft')).mobile).toBe('Review & issue ›');
    expect(quoteBetaPrimaryAction(doc('Ready')).ariaLabel).toBe('Review and issue quote');
    expect(quoteBetaPrimaryAction(doc('Draft'),2).mobile).toBe('Resolve 2 pricing issues ›');
    expect(quoteBetaPrimaryAction(doc('Draft'),1).mobile).toBe('Resolve 1 pricing issue ›');
    expect(quoteBetaPrimaryAction(doc('Draft'),1).help).not.toMatch(/sending/);
  });
  it('makes issued, viewed, signed and closed documents unambiguously distinct',()=>{
    expect(quoteBetaPrimaryAction(doc('Sent')).desktop).toBe('Share issued quote');
    expect(quoteBetaPrimaryAction(doc('Viewed')).mobile).toBe('Share issued quote ›');
    expect(quoteBetaPrimaryAction(doc('Signed')).desktop).toBe('View signed quote');
    expect(quoteBetaPrimaryAction(doc('Declined')).desktop).toBe('Review revision options');
    expect(quoteBetaPrimaryAction(doc('Expired')).desktop).toBe('Review revision options');
    expect(quoteBetaPrimaryAction(doc('Sent','quote','2026-10-15')).mobile).toBe('View archived quote ›');
    expect(quoteBetaPrimaryAction(doc('Signed','quote','2026-10-15')).help).toMatch(/Restore/);
    expect(quoteBetaStatusLabel(doc('Sent'))).toBe('Issued');
    expect(quoteBetaStatusLabel(doc('Ready'))).toBe('Ready for review');
    expect(quoteBetaStatusLabel(doc('Sent','quote','2026-10-15'))).toBe('Archived');
  });
  it('uses the same lifecycle for Pricing Schedules without pretending links send emails',()=>{
    expect(quoteBetaPrimaryAction(doc('Draft','pricing-schedule')).mobile).toBe('Review Pricing Schedule ›');
    expect(quoteBetaPrimaryAction(doc('Sent','pricing-schedule')).desktop).toBe('Share issued schedule');
    expect(quoteBetaPrimaryAction(doc('Signed','pricing-schedule')).mobile).toBe('View signed schedule ›');
    expect(quoteBetaPrimaryAction(doc('Sent','pricing-schedule')).help).toMatch(/confirm actual delivery/);
  });
});
