import {useEffect,useMemo,useRef} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {taskScope,usePersonalTaskStore} from '../store/personalTaskStore';
import {useAutomationStore} from '../store/automationStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {buildSalesQuoteRegistry,mySalesQuoteRegistry} from '../services/salesQuoteRegistry';
import {automationCandidates} from '../services/automationRules358b';
import {executeAutomationCandidates} from '../services/automationExecutor358b';
/** Mounted at the app level so enabled rules react to visible CRM changes while
 * SalesShop is running, even outside the Automations page. No background claims. */
export function AutomationRuntime(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
 user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
 department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const projects=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities),
 crmReady=useCrmStore(s=>s.hydrated);
 const quotes=useQuoteStore(s=>s.quotes),quotesReady=useQuoteStore(s=>s.hydrated);
 const storedTaskScope=usePersonalTaskStore(s=>s.scope),tasks=usePersonalTaskStore(s=>s.tasks),
 taskSync=usePersonalTaskStore(s=>s.syncStatus);
 const scope=taskScope(mode,org,user);
 const automationScope=useAutomationStore(s=>s.scope),rules=useAutomationStore(s=>s.rules),
 autoRun=useAutomationStore(s=>s.autoRunWhileOpen);
 const allowed=!perspective&&(mode==='local'||canEditTeamArea(role,department,'crm'));
 // Avoid a runaway catch-up after receiving consecutive cloud sync snapshots.
 // Manual execution on the Automations page remains available for deliberate backfill.
 const budget=useRef({scope:'',count:0});
 useEffect(()=>{useAutomationStore.getState().hydrate(scope);},[scope]);
 const personalQuotes=useMemo(()=>{
  if(!crmReady||!quotesReady)return [];
  const registry=buildSalesQuoteRegistry(quotes,activities,projects);
  return mySalesQuoteRegistry(registry,mode,user,projects);
 },[crmReady,quotesReady,quotes,activities,projects,mode,user]);
 useEffect(()=>{
  if(!allowed||!scope||storedTaskScope!==scope||automationScope!==scope||
   (mode==='cloud'&&taskSync!=='saved')||!crmReady||!quotesReady||!autoRun)return;
  if(budget.current.scope!==scope)budget.current={scope,count:0};
  if(budget.current.count>=20)return;
  const candidates=automationCandidates({deals:projects,quotes:personalQuotes,
   activities,tasks,rules,now:new Date(),mode,userId:user});
  if(candidates.length){
   const room=20-budget.current.count;
   // Reserve the quota before creating Tasks. Reentrant store updates should
   // never start a second execution against the same candidate snapshot.
   budget.current.count+=Math.min(room,candidates.length);
   executeAutomationCandidates(scope,candidates.slice(0,room));
  }
 },[allowed,scope,storedTaskScope,automationScope,crmReady,quotesReady,
  autoRun,projects,personalQuotes,activities,tasks,rules,mode,user,taskSync]);
 return null;
}
