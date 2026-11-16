import {create} from 'zustand';
import {AUTOMATION_IDS,DEFAULT_AUTOMATION_SETTINGS,readAutomationSettings,
 saveAutomationSettings,type AutomationRuleId,type AutomationSettings,type AutomationHistoryItem}
 from '../services/automationRules358b';

type Config=Pick<AutomationSettings,'rules'|'autoRunWhileOpen'|'history'>;
interface AutomationState extends Config {
 scope:string|null;
 hydrate:(scope:string|null)=>void;
 configure:(rule:AutomationRuleId,changes:Partial<Config['rules'][AutomationRuleId]>)=>void;
 toggleLive:(enabled:boolean)=>void;
 log:(item:AutomationHistoryItem)=>void;
}
const fresh=():Config=>({
 rules:Object.fromEntries(AUTOMATION_IDS.map(id=>[id,{...DEFAULT_AUTOMATION_SETTINGS.rules[id]}]))
  as Config['rules'],
 autoRunWhileOpen:false,history:[],
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
  const rules={...state.rules,[rule]:{enabled:changes.enabled??original.enabled,days}};
  saveAutomationSettings(state.scope,{rules,autoRunWhileOpen:state.autoRunWhileOpen,history:state.history});
  set({rules});
 },
 toggleLive(autoRunWhileOpen){
  const state=get();if(!state.scope)return;
  saveAutomationSettings(state.scope,{rules:state.rules,autoRunWhileOpen,history:state.history});
  set({autoRunWhileOpen});
 },
 log(item){
  const state=get();if(!state.scope||state.history.some(row=>row.sourceObjectId===item.sourceObjectId))return;
  const history=[item,...state.history].slice(0,150);
  saveAutomationSettings(state.scope,{rules:state.rules,autoRunWhileOpen:state.autoRunWhileOpen,history});
  set({history});
 },
}));
