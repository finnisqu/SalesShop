import {useState,type FormEvent} from 'react';
import {useWorktableDirectoryState} from './useWorktableDirectoryState';
import {CrmCustomFieldEditor} from './CrmCustomFieldEditor';
import {CRM_STARTER_FIELD_PACKS,previewCrmStarterPack,applyCrmStarterPack,
 type CrmStarterPackId} from '../services/crmStarterPacks352e1';
import type {CrmCustomFieldValues} from '../services/crmFieldEditor352d1';
import {
 CRM_MODULE_PLANS,blankCrmModulePlans,readCrmModulePlans,crmModulePlansStorageKey,
 setCrmModulePlan,exportCrmConfiguration,previewCrmConfigurationImport,
 applyCrmConfigurationImport,
 type CrmModulePlans,
} from '../services/crmConfiguration352e2';
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
 const [starterPackId,setStarterPackId]=useState<CrmStarterPackId>('general_sales');
 const [starterNotice,setStarterNotice]=useState('');
 const [starterError,setStarterError]=useState('');
 const starterPlan=previewCrmStarterPack(blueprint,starterPackId);
 const [modulePlans,setModulePlans]=useWorktableDirectoryState<CrmModulePlans>(
  crmModulePlansStorageKey(scope),key=>{
   try{return readCrmModulePlans(localStorage.getItem(key));}
   catch{return blankCrmModulePlans();}
  },
  (key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}
   catch{/* browser storage optional */}});
 // Pending pasted JSON and feedback must not cross accounts/organizations,
 // and are never persisted (unlike the saved field/module definitions).
 const [importText,setImportText]=useWorktableDirectoryState<string>(
  scope+':pending-config-import',()=> '');
 const [importNotice,setImportNotice]=useWorktableDirectoryState<string>(
  scope+':config-import-notice',()=> '');
 const [importError,setImportError]=useWorktableDirectoryState<string>(
  scope+':config-import-error',()=> '');
 let importPreview:ReturnType<typeof previewCrmConfigurationImport>|null=null;
 let importPreviewError='';
 if(importText.trim()){
  try{importPreview=previewCrmConfigurationImport(blueprint,modulePlans,importText);}
  catch(error){importPreviewError=error instanceof Error?error.message:'Invalid configuration.';}
 }
 const exportText=editable?exportCrmConfiguration(blueprint,modulePlans):'';

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
  <article className="company-settings-card crm-starter-pack-panel">
   <header><div>
    <strong>Optional starter field packs</strong>
    <small>Pick only what your company needs. Nothing is installed by default.</small>
   </div></header>
   <p className="crm-starter-pack-intro">
    Start with a suggested set of Company, Person and Deal fields, or keep your blueprint
    completely custom. Preview each change before adding definitions to this browser only.
   </p>
   <label className="crm-starter-pack-select">
    <span>Starter pack</span>
    <select value={starterPackId} aria-label="Choose a starter field pack"
     onChange={event=>{
      setStarterPackId(event.target.value as CrmStarterPackId);
      setStarterError('');setStarterNotice('');
     }}>
     {CRM_STARTER_FIELD_PACKS.map(pack=>
      <option key={pack.id} value={pack.id}>{pack.title}</option>)}
    </select>
   </label>
   <p className="crm-starter-pack-description">{starterPlan.pack.description}</p>
   <div className="crm-starter-pack-summary" aria-live="polite">
    <span>{starterPlan.additions} to add</span>
    <span>{starterPlan.present} already defined</span>
    {starterPlan.incompatible>0&&<span>{starterPlan.incompatible} type conflicts (skip)</span>}
   </div>
   <ul className="crm-starter-pack-fields" aria-label="Starter pack field preview">
    {starterPlan.fields.map(({field,status,message})=>
     <li key={field.target+':'+field.label}>
      <div><strong>{field.label}</strong>
       <small>{CRM_FIELD_TARGETS.find(item=>item.id===field.target)?.label}
        {' · '}{CRM_FIELD_TYPES.find(item=>item.id===field.type)?.label}</small>
      </div>
      <span className="crm-starter-pack-status" data-status={status}
       title={message}>{status==='add'?'Add':status==='present'?'Already defined':'Keep existing'}</span>
     </li>)}
   </ul>
   {starterPlan.blockedReason&&<p role="alert" className="crm-blueprint-error">
    Cannot add this pack: {starterPlan.blockedReason} No fields will be imported.
   </p>}
   <button type="button" className="crm-blueprint-create crm-starter-pack-apply"
    disabled={!editable||Boolean(starterPlan.blockedReason)||!starterPlan.additions}
    onClick={()=>{
     if(!editable)return;
     try{
      const next=applyCrmStarterPack(blueprint,starterPackId);
      setBlueprint(next);
      setStarterNotice('Added '+starterPlan.additions+
       ' optional fields to this browser blueprint. Existing fields were left unchanged.');
      setStarterError('');
     }catch(error){
      setStarterError(error instanceof Error?error.message:'Could not add starter fields.');
      setStarterNotice('');
     }
    }}>Add {starterPlan.additions} field{starterPlan.additions===1?'':'s'} to local blueprint</button>
   {starterNotice&&<p role="status" className="crm-blueprint-notice">{starterNotice}</p>}
   {starterError&&<p role="alert" className="crm-blueprint-error">{starterError}</p>}
   <p className="crm-starter-pack-disclaimer">
    Local design only · No live CRM records, team settings or Supabase data are changed.
    Existing fields can be paused or re-enabled individually.
   </p>
  </article>
  <article className="company-settings-card crm-config-portability">
   <header><div>
    <strong>Portable CRM configuration</strong>
    <small>Copy your optional field blueprint and module plans between workspaces.</small>
   </div></header>
   <p className="crm-config-help">
    Exports contain field definitions and module intentions only. No Company, Person,
    Deal, customer values, sample values or organization/account identifiers are included.
    Sharing a bundle does not share permissions or publish it to your team.
   </p>
   <div className="crm-config-modules">
    <strong>Module plans · local draft only</strong>
    <p>No actual CRM tabs, automations or workflow rules change.</p>
    {CRM_MODULE_PLANS.map(module=><label key={module.id} className="crm-config-module">
     <input type="checkbox" disabled={!editable}
      checked={modulePlans[module.id]}
      onChange={event=>setModulePlans(current=>
       setCrmModulePlan(current,module.id,event.target.checked))}/>
     <span><strong>{module.label}</strong><small>{module.description}</small></span>
    </label>)}
   </div>
   <div className="crm-config-transfer">
    <div className="crm-config-transfer-part">
     <label htmlFor="crm-config-export"><strong>Export configuration JSON</strong></label>
     <textarea id="crm-config-export" readOnly rows={5}
      value={exportText}
      aria-label="Export CRM configuration JSON"
      placeholder={editable?'':'Only owners and admins can export configuration drafts.'}/>
     <button type="button" className="crm-blueprint-create"
      disabled={!editable||!exportText}
      onClick={()=>{
       void (async()=>{
        try{
         if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable.');
         await navigator.clipboard.writeText(exportText);
         setImportNotice('Configuration copied. Save the JSON wherever you keep templates.');
         setImportError('');
        }catch{
         setImportError('Clipboard unavailable. Select and copy the JSON from the export box.');
         setImportNotice('');
        }
       })();
      }}>Copy configuration JSON</button>
    </div>
    <div className="crm-config-transfer-part">
     <label htmlFor="crm-config-import"><strong>Import configuration JSON</strong></label>
     <textarea id="crm-config-import" value={importText} rows={5}
      disabled={!editable} maxLength={80001}
      placeholder="Paste a SalesShop CRM configuration bundle to review it"
      onChange={event=>{setImportText(event.target.value);setImportNotice('');setImportError('');}}
      aria-describedby="crm-config-import-help"/>
     <p id="crm-config-import-help">Review before applying. Matching fields stay unchanged;
      type conflicts are skipped. Imported module intentions only turn plans on.</p>
    </div>
   </div>
   {importPreviewError&&<p role="alert" className="crm-blueprint-error">
    Cannot preview import: {importPreviewError}</p>}
   {importPreview&&<>
    <div className="crm-config-review" aria-label="CRM import preview" aria-live="polite">
     <strong>Import review</strong>
     <p>{importPreview.additions} fields to add · {importPreview.alreadyPresent}
      {' '}already defined · {importPreview.conflicts} type conflicts ·
      {' '}{importPreview.modulesToPlan} new module plans</p>
     <ul>
      {importPreview.fields.map(({field,status,message})=>
       <li key={field.target+':'+field.key}>
        <span>{CRM_FIELD_TARGETS.find(item=>item.id===field.target)?.label}
         {' · '}{field.label}</span>
        <small title={message}>{status==='add'?'Add':
         status==='present'?'Keep existing':'Skip type conflict'}</small>
       </li>)}
     </ul>
     {importPreview.modulesToPlan>0&&<p>New module plans:
      {' '}{importPreview.modules.filter(item=>item.status==='plan')
       .map(item=>item.label).join(', ')}</p>}
    </div>
    {importPreview.blockedReason&&<p role="alert" className="crm-blueprint-error">
     No changes will be imported: {importPreview.blockedReason}</p>}
   </>}
   <button type="button" className="crm-blueprint-create crm-config-apply"
    disabled={!editable||!importPreview||Boolean(importPreview.blockedReason)||
     (importPreview.additions===0&&importPreview.modulesToPlan===0)}
    onClick={()=>{
     if(!editable)return;
     try{
      const next=applyCrmConfigurationImport(blueprint,modulePlans,importText);
      // Both are scoped, device-local preference drafts; no remote save.
      setBlueprint(next.blueprint);
      setModulePlans(next.modules);
      setImportNotice('Imported configuration into local drafts. Existing fields kept.');
      setImportError('');
      setImportText('');
     }catch(error){
      setImportError(error instanceof Error?error.message:'Could not import configuration.');
      setImportNotice('');
     }
    }}>Apply reviewed changes locally</button>
   {importNotice&&<p role="status" className="crm-blueprint-notice">{importNotice}</p>}
   {importError&&<p role="alert" className="crm-blueprint-error">{importError}</p>}
   <p className="crm-config-footnote">
    Design only · These settings do not activate real fields, change team access,
    or sync to Supabase. Reimporting does not overwrite your edits.
   </p>
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
