import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const get=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const manifest=JSON.parse(get('package.json')) as {dependencies:Record<string,string>;devDependencies:Record<string,string>};
const guide=get('docs/architecture/16f-open-source-adoption.md');
describe('Batch 16F dependency audit',()=>{
 it('accurately identifies core open-source packages already available',()=>{
   for(const pkg of ['pdfjs-dist','exceljs','@tiptap/react','@tiptap/starter-kit','react','zustand','perfect-freehand'])
     expect(manifest.dependencies[pkg],pkg).toBeTruthy();
   for(const pkg of ['vite','vitest','@playwright/test'])expect(manifest.devDependencies[pkg],pkg).toBeTruthy();
 });
 it('does not misrepresent future libs as installed or flip the pricing engine',()=>{
   expect(manifest.dependencies['decimal.js']).toBeUndefined();
   expect(manifest.dependencies.zod).toBeUndefined();
   expect(guide).toContain('not installed');
   expect(guide).toContain('do not silently change existing quoted prices');
 });
});
