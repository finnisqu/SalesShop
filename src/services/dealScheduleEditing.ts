import {
  createMultifamilyStarterSchedule,
  validateDealScheduleRows,
  type DealScheduleDraft,
  type DealScheduleRow,
} from './dealScheduleTemplates';

export type SchedulePhase = 'import' | 'building';
export type ScheduleRowChanges = Partial<Pick<DealScheduleRow,
  'label'|'status'|'plannedStart'|'plannedFinish'|'actualStart'|'actualFinish'|'amount'|'retainagePercent'>>;

function idFor(scope:SchedulePhase):string {
  return scope + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

export function updateScheduleRow(
  schedule:DealScheduleDraft,rowId:string,changes:ScheduleRowChanges,
):DealScheduleDraft {
  const rows=schedule.rows.map(row=>row.id===rowId?{...row,...changes}:row);
  return {...schedule,rows};
}

/** Every new phase has its own stable IDs, independent from other imports/buildings. */
export function appendSchedulePhase(
  schedule:DealScheduleDraft,scope:SchedulePhase,
):DealScheduleDraft {
  const root=scope==='import'?'imports':'buildings';
  const prefix=idFor(scope);
  const phaseLabel=scope==='import'?'Import':'Building';
  const existing=schedule.rows.filter(row=>row.parentId===root);
  const highest=existing.reduce((max,row)=>{
    const match=row.label.match(new RegExp('^'+phaseLabel+' (\\d+)
  const reference=createMultifamilyStarterSchedule({importNames:['Import'],buildingNames:['Building']});
  const source=scope==='import'?'import-1':'building-1';
  const children=reference.rows.filter(row=>row.id===source||row.parentId===source);
  const mapped=children.map(row=>{
    const id=prefix+row.id.slice(source.length);
    return {
      ...row,id,
      label:row.id===source?(scope==='import'?'Import ':'Building ')+number:row.label,
      parentId:row.id===source?root:prefix,
      predecessorIds:row.predecessorIds.map(dep=>dep.startsWith(source+'-')
        ?prefix+dep.slice(source.length):dep),
      sourceImportIds:row.sourceImportIds?.slice(),
    };
  });
  let rows=schedule.rows.slice();
  const last=rows.reduce((position,row,index)=>
    row.id===root||row.parentId===root||childrenBelongToRoot(row,root,rows)
      ?index:position,-1);
  rows.splice(last+1,0,...mapped);
  if(scope==='building'){
    rows=rows.map(row=>row.id==='all-buildings-complete'
      ?{...row,predecessorIds:[...row.predecessorIds,prefix+'-punch']}
      :row.id==='final-billing'
        ?{...row,predecessorIds:[...row.predecessorIds,prefix+'-invoice']}
        :row);
  }
  return {...schedule,rows};
}
function childrenBelongToRoot(row:DealScheduleRow,root:string,rows:DealScheduleRow[]):boolean {
  const parent=rows.find(item=>item.id===row.parentId);
  return parent?.parentId===root;
}

/** Removing an import also unlinks it from every building and delivery dependency. */
export function removeSchedulePhase(
  schedule:DealScheduleDraft,groupId:string,
):DealScheduleDraft {
  const group=schedule.rows.find(row=>row.id===groupId);
  if(!group||group.kind!=='group'||(group.scope!=='import'&&group.scope!=='building'))return schedule;
  const removed=new Set([groupId]);
  let changed=true;
  while(changed){
    changed=false;
    for(const row of schedule.rows){
      if(row.parentId&&removed.has(row.parentId)&&!removed.has(row.id)){
        removed.add(row.id);changed=true;
      }
    }
  }
  const rows=schedule.rows.filter(row=>!removed.has(row.id)).map(row=>({
    ...row,
    predecessorIds:row.predecessorIds.filter(id=>!removed.has(id)),
    ...(row.sourceImportIds?{sourceImportIds:row.sourceImportIds.filter(id=>!removed.has(id))}:{}),
  }));
  return {...schedule,rows};
}

/** Buildings may take materials from several independent import waves. */
export function assignBuildingImports(
  schedule:DealScheduleDraft,buildingId:string,requestedIds:string[],
):DealScheduleDraft {
  const building=schedule.rows.find(row=>row.id===buildingId&&row.scope==='building'&&row.kind==='group');
  if(!building)return schedule;
  const imports=new Set(schedule.rows.filter(row=>row.scope==='import'&&row.kind==='group').map(row=>row.id));
  const ids=[...new Set(requestedIds.filter(id=>imports.has(id)))];
  const deliveryId=buildingId+'-delivery';
  const rows=schedule.rows.map(row=>{
    if(row.id===buildingId)return {...row,sourceImportIds:ids};
    if(row.id===deliveryId)return {...row,predecessorIds:[
      buildingId+'-site-ready',...ids.map(id=>id+'-site'),
    ]};
    return row;
  });
  return {...schedule,rows};
}

/** Prevent reversed date ranges without changing dates automatically. */
export function scheduleDateIssues(rows:readonly DealScheduleRow[]):string[] {
  const issues:string[]=[];
  for(const row of rows){
    if(row.plannedStart&&row.plannedFinish&&row.plannedFinish<row.plannedStart)
      issues.push(row.label+': planned finish precedes start');
    if(row.actualStart&&row.actualFinish&&row.actualFinish<row.actualStart)
      issues.push(row.label+': actual finish precedes start');
  }
  return issues;
}

export function scheduleProgress(schedule:DealScheduleDraft):{done:number;total:number;percent:number}{
  const tasks=schedule.rows.filter(row=>row.kind!=='group');
  const done=tasks.filter(row=>row.status==='complete').length;
  return {done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0};
}

export function assertValidSchedule(schedule:DealScheduleDraft):void {
  const errors=[...validateDealScheduleRows(schedule.rows),...scheduleDateIssues(schedule.rows)];
  if(errors.length)throw new Error(errors.join('; '));
}
));
    return Math.max(max,match?Number(match[1]):0);
  },0);
  const number=Math.max(highest,existing.length)+1;
  const reference=createMultifamilyStarterSchedule({importNames:['Import'],buildingNames:['Building']});
  const source=scope==='import'?'import-1':'building-1';
  const children=reference.rows.filter(row=>row.id===source||row.parentId===source);
  const mapped=children.map(row=>{
    const id=prefix+row.id.slice(source.length);
    return {
      ...row,id,
      label:row.id===source?(scope==='import'?'Import ':'Building ')+number:row.label,
      parentId:row.id===source?root:prefix,
      predecessorIds:row.predecessorIds.map(dep=>dep.startsWith(source+'-')
        ?prefix+dep.slice(source.length):dep),
      sourceImportIds:row.sourceImportIds?.slice(),
    };
  });
  let rows=schedule.rows.slice();
  const last=rows.reduce((position,row,index)=>
    row.id===root||row.parentId===root||childrenBelongToRoot(row,root,rows)
      ?index:position,-1);
  rows.splice(last+1,0,...mapped);
  if(scope==='building'){
    rows=rows.map(row=>row.id==='all-buildings-complete'
      ?{...row,predecessorIds:[...row.predecessorIds,prefix+'-punch']}
      :row.id==='final-billing'
        ?{...row,predecessorIds:[...row.predecessorIds,prefix+'-invoice']}
        :row);
  }
  return {...schedule,rows};
}
function childrenBelongToRoot(row:DealScheduleRow,root:string,rows:DealScheduleRow[]):boolean {
  const parent=rows.find(item=>item.id===row.parentId);
  return parent?.parentId===root;
}

/** Removing an import also unlinks it from every building and delivery dependency. */
export function removeSchedulePhase(
  schedule:DealScheduleDraft,groupId:string,
):DealScheduleDraft {
  const group=schedule.rows.find(row=>row.id===groupId);
  if(!group||group.kind!=='group'||(group.scope!=='import'&&group.scope!=='building'))return schedule;
  const removed=new Set([groupId]);
  let changed=true;
  while(changed){
    changed=false;
    for(const row of schedule.rows){
      if(row.parentId&&removed.has(row.parentId)&&!removed.has(row.id)){
        removed.add(row.id);changed=true;
      }
    }
  }
  const rows=schedule.rows.filter(row=>!removed.has(row.id)).map(row=>({
    ...row,
    predecessorIds:row.predecessorIds.filter(id=>!removed.has(id)),
    ...(row.sourceImportIds?{sourceImportIds:row.sourceImportIds.filter(id=>!removed.has(id))}:{}),
  }));
  return {...schedule,rows};
}

/** Buildings may take materials from several independent import waves. */
export function assignBuildingImports(
  schedule:DealScheduleDraft,buildingId:string,requestedIds:string[],
):DealScheduleDraft {
  const building=schedule.rows.find(row=>row.id===buildingId&&row.scope==='building'&&row.kind==='group');
  if(!building)return schedule;
  const imports=new Set(schedule.rows.filter(row=>row.scope==='import'&&row.kind==='group').map(row=>row.id));
  const ids=[...new Set(requestedIds.filter(id=>imports.has(id)))];
  const deliveryId=buildingId+'-delivery';
  const rows=schedule.rows.map(row=>{
    if(row.id===buildingId)return {...row,sourceImportIds:ids};
    if(row.id===deliveryId)return {...row,predecessorIds:[
      buildingId+'-site-ready',...ids.map(id=>id+'-site'),
    ]};
    return row;
  });
  return {...schedule,rows};
}

/** Prevent reversed date ranges without changing dates automatically. */
export function scheduleDateIssues(rows:readonly DealScheduleRow[]):string[] {
  const issues:string[]=[];
  for(const row of rows){
    if(row.plannedStart&&row.plannedFinish&&row.plannedFinish<row.plannedStart)
      issues.push(row.label+': planned finish precedes start');
    if(row.actualStart&&row.actualFinish&&row.actualFinish<row.actualStart)
      issues.push(row.label+': actual finish precedes start');
  }
  return issues;
}

export function scheduleProgress(schedule:DealScheduleDraft):{done:number;total:number;percent:number}{
  const tasks=schedule.rows.filter(row=>row.kind!=='group');
  const done=tasks.filter(row=>row.status==='complete').length;
  return {done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0};
}

export function assertValidSchedule(schedule:DealScheduleDraft):void {
  const errors=[...validateDealScheduleRows(schedule.rows),...scheduleDateIssues(schedule.rows)];
  if(errors.length)throw new Error(errors.join('; '));
}
