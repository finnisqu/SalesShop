import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Project,Activity} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import {automationCandidates,sanitizeAutomationSettings} from './automationRules358b';
import {WORKFLOW_TEMPLATES,MAX_CUSTOM_WORKFLOWS,templateWorkflow,
 sanitizeCustomWorkflows,normalizeCustomWorkflow,changeCustomWorkflow,
 cloneCustomWorkflow,isCustomWorkflowId,validWorkflowText,
 type CustomStageWorkflow} from './automationCustomWorkflows384';

const source=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const now=new Date('2026-11-18T12:00:00');
const deal=(patch:Partial<Project>={}):Project=>({
 id:'deal-1',name:'Cedar Place',stage:'Bid Sent',amount:85000,
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-17T12:00:00Z',
 assignedUserId:'seller-1',...patch,
});
const event=(patch:Partial<Activity>={}):Activity=>({
 id:'activity-1',projectId:'deal-1',type:'project-stage-changed',
 summary:'Bid submitted',occurredAt:'2026-11-16T12:00:00Z',
 metadata:{fromStage:'Bid Development',toStage:'Bid Sent'},...patch,
});
const rule=(id:string,patch:Partial<CustomStageWorkflow>={}):CustomStageWorkflow=>({
 ...templateWorkflow('bid-follow-up',id),enabled:true,...patch,
});
function preview(input:{
 workflows?:CustomStageWorkflow[];deals?:Project[];events?:Activity[];
 tasks?:PersonalTask[];userId?:string;mode?:'local'|'cloud';
}={}){
 return automationCandidates({
  deals:input.deals??[deal()],quotes:[],activities:input.events??[event()],
  tasks:input.tasks??[],rules:sanitizeAutomationSettings(null).rules,
  customRules:input.workflows??[rule('wf_abc123456789')],
  now,userId:input.userId??'seller-1',mode:input.mode??'cloud',
 });
}
describe('#384 multiple custom stage automations and starter templates',()=>{
 it('keeps existing built-in rules and does not auto-install a new workflow',()=>{
  const fresh=sanitizeAutomationSettings(null);
  expect(fresh.customRules).toEqual([]);
  expect(Object.values(fresh.rules).every(x=>!x.enabled)).toBe(true);
  expect(WORKFLOW_TEMPLATES.map(x=>x.id)).toEqual([
   'blank','bid-follow-up','negotiation','won-handoff','discovery',
  ]);
  expect(WORKFLOW_TEMPLATES).toHaveLength(5);
  expect(MAX_CUSTOM_WORKFLOWS).toBe(8);
  expect(preview({workflows:[]})).toEqual([]);
 });
 it('starts every template disabled and only uses supported live Deal stages',()=>{
  for(const template of WORKFLOW_TEMPLATES){
   const created=templateWorkflow(template.id,'wf_abc123456789');
   expect(created.enabled).toBe(false);
   expect(created.name.length).toBeGreaterThan(1);
   expect(created.days).toBeGreaterThanOrEqual(1);
   expect(created.days).toBeLessThanOrEqual(60);
   expect(created.taskLabel.length).toBeGreaterThan(1);
  }
  expect(templateWorkflow('won-handoff','wf_abc123456789').stage).toBe('Closed Won');
  expect(()=>templateWorkflow('blank','unsafe')).toThrow('Invalid workflow ID');
 });
 it('allows independent enabled rules to match one event, with unique Task identities',()=>{
  const workflows=[
   rule('wf_abc123456789',{name:'First',taskLabel:'Call client',days:2}),
   rule('wf_xyz123456789',{name:'Second',taskLabel:'Review specifications',days:5,priority:'high'}),
  ];
  const proposals=preview({workflows});
  expect(proposals).toHaveLength(2);
  expect(new Set(proposals.map(p=>p.sourceObjectId)).size).toBe(2);
  expect(proposals.map(p=>p.title)).toEqual([
   'Call client · Cedar Place','Review specifications · Cedar Place',
  ]);
  expect(proposals.map(p=>p.changes.dueDate)).toEqual(['2026-11-18','2026-11-21']);
  expect(proposals[1].changes.priority).toBe('high');
  expect(proposals[0].changes.associations).toEqual([
   {type:'project',id:'deal-1',label:'Deal · Cedar Place'},
  ]);
  expect(proposals.every(p=>p.rule==='deal-stage-task'&&!!p.customRuleId)).toBe(true);
 });
 it('requires latest confirmed stage transition, current stage, and assigned ownership',()=>{
  const configured=[rule('wf_abc123456789')];
  expect(preview({workflows:configured,events:[]})).toEqual([]);
  expect(preview({workflows:configured,events:[event({type:'manual-touchpoint'})]})).toEqual([]);
  expect(preview({workflows:configured,deals:[deal({stage:'Negotiation'})]})).toEqual([]);
  expect(preview({workflows:configured,userId:'someone-else'})).toEqual([]);
  expect(preview({workflows:configured,deals:[deal({assignedUserId:'someone-else'})]})).toEqual([]);
  expect(preview({workflows:configured,events:[
   event(),event({id:'activity-2',occurredAt:'2026-11-17T12:00:00Z',
    metadata:{toStage:'Negotiation'}}),
  ]})).toEqual([]);
  expect(preview({workflows:configured,events:[event({occurredAt:'2026-10-25T12:00:00Z'})]}))
   .toEqual([]);
  expect(preview({workflows:configured,events:[event({occurredAt:'2026-11-19T12:00:00Z'})]}))
   .toEqual([]);
 });
 it('does not duplicate generated Tasks even if previously canceled or deleted',()=>{
  const candidate=preview()[0];
  expect(candidate.sourceObjectId).toContain('wf_abc123456789');
  const historical={id:'old',title:candidate.title,sourceObjectId:candidate.sourceObjectId,
   deletedAt:'2026-11-17',createdAt:'2026-11-16',
   updatedAt:'2026-11-17',status:'canceled'} as PersonalTask;
  expect(preview({tasks:[historical]})).toEqual([]);
  const renamed=rule('wf_abc123456789',{taskLabel:'Different title'});
  expect(preview({workflows:[renamed]})[0].sourceObjectId).toBe(candidate.sourceObjectId);
 });
 it('repeating a separate stage transition can create a different private Task',()=>{
  const proposal=preview({events:[
   event({id:'activity-old',occurredAt:'2026-11-15T12:00:00Z'}),
   event({id:'activity-new',occurredAt:'2026-11-17T12:00:00Z'}),
  ]});
  expect(proposal).toHaveLength(1);
  expect(proposal[0].sourceObjectId).toContain('activity-new');
 });
 it('clamps or rejects untrusted storage values, duplicates and oversized collections',()=>{
  const input=rule('wf_abc123456789');
  const raw=[
   {...input,name:'<script/>',taskLabel:'X',days:900,stage:'Not real',priority:'urgent'},
   {...input,id:'bad',enabled:true},
   input,
   ...Array.from({length:30},(_,i)=>rule('wf_generatedid_'+i.toString().padStart(4,'0'))),
  ];
  const parsed=sanitizeCustomWorkflows(raw);
  expect(parsed).toHaveLength(8);
  expect(parsed[0]).toMatchObject({
   id:'wf_abc123456789',name:'Untitled workflow',taskLabel:'Follow up',
   stage:'Discovery',days:60,priority:'normal',
  });
  expect(new Set(parsed.map(r=>r.id)).size).toBe(8);
  expect(sanitizeCustomWorkflows('not-an-array')).toEqual([]);
  expect(normalizeCustomWorkflow({id:'bad'})).toBeNull();
  expect(isCustomWorkflowId('wf_abc123456789')).toBe(true);
  expect(validWorkflowText('<unsafe>',64)).toBe(false);
 });
 it('never allows edits to silently change the workflow ID or template of origin',()=>{
  const original=rule('wf_abc123456789');
  const changed=changeCustomWorkflow([original],original.id,{
   name:'New name',stage:'Negotiation',priority:'high',
  })[0];
  expect(changed.id).toBe(original.id);
  expect(changed.templateId).toBe('bid-follow-up');
  expect(changed.name).toBe('New name');
  expect(original.stage).toBe('Bid Sent');
  expect(()=>changeCustomWorkflow([original],original.id,{name:'<' })).toThrow();
  const duplicate=cloneCustomWorkflow(original,'wf_other123456789');
  expect(duplicate.enabled).toBe(false);
  expect(duplicate.id).not.toBe(original.id);
  expect(duplicate.stage).toBe(original.stage);
 });
 it('keeps rule identity in history even after a custom workflow is deleted',()=>{
  const custom=rule('wf_abc123456789');
  const settings=sanitizeAutomationSettings({
   customRules:[custom],history:[{
    id:'event',rule:'deal-stage-task',customRuleId:custom.id,
    sourceObjectId:'task-a',taskId:'task-a',title:'Call',at:'2026-11-18T12:00:00Z',
   }],
  });
  expect(settings.customRules).toHaveLength(1);
  expect(settings.history[0].customRuleId).toBe(custom.id);
  expect(sanitizeAutomationSettings({
   customRules:[],history:settings.history,
  }).history[0].customRuleId).toBe(custom.id);
 });
 it('uses existing private Task executor and scoped settings for both manual and app-open runs',()=>{
  const store=source('store/automationStore.ts');
  const runtime=source('components/AutomationRuntime.tsx');
  const workspace=source('components/AutomationsWorkspace.tsx');
  const executor=source('services/automationExecutor358b.ts');
  const controls=source('components/CustomAutomationRules384.tsx');
  expect(store).toContain('addCustom(template)');
  expect(store).toContain('duplicateCustom(id)');
  expect(store).toContain('configureCustom(id,changes)');
  expect(store).toContain('removeCustom(id)');
  expect(store).toContain('customRules:state.customRules');
  expect(runtime).toContain('activities,tasks,rules,customRules,now:new Date()');
  expect(workspace).toContain('<CustomAutomationRules384');
  expect(workspace).toContain('rule===id&&!row.customRuleId');
  expect(executor).toContain("settings.customRules.find(rule=>rule.id===item.customRuleId)");
  expect(executor).toContain('customRuleId:item.customRuleId');
  expect(controls).toContain('Confirm remove');
  expect(controls).toContain('Duplicate');
  expect(controls).toContain('Workflow added, initially disabled.');
  expect(executor).not.toContain('sendGmailMessage(');
  expect(executor).toContain('sourceObjectId===item.sourceObjectId');
 });
});
