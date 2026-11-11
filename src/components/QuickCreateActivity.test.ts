import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');

describe('Global header Quick Create Activity action',()=>{
 it('offers Log Activity alongside New Task and opens the existing global composer',()=>{
  const menu=source('src/components/QuickCreate.tsx');
  const app=source('src/App.tsx');
  const launcher=source('src/components/QuickActivityLauncher.tsx');
  const service=source('src/services/taskActivityWorkflow.ts');
  expect(menu).toContain('<strong>Log Activity</strong>');
  expect(menu).toContain('onClick={startActivity}');
  expect(menu).toContain('close();\n    // Reuse the one account-scoped CRM Activity editor');
  expect(menu).toContain('openActivityComposer();');
  expect(menu).toContain('<CreateGlyph kind="activity"/>');
  expect(app).toContain('<QuickCreate />');
  expect(app).toContain('<QuickActivityLauncher headless/>');
  expect(launcher).toContain("window.addEventListener('salesshop:open-activity',openForDate)");
  expect(service).toContain("new CustomEvent<ActivityComposerRequest>('salesshop:open-activity'");
 });
});
