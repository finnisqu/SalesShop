import {useState} from 'react';
import {CRM_MODULE_PLANS,type CrmModulePlans} from '../services/crmConfiguration352e2';
import {CRM_FIELD_TARGETS,type CrmFieldBlueprint,type CrmFieldTarget} from '../services/crmFieldBlueprint352b';
import {
 CRM_SETUP_TEMPLATES,CRM_SETUP_PANEL_LABELS,CRM_SETUP_PANEL_IDS,
 createCrmGuidedPreset,validateCrmGuidedSetup,previewCrmGuidedSetup,
 updateCrmSetupPanel,updateCrmSetupStage,moveCrmSetupStage,
 type CrmGuidedSetupDraft,type CrmGuidedSetupPlan,type CrmSetupTemplateId,
 type CrmSetupView,
} from '../services/crmGuidedSetup380';
import '../crm-guided-setup380.css';

type Step='choose'|'customize'|'review';
const STEP_NAMES:readonly {id:Step;label:string}[]=[
 {id:'choose',label:'1 · Start'},{id:'customize',label:'2 · Customize'},
 {id:'review',label:'3 · Review & save'},
];
export function CrmGuidedSetup380({
 editable,scope,saved,blueprint,modules,onApply,
}:{
 editable:boolean;scope:string;saved:CrmGuidedSetupDraft|null;
 blueprint:CrmFieldBlueprint;modules:CrmModulePlans;
 onApply:(plan:CrmGuidedSetupPlan)=>void;
}){
 const [step,setStep]=useState<Step>('choose');
 const [draft,setDraft]=useState<CrmGuidedSetupDraft>(
  ()=>saved??createCrmGuidedPreset('blank'));
 const [recordTarget,setRecordTarget]=useState<CrmFieldTarget>('deal');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const dirty=JSON.stringify(draft)!==JSON.stringify(saved);
 const errors=validateCrmGuidedSetup(draft);
 let preview:CrmGuidedSetupPlan|null=null;
 let previewError='';
 if(!errors.length){
  try{preview=previewCrmGuidedSetup(blueprint,modules,draft);}
  catch(caught){previewError=caught instanceof Error?caught.message:'Cannot preview setup.';}
 }
 const preset=CRM_SETUP_TEMPLATES.find(item=>item.id===draft.template)!;
 const choose=(id:CrmSetupTemplateId)=>{
  setDraft(createCrmGuidedPreset(id));
  setError('');setNotice('');
 };
 const setTerm=(key:CrmFieldTarget,value:string)=>{
  setDraft(current=>({...current,
   terminology:{...current.terminology,[key]:value},
  }));
 };
 const selectPanel=(id:typeof CRM_SETUP_PANEL_IDS[number],
  change:'up'|'down'|'toggle')=>{
  setDraft(current=>updateCrmSetupPanel(current,recordTarget,id,change));
 };
 const addStage=()=>{
  setDraft(current=>{
   if(current.stages.length>=9)return current;
   let number=current.stages.length+1;
   while(current.stages.some(stage=>stage.toLowerCase()==='stage '+number))number++;
   return {...current,stages:[...current.stages,'Stage '+number]};
  });
 };
 const goReview=()=>{
  if(errors.length||previewError){
   setError(errors[0]??previewError);
   return;
  }
  setError('');setNotice('');setStep('review');
 };
 const apply=()=>{
  if(!editable)return;
  try{
   const plan=previewCrmGuidedSetup(blueprint,modules,draft);
   onApply(plan);
   setError('');
   setNotice('Saved this setup draft to your browser for this SalesShop workspace. '+
    'Optional field definitions and module plans were merged without overwriting existing definitions.');
  }catch(caught){
   setError(caught instanceof Error?caught.message:'Could not save setup.');
   setNotice('');
  }
 };
 return <article className="company-settings-card crm-guided-setup" aria-label="Guided CRM setup">
  <header><div>
   <strong>Guided CRM Setup</strong>
   <small>Start with a template. Make it your own. Review every change before saving.</small>
  </div>
   <span className="crm-guided-save-state">
    {saved?'Local draft saved':'Not configured'}
   </span>
  </header>
  <p className="crm-guided-scope-note">
   <strong>Design mode only.</strong> Drafts belong to this browser, organization and
   signed-in user. They do not change live record names, Deal stages, permissions,
   shared views, customer data or team settings.
  </p>
  {!editable&&<p className="crm-guided-readonly" role="status">
   Only owners or admins can save a setup draft. You can inspect its preview here.
  </p>}
  <nav className="crm-guided-steps" aria-label="CRM setup steps">
   {STEP_NAMES.map((item,index)=><button type="button" key={item.id}
    aria-current={step===item.id?'step':undefined}
    onClick={()=>{
     if(index===2){goReview();return;}
     setError('');setNotice('');setStep(item.id);
    }}>{item.label}</button>)}
  </nav>
  {step==='choose'&&<div className="crm-guided-step" aria-label="Choose a CRM starting template">
   <div className="crm-guided-heading"><strong>Choose your starting point</strong>
    <small>Templates add optional fields later; none are installed until you save.</small></div>
   <div className="crm-guided-templates">
    {CRM_SETUP_TEMPLATES.map(item=><button type="button" key={item.id}
     className="crm-guided-template"
     aria-pressed={draft.template===item.id}
     onClick={()=>choose(item.id)}>
     <strong>{item.label}</strong>
     <span>{item.description}</span>
     <small>{item.fieldPack?'Optional starter field pack':'No optional fields'}</small>
    </button>)}
   </div>
   {saved&&<button type="button" className="crm-guided-restore"
    onClick={()=>{setDraft(saved);setError('');setNotice('');}}>
    Restore last saved setup
   </button>}
   <div className="crm-guided-step-footer">
    <span>Selected: <strong>{preset.label}</strong></span>
    <button type="button" className="crm-guided-primary"
     onClick={()=>{setStep('customize');setError('');setNotice('');}}>
     Customize setup →</button>
   </div>
  </div>}
  {step==='customize'&&<div className="crm-guided-step" aria-label="Customize CRM workflow and layout">
   <div className="crm-guided-heading">
    <strong>Shape the working experience</strong>
    <small>These choices update the live preview, not your existing CRM.</small>
   </div>
   <div className="crm-guided-form-grid">
    <section aria-label="Record terminology" className="crm-guided-edit-group">
     <h3>Record names</h3>
     <p>How your team would refer to the three universal record types.</p>
     <div className="crm-guided-three-fields">
      {CRM_FIELD_TARGETS.map(item=><label key={item.id}>
       <span>{item.label}</span>
       <input maxLength={28} value={draft.terminology[item.id]}
        onChange={e=>setTerm(item.id,e.target.value)} disabled={!editable}/>
      </label>)}
     </div>
    </section>
    <section aria-label="Pipeline stages" className="crm-guided-edit-group">
     <h3>Sales workflow</h3>
     <label><span>Pipeline name</span>
      <input value={draft.pipelineName} maxLength={44} disabled={!editable}
       onChange={e=>setDraft(current=>({...current,pipelineName:e.target.value}))}/>
     </label>
     <div className="crm-guided-stage-list">
      {draft.stages.map((stage,index)=><div key={index} className="crm-guided-stage-row">
       <span className="crm-guided-stage-number">{index+1}</span>
       <input aria-label={'Pipeline stage '+(index+1)} maxLength={36}
        value={stage} disabled={!editable}
        onChange={e=>setDraft(current=>updateCrmSetupStage(current,index,e.target.value))}/>
       <button type="button" aria-label={'Move stage '+(index+1)+' up'}
        disabled={!editable||index===0}
        onClick={()=>setDraft(current=>moveCrmSetupStage(current,index,-1))}>↑</button>
       <button type="button" aria-label={'Move stage '+(index+1)+' down'}
        disabled={!editable||index===draft.stages.length-1}
        onClick={()=>setDraft(current=>moveCrmSetupStage(current,index,1))}>↓</button>
       <button type="button" aria-label={'Remove stage '+(index+1)}
        disabled={!editable||draft.stages.length<=2}
        onClick={()=>setDraft(current=>({...current,
         stages:current.stages.filter((_,i)=>i!==index)}))}>×</button>
      </div>)}
     </div>
     <button type="button" className="crm-guided-secondary"
      disabled={!editable||draft.stages.length>=9} onClick={addStage}>+ Add stage</button>
    </section>
    <section className="crm-guided-edit-group" aria-label="Default directory views">
     <h3>Starting views</h3>
     <p>Draft defaults for Records directories; existing saved views are untouched.</p>
     <div className="crm-guided-two-fields">
      {([{key:'companies',title:'Companies'},{key:'deals',title:'Deals'}] as const)
       .map(item=><label key={item.key}><span>{item.title}</span>
        <select disabled={!editable} value={draft.views[item.key]}
         onChange={e=>setDraft(current=>({...current,
          views:{...current.views,[item.key]:e.target.value as CrmSetupView}}))}>
         <option value="table">Table</option><option value="board">Board</option>
        </select>
       </label>)}
     </div>
    </section>
    <section className="crm-guided-edit-group" aria-label="Record page panels">
     <h3>Record page arrangement</h3>
     <p>Reorder sections and hide optional sections. Details and Connections stay available.</p>
     <div className="crm-guided-target-picker" role="group" aria-label="Record layout target">
      {CRM_FIELD_TARGETS.map(item=><button type="button" key={item.id}
       aria-pressed={recordTarget===item.id} onClick={()=>setRecordTarget(item.id)}>
       {item.label}</button>)}
     </div>
     <div className="crm-guided-panel-list">
      {draft.panels[recordTarget].map((panel,index)=><div key={panel.id}
       className="crm-guided-panel-row">
       <label><input type="checkbox" disabled={!editable||panel.id==='details'||panel.id==='connections'}
        checked={panel.visible} onChange={()=>selectPanel(panel.id,'toggle')}/>
        <span>{CRM_SETUP_PANEL_LABELS[panel.id]}</span>
       </label>
       <div>
        <button type="button" aria-label={'Move '+CRM_SETUP_PANEL_LABELS[panel.id]+' up'}
         disabled={!editable||index===0}
         onClick={()=>selectPanel(panel.id,'up')}>↑</button>
        <button type="button" aria-label={'Move '+CRM_SETUP_PANEL_LABELS[panel.id]+' down'}
         disabled={!editable||index===draft.panels[recordTarget].length-1}
         onClick={()=>selectPanel(panel.id,'down')}>↓</button>
       </div>
      </div>)}
     </div>
    </section>
    <section className="crm-guided-edit-group crm-guided-wide" aria-label="Optional module plans">
     <h3>Optional capabilities to plan</h3>
     <p>Planning only—these options do not create automated tasks or enable new modules.</p>
     <div className="crm-guided-module-list">
      {CRM_MODULE_PLANS.map(item=><label key={item.id}>
       <input type="checkbox" disabled={!editable} checked={draft.modules[item.id]}
        onChange={e=>setDraft(current=>({...current,
         modules:{...current.modules,[item.id]:e.target.checked}}))}/>
       <span><strong>{item.label}</strong><small>{item.description}</small></span>
      </label>)}
     </div>
    </section>
   </div>
   <CrmSetupLivePreview draft={draft} target={recordTarget}/>
   <div className="crm-guided-step-footer">
    <button type="button" className="crm-guided-secondary"
     onClick={()=>{setStep('choose');setError('');}}>← Templates</button>
    <button type="button" className="crm-guided-primary" onClick={goReview}>
     Review configuration →</button>
   </div>
  </div>}
  {step==='review'&&<div className="crm-guided-step" aria-label="Review CRM configuration changes">
   <div className="crm-guided-heading"><strong>Review before saving</strong>
    <small>Nothing is changed on live records or shared with colleagues.</small></div>
   <div className="crm-guided-review-metrics" aria-live="polite">
    <div><strong>{preview?.fieldsToAdd??'—'}</strong><span>new field definitions</span></div>
    <div><strong>{preview?.existingFields??'—'}</strong><span>existing fields preserved</span></div>
    <div><strong>{preview?.conflictingFields??'—'}</strong><span>type conflicts skipped</span></div>
    <div><strong>{preview?.modulePlansToAdd??'—'}</strong><span>new module plans</span></div>
   </div>
   {preview?.packPreview&&<div className="crm-guided-field-review">
    <strong>Starter field changes</strong>
    <ul>{preview.packPreview.fields.map(({field,status})=><li key={field.target+':'+field.label}>
     <span>{CRM_FIELD_TARGETS.find(item=>item.id===field.target)?.label} · {field.label}</span>
     <small>{status==='add'?'Add':status==='present'?'Keep existing':'Skip conflict'}</small>
    </li>)}</ul>
   </div>}
   {draft.template==='blank'&&<p className="crm-guided-blank-note">
    Blank setup: your existing custom field definitions remain unchanged.
   </p>}
   <CrmSetupLivePreview draft={draft} target={recordTarget}/>
   <p className="crm-guided-review-safety">
    Saving records this plan in the current browser, adds only missing optional starter fields,
    and merges selected module planning flags. It does not remove fields, alter customer records,
    overwrite previously planned modules, publish permissions, or change live Deal stages.
   </p>
   {(errors.length>0||previewError)&&<p role="alert" className="crm-guided-error">
    {errors[0]??previewError}
   </p>}
   <div className="crm-guided-step-footer">
    <button type="button" className="crm-guided-secondary"
     onClick={()=>{setStep('customize');setError('');}}>← Make changes</button>
    <button type="button" className="crm-guided-primary"
     disabled={!editable||!preview||!dirty&&preview.fieldsToAdd===0&&preview.modulePlansToAdd===0}
     onClick={apply}>Save local setup draft</button>
   </div>
  </div>}
  {error&&<p role="alert" className="crm-guided-error">{error}</p>}
  {notice&&<p role="status" className="crm-guided-success">{notice}</p>}
  <footer className="crm-guided-footnote">
   Live team-wide stages, terminology, record layouts and shared custom field values
   remain unavailable until their database permissions and deployment are reviewed.
   You can continue fine-tuning field definitions in the sections below.
   <span className="crm-guided-scoped-key" aria-hidden="true">
    {scope?'Browser draft · account-scoped':''}
   </span>
  </footer>
 </article>;
}
function CrmSetupLivePreview({draft,target}:{
 draft:CrmGuidedSetupDraft;target:CrmFieldTarget;
}){
 const title=draft.terminology[target];
 return <div className="crm-guided-live-preview" aria-label="Sample record layout preview">
  <div className="crm-guided-live-preview-heading">
   <strong>Preview · Example {title}</strong>
   <small>{draft.pipelineName} · {draft.views.deals==='board'?'Board':'Table'} preference</small>
  </div>
  <div className="crm-guided-stage-preview">
   {draft.stages.map((stage,index)=><span key={index}>{stage||'Unnamed stage'}</span>)}
  </div>
  <div className="crm-guided-record-columns">
   {draft.panels[target].filter(panel=>panel.visible).map(panel=>
    <div key={panel.id} className="crm-guided-record-panel">
     <strong>{CRM_SETUP_PANEL_LABELS[panel.id]}</strong>
     <small>{panel.id==='details'?'Core fields + optional definitions':
      panel.id==='connections'?'Linked records':'Optional record section'}</small>
    </div>)}
  </div>
  <small className="crm-guided-preview-caption">Illustration only · No live CRM layout changes</small>
 </div>;
}
