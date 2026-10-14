import {describe,expect,it} from 'vitest';
import type {Quote,SalesDocumentTemplate} from '../types/quote';
import {documentMatchesSearch,filterSalesDocuments,salesDocumentCounts,
  type SalesDocumentLibraryFilters} from './salesDocumentLibrary';

function doc(id:string,title:string,status:Quote['status']='Draft',
  templateId:SalesDocumentTemplate='quick-quote',opts:Partial<Quote>={}):Quote{
  return {id,title,status,templateId,
    documentType:templateId==='quick-quote'?'quote':'pricing-schedule',
    quoteNumber:id,revision:0,createdAt:'2026-10-01T10:00:00Z',
    updatedAt:'2026-10-01T10:00:00Z',companyName:'',...opts} as Quote;
}
const base:SalesDocumentLibraryFilters={query:'',template:'all',status:'active',sort:'recent'};
describe('Sales Documents library usability',()=>{
  const records=[
    doc('a','Oakwood Community Plans','Draft','community-pricing',
      {companyName:'ABC Homes',contactName:'Maria Santos',updatedAt:'2026-10-14T10:00:00Z'}),
    doc('b','Kitchen Countertop','Sent','quick-quote',
      {companyName:'Smith Residence',contactEmail:'smith@example.com',updatedAt:'2026-10-12T10:00:00Z'}),
    doc('c','Builder Levels 2027','Ready','builder-rates',
      {companyName:'Grove Construction',updatedAt:'2026-10-11T10:00:00Z'}),
    doc('d','Old Quartz Quote','Signed','quick-quote',
      {archivedAt:'2026-10-10T10:00:00Z',updatedAt:'2026-10-08T10:00:00Z'}),
  ];
  it('defaults to active documents, newest edit first, without touching the source list',()=>{
    const result=filterSalesDocuments(records,base);
    expect(result.map(x=>x.id)).toEqual(['a','b','c']);
    expect(records.map(x=>x.id)).toEqual(['a','b','c','d']);
  });
  it('supports independent Draft, Issued and Archived status filters',()=>{
    expect(filterSalesDocuments(records,{...base,status:'drafts'}).map(x=>x.id)).toEqual(['a','c']);
    expect(filterSalesDocuments(records,{...base,status:'issued'}).map(x=>x.id)).toEqual(['b']);
    expect(filterSalesDocuments(records,{...base,status:'archived'}).map(x=>x.id)).toEqual(['d']);
    expect(salesDocumentCounts(records)).toEqual({active:3,drafts:2,issued:1,archived:1});
  });
  it('searches across name, customer, contacts, number, and template with multiple words',()=>{
    expect(documentMatchesSearch(records[0],'maria oakwood')).toBe(true);
    expect(documentMatchesSearch(records[1],'smith@example.com')).toBe(true);
    expect(documentMatchesSearch(records[2],'builder rate')).toBe(true);
    expect(documentMatchesSearch(records[0],'b smith')).toBe(false);
    expect(filterSalesDocuments(records,{...base,query:'ABC Homes'}).map(x=>x.id)).toEqual(['a']);
  });
  it('combines template filters and customer-name sorting without revealing archived documents',()=>{
    expect(filterSalesDocuments(records,{...base,template:'quick-quote'}).map(x=>x.id)).toEqual(['b']);
    expect(filterSalesDocuments(records,{...base,sort:'company'}).map(x=>x.id)).toEqual(['a','c','b']);
    expect(filterSalesDocuments(records,{...base,sort:'oldest'}).map(x=>x.id)).toEqual(['c','b','a']);
  });
});
