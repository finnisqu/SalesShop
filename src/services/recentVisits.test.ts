import {describe,it,expect} from 'vitest';
import {parseRecentVisits,rememberRecentVisit,recentVisitFromLocation,RECENT_VISIT_LIMIT} from './recentVisits';
import type {NavigationLocation} from '../store/navigationStore';

const location:NavigationLocation={
 view:'dashboard',catalogSection:'materials',focusedProjectId:null,focusedCompanyId:null,
 focusedContactId:null,focusedQuoteId:null,
};
describe('Recently visited routes',()=>{
 it('distinguishes records, quotes, notebooks and catalog sections',()=>{
  expect(recentVisitFromLocation({...location,focusedProjectId:'d1'})).toEqual({kind:'deal',id:'d1'});
  expect(recentVisitFromLocation({...location,focusedCompanyId:'c1'})).toEqual({kind:'company',id:'c1'});
  expect(recentVisitFromLocation({...location,focusedContactId:'p1'})).toEqual({kind:'person',id:'p1'});
  expect(recentVisitFromLocation({...location,view:'quotes',focusedQuoteId:'q1'})).toEqual({kind:'quote',id:'q1'});
  expect(recentVisitFromLocation({...location,view:'notebook'},'n1')).toEqual({kind:'notebook',id:'n1'});
  expect(recentVisitFromLocation({...location,view:'catalog',catalogSection:'sinks'})).toEqual({kind:'catalog',id:'sinks'});
 });
 it('moves revisited pages to the top, without duplicates or unbounded growth',()=>{
  let items=rememberRecentVisit([],{kind:'deal',id:'d1'});
  expect(rememberRecentVisit(items,{kind:'deal',id:'d1'})).toBe(items);
  for(let i=0;i<20;i++)items=rememberRecentVisit(items,{kind:'company',id:'c'+i});
  expect(items).toHaveLength(RECENT_VISIT_LIMIT);
  items=rememberRecentVisit(items,{kind:'company',id:'c17'});
  expect(items[0]).toEqual({kind:'company',id:'c17'});
  expect(items.filter(item=>item.id==='c17')).toHaveLength(1);
 });
 it('rejects invalid storage payloads and deduplicates valid destinations',()=>{
  expect(parseRecentVisits('{')).toEqual([]);
  expect(parseRecentVisits('{"other":"value"}')).toEqual([]);
  expect(parseRecentVisits(JSON.stringify([
   {kind:'company',id:'1'},{kind:'company',id:'1'}, {kind:'view',id:'hacked'},
   {kind:'catalog',id:'materials'}, {kind:'person',id:''}, null,
  ]))).toEqual([{kind:'company',id:'1'},{kind:'catalog',id:'materials'}]);
 });
});
