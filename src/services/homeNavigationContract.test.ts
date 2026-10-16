import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const file=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
describe('HOME and Beta global navigation accessibility',()=>{
 it('does not hide the desktop HOME quick-create entry behind global mobile-only CSS',()=>{
   const home=file('src/components/HomeWorkspace.tsx');
   const globalCss=file('src/quick-create.css');
   const homeCss=file('src/home-workspace.css');
   expect(home).toContain('<div className="sales-home-header-create"><QuickCreate /></div>');
   expect(globalCss).toContain('.quick-create-launcher {\n  display: none;');
   expect(homeCss).toContain('.sales-home-header-create .quick-create-launcher{display:inline-grid;');
   expect(homeCss).toContain('.sales-home-header-create{display:none}');
 });
 it('exposes the Beta global menu trigger as a named button',()=>{
   const beta=file('src/components/QuotesMobileBeta.tsx');
   expect(beta).toContain('<summary role="button" aria-label="Open SalesShop navigation">');
   expect(beta).toContain('<nav aria-label="SalesShop destinations">');
 });
});