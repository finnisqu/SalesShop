import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {quoteBuilderProgress} from './quoteBuilderProgress';

const draft=(patch:Partial<Quote>={})=>({id:'sample',title:'Test quote',documentType:'quote',
 status:'Draft',lines:[],sections:[],...patch} as Quote);
const charge=()=>({id:'c',kind:'item',includeInTotal:true,customerVisible:true,
 pricingMode:'direct',amount:250,description:'Trip charge'} as Quote['lines'][number]);
const stage=(q:Quote,id:string)=>quoteBuilderProgress(q).stages.find(s=>s.id===id)!;
describe('single-workspace five-stage quote progress',()=>{
 it('starts with optional details and optional Areas',()=>{
  const q=draft();
  expect(stage(q,'details')).toMatchObject({status:'Optional',state:'pending'});
  expect(stage(q,'areas')).toMatchObject({status:'Optional',state:'pending'});
  expect(stage(q,'pricing').status).toBe('Add priced work');
  expect(stage(q,'review').status).toBe('Awaiting prices');
  expect(stage(q,'contract').status).toBe('Not issued');
  expect(quoteBuilderProgress(q).stages.map(x=>x.label)).toEqual([
   'Project details','Takeoffs','Selections & pricing','Pricing review','Contract review']);
 });
 it('allows a priced General-only quick quote',()=>{
  const q=draft({lines:[charge()]});
  expect(stage(q,'areas')).toMatchObject({status:'General scope',state:'done'});
  expect(stage(q,'pricing')).toMatchObject({status:'Prices entered',state:'done'});
  expect(stage(q,'details').state).toBe('pending');
  expect(stage(q,'contract').state).toBe('pending');
 });
 it('keeps pricing issues sourced from the existing quote audit without mutating data',()=>{
  const q=draft({companyName:'Customer A',sections:[{id:'k',title:'Kitchen'} as Quote['sections'][number]],
   lines:[charge(),{...charge(),id:'bad',pricingMode:'quantity-rate',rate:undefined,quantity:2,sectionId:'k'}]});
  const before=JSON.stringify(q);
  expect(stage(q,'areas').status).toBe('1 Area');
  expect(stage(q,'details').state).toBe('done');
  expect(stage(q,'pricing')).toMatchObject({state:'attention',status:'1 issue'});
  expect(stage(q,'review').state).toBe('attention');
  expect(JSON.stringify(q)).toBe(before);
 });
 it('contract review is complete only for an actually issued document',()=>{
  const q=draft({lines:[charge()]});
  expect(stage({...q,status:'Ready'},'contract').state).toBe('pending');
  expect(stage({...q,status:'Sent'},'contract')).toMatchObject({status:'Issued',state:'done'});
  expect(stage({...q,status:'Signed'},'contract')).toMatchObject({status:'Signed',state:'done'});
 });
});
