import {describe,expect,it} from 'vitest';
import type {Activity} from '../types/crm';
import {activityRelations,primaryActivityRelations,activityMethodSummary} from './activityRelations';

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
 it('respects an explicitly removed association and deduplicates records',()=>{
  const links=[{type:'contact' as const,id:'person-bryan'}];
  expect(activityRelations({...event,metadata:{relatedRecords:links}})).toEqual(links);
  expect(primaryActivityRelations(links).companyId).toBeUndefined();
  expect(activityRelations({...event,metadata:{relatedRecords:[links[0],links[0]]}})).toHaveLength(1);
 });
});
