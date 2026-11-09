import {describe,expect,it} from 'vitest';
import type {Company} from '../types/crm';
import {companyRelationship,companyRelationshipLabel,companyRelationshipPatch,
 companyMatchesRelationship,visibleCompanyAliases,RELATIONSHIP_MARKERS} from './companyRelationship';
import {companyIdentityKeys} from './crmIdentity';
const base={id:'c1',name:'Acme',kind:'customer',aliases:['Acme Co'],createdAt:'2026-11-01',updatedAt:'2026-11-01'} as Company;

describe('explicit customer vs prospect relationships',()=>{
 it('never silently assumes legacy customer-kind records are Customers',()=>{
   expect(companyRelationship(base)).toBe('unclassified');
   expect(companyRelationshipLabel(base)).toContain('Unclassified');
   expect(companyMatchesRelationship(base,'customer')).toBe(false);
   expect(companyMatchesRelationship(base,'unclassified')).toBe(true);
 });
 it('separates Prospect, Customer and Partner while retaining non-status aliases',()=>{
   const prospect={...base,...companyRelationshipPatch(base,'prospect')};
   expect(prospect.kind).toBe('customer');
   expect(companyRelationship(prospect)).toBe('prospect');
   const customer={...prospect,...companyRelationshipPatch(prospect,'customer')};
   expect(companyRelationship(customer)).toBe('customer');
   expect(customer.aliases).not.toContain(RELATIONSHIP_MARKERS.prospect);
   expect(customer.aliases).toContain('Acme Co');
   const partner={...customer,...companyRelationshipPatch(customer,'partner')};
   expect(companyRelationship(partner)).toBe('partner');
   expect(partner.aliases).not.toContain(RELATIONSHIP_MARKERS.customer);
 });
 it('does not show or identity-match internal classification markers',()=>{
   const prospect={...base,...companyRelationshipPatch(base,'prospect')};
   expect(visibleCompanyAliases(prospect)).toEqual(['Acme Co']);
   expect(companyIdentityKeys(prospect)).toEqual(new Set(['acme','acme co']));
 });
});
