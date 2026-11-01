import { describe, expect, it } from 'vitest';
import type { Quote } from '../types/quote';
import { quoteBuilderProgress } from './quoteBuilderProgress';

const draft=(patch:Partial<Quote>={})=>({
  id:'sample',title:'Test quote',documentType:'quote',status:'Draft',
  lines:[],sections:[],...patch,
} as Quote);
const charge=()=>({
  id:'charge-1',kind:'item',includeInTotal:true,customerVisible:true,
  pricingMode:'direct',amount:250,description:'Trip charge',
} as Quote['lines'][number]);
const stage=(quote:Quote,id:string)=>quoteBuilderProgress(quote).stages.find(s=>s.id===id)!;

describe('nonlinear quote builder progress',()=>{
  it('never treats optional customer or an empty Area list as an issue',()=>{
    const q=draft();
    expect(stage(q,'details')).toMatchObject({status:'Optional',state:'pending'});
    expect(stage(q,'areas')).toMatchObject({status:'Optional',state:'pending'});
    expect(stage(q,'pricing').status).toBe('Add priced work');
    expect(stage(q,'review').status).toBe('Not reviewed');
  });
  it('treats a simple priced General charge as valid without mandatory Areas',()=>{
    const q=draft({lines:[charge()]});
    expect(stage(q,'areas')).toMatchObject({status:'General scope',state:'done'});
    expect(stage(q,'pricing')).toMatchObject({status:'Ready to review',state:'done'});
    expect(stage(q,'details').state).toBe('pending');
    expect(stage(q,'review').state).toBe('pending');
  });
  it('shows existing Area count and reuses audit blockers, without changing data',()=>{
    const q=draft({companyName:'Customer A',
      sections:[{id:'k',title:'Kitchen'} as Quote['sections'][number]],
      lines:[charge(),{...charge(),id:'missing-rate',pricingMode:'quantity-rate',rate:undefined,quantity:2,sectionId:'k'}]});
    const before=JSON.stringify(q);
    expect(stage(q,'areas').status).toBe('1 Area');
    expect(stage(q,'details').state).toBe('done');
    expect(stage(q,'pricing')).toMatchObject({state:'attention',status:'1 issue'});
    expect(JSON.stringify(q)).toBe(before);
  });
  it('does not pretend preview or draft means a quote was issued',()=>{
    const q=draft({lines:[charge()]});
    expect(stage({...q,status:'Ready'},'review').state).toBe('pending');
    expect(stage({...q,status:'Sent'},'review')).toMatchObject({status:'Issued',state:'done'});
    expect(stage({...q,status:'Signed'},'review')).toMatchObject({status:'Signed',state:'done'});
  });
});
