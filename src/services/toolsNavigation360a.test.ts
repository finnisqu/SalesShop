import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseSalesShopRoute,salesShopRoutePath} from './appRoutes';
import type {NavigationLocation} from '../store/navigationStore';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Tools primary workspace #360a',()=>{
 it('hosts the existing tools and the guarded CRM Import feature in predictable order',()=>{
  const s=read('components/ToolsWorkspace.tsx');
  for(const section of ['analytics','files','automations','email','import','suggestions']){
   expect(s).toContain("id:'"+section+"'");
  }
  expect(s.indexOf("id:'analytics'")).toBeLessThan(s.indexOf("id:'files'"));
  expect(s.indexOf("id:'files'")).toBeLessThan(s.indexOf("id:'automations'"));
  expect(s.indexOf("id:'automations'")).toBeLessThan(s.indexOf("id:'email'"));
  expect(s.indexOf("id:'email'")).toBeLessThan(s.indexOf("id:'import'"));
  expect(s.indexOf("id:'import'")).toBeLessThan(s.indexOf("id:'suggestions'"));
  for(const [id,component] of [
   ['analytics','SalesAnalyticsWorkspace'],['files','FilesWorkspace'],
   ['automations','AutomationsWorkspace'],['email','EmailWorkspace'],
   ['import','CrmImportWorkspace385'],
   ['suggestions','CrmSuggestionsWorkspace387'],
  ]){
   expect(s).toContain("section==='"+id+"'&&<"+component);
  }
 });
 it('preserves last selected Records tool when opening Tools',()=>{
  const s=read('components/ToolsWorkspace.tsx');
  expect(s).toContain('resolveToolsLanding(saved:string|null,legacy:string|null)');
  expect(s).toContain('sessionStorage.getItem(RECORDS_TAB_KEY)');
  expect(s).toContain('sessionStorage.setItem(TOOLS_TAB_KEY,next)');
  expect(s).toContain('mobileTabs={TOOLS_SECTIONS.map');
 });
 it('round trips the top-level Tools route without exposing public quote URLs',()=>{
  expect(parseSalesShopRoute('/tools')).toEqual({view:'tools'});
  expect(parseSalesShopRoute('/tools/unknown')).toBeNull();
  expect(salesShopRoutePath({
   view:'tools',catalogSection:'materials',focusedProjectId:null,
   focusedCompanyId:null,focusedContactId:null,focusedQuoteId:null,
  } satisfies NavigationLocation)).toBe('/tools');
 });
 it('leaves ordinary CRM subnavigation in Records, not Tools',()=>{
  const s=read('components/RecordsSectionNav.tsx');
  for(const name of ['organization','activity','suppliers','pages'])
   expect(s).toContain("id:'"+name+"'");
  for(const name of ['analytics','files','automations','email'])
   expect(s).not.toContain("id:'"+name+"'");
  const conn=read('components/Connections.tsx');
  expect(conn).not.toContain("tab==='email'&&");
  expect(conn).not.toContain("tab==='files'&&");
 });
 it('updates desktop header, mobile drawer and shortcuts while retaining auth boundaries',()=>{
  const app=read('App.tsx'),mobile=read('components/MobileAppChrome.tsx');
  expect(app).toContain("['home','dashboard','catalog','notebook','tools']");
  expect(app).toContain('>Tools</button>');
  expect(app).toContain("view === 'tools' ? (");
  expect(app).toContain("view === 'tools') && !canEditTeamArea");
  expect(mobile).toContain("{ view: 'tools', label: 'Tools'");
  expect(read('components/WorkspaceHelp.tsx')).toContain("tools:{name:'Tools'");
 });
});
