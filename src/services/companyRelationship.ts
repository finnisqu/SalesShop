import type {Company,CompanyKind,CompanyPatch} from '../types/crm';

export type CompanyRelationship='prospect'|'customer'|'partner'|'unclassified';
export type EditableCompanyRelationship=Exclude<CompanyRelationship,'unclassified'>;
/** Organization's own business is a CRM Company too, not a customer or prospect. */
export const OUR_COMPANY_MARKER='__ss_our_company_self_v1__';
export const isOurCompany=(company:Pick<Company,'aliases'>):boolean=>
 Boolean(company.aliases?.includes(OUR_COMPANY_MARKER));
export function ourCompanyPatch(company:Pick<Company,'aliases'>,selected:boolean):Pick<Company,'aliases'>{
 const aliases=(company.aliases??[]).filter(value=>value!==OUR_COMPANY_MARKER);
 return {aliases:selected?[...aliases,OUR_COMPANY_MARKER]:aliases};
}

/**
 * The existing normalized CRM schema only has customer/non-customer.
 * Keep the user-visible Prospect/Customer distinction in company aliases
 * until a schema-backed properties release. No database migration required.
 */
export const RELATIONSHIP_MARKERS={
 prospect:'__ss_account_prospect_v1__',
 customer:'__ss_account_customer_v1__',
} as const;
export function isInternalCrmAlias(value:string){
 return value.startsWith('__ss_')&&value.endsWith('__');
}
export function visibleCompanyAliases(company:Pick<Company,'aliases'>):string[]{
 return (company.aliases??[]).filter(a=>!isInternalCrmAlias(a));
}
export function companyRelationship(company:Pick<Company,'kind'|'aliases'>):CompanyRelationship{
 if(company.kind==='non-customer')return 'partner';
 if(company.aliases?.includes(RELATIONSHIP_MARKERS.prospect))return 'prospect';
 if(company.aliases?.includes(RELATIONSHIP_MARKERS.customer))return 'customer';
 return 'unclassified'; // preserve legacy records rather than guessing
}
export function companyRelationshipLabel(company:Pick<Company,'kind'|'aliases'>):string{
 if(isOurCompany(company))return 'Our Company';
 const relationship=companyRelationship(company);
 return relationship==='prospect'?'Prospect':relationship==='customer'?'Customer':
  relationship==='partner'?'Partner / other':'Unclassified';
}
export function companyRelationshipPatch(company:Pick<Company,'aliases'>,
 relationship:EditableCompanyRelationship):CompanyPatch{
 const aliases=(company.aliases??[]).filter(a=>
  a!==RELATIONSHIP_MARKERS.prospect&&a!==RELATIONSHIP_MARKERS.customer);
 return {kind:relationship==='partner'?'non-customer' as CompanyKind:'customer' as CompanyKind,
  aliases:relationship==='partner'?aliases:[...aliases,RELATIONSHIP_MARKERS[relationship]]};
}
export function companyMatchesRelationship(company:Pick<Company,'kind'|'aliases'>,
 filter:CompanyRelationship|'self'|'all'):boolean{
 if(filter==='all')return true;
 if(isOurCompany(company))return filter==='self';
 return filter!=='self'&&companyRelationship(company)===filter;
}
