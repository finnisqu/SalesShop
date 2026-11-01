import { describe, expect, it } from 'vitest';
import type { Quote } from '../types/quote';
import { quotePricingOverview } from './quotePricingOverview';

const charge=(id:string,amount:number,sectionId?:string)=>({
  id, description:id, kind:'item',pricingMode:'direct',amount,
  includeInTotal:true,customerVisible:true,sectionId,
} as Quote['lines'][number]);
const draft=(patch:Partial<Quote>={})=>({
  id:'test-quote',title:'Sample',documentType:'quote',status:'Draft',sections:[],lines:[],...patch,
} as Quote);
describe('quote-wide pricing overview (read-only model)',()=>{
  it('includes General flat charges without forcing countertop Areas',()=>{
    const q=draft({lines:[charge('trip',175)]});
    const before=JSON.stringify(q);
    const v=quotePricingOverview(q);
    expect(v.rows).toHaveLength(0);
    expect(v.generalAmount).toBe(175);
    expect(v.generalLineCount).toBe(1);
    expect(v.blockers).toHaveLength(0);
    expect(JSON.stringify(q)).toBe(before);
  });
  it('separates Area totals from General and counts canonical pricing findings',()=>{
    const q=draft({
      sections:[{id:'kitchen',title:'Kitchen'} as Quote['sections'][number],
        {id:'bath',title:'Bath'} as Quote['sections'][number]],
      lines:[charge('trip',120),charge('tops',400,'kitchen'),
        {...charge('sink',0,'bath'),pricingMode:'quantity-rate',quantity:1,rate:undefined}],
    });
    const v=quotePricingOverview(q);
    expect(v.rows.map(r=>r.section.id)).toEqual(['kitchen','bath']);
    expect(v.rows[0].amount).toBe(400);
    expect(v.generalAmount).toBe(120);
    expect(v.rows[1].blockers).toBe(1);
    expect(v.blockers).toHaveLength(1);
  });
  it('keeps General takeoff charges in General, never an extra regular Area',()=>{
    const q=draft({sections:[{id:'general',title:'General Takeoffs'} as Quote['sections'][number]],
      lines:[charge('extra',45,'general')]});
    const v=quotePricingOverview(q);
    expect(v.rows).toHaveLength(0);
    expect(v.generalLineCount).toBe(1);
    expect(v.generalAmount).toBe(45);
  });
});
