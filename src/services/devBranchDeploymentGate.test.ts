import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const workflow=(name:string)=>readFileSync(join(process.cwd(),'.github/workflows',name),'utf8');
const triggers=(name:string)=>workflow(name).split(/\non:\s*\n/)[1]?.split(/\n(?:permissions|concurrency|jobs):/)[0]??'';
describe('GitHub Actions automatic release checks and Cloudflare hosting',()=>{
 it('runs automatic CI on main pushes and PRs with manual fallback',()=>{
   for(const name of ['react-foundation.yml','navigation-smoke.yml','pricing-schedule-qc.yml',
     'visual-qc.yml','private-quote-rls-qc.yml','private-deal-roles-qc.yml']){
     const on=triggers(name);
     expect(on,name).toContain('workflow_dispatch:');
     expect(on,name).toMatch(/^  push:/m);
     expect(on,name).toMatch(/^  pull_request:/m);
     expect(on,name).toContain('branches: [main]');
   }
 });
 it('keeps credentialed staging manual and isolated',()=>{
   const name='supabase-staging-privacy-matrix.yml',on=triggers(name);
   expect(on).toContain('workflow_dispatch:');
   expect(on).not.toMatch(/^  (push|pull_request):/m);
   expect(workflow(name)).toContain('environment: sales-shop-privacy-staging');
 });
 it('tests and builds without publishing through obsolete GitHub Pages',()=>{
   const source=workflow('react-foundation.yml');
   expect(source).toContain('run: npm test');
   expect(source).toContain('run: npm run build');
   expect(source).toContain("VITE_BASE_PATH: '/'");
   expect(source).not.toContain('actions/deploy-pages');
   expect(source).not.toContain('actions/configure-pages');
   expect(source).not.toContain('dist/CNAME');
   expect(source).not.toMatch(/^  deploy:/m);
 });
});
