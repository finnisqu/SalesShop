import {useState} from 'react';
import {useAutomationStore} from '../store/automationStore';
import {AUTOMATION_STAGE_CHOICES,type AutomationCandidate} from '../services/automationRules358b';
import {MAX_CUSTOM_WORKFLOWS,WORKFLOW_TEMPLATES,validWorkflowText,
 type CustomStageWorkflow,type WorkflowTemplateId} from '../services/automationCustomWorkflows384';
import './custom-automations384.css';

/** Separate opt-in workflows supplement the original four automation rules. */
export function CustomAutomationRules384({scope,ready,candidates}:{
 scope:string|null;ready:boolean;candidates:readonly AutomationCandidate[];
}){
 const rules=useAutomationStore(state=>state.customRules);
 const create=useAutomationStore(state=>state.addCustom);
 const duplicate=useAutomationStore(state=>state.duplicateCustom);
 const configure=useAutomationStore(state=>state.configureCustom);
 const remove=useAutomationStore(state=>state.removeCustom);
 const [template,setTemplate]=useState<WorkflowTemplateId>('blank');
 const [editing,setEditing]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const full=rules.length>=MAX_CUSTOM_WORKFLOWS;
 const action=(fn:()=>string|null|void,success:string)=>{
  if(!ready)return;
  try{
   const id=fn();
   if(typeof id==='string')setEditing(id);
   setMessage(id===null?'Maximum of '+MAX_CUSTOM_WORKFLOWS+' workflows reached.':success);
  }catch(error){
   setMessage(error instanceof Error?error.message:'Could not save workflow.');
  }
 };
 return <section className="ss-custom-workflows" aria-label="My custom workflows">
  <header>
   <div><h3>My workflows <small>{rules.length}/{MAX_CUSTOM_WORKFLOWS}</small></h3>
    <p>Create several stage-triggered Task rules, each with its own timing. Start from a template or a blank rule.</p>
   </div>
  </header>
  <div className="ss-custom-workflow-create">
   <label>Start from
    <select value={template} onChange={e=>setTemplate(e.target.value as WorkflowTemplateId)}
     disabled={!ready||full}>
     {WORKFLOW_TEMPLATES.map(item=><option key={item.id} value={item.id}>
      {item.name}</option>)}
    </select>
   </label>
   <button type="button" disabled={!ready||full}
    onClick={()=>action(()=>create(template),'Workflow added, initially disabled.')}>
    + Add workflow
   </button>
  </div>
  <small className="ss-custom-workflow-template-description">
   {WORKFLOW_TEMPLATES.find(item=>item.id===template)?.description}
  </small>
  {!rules.length&&<p className="ss-custom-workflow-empty">No custom workflows yet.
   Add a template to customize its stage, Task name and timing. New workflows start off.</p>}
  <div className="ss-custom-workflow-list">
   {rules.map(rule=><article key={rule.id} className="ss-custom-workflow-card">
    <div className="ss-custom-workflow-card-top">
     <div><strong>{rule.name}</strong>
      <small>{rule.stage} → {rule.taskLabel} · {rule.days} {rule.days===1?'day':'days'} after</small>
     </div>
     <div className="ss-custom-workflow-card-actions">
      <label className="ss-custom-workflow-enable">
       <input type="checkbox" checked={rule.enabled} disabled={!ready}
        onChange={e=>action(()=>configure(rule.id,{enabled:e.target.checked}),
         e.target.checked?'Workflow enabled.':'Workflow paused.')}/>
       <span>{rule.enabled?'On':'Off'}</span>
      </label>
      <button type="button" aria-expanded={editing===rule.id}
       onClick={()=>setEditing(current=>current===rule.id?null:rule.id)}>
       {editing===rule.id?'Close':'Edit'}
      </button>
     </div>
    </div>
    <div className="ss-custom-workflow-card-meta">
     <span>{candidates.filter(item=>item.customRuleId===rule.id).length} new matches</span>
     <span>Private Task · {rule.priority==='high'?'High':'Normal'} priority</span>
    </div>
    {editing===rule.id&&<CustomWorkflowEditor384 key={scope+':'+rule.id}
     rule={rule} ready={ready} full={full}
     configure={changes=>action(()=>configure(rule.id,changes),'Workflow saved.')}
     duplicate={()=>action(()=>duplicate(rule.id),'Workflow copied, initially disabled.')}
     remove={()=>action(()=>{remove(rule.id);setEditing(null);},'Workflow removed; existing Tasks retained.')}/>}
   </article>)}
  </div>
  {message&&<p className="ss-custom-workflow-message" role="status">{message}</p>}
  <p className="ss-custom-workflow-footnote">All rules are personal to this browser and current
   SalesShop Task scope. A rule requires a confirmed recent Deal-stage change and your
   assigned ownership. Removing a workflow never deletes Tasks it already created.
   Execution remains manual unless you explicitly enable app-open checks above.</p>
 </section>;
}
function CustomWorkflowEditor384({rule,ready,full,configure,duplicate,remove}:{
 rule:CustomStageWorkflow;ready:boolean;full:boolean;
 configure:(changes:Partial<CustomStageWorkflow>)=>void;
 duplicate:()=>void;remove:()=>void;
}){
 const [name,setName]=useState<string|null>(null);
 const [taskLabel,setTaskLabel]=useState<string|null>(null);
 const [confirmRemove,setConfirmRemove]=useState(false);
 const currentName=name??rule.name,currentTask=taskLabel??rule.taskLabel;
 const namesValid=validWorkflowText(currentName,64)&&validWorkflowText(currentTask,70);
 const changed=currentName.trim()!==rule.name||currentTask.trim()!==rule.taskLabel;
 return <div className="ss-custom-workflow-editor">
  <div className="ss-custom-workflow-fields">
   <label>Workflow name
    <input type="text" maxLength={64} disabled={!ready} value={currentName}
     aria-invalid={!validWorkflowText(currentName,64)}
     onChange={e=>setName(e.target.value)}/>
   </label>
   <label>When Deal enters
    <select value={rule.stage} disabled={!ready}
     onChange={e=>configure({stage:e.target.value as CustomStageWorkflow['stage']})}>
     {AUTOMATION_STAGE_CHOICES.map(stage=><option value={stage} key={stage}>{stage}</option>)}
    </select>
   </label>
   <label>Task title
    <input type="text" maxLength={70} disabled={!ready} value={currentTask}
     aria-invalid={!validWorkflowText(currentTask,70)}
     onChange={e=>setTaskLabel(e.target.value)}/>
   </label>
   <label>Days after stage change
    <input type="number" min={1} max={60} step={1} value={rule.days} disabled={!ready}
     onChange={e=>{
      const days=Number(e.target.value);
      if(Number.isInteger(days)&&days>=1&&days<=60)configure({days});
     }}/>
   </label>
   <label>Task priority
    <select value={rule.priority} disabled={!ready}
     onChange={e=>configure({priority:e.target.value as CustomStageWorkflow['priority']})}>
     <option value="normal">Normal</option><option value="high">High</option>
    </select>
   </label>
  </div>
  <div className="ss-custom-workflow-editor-actions">
   <button type="button" disabled={!ready||!namesValid||!changed}
    onClick={()=>{configure({name:currentName.trim(),taskLabel:currentTask.trim()});
     setName(null);setTaskLabel(null);}}>Save names</button>
   <button type="button" disabled={!ready||full} onClick={duplicate}>Duplicate</button>
   <button type="button" disabled={!ready} onClick={()=>setConfirmRemove(!confirmRemove)}>
    {confirmRemove?'Cancel removal':'Remove'}
   </button>
  </div>
  {!namesValid&&<small role="alert">Names need 2–64 and 2–70 characters respectively, without markup.</small>}
  {confirmRemove&&<div className="ss-custom-workflow-remove-confirm">
   <span>Remove this workflow? Existing generated Tasks and history remain.</span>
   <button type="button" disabled={!ready} onClick={remove}>Confirm remove</button>
  </div>}
 </div>;
}
