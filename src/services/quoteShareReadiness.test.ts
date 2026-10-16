import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {customerShareCreationBlocker} from './quoteShareReadiness';

const doc=(status:Quote['status'],archivedAt?:string)=>
  ({status,archivedAt} as Pick<Quote,'status'|'archivedAt'>);

describe('18E customer link creation requires explicit issuing',()=>{
  it('refuses Draft and Ready even with every selling price and customer field complete',()=>{
    expect(customerShareCreationBlocker(doc('Draft'))).toMatch(/explicitly issue/);
    expect(customerShareCreationBlocker(doc('Ready'))).toMatch(/explicitly issue/);
  });
  it('accepts only current non-archived issued/reviewed/signed revisions',()=>{
    for(const status of ['Sent','Viewed','Signed'] as const)
      expect(customerShareCreationBlocker(doc(status))).toBeNull();
    for(const status of ['Declined','Expired'] as const)
      expect(customerShareCreationBlocker(doc(status))).toMatch(/new revision/);
    expect(customerShareCreationBlocker(doc('Sent','2026-10-15T21:00:00Z'))).toMatch(/Restore/);
  });
});
