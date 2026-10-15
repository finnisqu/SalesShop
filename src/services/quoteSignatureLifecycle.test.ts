import {afterEach,describe,expect,it} from 'vitest';
import {useQuoteStore} from '../store/quoteStore';
import type {Quote} from '../types/quote';
import {completeQuoteSignature} from './signatureService';
import {createQuoteRevisionSnapshot} from './quoteIntegrity';

const initial=useQuoteStore.getState();
const q=(patch:Partial<Quote>={}):Quote=>({
  id:'signature-qc',quoteNumber:'Q-101',documentType:'quote',
  originalQuoteDate:'2026-10-15',quoteDate:'2026-10-15',revision:0,
  status:'Draft',title:'Kitchen',sections:[],lines:[{
    id:'top',kind:'item',description:'Install',pricingMode:'direct',amount:100,
    customerVisible:true,includeInTotal:true,
  }],customerColumns:{quantity:true,rate:true,lineAmount:true},
  customerNotes:'Original terms',internalNotes:'Private costs',history:[],
  createdAt:'2026-10-15T18:00:00Z',updatedAt:'2026-10-15T18:00:00Z',
  ...patch,
});
const acceptance={signerName:'Customer',method:'typed' as const,signatureText:'Customer',
  consentText:'I accept'};
afterEach(()=>useQuoteStore.setState(initial));
describe('18F in-person signing is acceptance, not silent issuing',()=>{
  it('refuses an unissued draft even if it is priced',async()=>{
    const quote=q();
    useQuoteStore.setState({quotes:[quote],activeQuoteId:quote.id,hydrated:true});
    await expect(completeQuoteSignature(quote.id,acceptance))
      .rejects.toThrow(/explicitly issue/);
    const latest=useQuoteStore.getState().quotes[0];
    expect(latest.status).toBe('Draft');
    expect(latest.history).toEqual([]);
  });
  it('refuses Ready, Archived, Expired and an issued record without a frozen revision',async()=>{
    for(const status of ['Ready','Expired','Declined'] as const){
      const quote=q({status});
      useQuoteStore.setState({quotes:[quote],hydrated:true});
      await expect(completeQuoteSignature(quote.id,acceptance)).rejects.toThrow(/explicitly issue/);
    }
    const archived=q({status:'Sent',archivedAt:'2026-10-15T19:00:00Z'});
    useQuoteStore.setState({quotes:[archived],hydrated:true});
    await expect(completeQuoteSignature(archived.id,acceptance)).rejects.toThrow(/explicitly issue/);
    const issued=q({status:'Sent'});
    useQuoteStore.setState({quotes:[issued],hydrated:true});
    await expect(completeQuoteSignature(issued.id,acceptance)).rejects.toThrow(/not frozen/);
  });
  it('uses a real issued revision snapshot as a prerequisite for signature receipt',()=>{
    const issued=q({status:'Sent'});
    const frozen=createQuoteRevisionSnapshot(issued,'2026-10-15T18:30:00Z','Sent');
    expect(frozen.customerTotal).toBe(100);
    expect(frozen.revision).toBe(issued.revision);
  });
});
