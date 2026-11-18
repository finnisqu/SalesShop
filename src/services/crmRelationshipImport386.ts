/** #385b — Review-only proposed Person↔Deal links.
 * Pure matching, no writes, no fuzzy linking. Existing CRM IDs refer to real
 * SalesShop records, not external-system IDs. */
import type {Company,Contact,Project} from '../types/crm';
import type {DealPersonLink} from '../store/dealPeopleStore';
import {normalizeCompanyIdentity,normalizeEmail,normalizePersonName}
 from './crmIdentity';
import type {CrmImportTable} from './crmImport385';

export type RelationshipField=
 'dealId'|'dealName'|'companyName'|'personId'|'personEmail'|'personName'|'role';
export type RelationshipMapping=Partial<Record<RelationshipField,number>>;
export interface RelationshipFieldSpec {
 id:RelationshipField;label:string;aliases:readonly string[];
}
export const RELATIONSHIP_FIELDS:readonly RelationshipFieldSpec[]=[
 {id:'dealId',label:'Deal ID',aliases:['deal id','project id','salesshop deal id','opportunity id']},
 {id:'dealName',label:'Deal name',aliases:['deal name','project name','opportunity name','deal','project']},
 {id:'companyName',label:'Deal Company',aliases:['deal company','company','company name','account','account name','customer name']},
 {id:'personId',label:'Person ID',aliases:['person id','contact id','salesshop person id']},
 {id:'personEmail',label:'Person email',aliases:['person email','contact email','email','email address','e-mail']},
 {id:'personName',label:'Person name',aliases:['person name','contact name','full name']},
 {id:'role',label:'Relationship role',aliases:['relationship role','role','deal role','contact role','responsibility']},
];
export type RelationshipCandidateStatus='ready'|'existing'|'review';
export interface RelationshipImportCandidate{
 index:number;status:RelationshipCandidateStatus;reason:string;
 dealId?:string;dealName?:string;personId?:string;personName?:string;
 companyName?:string;email?:string;role?:string;
}
export interface RelationshipImportPreview{
 errors:string[];
 rows:RelationshipImportCandidate[];
 counts:Record<RelationshipCandidateStatus,number>;
 mapping:RelationshipMapping;
}
export interface RelationshipImportSnapshot{
 companies:readonly Company[];
 people:readonly Contact[];
 deals:readonly Project[];
 links:readonly DealPersonLink[];
}
const normHeader=(value:string)=>value.trim().toLowerCase().replace(/[_-]+/g,' ')
 .replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ');
const value=(row:readonly string[],mapping:RelationshipMapping,field:RelationshipField)=>
 String(mapping[field]===undefined?'':row[mapping[field]!]??'').trim();
const acceptable=(value:string,max:number)=>
 value.length<=max&&!/[\u0000-\u001f<>]/.test(value);
export function suggestRelationshipMapping(headers:readonly string[]):RelationshipMapping{
 const result:RelationshipMapping={},used=new Set<number>();
 for(const field of RELATIONSHIP_FIELDS){
  const index=headers.findIndex((header,i)=>!used.has(i)&&
   field.aliases.some(alias=>normHeader(alias)===normHeader(header)));
  if(index>=0){result[field.id]=index;used.add(index);}
 }
 return result;
}
function companyFromName(companies:readonly Company[],name:string){
 const normalized=normalizeCompanyIdentity(name);
 return companies.filter(company=>
  [company.name,...(company.aliases??[])].some(candidate=>
   normalizeCompanyIdentity(candidate)===normalized));
}
function dealResult(row:readonly string[],mapping:RelationshipMapping,
 snapshot:RelationshipImportSnapshot):{
 deal?:Project;issue?:string;
}{
 const rawId=value(row,mapping,'dealId');
 const rawName=value(row,mapping,'dealName');
 const rawCompany=value(row,mapping,'companyName');
 if(rawId&&(!acceptable(rawId,100)))return {issue:'Deal ID is too long or invalid.'};
 if(rawName&&(!acceptable(rawName,160)))return {issue:'Deal name is too long or invalid.'};
 if(rawCompany&&(!acceptable(rawCompany,160)))return {issue:'Deal Company is too long or invalid.'};
 let candidates:Project[]=rawId
  ?snapshot.deals.filter(item=>item.id===rawId)
  :rawName?snapshot.deals.filter(item=>
    normalizePersonName(item.name)===normalizePersonName(rawName)):[];
 if(rawId&&!candidates.length)return {issue:'Deal ID not found in this workspace.'};
 if(!rawId&&!rawName)return {issue:'Enter a Deal ID or Deal name.'};
 if(rawName)candidates=candidates.filter(item=>
  normalizePersonName(item.name)===normalizePersonName(rawName));
 if(rawCompany){
  const matches=companyFromName(snapshot.companies,rawCompany);
  if(matches.length!==1)return {issue:matches.length>1?
   'Deal Company is ambiguous; use the exact SalesShop Deal ID.':
   'Deal Company was not found; import or correct it first.'};
  candidates=candidates.filter(item=>item.companyId===matches[0].id);
 }
 if(candidates.length===0)return {issue:'Deal identifiers do not match the same record.'};
 if(candidates.length>1)return {issue:'Several Deals share these details; provide the SalesShop Deal ID or Company.'};
 return {deal:candidates[0]};
}
function personResult(row:readonly string[],mapping:RelationshipMapping,
 snapshot:RelationshipImportSnapshot):{
 person?:Contact;issue?:string;
}{
 const rawId=value(row,mapping,'personId');
 const rawEmail=value(row,mapping,'personEmail').toLowerCase();
 const rawName=value(row,mapping,'personName');
 if(rawId&&!acceptable(rawId,100))return {issue:'Person ID is too long or invalid.'};
 if(rawEmail&&(!acceptable(rawEmail,180)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)))
  return {issue:'Person email is invalid.'};
 if(rawName&&!acceptable(rawName,160))return {issue:'Person name is too long or invalid.'};
 if(!rawId&&!rawEmail)return {issue:
  'Use a SalesShop Person ID or unique email; a name alone is not sufficient.'};
 let candidates:Contact[]=rawId
  ?snapshot.people.filter(item=>item.id===rawId)
  :snapshot.people.filter(item=>normalizeEmail(item.email)===rawEmail);
 if(rawId&&!candidates.length)return {issue:'Person ID not found in this workspace.'};
 if(rawEmail)candidates=candidates.filter(item=>
  normalizeEmail(item.email)===rawEmail);
 if(rawName)candidates=candidates.filter(item=>
  normalizePersonName(item.name)===normalizePersonName(rawName));
 if(!candidates.length)return {issue:'Person identifiers do not match the same record.'};
 if(candidates.length>1)return {issue:'Several People match this email; specify the SalesShop Person ID.'};
 return {person:candidates[0]};
}
export function previewRelationshipImport(
 table:CrmImportTable,mapping:RelationshipMapping,snapshot:RelationshipImportSnapshot,
):RelationshipImportPreview{
 const errors:string[]=[];
 const indexes=RELATIONSHIP_FIELDS.map(field=>mapping[field.id]).filter(
  (n):n is number=>n!==undefined);
 if(indexes.some(index=>!Number.isInteger(index)||index<0||index>=table.headers.length))
  errors.push('A mapped field points to a missing column.');
 if(new Set(indexes).size!==indexes.length)
  errors.push('One spreadsheet column cannot map to multiple fields.');
 if(mapping.dealId===undefined&&mapping.dealName===undefined)
  errors.push('Map Deal ID or Deal name.');
 if(mapping.personId===undefined&&mapping.personEmail===undefined)
  errors.push('Map Person ID or Person email. Names alone are not sufficient.');
 if(errors.length)return {errors,mapping,rows:[],counts:{ready:0,existing:0,review:0}};
 const seen=new Set<string>();
 const rows:RelationshipImportCandidate[]=table.rows.map((row,index):RelationshipImportCandidate=>{
  const result:RelationshipImportCandidate={index,status:'review',reason:''};
  const fail=(reason:string)=>({...result,reason});
  const matchedDeal=dealResult(row,mapping,snapshot);
  if(!matchedDeal.deal)return fail(matchedDeal.issue??'Deal not found.');
  result.dealId=matchedDeal.deal.id;
  result.dealName=matchedDeal.deal.name;
  result.companyName=snapshot.companies.find(company=>
   company.id===matchedDeal.deal!.companyId)?.name;
  const matchedPerson=personResult(row,mapping,snapshot);
  if(!matchedPerson.person)return fail(matchedPerson.issue??'Person not found.');
  result.personId=matchedPerson.person.id;
  result.personName=matchedPerson.person.name;
  result.email=matchedPerson.person.email;
  const role=value(row,mapping,'role');
  if(!acceptable(role,120))return fail('Role must be no longer than 120 characters and contain no markup.');
  result.role=role||undefined;
  const key=matchedDeal.deal.id+'|'+matchedPerson.person.id;
  if(snapshot.links.some(link=>link.dealId===matchedDeal.deal!.id&&
   link.personId===matchedPerson.person!.id))
   return {...result,status:'existing',reason:'Already linked to this Deal; existing role is preserved.'};
  if(seen.has(key))return fail('Repeated Deal–Person relationship in this file.');
  seen.add(key);
  return {...result,status:'ready',reason:'Create this Deal–Person link'};
 });
 const counts={ready:0,existing:0,review:0};
 rows.forEach(row=>{counts[row.status]++;});
 return {errors,mapping,rows,counts};
}
