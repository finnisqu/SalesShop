import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Project,Activity} from '../types/crm';
import type {SalesQuoteRecord} from './salesQuoteRegistry';
import type {PersonalTask} from '../store/personalTaskStore';
import {automationCandidates,addCalendarDays,sanitizeAutomationSettings,
 type AutomationRules} from './automationRules358b';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const now=new Date('2026-11-16T12:00:00');
const enabled:AutomationRules={
 'quote-delivered':{enabled:true,days:3},
 'deal-inactive':{enabled:true,days:14},
 'deal-won':{enabled:true,days:1},
};
const deal=(more:Partial<Project>={}):Project=>({
 id:'d',name:'Cedar Apartments',stage:'Bid Sent',amount:50000,
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-16T12:00:00Z',assignedUserId:'rep-a',...more,
});
const quote=(more:Partial<SalesQuoteRecord>={}):SalesQuoteRecord=>({
 id:'native:q',source:'salesshop',sourceId:'q',name:'Cedar Countertops',number:'Q1',
 documentType:'Quote',status:'Sent',value:25000,sentDate:'2026-11-15',
 updatedAt:'2026-11-16T10:00:00Z',ownerUserId:'rep-a',projectId:'d',...more,
});
const activity=(more:Partial<Activity>={}):Activity=>({
 id:'won-a',type:'project-stage-changed',projectId:'d',
 summary:'Won',occurredAt:'2026-11-14T12:00:00Z',
 metadata:{toStage:'Closed Won'},...more,
});
const candidates=(deals:Project[],quotes:SalesQuoteRecord[],activities:Activity[]=[],
 tasks:PersonalTask[]=[],mode:'local'|'cloud'='local')=>
 automationCandidates({deals,quotes,activities,tasks,rules:enabled,now,mode,userId:'rep-a'});
describe('Opt-in workflow automations #358b',()=>{
 it('ships disabled rules, with bounded configurations',()=>{
  const safe=sanitizeAutomationSettings(null);
  expect(Object.values(safe.rules).every(rule=>!rule.enabled)).toBe(true);
  expect(safe.autoRunWhileOpen).toBe(false);
  expect(sanitizeAutomationSettings({rules:{'deal-inactive':{enabled:true,days:500}}})
   .rules['deal-inactive'].days).toBe(60);
 });
 it('uses local calendar dates without the UTC DST gap',()=>{
  expect(addCalendarDays('2026-11-15',3)).toBe('2026-11-18');
  expect(addCalendarDays('2026-02-30',3)).toBeNull();
 });
 it('creates only from real confirmed delivery evidence, including external bids',()=>{
  const result=candidates([deal()],[quote(),quote({id:'external:a',source:'external',sourceId:'a'})]);
  expect(result.filter(item=>item.rule==='quote-delivered')).toHaveLength(2);
  expect(result[0].changes.sourceObjectId).toContain('automation:');
  expect(candidates([deal()],[quote({sentDate:undefined})])
    .filter(item=>item.rule==='quote-delivered')).toHaveLength(0);
 });
 it('does not duplicate historical, canceled or removed Tasks',()=>{
  const candidate=candidates([deal()],[quote()])[0];
  const existing={id:'t',title:'Old',sourceObjectId:candidate.sourceObjectId,
   deletedAt:'2026-11-15',createdAt:'2026-11-15',updatedAt:'2026-11-15'} as PersonalTask;
  expect(candidates([deal()],[quote()],[],[existing])
    .filter(item=>item.rule==='quote-delivered')).toHaveLength(0);
 });
 it('only considers current assigned-owner Deals and recent interaction events',()=>{
  const idle=deal({stage:'Discovery',createdAt:'2026-10-01T12:00:00Z'});
  expect(candidates([idle],[]).some(item=>item.rule==='deal-inactive')).toBe(true);
  expect(candidates([idle],[],[activity({type:'manual-touchpoint',
   occurredAt:'2026-11-10T12:00:00Z',metadata:{interactionMethod:'call'}})])
   .some(item=>item.rule==='deal-inactive')).toBe(false);
  expect(candidates([idle],[],[],[],'cloud').some(item=>item.rule==='deal-inactive')).toBe(true);
  expect(candidates([{...idle,assignedUserId:'other'}],[],[],[],'cloud')).toHaveLength(0);
 });
 it('Won handoff requires an actual stage-change record and carries checklist',()=>{
  const won=deal({stage:'Closed Won'});
  expect(candidates([won],[])).toHaveLength(0);
  const actions=candidates([won],[],[activity()]);
  expect(actions).toHaveLength(1);
  expect(actions[0].rule).toBe('deal-won');
  expect(actions[0].changes.subtasks).toHaveLength(4);
 });
 it('shows real toggles, preview, execution history and app-level live runner',()=>{
  const nav=read('components/RecordsSectionNav.tsx');
  expect(nav).toContain("id:'automations',label:'Automations'");
  expect(read('components/Connections.tsx')).toContain("tab==='automations'&&<AutomationsWorkspace");
  expect(read('App.tsx')).toContain('<AutomationRuntime/>');
  const ui=read('components/AutomationsWorkspace.tsx');
  expect(ui).toContain('Automatically run enabled rules while SalesShop is open');
  expect(ui).toContain('Run enabled rules');
  expect(ui).toContain('Created Task history');
  expect(read('services/automationExecutor358b.ts')).toContain('sourceObjectId===item.sourceObjectId');
  expect(read('services/automationExecutor358b.ts')).toContain("tasks.syncStatus!=='saved'");
  expect(read('components/AutomationRuntime.tsx')).toContain("mode==='cloud'&&taskSync!=='saved'");
  expect(read('components/AutomationRuntime.tsx')).toContain('if(budget.current.count>=20)return;');
 });
});
