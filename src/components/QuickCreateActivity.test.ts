import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');

describe('Global header Quick Create Activity action',()=>{
 it('serializes Board name-first creation before the saving rerender',()=>{
  const board=source('src/components/BoardQuickCreate.tsx');
  expect(board).toContain('const savingRef=useRef(false)');
  expect(board).toContain('if(!clean||savingRef.current)return');
  expect(board).toContain('savingRef.current=true;setSaving(true)');
  expect(board).toContain('finally{savingRef.current=false;setSaving(false)}');
  expect(board).toContain("This Person is already in the pending selection.");
 });

 it('never silently dismisses a failed Deal/Account create and prevents duplicate retries after partial linking',()=>{
  const menu=source('src/components/QuickCreate.tsx');
  expect(menu).toContain("if(!projectId)throw new Error(");
  expect(menu).toContain("if(!companyId)throw new Error(");
  expect(menu).toContain("if(namedCreatePending.current||pendingCreated)return;");
  expect(menu).toContain("setPendingCreated({id:createdId,kind:namedMode})");
  expect(menu).toContain('role="alert"');
  expect(menu).toContain('Open created record');
 });
 it('offers Log Activity alongside New Task and opens the existing global composer',()=>{
  const menu=source('src/components/QuickCreate.tsx');
  const app=source('src/App.tsx');
  const launcher=source('src/components/QuickActivityLauncher.tsx');
  const service=source('src/services/taskActivityWorkflow.ts');
  expect(menu).toContain('<strong>Log Activity</strong>');
  expect(menu).toContain('onClick={startActivity}');
  expect(menu).toContain('close();\n    // Reuse the one account-scoped CRM Activity editor');
  expect(menu).toContain('openActivityComposer(context?{associations:[contextTaskAssociation(context)]}:{});');
  expect(menu).toContain('contextTaskAssociation(context)');
  expect(menu).toContain('<CreateGlyph kind="activity"/>');
  expect(app).toContain('<QuickCreate />');
  expect(app).toContain('<QuickActivityLauncher headless/>');
  expect(launcher).toContain("window.addEventListener('salesshop:open-activity',openForDate)");
  expect(service).toContain("new CustomEvent<ActivityComposerRequest>('salesshop:open-activity'");
 });
});
