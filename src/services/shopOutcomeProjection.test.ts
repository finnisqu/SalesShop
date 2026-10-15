import { describe, expect, it } from 'vitest';
import type { SignatureRecord } from '../types/signature';
import { projectSignedShopOutcomes } from './shopOutcomeProjection';

const source: SignatureRecord = {
  id: 'signature-1',
  quoteId: 'quote-100',
  quoteNumber: 'WS-2026-101',
  revision: 2,
  signerName: 'Private Customer Name',
  signerEmail: 'private@example.com',
  method: 'drawn',
  strokes: [{id:'private-stroke',points:[{x:1,y:3}]}],
  consentText: 'Private signing consent',
  acceptedAt: '2026-10-14T19:00:00Z',
  acceptedSnapshot: {
    quoteId: 'quote-100',
    quoteNumber: 'WS-2026-101',
    revision: 2,
    documentType: 'quote',
    quoteDate: '2026-10-14',
    title: 'Accepted kitchen scope',
    projectId: 'project-1',
    companyName: 'Customer Company',
    contactName: 'Sensitive Contact',
    contactEmail: 'contact@example.com',
    address: 'Sensitive Job Address',
    sections: [{id:'kitchen',title:'Kitchen',customerVisible:true}],
    lines: [{
      id:'line-1',kind:'material',sectionId:'kitchen',
      description:'Private margin and brand reference',
      pricingMode:'lump-sum',amount:1750,customerVisible:true,
      includeInTotal:true,internalCost:499,
    }],
    customerColumns: {quantity:true,rate:true,lineAmount:true},
    customerNotes:'Private customer message',
    acceptedTotal:1750,
  },
};

describe('signed shop outcome allowlist (not a permission boundary)',()=>{
  it('projects only signed acceptance evidence and its operational amount',()=>{
    const result=projectSignedShopOutcomes([source]);
    expect(result).toEqual([{
      kind:'signed-customer-commitment',
      signatureId:'signature-1',
      quoteId:'quote-100',
      quoteNumber:'WS-2026-101',
      revision:2,
      documentType:'quote',
      title:'Accepted kitchen scope',
      projectId:'project-1',
      companyName:'Customer Company',
      acceptedAt:'2026-10-14T19:00:00Z',
      acceptedTotal:1750,
    }]);
  });

  it('does not leak costs, signer identity, contact info, address, notes or revisions',()=>{
    const json=JSON.stringify(projectSignedShopOutcomes([source]));
    for(const secret of [
      '499','Private Customer Name','private@example.com','private-stroke',
      'Sensitive Contact','contact@example.com','Sensitive Job Address',
      'Private margin and brand reference','Private customer message',
      'Private signing consent','sections','lines','internalCost','strokes',
    ]) expect(json).not.toContain(secret);
  });

  it('never manufactures outcomes from drafts or unsigned quotes',()=>{
    expect(projectSignedShopOutcomes([])).toEqual([]);
    // The input must be actual signed records, not a Quote with status 'Signed'.
    expect(projectSignedShopOutcomes([{...source,id:'signature-2',acceptedAt:'not-a-date'}])).toEqual([]);
  });

  it('deduplicates repeated signature rows but retains separately signed revisions',()=>{
    const second={...source,id:'signature-2',acceptedAt:'2026-10-15T19:00:00Z',
      acceptedSnapshot:{...source.acceptedSnapshot,revision:3,acceptedTotal:2250}};
    const outcomes=projectSignedShopOutcomes([source,source,second]);
    expect(outcomes.map(outcome=>outcome.signatureId)).toEqual(['signature-2','signature-1']);
    expect(outcomes.map(outcome=>outcome.acceptedTotal)).toEqual([2250,1750]);
  });
});
