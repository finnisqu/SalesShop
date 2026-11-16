import {useState,type FormEvent} from 'react';
import {useWorktableDirectoryState} from './useWorktableDirectoryState';
import {CrmCustomFieldEditor} from './CrmCustomFieldEditor';
import type {CrmCustomFieldValues} from '../services/crmFieldEditor352d1';
import {blankCrmFieldBlueprint,crmBlueprintStorageKey,readCrmFieldBlueprint,
 createCrmCustomField,toggleCrmCustomField,moveCrmCustomField,setCrmFieldVisibility,
 CRM_FIELD_TARGETS,CRM_FIELD_TYPES,CRM_FIELD_VISIBILITIES,
 DEFAULT_CRM_FIELD_VISIBILITY,CRM_MAX_FIELDS_PER_TARGET,CRM_LABEL_LIMIT,
 type CrmFieldTarget,type CrmFieldType,type CrmFieldVisibility,type CrmFieldBlueprint,
} from '../services/crmFieldBlueprint352b';
import '../crm-blueprint-settings.css';

export function CrmFieldBlueprintSettings({editable,mode,organizationId,userId}:{
 editable:boolean;
 mode:'local'|'cloud';
 organizationId:string|null;
 userId?:string;
}){
 const scope=crmBlueprintStorageKey(mode,organizationId,userId);
 const [blueprint,setBlueprint]=useWorktableDirectoryState<CrmFieldBlueprint>(scope,
  key=>{
   try{return readCrmFieldBlueprint(localStorage.getItem(key));}
   catch{return blankCrmFieldBlueprint();}
  },
  (key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* browser storage optional */}});
 const [target,setTarget]=useState<CrmFieldTarget>('company');
 const [label,setLabel]=useState('');
 const [kind,setKind]=useState<CrmFieldType>('text');
 const [visibility,setVisibility]=useState<CrmFieldVisibility>(DEFAULT_CRM_FIELD_VISIBILITY);
 const [description,setDescription]=useState('');
 const [choices,setChoices]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 // Sample values never persist, and the directory key isolates them when
 // someone switches accounts/organizations in the same Settings session.
 const [sampleValues,setSampleValues]=useWorktableDirectoryState<
  Record<CrmFieldTarget,CrmCustomFieldValues>>(scope+':sample-record',
  ()=>({company:{},person:{},deal:{}}));
 const [sampleRevision,setSampleRevision]=useState(0);

 const fields=blueprint.fields.filter(field=>field.target===target);
 const title=CRM_FIELD_TARGETS.find(item=>item.id===target)?.label??'Records';
 const recordName=target==='company'?'Company':target==='person'?'Person':'Deal';
 const create=(event:FormEvent)=>{
  event.preventDefault();
  if(!editable)return;
  try{
   const next=createCrmCustomField(blueprint,{
    target,label,type:kind,description,visibility,
    ...(kind==='choice'?{options:choices.split(/[,\n]/)}:{}),
   },'field_'+crypto.randomUUID());
   setBlueprint(next);
   setLabel('');setDescription('');setChoices('');setVisibility(DEFAULT_CRM_FIELD_VISIBILITY);setError('');
   setNotice('Field definition added to your local blueprint. It is not active on CRM records yet.');
  }catch(e){
   setError(e instanceof Error?e.message:'Could not add this field.');
   setNotice('');
  }
 };
 return <section className="settings-panel-grid" aria-label="CRM customization blueprint">
  <article className="company-settings-card crm-blueprint-panel">
   <header><div>
     <strong>CRM Setup · Custom field blueprint</strong>
     <small>Build a CRM that fits your business, not a fixed industry template.</small>
   </div></header>
   <p className="crm-blueprint-explainer">
    Companies, People and Deals keep a stable core. Your business can define
    optional information for each record type without adding unrelated fields to everyone else's CRM.
   </p>
   <div className="crm-blueprint-draft-note" role="status">
    <strong>Design draft · This device only</strong>
    <span>These field definitions are saved only in this browser and signed-in workspace.
     They are not shared with your team, do not appear on live records yet, and do not store customer values.
     Cloud publishing and record values will require a separate permission and persistence release.</span>
   </div>
   {!editable&&<p className="crm-blueprint-access-note">Owners and admins can design field blueprints. Your current role or preview mode is read-only.</p>}
   <div className="crm-blueprint-targets" role="group" aria-label="Record type to customize">
    {CRM_FIELD_TARGETS.map(item=><button key={item.id} type="button"
      aria-pressed={target===item.id} onClick={()=>{setTarget(item.id);setError('');setNotice('');}}>
      {item.label}<span>{blueprint.fields.filter(field=>field.target===item.id).length}</span>
    </button>)}
   </div>
   <div className="crm-blueprint-section-heading">
    <strong>{title} · custom definitions</strong>
    <small>{fields.length} of {CRM_MAX_FIELDS_PER_TARGET} field slots used</small>
   </div>
   {fields.length?<div className="crm-blueprint-field-list">
    {fields.map((field,index)=><div className="crm-blueprint-field" key={field.id}>
      <div className="crm-blueprint-field-info">
       <strong>{field.label}</strong>
       <small>{CRM_FIELD_TYPES.find(item=>item.id===field.type)?.label}
        {field.type==='choice'?' · '+(field.options??[]).join(', '):''}</small>
       <small>Visible to: {CRM_FIELD_VISIBILITIES.find(item=>item.id===field.visibility)?.label??
        'CRM editors and admins'}</small>
       {field.description&&<span>{field.description}</span>}
       <code>{field.key}</code>
      </div>
      <div className="crm-blueprint-field-actions">
       <label className="crm-blueprint-visibility">
        <span>Visibility</span>
        <select disabled={!editable} value={field.visibility??DEFAULT_CRM_FIELD_VISIBILITY}
         aria-label={'Visibility of '+field.label}
         onChange={event=>setBlueprint(current=>setCrmFieldVisibility(current,
          field.id,event.target.value as CrmFieldVisibility))}>
         {CRM_FIELD_VISIBILITIES.map(item=>
          <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
       </label>
       <button type="button" disabled={!editable||index===0}
        onClick={()=>setBlueprint(current=>moveCrmCustomField(current,field.id,-1))}
        aria-label={'Move '+field.label+' up'}>↑</button>
       <button type="button" disabled={!editable||index===fields.length-1}
        onClick={()=>setBlueprint(current=>moveCrmCustomField(current,field.id,1))}
        aria-label={'Move '+field.label+' down'}>↓</button>
       <button type="button" disabled={!editable} aria-pressed={field.active}
        onClick={()=>setBlueprint(current=>toggleCrmCustomField(current,field.id,!field.active))}>
        {field.active?'Enabled':'Paused'}
       </button>
      </div>
     </div>)}
    </div>:<p className="crm-blueprint-empty">No custom fields defined for {title.toLowerCase()}.
     Start with a field your business actually needs.</p>}
   <form className="crm-blueprint-new-field" onSubmit={create}>
    <fieldset disabled={!editable}>
     <legend>Add a field to {title}</legend>
     <div className="crm-blueprint-form-grid">
      <label><span>Field name</span>
       <input value={label} required maxLength={CRM_LABEL_LIMIT}
        placeholder="e.g. Territory, Contract type, Lead source"
        onChange={event=>{setLabel(event.target.value);setError('');}}/>
      </label>
      <label><span>Field type</span>
       <select value={kind} onChange={event=>{setKind(event.target.value as CrmFieldType);setError('');}}>
        {CRM_FIELD_TYPES.map(type=><option key={type.id} value={type.id}>{type.label}</option>)}
       </select>
      </label>
      <label className="crm-blueprint-wide"><span>Who can see it once published?</span>
       <select value={visibility}
        onChange={event=>setVisibility(event.target.value as CrmFieldVisibility)}>
        {CRM_FIELD_VISIBILITIES.map(item=>
         <option key={item.id} value={item.id}>{item.label}</option>)}
       </select>
      </label>
      <p className="crm-blueprint-visibility-help crm-blueprint-wide">
       {CRM_FIELD_VISIBILITIES.find(item=>item.id===visibility)?.description}
       {' '}This is a draft setting; actual privacy requires database enforcement before publishing.
      </p>
      <label className="crm-blueprint-wide"><span>Description (optional)</span>
       <input value={description} maxLength={160}
        placeholder="How should your team use this field?"
        onChange={event=>setDescription(event.target.value)}/>
      </label>
      {kind==='choice'&&<label className="crm-blueprint-wide">
       <span>Choices · comma-separated or one per line</span>
       <textarea rows={3} value={choices} required
        placeholder="Inbound, Referral, Returning customer"
        onChange={event=>setChoices(event.target.value)}/>
      </label>}
     </div>
     <button type="submit" className="crm-blueprint-create" disabled={!label.trim()}>
      Add field to blueprint
     </button>
    </fieldset>
   </form>
   {error&&<p role="alert" className="crm-blueprint-error">{error}</p>}
   {notice&&<p role="status" className="crm-blueprint-notice">{notice}</p>}
  </article>
  <article className="company-settings-card crm-blueprint-preview">
   <header><div>
    <strong>Sample {recordName} record preview</strong>
    <small>Test how your field definitions would look on a record page.</small>
   </div></header>
   <p className="crm-blueprint-preview-disclaimer" role="status">
    <strong>Preview only</strong> · These are fictional sample values.
    Nothing entered here is stored in CRM, synced to Supabase, or saved to this device.
    Closing or reloading SalesShop discards the sample.
   </p>
   <div className="crm-blueprint-preview-record">
    <div className="crm-blueprint-preview-record-header">
     <strong>Example {recordName}</strong>
     <span>Custom fields · {fields.filter(field=>field.active).length} active</span>
    </div>
    <CrmCustomFieldEditor
     key={scope+':'+target+':'+sampleRevision}
     fields={fields} target={target} values={sampleValues[target]??{}}
     disabled={!editable}
     onChange={next=>setSampleValues(current=>({...current,[target]:next}))}/>
   </div>
   <button type="button" className="crm-blueprint-preview-reset"
    disabled={!editable||!Object.keys(sampleValues[target]??{}).length}
    onClick={()=>{
     setSampleValues(current=>({...current,[target]:{}}));
     setSampleRevision(current=>current+1);
    }}>Clear sample values</button>
  </article>
  <article className="company-settings-card crm-blueprint-principles">
   <header><div>
    <strong>Built for different businesses</strong>
    <small>Custom configuration without fragmenting the underlying CRM.</small>
   </div></header>
   <div className="crm-blueprint-principle-list">
    <p><strong>Start small.</strong> Only add the fields that matter to your process.
     New customer workspaces will not inherit countertop-specific fields by default.</p>
    <p><strong>Keep relationships universal.</strong> People, Companies, Deals, Tasks and Activities
     retain their shared linking model, regardless of industry.</p>
    <p><strong>Keep changes reversible.</strong> Field IDs and keys stay stable.
     Pausing a field preserves its definition for future data migrations.</p>
    <p><strong>Publish deliberately.</strong> Organization-wide fields, access rules, record values,
     search, exports and automations will share one validated schema when cloud activation is approved.</p>
   </div>
  </article>
 </section>;
}
