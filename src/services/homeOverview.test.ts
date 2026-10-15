import {describe,it,expect} from 'vitest';
import {personalHomeQuotes,homeRecentQuotes,homeMonthlyMetrics} from './homeOverview';
import type {Quote} from '../types/quote';
const make=(id:string,ownerUserId?:string):Quote=>({id,ownerUserId,status:'Draft',title:id,updatedAt:'2026-10-12T10:00:00Z',lines:[],sections:[],history:[],customerColumns:{quantity:false,rate:false,lineAmount:true}} as unknown as Quote);
describe('private Home overview',()=>{
 it('shows only the authenticated rep records in cloud, never unowned legacy or coworkers',()=>{
   const records=[make('mine','A'),make('their','B'),make('legacy')];
   expect(personalHomeQuotes(records,'A',true).map(q=>q.id)).toEqual(['mine']);
   expect(personalHomeQuotes(records,undefined,true)).toEqual([]);
   expect(personalHomeQuotes(records,undefined,false)).toHaveLength(3);
 });
 it('keeps most recently edited quotes first',()=>{
   const older=make('older','A'),newer={...make('newer','A'),updatedAt:'2026-10-14T11:00:00Z'};
   expect(homeRecentQuotes([older,newer],1).map(q=>q.id)).toEqual(['newer']);
 });
 it('counts signatures and sends by actual timestamps, not draft status guesses',()=>{
   const signed={...make('signed','A'),status:'Signed' as const,sentAt:'2026-10-07T18:00:00Z',signedAt:'2026-10-09T18:00:00Z'};
   const draft=make('draft','A');
   const report=homeMonthlyMetrics([signed,draft],new Date('2026-10-15T12:00:00Z'));
   expect(report.sent).toBe(1);expect(report.signed).toBe(1);expect(report.signedValue).toBe(0);
 });
});
