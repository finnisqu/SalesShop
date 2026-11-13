import {describe,expect,it} from 'vitest';
import {matchesCatalogSearch} from './catalogWorktableSearch';

describe('Catalog header + worktable search conjunction',()=>{
 const sink=['Kitchen 3218','Stainless steel','Undermount','Satin',
  'Stock supplier','3218-5050'];
 it('requires both search inputs to match independently rather than concatenating them',()=>{
  expect(matchesCatalogSearch(sink,'3218','satin')).toBe(true);
  expect(matchesCatalogSearch(sink,'satin','3218')).toBe(true);
  expect(matchesCatalogSearch(sink,'3218','brass')).toBe(false);
  expect(matchesCatalogSearch(sink,'','')).toBe(true);
 });
 it('preserves multiword phrases, trims whitespace and ignores capitalization',()=>{
  expect(matchesCatalogSearch(sink,' STAINLESS steel ','stock supplier')).toBe(true);
  expect(matchesCatalogSearch(sink,'stainless stock')).toBe(false);
  expect(matchesCatalogSearch(sink,'','  3218-5050  ')).toBe(true);
 });
 it('does not leak missing values into the searchable text',()=>{
  expect(matchesCatalogSearch(['White Quartz',null,undefined,12],'undefined')).toBe(false);
  expect(matchesCatalogSearch(['White Quartz',null,undefined,12],'12')).toBe(true);
 });
});
