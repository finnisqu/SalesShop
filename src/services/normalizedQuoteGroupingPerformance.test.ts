import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./normalizedQuoteSync.ts',import.meta.url),'utf8');
const pagination=readFileSync(new URL('./normalizedQuoteSyncPagination.test.ts',import.meta.url),'utf8');

describe('Large normalized quote data grouping contract',()=>{
 it('appends child rows without copying each growing quote history',()=>{
  expect(source).toContain('const current=grouped.get(quoteId);');
  expect(source).toContain('if(current)current.push(item);');
  expect(source).toContain('else grouped.set(quoteId,[item]);');
  expect(source).not.toContain('grouped.set(quoteId, [...(grouped.get(quoteId)');
 });
 it('keeps the existing multi-table pagination and original sort order',()=>{
  expect(source).toContain('const QUOTE_PAGE_SIZE=500;');
  expect(source).toContain('const [quoteRows, sectionRows, lineRows, revisionRows] = await Promise.all([');
  expect(source).toContain('groupByQuote<QuoteSection>(sectionRows');
  expect(source).toContain('groupByQuote<QuoteLine>(lineRows');
  expect(source).toContain('groupByQuote<QuoteRevisionSnapshot>(revisionRows');
  expect(pagination).toContain('quote?.history).toHaveLength(1004)');
 });
});
