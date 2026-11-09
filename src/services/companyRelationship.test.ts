import {describe,expect,it} from 'vitest';
import type {Company} from '../types/crm';
import {companyRelationship,companyRelationshipLabel,companyRelationshipPatch,
 companyMatchesRelationship,visibleCompanyAliases,RELATIONSHIP_MARKERS,
 OUR_COMPANY_MARKER,isOurCompany,ourCompanyPatch} from './companyRelationship';
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
 it('marks a normal Company as SELF without turning it into a customer or hiding it',()=>{
   const existing={...base,kind:'non-customer' as const,aliases:['WSI']};
   const own={...existing,...ourCompanyPatch(existing,true)};
   expect(isOurCompany(own)).toBe(true);
   expect(companyRelationshipLabel(own)).toBe('Our Company');
   expect(companyMatchesRelationship(own,'self')).toBe(true);
   expect(companyMatchesRelationship(own,'all')).toBe(true);
   expect(companyMatchesRelationship(own,'partner')).toBe(false);
   expect(companyMatchesRelationship(own,'prospect')).toBe(false);
   expect(companyMatchesRelationship(own,'customer')).toBe(false);
   expect(visibleCompanyAliases(own)).toEqual(['WSI']);
   expect(companyIdentityKeys(own)).toEqual(new Set(['acme','wsi']));
   expect(own.aliases).toContain(OUR_COMPANY_MARKER);
   const reverted={...own,...ourCompanyPatch(own,false)};
   expect(isOurCompany(reverted)).toBe(false);
   expect(companyRelationshipLabel(reverted)).toBe('Partner / other');
   expect(reverted.aliases).toEqual(['WSI']);
 });
 it('does not show or identity-match internal classification markers',()=>{
   const prospect={...base,...companyRelationshipPatch(base,'prospect')};
   expect(visibleCompanyAliases(prospect)).toEqual(['Acme Co']);
   expect(companyIdentityKeys(prospect)).toEqual(new Set(['acme','acme co']));
 });
});
