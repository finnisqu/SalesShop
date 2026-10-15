import {describe,expect,it} from 'vitest';
import {sanitizeSignedShopOutcomes} from './shopOutcomesReader';

const full = {
  kind:'signed-customer-commitment',signatureId:'s1',quoteId:'q1',
  quoteNumber:'Q-2026-011',revision:2,documentType:'quote',
  title:'Approved scope',projectId:'p1',companyName:'Customer Company',
  acceptedAt:'2026-10-15T12:00:00Z',acceptedTotal:2200.5,
  signerName:'Private signer',signerEmail:'signer@example.com',
  strokes:[{x:2,y:3}],internalCost:525,margin:45,
  contactName:'Private contact',contactEmail:'private@example.com',
  sections:[{private:true}],lines:[{private:true}],
  notes:'Private sales note',
};
describe('cloud shop outcomes response defense in depth',()=>{
  it('retains only the signed operational allowlist',()=>{
    expect(sanitizeSignedShopOutcomes([full])).toEqual([{
      kind:'signed-customer-commitment',signatureId:'s1',quoteId:'q1',
      quoteNumber:'Q-2026-011',revision:2,documentType:'quote',
      title:'Approved scope',projectId:'p1',companyName:'Customer Company',
      acceptedAt:'2026-10-15T12:00:00Z',acceptedTotal:2200.5,
    }]);
  });
  it('never keeps private cost, contact, signature or notebook fields',()=>{
    const output=JSON.stringify(sanitizeSignedShopOutcomes([full]));
    for(const secret of ['Private signer','signer@example.com','strokes','internalCost',
      'margin','Private contact','private@example.com','sections','lines','Private sales note']){
      expect(output).not.toContain(secret);
    }
  });
  it('rejects malformed signed evidence instead of displaying drafts',()=>{
    expect(sanitizeSignedShopOutcomes([
      {...full,kind:'draft'},{...full,acceptedTotal:'2200'},
      {...full,acceptedTotal:Infinity},{...full,acceptedAt:'not-a-date'},
      {...full,documentType:'unknown'},{...full,revision:-1},
      {...full,signatureId:''},null,
    ])).toEqual([]);
    expect(()=>sanitizeSignedShopOutcomes({outcomes:[full]})).toThrow('Invalid shop outcomes response.');
  });
  it('removes unexpected optional nested values without hiding legitimate signed records',()=>{
    const [safe]=sanitizeSignedShopOutcomes([{...full,projectId:{sensitive:'secret'},companyName:null}]);
    expect(safe).not.toHaveProperty('projectId');
    expect(safe).not.toHaveProperty('companyName');
    expect(safe.acceptedTotal).toBe(2200.5);
  });
});
