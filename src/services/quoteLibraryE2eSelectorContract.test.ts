import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const quote=readFileSync(new URL('../components/QuotesMobileBeta.tsx',import.meta.url),'utf8');
const library=readFileSync(new URL('../../e2e/sales-document-library.pw.ts',import.meta.url),'utf8');
const home=readFileSync(new URL('../../e2e/home-journey.pw.ts',import.meta.url),'utf8');
const create=readFileSync(new URL('../../e2e/sales-document-templates.pw.ts',import.meta.url),'utf8');
describe('Quick Quote current library testing contract',()=>{
 it('matches the unified header and new-document action',()=>{
  expect(quote).toContain('<WorkspaceHeader title="Records"');
  expect(quote).toContain('<RecordsSectionNav selected="quotes"');
  expect(quote).toContain('Filter quote document type');
  expect(quote).toContain('onClick={()=>setShowNewDocument(true)}>+ Document</button>');
  expect(library).toContain("getByRole('heading',{name:'Records',exact:true})");
  expect(library).toContain("getByRole('combobox',{name:'Filter quote document type'})");
  expect(library).toContain("getByRole('button',{name:/^\\+ Document$/})");
 });
 it('keeps the home and templates navigation tied to current library title',()=>{
  expect(home).toContain("getByRole('heading',{name:'Records',exact:true})");
  expect(create).toContain("getByRole('heading',{name:'Records',exact:true})");
  expect(home).not.toContain("heading',{name:'Sales Documents'");
 });
});
