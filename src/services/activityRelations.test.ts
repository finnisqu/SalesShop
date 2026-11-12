import {describe,expect,it} from 'vitest';
import type {Activity} from '../types/crm';
import {activityRelations,primaryActivityRelations,activityMethodSummary,
 activityRelationsWithContext} from './activityRelations';

const event:Activity={
 id:'act1',type:'manual-touchpoint',summary:'Call with Aaron',
 contactId:'person-aaron',companyId:'company-h',
 occurredAt:'2026-11-03T15:00:00Z',metadata:{interactionMethod:'call',notes:'Discussed bid'},
};
describe('CRM Activity related records',()=>{
 it('shows original single-ID links for older activities',()=>{
  expect(activityRelations(event)).toEqual([
   {type:'contact',id:'person-aaron'},{type:'company',id:'company-h'},
  ]);
 });
 it('retains multiple People from JSON metadata while primary columns remain backward-compatible',()=>{
  const links=[
   {type:'contact' as const,id:'person-aaron',label:'Person · Aaron Case'},
   {type:'contact' as const,id:'person-bryan',label:'Person · Bryan Benoit'},
   {type:'company' as const,id:'company-h',label:'Company · H&H Multifamily'},
  ];
  expect(activityRelations({...event,metadata:{relatedRecords:links}})).toEqual(links);
  expect(primaryActivityRelations(links)).toEqual({
   contactId:'person-aaron',companyId:'company-h',projectId:undefined,quoteId:undefined,
  });
  expect(activityMethodSummary('call',links)).toBe('Call with Aaron Case');
 });
 it('materializes Person → Company, Quote → Deal → Company for CRM history and follow-up tasks',()=>{
  const explicit=[
   {type:'contact' as const,id:'contact-1',label:'Person · Paige'},
   {type:'quote' as const,id:'quote-1',label:'Quote · Apartment bid'},
  ];
  const result=activityRelationsWithContext(explicit,
   [{id:'contact-1',companyId:'company-1'}],
   [{id:'deal-1',companyId:'company-1'}],
   [{id:'quote-1',projectId:'deal-1'}]);
  expect(result).toEqual([
   ...explicit,
   {type:'company',id:'company-1'},
   {type:'project',id:'deal-1'},
  ]);
  expect(primaryActivityRelations(result)).toMatchObject({
   contactId:'contact-1',quoteId:'quote-1',projectId:'deal-1',companyId:'company-1',
  });
  expect(activityRelations({...event,metadata:{relatedRecords:result}})).toEqual(result);
 });
 it('prefers explicitly selected Company and does not re-add deleted links during Activity editing',()=>{
  const selected=[
   {type:'company' as const,id:'company-picked'},
   {type:'contact' as const,id:'contact-2'},
  ];
  const result=activityRelationsWithContext(selected,
   [{id:'contact-2',companyId:'company-parent'}],[],[]);
  expect(result.map(link=>link.id)).toEqual(['company-picked','contact-2','company-parent']);
  expect(primaryActivityRelations(result).companyId).toBe('company-picked');
  // The editor's explicit link list is intentionally authoritative.
  expect(primaryActivityRelations([{type:'contact',id:'contact-2'}]).companyId).toBeUndefined();
 });
 it('respects an explicitly removed association and deduplicates records',()=>{
  const links=[{type:'contact' as const,id:'person-bryan'}];
  expect(activityRelations({...event,metadata:{relatedRecords:links}})).toEqual(links);
  expect(primaryActivityRelations(links).companyId).toBeUndefined();
  expect(activityRelations({...event,metadata:{relatedRecords:[links[0],links[0]]}})).toHaveLength(1);
 });
});
