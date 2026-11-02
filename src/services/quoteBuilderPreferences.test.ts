import {afterEach,describe,expect,it,vi} from 'vitest';
import {defaultQuoteBuilderPreferences,parseQuoteBuilderPreferences,
 quoteBuilderPreferenceScope,readQuoteBuilderPreferences,writeQuoteBuilderPreferences,
 QUOTE_GENERAL_QUICK_ADDS} from './quoteBuilderPreferences';

afterEach(()=>vi.unstubAllGlobals());
describe('My Quote Builder preferences',()=>{
 it('defaults to compact rows with the most common General quick adds',()=>{
  expect(defaultQuoteBuilderPreferences()).toEqual({
   density:'compact',favoriteQuickAdds:['item','material','sink'],
  });
 });
 it('validates favorites, deduplicates entries and ignores unknown fields',()=>{
  expect(parseQuoteBuilderPreferences({density:'comfortable',
   favoriteQuickAdds:['item','item','rate','unknown',null],
   privateQuote:'not stored'})).toEqual({
    density:'comfortable',favoriteQuickAdds:['item','rate'],
  });
  expect(parseQuoteBuilderPreferences('nope')).toEqual(defaultQuoteBuilderPreferences());
  expect(QUOTE_GENERAL_QUICK_ADDS).toHaveLength(5);
 });
 it('keeps personal settings scoped to organization and account',()=>{
  const a=quoteBuilderPreferenceScope('cloud','company1','sales1');
  const b=quoteBuilderPreferenceScope('cloud','company1','sales2');
  const c=quoteBuilderPreferenceScope('cloud','company2','sales1');
  const values=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,
   setItem:(k:string,v:string)=>{values.set(k,v);}});
  expect(writeQuoteBuilderPreferences(a,{density:'comfortable',favoriteQuickAdds:['rate','note']})).toBe(true);
  expect(readQuoteBuilderPreferences(a).density).toBe('comfortable');
  expect(readQuoteBuilderPreferences(b)).toEqual(defaultQuoteBuilderPreferences());
  expect(readQuoteBuilderPreferences(c)).toEqual(defaultQuoteBuilderPreferences());
  expect(quoteBuilderPreferenceScope('cloud','company1',null)).toBeNull();
  expect(writeQuoteBuilderPreferences(null,{density:'compact',favoriteQuickAdds:[]})).toBe(false);
 });
 it('gracefully falls back when browser storage is unavailable',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error('off');},setItem:()=>{throw Error('off');}});
  expect(readQuoteBuilderPreferences('local-device')).toEqual(defaultQuoteBuilderPreferences());
  expect(writeQuoteBuilderPreferences('local-device',defaultQuoteBuilderPreferences())).toBe(false);
 });
});
