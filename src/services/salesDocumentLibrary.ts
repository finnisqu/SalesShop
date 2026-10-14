import type {Quote,SalesDocumentTemplate} from '../types/quote';
import {salesDocumentTemplate,salesTemplateLabel} from './salesDocumentTemplates';

export type SalesDocumentStatusFilter='active'|'drafts'|'issued'|'archived';
export type SalesDocumentSort='recent'|'name'|'company'|'oldest';
export interface SalesDocumentLibraryFilters {
  query:string;
  template:'all'|SalesDocumentTemplate;
  status:SalesDocumentStatusFilter;
  sort:SalesDocumentSort;
}
export function documentMatchesSearch(quote:Quote,query:string):boolean{
  const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if(!words.length)return true;
  const haystack=[
    quote.title,quote.quoteNumber,quote.companyName,quote.contactName,
    quote.contactEmail,quote.projectName,salesTemplateLabel(salesDocumentTemplate(quote)),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
  return words.every(word=>haystack.includes(word));
}
function matchesStatus(quote:Quote,status:SalesDocumentStatusFilter):boolean{
  if(status==='archived')return !!quote.archivedAt;
  if(quote.archivedAt)return false;
  if(status==='drafts')return quote.status==='Draft'||quote.status==='Ready';
  if(status==='issued')return !['Draft','Ready'].includes(quote.status);
  return true;
}
export function filterSalesDocuments(documents:Quote[],filter:SalesDocumentLibraryFilters):Quote[]{
  const filtered=documents.filter(q=>(filter.template==='all'||salesDocumentTemplate(q)===filter.template)&&
    matchesStatus(q,filter.status)&&documentMatchesSearch(q,filter.query));
  return filtered.sort((a,b)=>{
    const comparison=filter.sort==='name'?a.title.localeCompare(b.title,undefined,{sensitivity:'base'}):
      filter.sort==='company'?(a.companyName||'\uffff').localeCompare((b.companyName||'\uffff'),undefined,{sensitivity:'base'}):
      filter.sort==='oldest'?a.updatedAt.localeCompare(b.updatedAt):b.updatedAt.localeCompare(a.updatedAt);
    return comparison||a.id.localeCompare(b.id);
  });
}
export function salesDocumentCounts(documents:Quote[]){
  const live=documents.filter(q=>!q.archivedAt);
  return {
    active:live.length,
    drafts:live.filter(q=>q.status==='Draft'||q.status==='Ready').length,
    issued:live.filter(q=>!['Draft','Ready'].includes(q.status)).length,
    archived:documents.length-live.length,
  };
}
