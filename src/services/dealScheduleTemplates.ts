/** Starter Gantt structure for contracted multifamily Deals.
 * A schedule is a child of a CRM Deal, not another Deal/stage.
 * Dates, payment amounts, and actual shipment/building assignments remain unset.
 * This is a template factory only; it does not write CRM or cloud data.
 */
export type DealScheduleRowKind = 'group'|'task'|'milestone'|'period'|'financial';
export type DealScheduleScope = 'project'|'import'|'building'|'closeout';
export type DealScheduleStatus = 'not-started'|'in-progress'|'complete'|'on-hold';

export interface DealScheduleRow {
  id: string;
  parentId?: string;
  label: string;
  scope: DealScheduleScope;
  kind: DealScheduleRowKind;
  status: DealScheduleStatus;
  /** Reference IDs, not row indices; advisory until dependency automation is implemented. */
  predecessorIds: string[];
  /** Import assignment is deliberately many-to-many: one building may use several batches. */
  sourceImportIds?: string[];
  plannedStart?: string;
  plannedFinish?: string;
  actualStart?: string;
  actualFinish?: string;
  amount?: number;
  retainagePercent?: number;
  /** PO, vessel/container, shipment tracking, or invoice number; no automatic ledger posting. */
  reference?: string;
  /** Optional per-milestone scheduling and billing context. */
  notes?: string;
}

export interface DealScheduleDraft {
  templateId: 'multifamily-starter-v1';
  dealId?: string;
  label: string;
  rows: DealScheduleRow[];
}

export interface MultifamilyStarterOptions {
  dealId?: string;
  /** Repeated import waves, each with its own independent production/shipping schedule. */
  importNames?: string[];
  /** Repeated buildings/installation phases, each with independent billing. */
  buildingNames?: string[];
  /** Optional explicit mapping of building name to the import batch names supplying it. */
  buildingImports?: Record<string,string[]>;
}

const initialStatus: DealScheduleStatus = 'not-started';
const nonEmptyNames = (names: string[], fallback: string): string[] => {
  const cleaned = names.map(name => name.trim()).filter(Boolean);
  return cleaned.length ? cleaned : [fallback];
};

/** No date defaults: a starter template must not manufacture delivery commitments. */
export function createMultifamilyStarterSchedule(options: MultifamilyStarterOptions = {}): DealScheduleDraft {
  const importNames = nonEmptyNames(options.importNames ?? ['Import 1','Import 2'], 'Import 1');
  const buildingNames = nonEmptyNames(options.buildingNames ?? ['Building 1','Building 2'], 'Building 1');
  const rows: DealScheduleRow[] = [];
  const add = (
    id: string, parentId: string|undefined, label: string,
    scope: DealScheduleScope, kind: DealScheduleRowKind,
    predecessorIds: string[] = [], sourceImportIds?: string[],
  ) => {
    rows.push({id,parentId,label,scope,kind,status:initialStatus,predecessorIds,
      ...(sourceImportIds ? {sourceImportIds} : {})});
  };

  // Cross-project administrative and approval milestones are not duplicated per building.
  add('contract',undefined,'Contract & preconstruction','project','group');
  add('contract-executed','contract','Contract executed','project','milestone');
  add('notice-to-proceed','contract','Notice to proceed','project','milestone',['contract-executed']);
  add('deposit-invoiced','contract','Deposit invoiced','project','financial',['contract-executed']);
  add('deposit-received','contract','Deposit received','project','financial',['deposit-invoiced']);
  add('shop-drawings-submitted','contract','Shop drawings submitted','project','milestone',['notice-to-proceed']);
  add('shop-drawings-approved','contract','Shop drawings approved','project','milestone',['shop-drawings-submitted']);
  add('selections-approved','contract','Material / finish selections approved','project','milestone',['shop-drawings-approved']);

  add('imports',undefined,'Phased imports / material logistics','project','group');
  importNames.forEach((name,index) => {
    const id = `import-${index+1}`;
    add(id,'imports',name,'import','group');
    add(`${id}-po`,id,'Purchase order / material release','import','milestone',['selections-approved','deposit-received']);
    add(`${id}-production`,id,'Production','import','period',[`${id}-po`]);
    add(`${id}-on-water`,id,'On water / ocean transit','import','period',[`${id}-production`]);
    add(`${id}-port`,id,'Port arrival','import','milestone',[`${id}-on-water`]);
    add(`${id}-customs`,id,'Customs cleared / domestic freight','import','milestone',[`${id}-port`]);
    add(`${id}-site`,id,'Delivery to site','import','milestone',[`${id}-customs`]);
  });

  add('buildings',undefined,'Buildings / installation phases','project','group');
  const finalBuildingMilestones:string[] = [];
  const invoiceMilestones:string[] = [];
  buildingNames.forEach((name,index) => {
    const id = `building-${index+1}`;
    const selectedImports = options.buildingImports?.[name] ?? [];
    // Never imply a material-to-building allocation before a user selects it.
    const sourceImportIds = importNames.flatMap((importName,i) =>
      selectedImports.includes(importName) ? [`import-${i+1}`] : []);
    add(id,'buildings',name,'building','group',[],sourceImportIds);
    add(`${id}-site-ready`,id,'Site ready / field verification','building','milestone');
    add(`${id}-delivery`,id,'Material delivery to building','building','milestone',
      [`${id}-site-ready`,...sourceImportIds.map(importId=>`${importId}-site`)]);
    add(`${id}-install`,id,'Installation','building','period',[`${id}-delivery`]);
    add(`${id}-punch`,id,'Punch list / building sign-off','building','milestone',[`${id}-install`]);
    add(`${id}-invoice`,id,'Progress invoice submitted','building','financial',[`${id}-punch`]);
    add(`${id}-payment`,id,'Progress invoice paid','building','financial',[`${id}-invoice`]);
    finalBuildingMilestones.push(`${id}-punch`);
    invoiceMilestones.push(`${id}-invoice`);
  });

  add('closeout',undefined,'Project closeout & retainage','closeout','group');
  add('all-buildings-complete','closeout','All buildings / punch lists complete','closeout','milestone',finalBuildingMilestones);
  add('final-billing','closeout','Final billing reconciled','closeout','financial',invoiceMilestones);
  add('retainage-request','closeout','Retainage invoice / release request','closeout','financial',
    ['all-buildings-complete','final-billing']);
  add('retainage-received','closeout','Retainage received','closeout','financial',['retainage-request']);
  add('project-complete','closeout','Project complete','closeout','milestone',['retainage-received']);

  return {templateId:'multifamily-starter-v1',dealId:options.dealId,
    label:'Multifamily · phased procurement, installation & billing',rows};
}

/** Structural checks protect the renderer from cycles in imported/cloud data. */
export function validateDealScheduleRows(rows: readonly DealScheduleRow[]): string[] {
  const ids = new Set<string>();
  const errors: string[] = [];
  const byId=new Map<string,DealScheduleRow>();
  for(const row of rows){
    if(!row.id?.trim())errors.push('Empty schedule row ID');
    if(ids.has(row.id))errors.push('Duplicate row ID: '+row.id);
    ids.add(row.id);
    byId.set(row.id,row);
  }
  for(const row of rows){
    if(row.parentId&&!ids.has(row.parentId))
      errors.push('Missing parent for '+row.id+': '+row.parentId);
    if(row.parentId===row.id)errors.push('Self-parented row: '+row.id);
    if(row.parentId&&byId.get(row.parentId)?.kind!=='group')
      errors.push('Parent must be a group for '+row.id+': '+row.parentId);
    for(const predecessor of row.predecessorIds){
      if(!ids.has(predecessor))
        errors.push('Missing predecessor for '+row.id+': '+predecessor);
      if(predecessor===row.id)errors.push('Self-dependent row: '+row.id);
    }
    for(const importId of row.sourceImportIds??[]){
      const imp=byId.get(importId);
      if(!imp||imp.scope!=='import'||imp.kind!=='group')
        errors.push('Invalid source import for '+row.id+': '+importId);
    }
  }

  /** Detect both hierarchy and advisory-predecessor cycles before rendering. */
  const cycles=(name:string,neighbors:(row:DealScheduleRow)=>readonly string[])=>{
    const visited=new Set<string>(),active=new Set<string>(),reported=new Set<string>();
    const visit=(id:string):void=>{
      if(active.has(id)){
        if(!reported.has(id))errors.push('Circular '+name+' reference: '+id);
        reported.add(id);
        return;
      }
      if(visited.has(id))return;
      const row=byId.get(id);if(!row)return;
      active.add(id);
      for(const neighbor of neighbors(row))visit(neighbor);
      active.delete(id);
      visited.add(id);
    };
    for(const id of ids)visit(id);
  };
  cycles('parent',row=>row.parentId?[row.parentId]:[]);
  cycles('dependency',row=>row.predecessorIds);
  return errors;
}
