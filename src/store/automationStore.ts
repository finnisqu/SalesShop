import {create} from 'zustand';
import {DEFAULT_AUTOMATION_SETTINGS,readAutomationSettings,
 saveAutomationSettings,normalizeAutomationStage,normalizeStageTaskLabel,
 type AutomationRuleId,type AutomationSettings,type AutomationHistoryItem}
 from '../services/automationRules358b';
import {changeCustomWorkflow,cloneCustomWorkflow,makeCustomWorkflowId,
 MAX_CUSTOM_WORKFLOWS,templateWorkflow,type CustomStageWorkflow,
 type WorkflowTemplateId} from '../services/automationCustomWorkflows384';

type Config=Pick<AutomationSettings,'rules'|'customRules'|'autoRunWhileOpen'|'history'>;
interface AutomationState extends Config {
 scope:string|null;
 hydrate:(scope:string|null)=>void;
 configure:(rule:AutomationRuleId,changes:Partial<Config['rules'][AutomationRuleId]>)=>void;
 addCustom:(template:WorkflowTemplateId)=>string|null;
 duplicateCustom:(id:string)=>string|null;
 configureCustom:(id:string,change:Partial<CustomStageWorkflow>)=>void;
 removeCustom:(id:string)=>void;
 toggleLive:(enabled:boolean)=>void;
 log:(item:AutomationHistoryItem)=>void;
}
const fresh=():Config=>({
 rules:{
  'quote-delivered':{...DEFAULT_AUTOMATION_SETTINGS.rules['quote-delivered']},
  'deal-inactive':{...DEFAULT_AUTOMATION_SETTINGS.rules['deal-inactive']},
  'deal-won':{...DEFAULT_AUTOMATION_SETTINGS.rules['deal-won']},
  'deal-stage-task':{...DEFAULT_AUTOMATION_SETTINGS.rules['deal-stage-task']},
 },
 customRules:[],
 autoRunWhileOpen:false,
 history:[],
});
export const useAutomationStore=create<AutomationState>((set,get)=>({
 scope:null,...fresh(),
 hydrate(scope){
  if(get().scope===scope)return;
  const config=scope?readAutomationSettings(scope):fresh();
  set({scope,...config});
 },
 configure(rule,changes){
  const state=get();if(!state.scope)return;
  const original=state.rules[rule];
  const days=changes.days===undefined?original.days:Math.max(1,Math.min(60,Math.round(changes.days)));
  const options=rule==='deal-stage-task'?{
   enabled:changes.enabled??original.enabled,days,
   stage:normalizeAutomationStage(changes.stage??original.stage),
   taskLabel:normalizeStageTaskLabel(changes.taskLabel??original.taskLabel),
  }:{enabled:changes.enabled??original.enabled,days};
  const rules={...state.rules,[rule]:options};
  saveAutomationSettings(state.scope,{rules,customRules:state.customRules,
   autoRunWhileOpen:state.autoRunWhileOpen,history:state.history});
  set({rules});
 },
 addCustom(template){
  const state=get();if(!state.scope||state.customRules.length>=MAX_CUSTOM_WORKFLOWS)return null;
  let id=makeCustomWorkflowId();
  while(state.customRules.some(item=>item.id===id))id=makeCustomWorkflowId();
  const rule=templateWorkflow(template,id),customRules=[...state.customRules,rule];
  saveAutomationSettings(state.scope,{rules:state.rules,customRules,
   autoRunWhileOpen:state.autoRunWhileOpen,history:state.history});
  set({customRules});
  return id;
 },
 duplicateCustom(id){
  const state=get();if(!state.scope||state.customRules.length>=MAX_CUSTOM_WORKFLOWS)return null;
  const original=state.customRules.find(row=>row.id===id);
  if(!original)return null;
  let nextId=makeCustomWorkflowId();
  while(state.customRules.some(row=>row.id===nextId))nextId=makeCustomWorkflowId();
  const customRules=[...state.customRules,cloneCustomWorkflow(original,nextId)];
  saveAutomationSettings(state.scope,{rules:state.rules,customRules,
   autoRunWhileOpen:state.autoRunWhileOpen,history:state.history});
  set({customRules});
  return nextId;
 },
 configureCustom(id,changes){
  const state=get();if(!state.scope||!state.customRules.some(row=>row.id===id))return;
  const customRules=changeCustomWorkflow(state.customRules,id,changes);
  saveAutomationSettings(state.scope,{rules:state.rules,customRules,
   autoRunWhileOpen:state.autoRunWhileOpen,history:state.history});
  set({customRules});
 },
 removeCustom(id){
  const state=get();if(!state.scope)return;
  const customRules=state.customRules.filter(row=>row.id!==id);
  if(customRules.length===state.customRules.length)return;
  saveAutomationSettings(state.scope,{rules:state.rules,customRules,
   autoRunWhileOpen:state.autoRunWhileOpen,history:state.history});
  set({customRules});
 },
 toggleLive(autoRunWhileOpen){
  const state=get();if(!state.scope)return;
  saveAutomationSettings(state.scope,{rules:state.rules,customRules:state.customRules,
   autoRunWhileOpen,history:state.history});
  set({autoRunWhileOpen});
 },
 log(item){
  const state=get();if(!state.scope||state.history.some(row=>row.sourceObjectId===item.sourceObjectId))return;
  const history=[item,...state.history].slice(0,150);
  saveAutomationSettings(state.scope,{rules:state.rules,customRules:state.customRules,
   autoRunWhileOpen:state.autoRunWhileOpen,history});
  set({history});
 },
}));
