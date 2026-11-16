import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 353b — retired quote builder is not user accessible',()=>{
 it('always mounts Quick Quote for the entire Records → Quotes route',()=>{
  const app=read('App.tsx');
  expect(app).toContain("view === 'quotes' ? (");
  expect(app).toContain('<QuotesMobileBeta />');
  expect(app).not.toContain('<Quotes />');
  expect(app).not.toContain("import { Quotes }");
  expect(app).not.toContain('mobileQuotesBetaEnabled');
 });
 it('does not honor the old saved classic editor setting',()=>{
  const state=read('store/quotesMobileBetaStore.ts');
  expect(state).toContain('enabled: true');
  expect(state).toContain('setEnabled: () => set({enabled:true})');
  expect(state).not.toContain('readOptIn');
  expect(state).not.toContain('salesshop:quotes-mobile-beta-v1');
 });
 it('removes the retired editor choice from ordinary customer settings',()=>{
  const settings=read('components/CompanySettings.tsx');
  expect(settings).not.toContain('Choose your Quote editor');
  expect(settings).not.toContain('Open Detailed Editor');
  expect(settings).not.toContain('setQuotesBetaEnabled');
  expect(settings).toContain('Project Timeline (Beta)');
 });
 it('removes old editor routes in library actions, row menus and document options',()=>{
  const library=read('components/QuotesMobileBeta.tsx');
  const menu=read('components/SalesDocumentActionsMenu.tsx');
  expect(library).not.toContain('openDetailedQuoteEditor');
  expect(library).not.toContain("label:'Detailed Editor'");
  expect(library).not.toContain("label:'Open in Detailed Editor'");
  expect(menu).not.toContain('Open in Detailed Editor');
  expect(menu).not.toContain('openDetailedQuoteEditor');
  expect(library).toContain('QuoteMatrixBuilder');
  expect(library).toContain('<RecordsSectionNav selected="quotes"');
 });
 it('keeps mobile toolbar and actions aligned to Quick Quote regardless of prior device preference',()=>{
  const mobile=read('components/MobileAppChrome.tsx');
  expect(mobile).not.toContain('betaQuotesEnabled');
  expect(mobile).toContain("view === 'quotes' && !quoteReadOnly && !preview");
  expect(mobile).toContain('sales-shop:quotes-beta-back');
 });
 it('old programmatic editor navigation can no longer force a legacy mode',()=>{
  const compatibility=read('services/quoteEditorNavigation.ts');
  expect(compatibility).not.toContain('setEnabled(false)');
  expect(compatibility).toContain('setEnabled(true)');
 });
 it('still routes Quotes navigation to the document library, not legacy metadata',()=>{
  const records=read('components/Connections.tsx');
  expect(records).toContain("if(next==='quotes'){requestRecordsQuotesLibrary();setView('quotes');return;}");
  const quick=read('components/QuotesMobileBeta.tsx');
  expect(quick).toContain("return requested?'library':restoredLocation.current.page");
 });
});
