import {describe,it,expect} from 'vitest';
import type {Activity} from '../types/crm';
import {confirmedQuoteDeliveries,quoteDeliveryLabel,quoteIssued,projectStageAfterDelivery,projectStageAfterIssue} from './quoteDeliveryLifecycle';

const event=(overrides:Partial<Activity>={}):Activity=>({
  id:'a1',type:'quote-sent',summary:'Customer delivery confirmed',
  quoteId:'quote-1',occurredAt:'2026-10-14T12:00:00.000Z',
  metadata:{source:'manual',revision:2,deliveryConfirmed:true,deliveryMethod:'email'},
  ...overrides,
});
describe('revision-specific customer delivery reporting',()=>{
  it('does not infer delivery from automatic issuing or link-related actions',()=>{
    expect(confirmedQuoteDeliveries({id:'quote-1',revision:2},[
      event({id:'old',metadata:{source:'quote',revision:2}}),
      event({id:'different',quoteId:'quote-2'}),
      event({id:'other-revision',metadata:{source:'manual',revision:1,deliveryConfirmed:true}}),
    ])).toEqual([]);
    expect(quoteDeliveryLabel({status:'Sent'},[])).toBe('Issued — delivery not confirmed');
  });
  it('reports only explicitly confirmed deliveries for the matching revision',()=>{
    const events=[
      event({id:'earlier',occurredAt:'2026-10-14T11:00:00.000Z'}),
      event({id:'later',occurredAt:'2026-10-14T13:00:00.000Z'}),
      event({id:'other',metadata:{source:'manual',revision:1,deliveryConfirmed:true}}),
    ];
    const found=confirmedQuoteDeliveries({id:'quote-1',revision:2},events);
    expect(found.map(x=>x.id)).toEqual(['later','earlier']);
    expect(quoteDeliveryLabel({status:'Sent'},found)).toBe('Customer delivery confirmed');
  });
  it('retains distinct quote lifecycle and delivery signals',()=>{
    expect(quoteIssued({status:'Draft'})).toBe(false);
    expect(quoteIssued({status:'Ready'})).toBe(false);
    expect(quoteIssued({status:'Sent'})).toBe(true);
    expect(quoteDeliveryLabel({status:'Viewed'},[])).toBe('Customer viewed');
    expect(quoteDeliveryLabel({status:'Signed'},[])).toBe('Signed by customer');
  });
  it('keeps project in bid development until actual customer delivery',()=>{
    for(const stage of ['Discovery','Intent to Bid'] as const){
      expect(projectStageAfterIssue(stage)).toBe('Bid Development');
      expect(projectStageAfterDelivery(stage,0)).toBe('Bid Sent');
    }
    expect(projectStageAfterIssue('Bid Development')).toBe(null);
    expect(projectStageAfterIssue('Bid Sent')).toBe(null);
    expect(projectStageAfterIssue('Negotiation')).toBe(null);
  });
  it('moves first delivery to Bid Sent and delivered revisions to Negotiation',()=>{
    expect(projectStageAfterDelivery('Bid Development',0)).toBe('Bid Sent');
    expect(projectStageAfterDelivery('Bid Development',2)).toBe('Bid Sent');
    expect(projectStageAfterDelivery('Bid Sent',0)).toBe(null);
    expect(projectStageAfterDelivery('Bid Sent',1)).toBe('Negotiation');
    expect(projectStageAfterDelivery('Negotiation',2)).toBe(null);
  });
  it('never regresses completed, won, lost, or inactive accounts',()=>{
    for(const stage of ['Closed Won','Completed','Closed Lost','Discarded'] as const){
      expect(projectStageAfterIssue(stage)).toBe(null);
      expect(projectStageAfterDelivery(stage,0)).toBe(null);
      expect(projectStageAfterDelivery(stage,5)).toBe(null);
    }
  });

});
