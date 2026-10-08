import { describe, expect, it } from 'vitest';
import { quotesForCompany, quotesForProject } from './quoteCrmLinks';
import type { Quote } from '../types/quote';

type MinimalQuote = Pick<Quote,'id'|'projectId'|'companyId'|'updatedAt'>;
const quotes: MinimalQuote[] = [
  { id:'a', projectId:'p1', updatedAt:'2026-10-02T11:00:00Z' },
  { id:'b', companyId:'c1', updatedAt:'2026-10-05T10:00:00Z' },
  { id:'c', projectId:'p2', companyId:'c2', updatedAt:'2026-10-03T11:00:00Z' },
  { id:'d', projectId:'p1', companyId:'c1', updatedAt:'2026-10-08T13:00:00Z' },
];
describe('explicit CRM quote relationships', () => {
  it('lists only project-linked quotes in most recent order', () => {
    expect(quotesForProject({ id:'p1' },quotes).map(q=>q.id)).toEqual(['d','a']);
  });
  it('finds company-linked quotes via company or an explicitly connected project without duplicates', () => {
    const projects=[{id:'p1',companyId:'c1'},{id:'p2',companyId:'c2'}];
    expect(quotesForCompany({id:'c1'},projects,quotes).map(q=>q.id)).toEqual(['d','b','a']);
  });
  it('does not match unrelated companies just because of similar names', () => {
    expect(quotesForCompany({id:'unlinked'},[{id:'p1',companyId:'c1'}],quotes)).toEqual([]);
  });
});
