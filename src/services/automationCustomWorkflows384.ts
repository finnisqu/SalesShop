import {PROJECT_STAGES,type ProjectStage} from '../types/crm';

/** #384: Personal, browser-configured stage workflows; only Tasks are created.
 * These IDs identify rules for deduplication, never for security checks. */
export const MAX_CUSTOM_WORKFLOWS=8;
export const WORKFLOW_TEMPLATES=[
 {id:'blank',name:'New workflow',description:'Choose any Deal stage and Task.',
  stage:'Discovery',days:3,taskLabel:'Follow up',priority:'normal'},
 {id:'bid-follow-up',name:'Bid follow-up',description:'Check back after a bid is sent.',
  stage:'Bid Sent',days:3,taskLabel:'Check bid status',priority:'normal'},
 {id:'negotiation',name:'Negotiation checkpoint',description:'Review terms and next steps.',
  stage:'Negotiation',days:2,taskLabel:'Review proposal terms',priority:'high'},
 {id:'won-handoff',name:'Won Deal kickoff',description:'Coordinate the first internal handoff.',
  stage:'Closed Won',days:1,taskLabel:'Schedule project handoff',priority:'high'},
 {id:'discovery',name:'Discovery follow-up',description:'Confirm requirements for a new opportunity.',
  stage:'Discovery',days:2,taskLabel:'Confirm discovery requirements',priority:'normal'},
] as const;
export type WorkflowTemplateId=(typeof WORKFLOW_TEMPLATES)[number]['id'];
export type WorkflowPriority='normal'|'high';
export interface CustomStageWorkflow {
 id:string;name:string;enabled:boolean;
 stage:ProjectStage;days:number;taskLabel:string;priority:WorkflowPriority;
 templateId?:WorkflowTemplateId;
}
export const isCustomWorkflowId=(value:unknown):value is string=>
 typeof value==='string'&&/^wf_[a-z0-9_-]{8,70}$/.test(value);
const safeText=(value:unknown,max:number):value is string=>
 typeof value==='string'&&value.trim().length>=2&&value.trim().length<=max&&
 !/[\u0000-\u001f<>]/.test(value);
export const validWorkflowText=(value:unknown,max:number)=>
 safeText(value,max);
export const customWorkflowStage=(stage:unknown):ProjectStage=>
 PROJECT_STAGES.find(item=>item===stage)??'Discovery';
export const customWorkflowDays=(days:unknown):number=>
 typeof days==='number'&&Number.isInteger(days)
 ?Math.max(1,Math.min(60,days)):3;
export function templateWorkflow(id:WorkflowTemplateId,ruleId:string):CustomStageWorkflow{
 if(!isCustomWorkflowId(ruleId))throw new Error('Invalid workflow ID');
 const template=WORKFLOW_TEMPLATES.find(item=>item.id===id);
 if(!template)throw new Error('Unknown workflow template');
 return {id:ruleId,name:template.name,enabled:false,
  stage:template.stage,days:template.days,taskLabel:template.taskLabel,
  priority:template.priority,templateId:id};
}
export function normalizeCustomWorkflow(value:unknown):CustomStageWorkflow|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const item=value as Record<string,unknown>;
 if(!isCustomWorkflowId(item.id))return null;
 const selectedTemplate=WORKFLOW_TEMPLATES.find(template=>template.id===item.templateId);
 return {
  id:item.id,name:safeText(item.name,64)?item.name.trim():'Untitled workflow',
  enabled:item.enabled===true,
  stage:customWorkflowStage(item.stage),days:customWorkflowDays(item.days),
  taskLabel:safeText(item.taskLabel,70)?item.taskLabel.trim():'Follow up',
  priority:item.priority==='high'?'high':'normal',
  ...(selectedTemplate?{templateId:selectedTemplate.id}:{}),
 };
}
export function sanitizeCustomWorkflows(value:unknown):CustomStageWorkflow[]{
 if(!Array.isArray(value))return [];
 const seen=new Set<string>(),list:CustomStageWorkflow[]=[];
 for(const raw of value.slice(0,100)){
  const rule=normalizeCustomWorkflow(raw);
  if(!rule||seen.has(rule.id))continue;
  seen.add(rule.id);list.push(rule);
  if(list.length>=MAX_CUSTOM_WORKFLOWS)break;
 }
 return list;
}
export function changeCustomWorkflow(
 workflows:readonly CustomStageWorkflow[],id:string,change:Partial<
 Pick<CustomStageWorkflow,'name'|'stage'|'days'|'taskLabel'|'priority'|'enabled'>>,
):CustomStageWorkflow[]{
 return workflows.map(rule=>{
  if(rule.id!==id)return rule;
  // Only editable properties may change; the persisted ID and origin
  // template are immutable even if an untyped caller supplies extra keys.
  const next=normalizeCustomWorkflow({
   ...rule,
   name:change.name??rule.name,stage:change.stage??rule.stage,
   days:change.days??rule.days,taskLabel:change.taskLabel??rule.taskLabel,
   priority:change.priority??rule.priority,enabled:change.enabled??rule.enabled,
  });
  if(!next)throw new Error('Invalid workflow');
  if(change.name!==undefined&&!safeText(change.name,64))throw new Error('Use a workflow name of 2–64 characters.');
  if(change.taskLabel!==undefined&&!safeText(change.taskLabel,70))
   throw new Error('Use a Task name of 2–70 characters.');
  return next;
 });
}
export function cloneCustomWorkflow(source:CustomStageWorkflow,id:string):CustomStageWorkflow{
 if(!isCustomWorkflowId(id))throw new Error('Invalid workflow ID');
 return {...source,id,enabled:false,name:(source.name.slice(0,58)+' copy').slice(0,64)};
}
export function makeCustomWorkflowId():string{
 // A display/persistence identifier, not a permission or authentication token.
 return 'wf_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);
}
