import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Batch 353g — schedule future meetings without fabricated CRM Activity',()=>{
 it('opens the normal private Task editor as a Meeting linked to the current record',()=>{
  const panel=read('components/RecordTasksPanel.tsx');
  expect(panel).toContain('+ Schedule meeting');
  expect(panel).toContain("mode:'create',type:'meeting'");
  expect(panel).toContain('associations:[{type:linkType,id,label:');
  expect(panel).toContain("!preview&&Boolean(scope)&&storedScope===scope");
  expect(panel).not.toContain('recordActivity(');
 });
 it('dated Meeting Tasks have their own date/time and separately logged history',()=>{
  const editor=read('components/TasksWorkspace.tsx');
  expect(editor).toContain("const types:TaskType[]=['todo','call','email','meeting','follow-up']");
  expect(editor).toContain('Due time<input type="time"');
  const panel=read('components/RecordTasksPanel.tsx');
  expect(panel).toContain('Log the completed meeting separately as an Activity.');
 });
});
