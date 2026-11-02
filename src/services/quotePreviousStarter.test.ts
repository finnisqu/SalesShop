import {describe,expect,it} from 'vitest';
import {previousSalesDocuments} from './salesDocumentTemplates';
import type {Quote} from '../types/quote';
const doc=(id:string,documentType:'quote'|'pricing-schedule'|'change-order',archived=false):Quote=>({
 id,title:id,documentType,status:'Draft',updatedAt:'2026-11-01T12:00:00Z',
 ...(archived?{archivedAt:'2026-11-01T12:00:00Z'}:{}),
 sections:[],lines:[],pricingSchedule:documentType==='pricing-schedule'
  ?{route:'rate-sheet',publishSource:'rate-sheet',customerItems:[]}:undefined,
} as unknown as Quote);
describe('previous-document starter choices',()=>{
 const quotes=[doc('quick','quote'),doc('archived','quote',true),
  doc('schedule','pricing-schedule'),doc('change-order','change-order')];
 it('allows active Quick Quotes, excluding archived quotes, schedules and change orders',()=>{
  expect(previousSalesDocuments(quotes,'quick-quote').map(q=>q.id)).toEqual(['quick']);
 });
 it('only offers matching schedule types and never crosses into ordinary quotes',()=>{
  expect(previousSalesDocuments(quotes,'builder-rates').map(q=>q.id)).toEqual(['schedule']);
  expect(previousSalesDocuments(quotes,'spreadsheet')).toEqual([]);
 });
 it('never offers a starter for an incomplete selection or placeholder',()=>{
  expect(previousSalesDocuments(quotes,null)).toEqual([]);
  expect(previousSalesDocuments(quotes,'multifamily')).toEqual([]);
 });
});
