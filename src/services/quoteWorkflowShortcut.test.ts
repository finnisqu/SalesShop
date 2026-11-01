import { describe, expect, it } from 'vitest';
import type { Quote } from '../types/quote';
import { nextQuoteAreaShortcut, nextQuoteAreaAfter } from './quoteWorkflowShortcut';

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
  it('advances existing Areas in sequence instead of silently creating duplicates', () => {
    const sections = [
      {id:'general',title:'General Takeoffs'},
      {id:'kitchen',title:'Kitchen'},
      {id:'bath',title:'Bath'},
      {id:'island',title:'Island'},
    ] as Quote['sections'];
    const quote = draft({sections});
    const before = JSON.stringify(quote);
    expect(nextQuoteAreaAfter(quote,'general')).toEqual({kind:'open',areaId:'kitchen',label:'Next: Kitchen ›'});
    expect(nextQuoteAreaAfter(quote,'kitchen')).toEqual({kind:'open',areaId:'bath',label:'Next: Bath ›'});
    expect(nextQuoteAreaAfter(quote,'bath')).toEqual({kind:'open',areaId:'island',label:'Next: Island ›'});
    expect(nextQuoteAreaAfter(quote,'island')).toEqual({kind:'create',label:'+ Add Area ›'});
    expect(JSON.stringify(quote)).toBe(before);
  });
  it('never creates an Area for issued quotes or unrelated Area IDs', () => {
    const sections=[{id:'one',title:'Kitchen'}, {id:'two',title:'Vanity'}] as Quote['sections'];
    expect(nextQuoteAreaAfter(draft({sections,status:'Sent'}),'one')).toMatchObject({kind:'open',areaId:'two'});
    expect(nextQuoteAreaAfter(draft({sections,status:'Sent'}),'two')).toBeNull();
    expect(nextQuoteAreaAfter(draft({sections}),'stale-id')).toBeNull();
    expect(nextQuoteAreaAfter(draft({sections,documentType:'pricing-schedule'}),'one')).toBeNull();
  });
});
