import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Activity,Project} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import {
 automationCandidates,sanitizeAutomationSettings,
 normalizeAutomationStage,normalizeStageTaskLabel,
 AUTOMATION_STAGE_CHOICES,DEFAULT_STAGE_TASK_LABEL,
 type AutomationRules,
} from './automationRules358b';

const get=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const now=new Date('2026-11-18T12:00:00');
const project=(changes:Partial<Project>={}):Project=>({
 id:'deal-a',name:'Elm Apartments',stage:'Bid Sent',amount:35000,
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-17T12:00:00Z',
 assignedUserId:'rep-a',...changes,
});
const event=(changes:Partial<Activity>={}):Activity=>({
 id:'stage-a',projectId:'deal-a',type:'project-stage-changed',
 occurredAt:'2026-11-16T12:00:00Z',summary:'Stage changed',
 metadata:{fromStage:'Bid Development',toStage:'Bid Sent'},...changes,
});
const settings=():AutomationRules=>({
 ...sanitizeAutomationSettings(null).rules,
 'deal-stage-task':{enabled:true,days:3,stage:'Bid Sent',taskLabel:'Call client'},
});
function proposals(input:{
 deal?:Project;events?:Activity[];rules?:AutomationRules;
 tasks?:PersonalTask[];mode?:'local'|'cloud';userId?:string;
}={}){
 return automationCandidates({
  deals:[input.deal??project()],quotes:[],activities:input.events??[event()],
  tasks:input.tasks??[],rules:input.rules??settings(),
  now,mode:input.mode??'cloud',userId:input.userId??'rep-a',
 });
}
describe('#383 — custom stage-triggered private Task rule',()=>{
 it('starts disabled and preserves all three existing automation rule defaults',()=>{
  const fresh=sanitizeAutomationSettings(null);
  expect(fresh.rules['deal-stage-task']).toEqual({
   enabled:false,days:1,stage:'Bid Sent',taskLabel:DEFAULT_STAGE_TASK_LABEL,
  });
  expect(fresh.rules['quote-delivered'].enabled).toBe(false);
  expect(fresh.rules['deal-inactive'].enabled).toBe(false);
  expect(fresh.rules['deal-won'].enabled).toBe(false);
  expect(fresh.autoRunWhileOpen).toBe(false);
  expect(proposals({rules:fresh.rules})).toHaveLength(0);
 });
 it('sanitizes untrusted stage, title and day values without trusting arbitrary labels',()=>{
  const parsed=sanitizeAutomationSettings({rules:{'deal-stage-task':{
   enabled:true,days:999,stage:'Bogus',taskLabel:'<script>alert(1)</script>',
  }}});
  expect(parsed.rules['deal-stage-task']).toEqual({
   enabled:true,days:60,stage:'Bid Sent',taskLabel:DEFAULT_STAGE_TASK_LABEL,
  });
  expect(normalizeAutomationStage('Negotiation')).toBe('Negotiation');
  expect(normalizeStageTaskLabel('  Call client  ')).toBe('Call client');
  expect(normalizeStageTaskLabel('x')).toBe(DEFAULT_STAGE_TASK_LABEL);
  expect(normalizeStageTaskLabel('a'.repeat(71))).toBe(DEFAULT_STAGE_TASK_LABEL);
  expect(AUTOMATION_STAGE_CHOICES).toContain('Closed Won');
 });
 it('requires a confirmed recorded stage change, not an imported stage snapshot',()=>{
  expect(proposals({events:[]})).toHaveLength(0);
  expect(proposals({events:[event({type:'manual-touchpoint'})]})).toHaveLength(0);
  expect(proposals({events:[event({metadata:{toStage:'Discovery'}})]})).toHaveLength(0);
  expect(proposals({deal:project({stage:'Negotiation'})})).toHaveLength(0);
 });
 it('uses the configured task name, event timestamp, due date and Deal association',()=>{
  const rows=proposals();
  expect(rows).toHaveLength(1);
  const row=rows[0];
  expect(row.rule).toBe('deal-stage-task');
  expect(row.title).toBe('Call client · Elm Apartments');
  expect(row.context).toContain('Bid Sent');
  expect(row.changes.type).toBe('todo');
  expect(row.changes.dueDate).toBe('2026-11-19');
  expect(row.changes.associations).toEqual([
   {type:'project',id:'deal-a',label:'Deal · Elm Apartments'},
  ]);
  expect(row.changes.notes).toContain('No customer messages');
 });
 it('does not process stale, future or mismatched owner events',()=>{
  expect(proposals({events:[event({occurredAt:'2026-10-30T12:00:00Z'})]})).toHaveLength(0);
  expect(proposals({events:[event({occurredAt:'2026-11-19T12:00:00Z'})]})).toHaveLength(0);
  expect(proposals({deal:project({assignedUserId:'rep-b'})})).toHaveLength(0);
  expect(proposals({userId:'rep-b'})).toHaveLength(0);
  expect(proposals({events:[event({projectId:'other-deal'})]})).toHaveLength(0);
 });
 it('prevents repeats after completed, canceled or deleted tasks',()=>{
  const candidate=proposals()[0];
  const existing={id:'old-task',title:candidate.title,
   sourceObjectId:candidate.sourceObjectId,
   deletedAt:'2026-11-17',createdAt:'2026-11-16',
   updatedAt:'2026-11-17'} as PersonalTask;
  expect(proposals({tasks:[existing]})).toHaveLength(0);
  expect(candidate.sourceObjectId).toContain('stage-a:Bid Sent');
  expect(proposals()[0].sourceObjectId).toBe(candidate.sourceObjectId);
 });
 it('can create one follow-up for a later legitimate transition back to that stage',()=>{
  const oldEvent=event({id:'stage-a',occurredAt:'2026-11-15T12:00:00Z'});
  const newer=event({id:'stage-b',occurredAt:'2026-11-17T12:00:00Z'});
  const rows=proposals({events:[oldEvent,newer]});
  expect(rows).toHaveLength(1);
  expect(rows[0].sourceObjectId).toContain('stage-b');
  expect(rows[0].changes.dueDate).toBe('2026-11-20');
 });
 it('keeps existing fixed rules available alongside the configurable stage rule',()=>{
  const other=sanitizeAutomationSettings(null).rules;
  expect(other['deal-won']).toBeDefined();
  expect(other['quote-delivered']).toBeDefined();
  expect(other['deal-inactive']).toBeDefined();
  const all=proposals({rules:settings()});
  expect(all.every(row=>row.rule==='deal-stage-task')).toBe(true);
 });
 it('connects stage, task title and disabled consent to existing task executor',()=>{
  const ui=get('components/AutomationsWorkspace.tsx');
  const store=get('store/automationStore.ts');
  const runner=get('components/AutomationRuntime.tsx');
  const executor=get('services/automationExecutor358b.ts');
  expect(ui).toContain("id==='deal-stage-task'&&<StageTaskEditor383");
  expect(ui).toContain('When a Deal enters');
  expect(ui).toContain('Save task name');
  expect(ui).toContain('disabled={!ready}');
  expect(ui).toContain("onConfigure({taskLabel:text.trim()})");
  expect(ui).toContain('key={scope??');
  expect(store).toContain('normalizeAutomationStage(changes.stage??original.stage)');
  expect(store).toContain('normalizeStageTaskLabel(changes.taskLabel??original.taskLabel)');
  expect(runner).toContain('automationCandidates({');
  expect(executor).toContain('sourceObjectId===item.sourceObjectId');
  expect(executor).not.toContain('sendGmailMessage(');
  expect(ui).toContain('Automatically run enabled rules while SalesShop is open');
 });
});
