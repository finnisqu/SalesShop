import type {Company,Contact} from '../types/crm';

/**
 * Internal roster backed by two tagged, non-customer CRM companies.
 * Reuses normalized company/contact persistence without a new migration.
 * This is a contact directory, not a Team login or permissions manager.
 */
export type RosterGroup='employees'|'subcontractors';
export const OUR_ORG_GROUPS:ReadonlyArray<{id:RosterGroup;title:string;companyName:string;marker:string}>=[
 {id:'employees',title:'Employees',companyName:'SalesShop · Internal Employees',marker:'__ss_our_org_employees_v1__'},
 {id:'subcontractors',title:'Subcontractors',companyName:'SalesShop · Internal Subcontractors',marker:'__ss_our_org_subcontractors_v1__'},
];
export const ourOrgGroup=(company:Company):RosterGroup|undefined=>
 OUR_ORG_GROUPS.find(group=>company.aliases?.includes(group.marker))?.id;
export const isOurOrgCompany=(company:Company)=>Boolean(ourOrgGroup(company));
export function ourOrgCompanyIds(companies:readonly Company[]):Set<string>{
 return new Set(companies.filter(isOurOrgCompany).map(item=>item.id));
}
const MEMBER_PREFIX='__ss_our_org_sub_member_v1_';
const ROLE_PREFIX='__ss_our_org_role_v1_';
export const ourOrgMemberMarker=(contactId:string)=>MEMBER_PREFIX+encodeURIComponent(contactId)+'__';
export const ourOrgRoleMarker=(role:string)=>ROLE_PREFIX+encodeURIComponent(role.trim())+'__';
const storedRole=(alias:string):string|undefined=>{
 if(!alias.startsWith(ROLE_PREFIX)||!alias.endsWith('__'))return undefined;
 try{return decodeURIComponent(alias.slice(ROLE_PREFIX.length,-2))}catch{return undefined}
};
export function rosterGroupForContact(contact:Contact,companies:readonly Company[]):RosterGroup|undefined{
 const group=companies.find(c=>c.id===contact.companyId);
 const direct=group?ourOrgGroup(group):undefined;
 if(direct)return direct;
 const sub=companies.find(c=>ourOrgGroup(c)==='subcontractors');
 return sub?.aliases?.includes(ourOrgMemberMarker(contact.id))?'subcontractors':undefined;
}
export function isOurOrgContact(contact:Contact,companies:readonly Company[]):boolean{
 return Boolean(rosterGroupForContact(contact,companies));
}
export function ourOrgRoles(contacts:readonly Contact[],companies:readonly Company[],group:RosterGroup):string[]{
 const owned=companies.find(c=>ourOrgGroup(c)===group);
 const saved=(owned?.aliases??[]).map(storedRole).filter((x):x is string=>Boolean(x));
 const used=contacts.filter(c=>rosterGroupForContact(c,companies)===group)
  .map(c=>c.title?.trim()).filter((x):x is string=>Boolean(x));
 return [...new Set([...saved,...used])].sort((a,b)=>a.localeCompare(b));
}
export function ourOrgPeople(contacts:readonly Contact[],companies:readonly Company[],
 group?:RosterGroup):Contact[]{
 return contacts.filter(c=>{
  const category=rosterGroupForContact(c,companies);
  return Boolean(category&&(!group||category===group));
 }).slice().sort((a,b)=>a.name.localeCompare(b.name));
}
/** Never silently reuse an unrelated customer/partner company's name. */
export function ensureOurOrgCompany(group:RosterGroup,companies:readonly Company[],
 resolve:(name:string,kind:'non-customer')=>string|undefined,
 update:(companyId:string,changes:{aliases:string[]})=>void):string{
 const spec=OUR_ORG_GROUPS.find(item=>item.id===group)!;
 const found=companies.find(c=>ourOrgGroup(c)===group);
 if(found)return found.id;
 // Reserved internal name is not exposed in the customer directory.
 const existing=companies.find(c=>c.name===spec.companyName);
 if(existing)
  throw new Error('The reserved internal directory name is already in use. Rename that company before adding roster entries.');
 const id=resolve(spec.companyName,'non-customer');
 if(!id)throw new Error('Could not initialize the internal directory.');
 const company=companies.find(c=>c.id===id);
 if(company&&!isOurOrgCompany(company))
  throw new Error('An existing company matches this reserved directory. No existing company was converted.');
 const aliases=[...new Set([...(company?.aliases??[]),spec.marker])];
 update(id,{aliases});
 return id;
}
