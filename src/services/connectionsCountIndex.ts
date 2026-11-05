import type {Contact,Project} from '../types/crm';
import type {Quote} from '../types/quote';

export interface ConnectionsCounts {
 peopleByCompany:ReadonlyMap<string,number>;
 dealsByCompany:ReadonlyMap<string,number>;
 quotesByCompany:ReadonlyMap<string,number>;
 quotesByDeal:ReadonlyMap<string,number>;
}
type QuoteLink=Pick<Quote,'id'|'companyId'|'projectId'|'archivedAt'>;
const bump=(map:Map<string,number>,id:string|undefined)=>{
 if(id)map.set(id,(map.get(id)??0)+1);
};
/** Same explicit-link semantics as quotesForCompany/quotesForProject, but
 * index once per store version instead of scanning every record on each
 * directory row, filter keystroke or open preview. */
export function indexConnectionsCounts(
 contacts:readonly Pick<Contact,'companyId'>[],
 projects:readonly Pick<Project,'id'|'companyId'>[],
 quotes:readonly QuoteLink[],
):ConnectionsCounts{
 const peopleByCompany=new Map<string,number>();
 const dealsByCompany=new Map<string,number>();
 const quotesByCompany=new Map<string,number>();
 const quotesByDeal=new Map<string,number>();
 const projectCompanies=new Map<string,string>();
 for(const contact of contacts)bump(peopleByCompany,contact.companyId);
 for(const project of projects){
  bump(dealsByCompany,project.companyId);
  if(project.companyId)projectCompanies.set(project.id,project.companyId);
 }
 for(const quote of quotes){
  if(quote.archivedAt)continue;
  bump(quotesByDeal,quote.projectId);
  // A quote with both company and linked Deal can belong to two companies,
  // but must never count twice when they reference the same company.
  const companyIds=new Set<string>();
  if(quote.companyId)companyIds.add(quote.companyId);
  const linkedCompany=quote.projectId?projectCompanies.get(quote.projectId):undefined;
  if(linkedCompany)companyIds.add(linkedCompany);
  for(const companyId of companyIds)bump(quotesByCompany,companyId);
 }
 return {peopleByCompany,dealsByCompany,quotesByCompany,quotesByDeal};
}
