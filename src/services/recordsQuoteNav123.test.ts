import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 123 — Quotes consolidation into Records',()=>{
 it('keeps exactly four primary destinations and physical Shift+1–4 shortcuts',()=>{
  const app=read('App.tsx');
  const mobile=read('components/MobileAppChrome.tsx');
  expect(app).toContain("const PRIMARY_NAV_DESTINATIONS=['home','dashboard','catalog','notebook']");
  expect(app).toContain('/^Digit([1-4])$/');
  const tabs=app.slice(app.indexOf('<nav className="app-tabs"'),app.indexOf('</nav>',app.indexOf('<nav className="app-tabs"')));
  for(const label of ['Home','Records','Catalog','Notebook'])
   expect(tabs).toContain('>'+label+'</button>');
  expect(tabs).not.toContain('>Quotes</button>');
  expect(tabs).not.toContain('>Tasks</button>');
  expect(mobile).not.toContain("{ view: 'quotes', label: 'Quotes'");
  expect(mobile).toContain("item.view==='dashboard'&&view==='quotes'");
 });
 it('puts Companies, People, Deals, Quotes and Tasks into one shared Records subnav',()=>{
  const nav=read('components/RecordsSectionNav.tsx');
  const main=['companies','people','deals','quotes','tasks'];
  const extras=['suppliers','pages','activity','organization'];
  const mainPart=nav.slice(nav.indexOf('export const RECORDS_MAIN_TABS'),nav.indexOf('] as const;'));
  let at=-1;
  for(const name of main){const next=mainPart.indexOf("id:'"+name+"'");expect(next).toBeGreaterThan(at);at=next;}
  for(const name of extras)expect(nav).toContain("id:'"+name+"'");
  expect(nav).toContain('<WorkspaceMoreMenu label="Records sections"');
  const records=read('components/Connections.tsx');
  expect(records).toContain('<RecordsSectionNav selected={tab as RecordsSection}');
  expect(records).toContain("if(next==='quotes'){requestRecordsQuotesLibrary();setView('quotes');return;}");
 });
 it('preserves full Quotes library, quote-specific document filters and deep links',()=>{
  const quotes=read('components/QuotesMobileBeta.tsx');
  const main=read('App.tsx');
  expect(quotes).toContain('<RecordsSectionNav selected="quotes"');
  expect(quotes).toContain('Filter quote document type');
  expect(quotes).toContain('RECORDS_QUOTES_LIBRARY_KEY');
  expect(quotes).toContain("return requested?'library':restoredLocation.current.page");
  expect(quotes).toContain('if(!hydrated||!routeQuoteId||consumedRoute.current===routeQuoteId)return');
  expect(quotes).toContain('QuoteMatrixBuilder');
  expect(main).toContain("view === 'quotes' ? (");
  expect(main).toContain('mobileQuotesBetaEnabled ? <QuotesMobileBeta /> : <Quotes />');
 });
});
