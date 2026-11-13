import {describe,expect,it} from 'vitest';
import {normalizeCatalogVariantDefaults} from './catalogVariantDefaults';

const fixture=(active=[true,true,true],defaults=[false,false,false])=>active.map((value,i)=>({
 id:'variant-'+i,active:value,default:defaults[i]??false,label:'SKU '+i,
}));
describe('Batch 333a — one unambiguous active Catalog default',()=>{
 it('chooses the first active variant when there is no default',()=>{
  expect(normalizeCatalogVariantDefaults(fixture()).map(v=>v.default)).toEqual([true,false,false]);
 });
 it('keeps a valid default, but clears duplicate active defaults',()=>{
  expect(normalizeCatalogVariantDefaults(fixture(undefined,[false,true,true]))
   .map(v=>v.default)).toEqual([false,true,false]);
 });
 it('prefers a requested active SKU over the previous default',()=>{
  expect(normalizeCatalogVariantDefaults(fixture(undefined,[true,false,false]),'variant-2')
   .map(v=>v.default)).toEqual([false,false,true]);
 });
 it('rejects an inactive requested default and falls back to an available SKU',()=>{
  const source=fixture([true,false,true],[false,true,false]);
  expect(normalizeCatalogVariantDefaults(source,'variant-1')
   .map(v=>v.default)).toEqual([true,false,false]);
 });
 it('removes stale defaults when all variants are inactive',()=>{
  expect(normalizeCatalogVariantDefaults(fixture([false,false,false],[true,true,false]))
   .map(v=>v.default)).toEqual([false,false,false]);
 });
 it('does not mutate original variants or replace unchanged objects',()=>{
  const source=fixture([true,true,false],[false,true,false]);
  const before=structuredClone(source);
  const next=normalizeCatalogVariantDefaults(source);
  expect(source).toEqual(before);
  expect(next).not.toBe(source);
  expect(next[0]).toBe(source[0]);
  expect(next[1]).toBe(source[1]);
  expect(next[2]).toBe(source[2]);
 });
 it('handles empty variants and removing the default without inventing identity',()=>{
  expect(normalizeCatalogVariantDefaults([])).toEqual([]);
  const remaining=fixture([true,true,true],[false,true,false])
   .filter(v=>v.id!=='variant-1');
  const result=normalizeCatalogVariantDefaults(remaining);
  expect(result).toHaveLength(2);
  expect(result.filter(v=>v.default).map(v=>v.id)).toEqual(['variant-0']);
 });
});
