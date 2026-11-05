import {describe,expect,it} from 'vitest';
import type {Contact,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import {quotesForCompany,quotesForProject} from './quoteCrmLinks';
import {indexConnectionsCounts} from './connectionsCountIndex';

const project=(id:string,companyId?:string):Pick<Project,'id'|'companyId'>=>({id,companyId});
const quote=(id:string,companyId?:string,projectId?:string,archivedAt?:string):
 Pick<Quote,'id'|'companyId'|'projectId'|'updatedAt'|'archivedAt'>=>({
 id,companyId,projectId,updatedAt:'2026-11-05T12:00:00Z',archivedAt,
});

describe('Connections indexed directory counts',()=>{
 it('matches explicit company and Deal quote links, including double links',()=>{
  const companies=[{id:'a'},{id:'b'},{id:'c'}];
  const projects=[project('p1','a'),project('p2','b'),project('p3','a')];
  const quotes=[
   quote('both','a','p1'),quote('cross','b','p1'),
   quote('onlyDeal',undefined,'p3'),quote('onlyCompany','c'),
   quote('unlinked'),quote('archived','a','p2','2026-11-04')
  ];
  const contacts:Pick<Contact,'companyId'>[]=[
   {companyId:'a'},{companyId:'a'},{companyId:'b'},{}
  ];
  const idx=indexConnectionsCounts(contacts,projects,quotes);
  for(const company of companies){
   const expected=quotesForCompany(company,projects,quotes).filter(q=>!q.archivedAt).length;
   expect(idx.quotesByCompany.get(company.id)??0).toBe(expected);
  }
  for(const deal of projects){
   expect(idx.quotesByDeal.get(deal.id)??0).toBe(
    quotesForProject(deal,quotes).filter(q=>!q.archivedAt).length);
  }
  expect(idx.quotesByCompany.get('a')).toBe(3);
  expect(idx.quotesByCompany.get('b')).toBe(1);
  expect(idx.peopleByCompany.get('a')).toBe(2);
  expect(idx.dealsByCompany.get('a')).toBe(2);
 });
 it('does not accidentally link a quote merely because company names match',()=>{
  const quotes=[quote('stranger',undefined,'not-a-deal'),quote('visible','abc')];
  const idx=indexConnectionsCounts([],[],quotes);
  expect(idx.quotesByCompany.get('abc')).toBe(1);
  expect(idx.quotesByCompany.get('unknown')).toBeUndefined();
  expect(idx.quotesByDeal.get('not-a-deal')).toBe(1);
 });
 it('does not mutate the source arrays',()=>{
  const contacts=[{companyId:'a'}],projects=[project('p1','a')],quotes=[quote('a','a')];
  const before=JSON.stringify({contacts,projects,quotes});
  indexConnectionsCounts(contacts,projects,quotes);
  expect(JSON.stringify({contacts,projects,quotes})).toBe(before);
 });
});
