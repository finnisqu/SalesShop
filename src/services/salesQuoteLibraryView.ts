import type {SalesQuoteRecord} from './salesQuoteRegistry';
import type {SalesDocumentSort,SalesDocumentStatusFilter} from './salesDocumentLibrary';
import type {SalesDocumentTemplate} from '../types/quote';

export type QuoteLibrarySource='all'|'salesshop'|'external';
export type QuoteLibraryOwner='all'|'mine'|'assigned';
export interface QuoteLibraryViewFilters{
 query:string;
 source:QuoteLibrarySource;
 owner:QuoteLibraryOwner;
 from:string;
 to:string;
}
export interface SavedQuoteLibraryFilters extends QuoteLibraryViewFilters{
 template:'all'|SalesDocumentTemplate;
 status:SalesDocumentStatusFilter;
 sort:SalesDocumentSort;
}
export const DEFAULT_QUOTE_LIBRARY_FILTERS:SavedQuoteLibraryFilters={
 query:'',source:'all',owner:'all',from:'',to:'',
 template:'all',status:'active',sort:'recent',
};
const SOURCES:readonly QuoteLibrarySource[]=['all','salesshop','external'];
const OWNERS:readonly QuoteLibraryOwner[]=['all','mine','assigned'];
const STATUSES:readonly SalesDocumentStatusFilter[]=['active','drafts','issued','archived'];
const SORTS:readonly SalesDocumentSort[]=['recent','name','company','oldest'];
const TEMPLATES:readonly SavedQuoteLibraryFilters['template'][]=[
 'all','quick-quote','builder-rates','community-pricing','spreadsheet',
];
const isDay=(value:unknown):value is string=>
 typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
export function restoreQuoteLibraryFilters(value:unknown):SavedQuoteLibraryFilters{
 if(!value||typeof value!=='object')return {...DEFAULT_QUOTE_LIBRARY_FILTERS};
 const v=value as Record<string,unknown>;
 const one=<T extends string>(candidate:unknown,allowed:readonly T[],fallback:T):T=>
  typeof candidate==='string'&&allowed.includes(candidate as T)?candidate as T:fallback;
 return {
  query:typeof v.query==='string'?v.query.slice(0,300):'',
  source:one(v.source,SOURCES,'all'),
  owner:one(v.owner,OWNERS,'all'),
  from:isDay(v.from)?v.from:'',
  to:isDay(v.to)?v.to:'',
  template:one(v.template,TEMPLATES,'all'),
  status:one(v.status,STATUSES,'active'),
  sort:one(v.sort,SORTS,'recent'),
 };
}
const normalize=(value:string)=>value.toLocaleLowerCase().replace(/[$,]/g,'').trim();
export function quoteLibraryRecordDate(record:SalesQuoteRecord):string{
 return record.sentDate??record.updatedAt.slice(0,10);
}
/** Same query, source, owner, and date semantics for the two quote sources.
 * Security and ownership filtering happen before this presentation-only step. */
export function matchesQuoteLibraryRecord(record:SalesQuoteRecord,filter:QuoteLibraryViewFilters,
 actorId?:string,assignedDealIds:ReadonlySet<string>=new Set()):boolean{
 if(filter.source!=='all'&&record.source!==filter.source)return false;
 if(filter.owner==='mine'&&actorId&&record.ownerUserId!==actorId)return false;
 if(filter.owner==='assigned'&&(!actorId||record.source!=='external'||
  !record.projectId||!assignedDealIds.has(record.projectId)))return false;
 const day=quoteLibraryRecordDate(record);
 if(filter.from&&day<filter.from)return false;
 if(filter.to&&day>filter.to)return false;
 const words=normalize(filter.query).split(/\s+/).filter(Boolean);
 if(!words.length)return true;
 const value=record.value;
 const text=normalize([
  record.name,record.number,record.companyName,record.dealName,record.documentType,
  record.platform,record.source==='external'?'external builder platform':'salesshop native',
  record.status,record.sentDate,record.updatedAt.slice(0,10),
  value===undefined?'':String(value),value===undefined?'':value.toLocaleString('en-US'),
 ].filter(Boolean).join(' '));
 return words.every(word=>text.includes(word));
}
export function compareQuoteLibraryRecords(a:SalesQuoteRecord,b:SalesQuoteRecord,
 sort:SalesDocumentSort):number{
 const compare=sort==='name'?a.name.localeCompare(b.name,undefined,{sensitivity:'base'}):
 sort==='company'?(a.companyName??'\uffff').localeCompare(b.companyName??'\uffff',undefined,{sensitivity:'base'}):
 sort==='oldest'?a.updatedAt.localeCompare(b.updatedAt):b.updatedAt.localeCompare(a.updatedAt);
 return compare||a.id.localeCompare(b.id);
}
