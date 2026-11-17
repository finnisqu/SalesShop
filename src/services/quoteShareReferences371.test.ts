import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {quoteShareLookupCandidate,quoteShareReferenceSummary} from './quoteShareReferences371';
import type {QuoteShare} from './quoteShareService';
import type {SalesQuoteRecord} from './salesQuoteRegistry';
const quote=(source:'salesshop'|'external',status='Sent')=>({
 source,status,sourceId:'q1',id:'native:q1',name:'Example Quote',updatedAt:'2026-11-17'
} as SalesQuoteRecord);
const share=(changes:Partial<QuoteShare>={}):QuoteShare=>({
 id:'s1',quoteId:'q1',revision:3,token:'customerBearerToken',
 status:'active',viewCount:2,createdAt:'2026-11-16T00:00:00Z',
 firstViewedAt:null,lastViewedAt:null,signedAt:null,expiresAt:null,...changes
});
describe('Quote Share references in Files #371',()=>{
 it('never treats external quote records or unissued drafts as having a native customer link',()=>{
  expect(quoteShareLookupCandidate(quote('external'))).toBe(false);
  expect(quoteShareLookupCandidate(quote('salesshop','Draft'))).toBe(false);
  expect(quoteShareLookupCandidate(quote('salesshop','Sent'))).toBe(true);
 });
 it('requires matching quote identity and exact current revision',()=>{
  expect(quoteShareReferenceSummary({id:'other',revision:3},share()).usable).toBe(false);
  expect(quoteShareReferenceSummary({id:'q1',revision:4},share()).state).toBe('mismatch');
  expect(quoteShareReferenceSummary({id:'q1',revision:3},share()).state).toBe('viewed');
 });
 it('disables revoked/expired URLs; signed links may remain usable after expiry',()=>{
  const q={id:'q1',revision:3};
  expect(quoteShareReferenceSummary(q,share({status:'revoked'})).usable).toBe(false);
  expect(quoteShareReferenceSummary(q,share({expiresAt:'2026-11-15T00:00:00Z'}),
   Date.parse('2026-11-17T00:00:00Z')).state).toBe('expired');
  expect(quoteShareReferenceSummary(q,share({status:'signed',expiresAt:'2026-11-15T00:00:00Z'}),
   Date.parse('2026-11-17T00:00:00Z')).usable).toBe(true);
  expect(quoteShareReferenceSummary(q,null).state).toBe('missing');
 });
 it('summaries never accidentally copy or display sensitive customer tokens',()=>{
  const summary=quoteShareReferenceSummary({id:'q1',revision:3},share());
  expect(JSON.stringify(summary)).not.toContain('customerBearerToken');
  const component=readFileSync(new URL('../components/QuoteShareReferences371.tsx',import.meta.url),'utf8');
  expect(component).toContain('getQuoteShare(');
  expect(component).toContain('quoteShareUrl(');
  expect(component).toContain('Copy customer link');
  expect(component).toContain('Manage in Quote');
  expect(component).not.toContain('localStorage.setItem(');
  expect(component).not.toContain('createQuoteShare(');
  expect(component).not.toContain('revokeQuoteShare(');
 });
});
