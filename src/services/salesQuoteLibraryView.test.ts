import {describe,expect,it} from 'vitest';
import type {SalesQuoteRecord} from './salesQuoteRegistry';
import {compareQuoteLibraryRecords,DEFAULT_QUOTE_LIBRARY_FILTERS,
 matchesQuoteLibraryRecord,quoteLibraryRecordDate,restoreQuoteLibraryFilters,
 type QuoteLibraryViewFilters} from './salesQuoteLibraryView';

const native:SalesQuoteRecord={
 id:'native:q1',source:'salesshop',sourceId:'q1',name:'Downtown Tower countertops',
 number:'Q-101',documentType:'Quote',companyName:'Pioneer Builder',
 projectId:'deal-one',dealName:'Commercial renovation',ownerUserId:'rep-1',
 status:'Sent',value:75000,sentDate:'2026-11-05',updatedAt:'2026-11-08T12:00:00Z',
};
const external:SalesQuoteRecord={
 id:'external:a1',source:'external',sourceId:'a1',name:'Apartments bid',
 number:'',documentType:'Quote',platform:'BuildingConnected',
 companyName:'Pioneer Builder',projectId:'deal-two',dealName:'Apartment shell',
 ownerUserId:'rep-2',status:'Sent',value:85000,sentDate:'2026-11-06',
 updatedAt:'2026-11-12T12:00:00Z',
};
const base:QuoteLibraryViewFilters={query:'',source:'all',owner:'all',from:'',to:''};
const matches=(record:SalesQuoteRecord,filter:Partial<QuoteLibraryViewFilters>,
 actor='rep-1',deals=new Set(['deal-two']))=>
 matchesQuoteLibraryRecord(record,{...base,...filter},actor,deals);

describe('one first-class Quotes library across both sources',()=>{
 it('finds either source by multiword customer/deal, quote number, platform or amount',()=>{
  expect(matches(native,{query:'pioneer 75000'})).toBe(true);
  expect(matches(native,{query:'Q-101 renovation'})).toBe(true);
  expect(matches(external,{query:'buildingconnected 85,000'})).toBe(true);
  expect(matches(external,{query:'Pioneer apartments'})).toBe(true);
  expect(matches(external,{query:'not-my-client'})).toBe(false);
 });
 it('supports source filters without hiding external quotes behind native templates',()=>{
  expect(matches(external,{source:'external'})).toBe(true);
  expect(matches(native,{source:'external'})).toBe(false);
  expect(matches(native,{source:'salesshop'})).toBe(true);
  expect(matches(external,{source:'salesshop'})).toBe(false);
 });
 it('uses recorded ownership and assigned Deals without assuming company-wide private draft access',()=>{
  expect(matches(native,{owner:'mine'})).toBe(true);
  expect(matches(external,{owner:'mine'})).toBe(false);
  expect(matches(external,{owner:'assigned'})).toBe(true);
  expect(matches(native,{owner:'assigned'})).toBe(false);
  expect(matches(external,{owner:'assigned'},'rep-1',new Set())).toBe(false);
 });
 it('treats sent date as activity date, updated date as fallback, and includes range endpoints',()=>{
  expect(quoteLibraryRecordDate(external)).toBe('2026-11-06');
  expect(matches(external,{from:'2026-11-06',to:'2026-11-06'})).toBe(true);
  expect(matches(external,{from:'2026-11-07'})).toBe(false);
  expect(matches(native,{to:'2026-11-04'})).toBe(false);
  const draft={...native,sentDate:undefined};
  expect(quoteLibraryRecordDate(draft)).toBe('2026-11-08');
 });
 it('sorts mixed source entries once, by the same selected column in Table and Cards',()=>{
  expect([native,external].sort((a,b)=>compareQuoteLibraryRecords(a,b,'recent'))
    .map(x=>x.id)).toEqual(['external:a1','native:q1']);
  expect([native,external].sort((a,b)=>compareQuoteLibraryRecords(a,b,'oldest'))
    .map(x=>x.id)).toEqual(['native:q1','external:a1']);
  expect([native,external].sort((a,b)=>compareQuoteLibraryRecords(a,b,'name'))
    .map(x=>x.id)).toEqual(['external:a1','native:q1']);
 });
 it('recovers only safe and valid session filters',()=>{
  expect(restoreQuoteLibraryFilters({source:'external',owner:'mine',
   query:'builder',from:'2026-11-01',to:'2026-11-12',sort:'name',
   template:'all',status:'issued'})).toMatchObject({
    source:'external',owner:'mine',query:'builder',from:'2026-11-01',
    to:'2026-11-12',sort:'name',
  });
  expect(restoreQuoteLibraryFilters({source:'invalid',from:'tomorrow',
   status:'not-a-status',sort:'random'})).toMatchObject({
    ...DEFAULT_QUOTE_LIBRARY_FILTERS,
  });
 });
});
