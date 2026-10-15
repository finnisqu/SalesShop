import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const connections=read('src/components/Connections.tsx');
const account=read('src/components/AccountMenu.tsx');
const mobile=read('src/components/MobileAppChrome.tsx');
describe('Batch 16A profile and Connections cleanup',()=>{
 it('keeps linked quote counts but removes redundant Connections quote library',()=>{
   expect(connections).not.toContain("{ id: 'quotes', label: 'Quotes'");
   expect(connections).not.toContain("tab === 'quotes'");
   expect(connections).toContain('quotesForCompany(company, projects, quotes)');
   expect(connections).toContain('quotesForProject(project, quotes)');
 });
 it('puts personal appearance controls in desktop and mobile profile areas',()=>{
   for(const source of [account,mobile]){
     expect(source).toContain("['warm','light','dark'] as const");
     expect(source).toContain('setAppearance({themeChoice:choice})');
     expect(source).toContain('aria-pressed=');
   }
 });
});
