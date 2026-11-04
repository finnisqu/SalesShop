import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const file=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
describe('HOME and Beta global navigation accessibility',()=>{
 it('exposes HOME Quick Create in the live top actions',()=>{
   const home=file('src/components/HomeWorkspace.tsx');
   const globalCss=file('src/quick-create.css');
   const homeCss=file('src/home-workspace.css');
   expect(home).toContain('className="sales-home-top-actions"');
   expect(home).toContain('{canCreate&&<QuickCreate />}');
   expect(globalCss).toContain('.quick-create-launcher {');
   expect(globalCss).toContain('display: none;');
   expect(homeCss).toContain('.sales-home-top-actions .quick-create-launcher{display:grid;');
 });
 it('keeps a named shared navigation button for Beta and other app views',()=>{
   const chrome=file('src/components/MobileAppChrome.tsx');
   const beta=file('src/components/QuotesMobileBeta.tsx');
   expect(chrome).toContain('aria-label="Open SalesShop navigation"');
   expect(chrome).toContain('mobile-app-drawer-nav');
   expect(chrome).toContain("const isEditingQuote = view === 'quotes' && betaQuotesEnabled");
   expect(beta).toContain("'sales-shop:quotes-beta-back'");
 });
});
