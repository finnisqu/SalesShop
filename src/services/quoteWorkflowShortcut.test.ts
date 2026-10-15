import { describe, expect, it } from 'vitest';
import type { Quote } from '../types/quote';
import { nextQuoteAreaShortcut } from './quoteWorkflowShortcut';

const draft = (patch: Partial<Quote> = {}) =>
  ({ id: 'quote-1', status: 'Draft', documentType: 'quote', sections: [], ...patch } as Quote);

describe('Fast, explicit Details to Area quote navigation', () => {
  it('offers to create an Area only on an editable quote with no Areas', () => {
    expect(nextQuoteAreaShortcut(draft())).toEqual({kind:'create',label:'+ Start first Area ›'});
    expect(nextQuoteAreaShortcut(draft({status:'Sent'}))).toBeNull();
  });
  it('navigates existing Areas by ID and never treats General Takeoffs as an Area', () => {
    const quote=draft({sections:[
      {id:'general',title:'General Takeoffs'} as Quote['sections'][number],
      {id:'kitchen',title:'Kitchen'} as Quote['sections'][number],
      {id:'bath',title:'Bath'} as Quote['sections'][number],
    ]});
    expect(nextQuoteAreaShortcut(quote)).toEqual({kind:'open',areaId:'kitchen',label:'Continue to Kitchen ›'});
    expect(nextQuoteAreaShortcut({...quote,status:'Sent'})).toMatchObject({kind:'open',areaId:'kitchen'});
  });
  it('never creates a countertop Area inside a pricing schedule', () => {
    expect(nextQuoteAreaShortcut(draft({documentType:'pricing-schedule'}))).toBeNull();
  });
});
