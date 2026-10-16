import {describe,expect,it} from 'vitest';
import {signedOutcome,type SignatureSource} from '../../supabase/functions/shop-outcomes/projection';

const evidence:SignatureSource={
  id:'signature_a',quote_id:'quote_a',revision:2,accepted_at:'2026-10-14T18:00:00.000Z',
  accepted_snapshot:{
    quoteNumber:'WS-100-R2',documentType:'quote',title:'Accepted countertop work',
    projectId:'project_a',companyName:'Customer Company',acceptedTotal:2450,
    signerName:'Private Signer',signerEmail:'signer@example.com',
    signatureText:'do not return',strokes:[{points:[{x:4,y:3}]}],
    contactName:'Private Customer',contactEmail:'contact@example.com',
    address:'Secret Site',internalNotes:'Private sales intelligence',
    quoteLines:[{description:'Private line details',internalCost:450,margin:77}],
    customerNotes:'Private customer notes',
  },
};

describe('signed-only Shop Outcomes Edge Function projection',()=>{
  it('returns exactly the operational allowlist',()=>{
    expect(signedOutcome(evidence)).toEqual({
      kind:'signed-customer-commitment',
      signatureId:'signature_a',quoteId:'quote_a',
      quoteNumber:'WS-100-R2',revision:2,documentType:'quote',
      title:'Accepted countertop work',projectId:'project_a',
      companyName:'Customer Company',acceptedAt:'2026-10-14T18:00:00.000Z',
      acceptedTotal:2450,
    });
  });
  it('cannot serialize signature identity, strokes, CRM intelligence or costs',()=>{
    const json=JSON.stringify(signedOutcome(evidence));
    for(const secret of ['Private Signer','signer@example.com','do not return',
      'Private Customer','contact@example.com','Secret Site','Private sales intelligence',
      'Private line details','Private customer notes','internalCost','margin','strokes','signatureText']){
      expect(json).not.toContain(secret);
    }
  });
  it('does not manufacture operational records without valid signed evidence',()=>{
    expect(signedOutcome({...evidence,accepted_snapshot:null})).toBeNull();
    expect(signedOutcome({...evidence,accepted_at:'invalid'})).toBeNull();
    expect(signedOutcome({...evidence,accepted_snapshot:{acceptedTotal:'2450'}})).toBeNull();
    expect(signedOutcome({...evidence,accepted_snapshot:{acceptedTotal:Infinity}})).toBeNull();
  });
  it('retains signed change orders and pricing schedules with safe document types',()=>{
    expect(signedOutcome({...evidence,accepted_snapshot:{acceptedTotal:1,documentType:'change-order'}})?.documentType).toBe('change-order');
    expect(signedOutcome({...evidence,accepted_snapshot:{acceptedTotal:1,documentType:'pricing-schedule'}})?.documentType).toBe('pricing-schedule');
    expect(signedOutcome({...evidence,accepted_snapshot:{acceptedTotal:1,documentType:'unknown'}})?.documentType).toBe('quote');
  });
});
