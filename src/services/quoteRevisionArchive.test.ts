import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {useQuoteStore} from '../store/quoteStore';
import type {Quote} from '../types/quote';
import {createQuoteRevisionSnapshot} from './quoteIntegrity';
import {historicalCustomerQuote} from './quoteRevisionView';

const originalState=useQuoteStore.getState();
beforeEach(()=>{
  const storage=new Map<string,string>();
  vi.stubGlobal('localStorage',{
    setItem:(key:string,val:string)=>{storage.set(key,val);},
    getItem:(key:string)=>storage.get(key)??null,
    removeItem:(key:string)=>storage.delete(key),
  });
});
afterEach(()=>{useQuoteStore.setState(originalState);vi.unstubAllGlobals();});

const fixture=():Quote=>{
  const q={
    id:'archive-test',quoteNumber:'WS-123',documentType:'quote',
    originalQuoteDate:'2026-10-15',quoteDate:'2026-10-15',
    revision:0,status:'Sent',title:'Original customer document',
    companyName:'Test customer',sections:[],lines:[{
      id:'price',kind:'item',description:'Installed counters',
      pricingMode:'direct',amount:725,customerVisible:true,includeInTotal:true,
    }],
    customerColumns:{quantity:true,rate:true,lineAmount:true},
    customerNotes:'Original terms',internalNotes:'Private note',
    history:[],createdAt:'2026-10-15T12:00:00Z',updatedAt:'2026-10-15T12:00:00Z',
  } as Quote;
  q.history=[createQuoteRevisionSnapshot(q,'2026-10-15T12:30:00Z','Sent')];
  return q;
};
describe('18F archive/restore never rewrites issued customer copies',()=>{
  it('archive then restore keeps frozen total, scope, revision and status untouched',()=>{
    const q=fixture();
    useQuoteStore.setState({quotes:[q],activeQuoteId:q.id,hydrated:true});
    useQuoteStore.getState().archiveQuote(q.id);
    const archived=useQuoteStore.getState().quotes[0];
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.status).toBe('Sent');
    expect(archived.history[0].customerTotal).toBe(725);
    expect(historicalCustomerQuote(archived,archived.history[0]).customerNotes).toBe('Original terms');
    useQuoteStore.getState().restoreQuote(q.id);
    const restored=useQuoteStore.getState().quotes[0];
    expect(restored.archivedAt).toBeUndefined();
    expect(restored.revision).toBe(0);
    expect(restored.status).toBe('Sent');
    expect(restored.history).toEqual(q.history);
    expect(restored.lines).toEqual(q.lines);
  });
  it('delete on an issued document archives instead of deleting its historical record',()=>{
    const q=fixture();
    useQuoteStore.setState({quotes:[q],activeQuoteId:q.id,hydrated:true});
    useQuoteStore.getState().deleteQuote(q.id);
    const saved=useQuoteStore.getState().quotes.find(item=>item.id===q.id);
    expect(saved).toBeDefined();
    expect(saved?.archivedAt).toBeTruthy();
    expect(saved?.history[0].customerTotal).toBe(725);
  });
});
