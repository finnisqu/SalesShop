import {create} from 'zustand';
import {
  createMultifamilyStarterSchedule,validateDealScheduleRows,
  type DealScheduleDraft,type DealScheduleRow,type DealScheduleStatus,
} from '../services/dealScheduleTemplates';

/** Opt-in presentation beta. Timelines never alter CRM, Tasks or cloud records. */
const FEATURE_KEY='salesshop:project-timeline-beta-enabled-v1';
const DATA_PREFIX='salesshop:project-timeline-beta-drafts-v1:';
const readEnabled=()=>{
  try{return typeof window!=='undefined'&&window.localStorage.getItem(FEATURE_KEY)==='1';}
  catch{return false;}
};
export function timelineBetaScope(mode:string,org?:string|null,user?:string|null):string|null {
  if(mode==='local')return 'local';
  return mode==='cloud'&&org&&user?'org:'+org+':user:'+user:null;
}
function verify(draft:DealScheduleDraft,dealId:string):boolean{
  if(draft?.dealId!==dealId||draft.templateId!=='multifamily-starter-v1'||
     !Array.isArray(draft.rows)||draft.rows.length>1000)return false;
  return validateDealScheduleRows(draft.rows).length===0;
}
function readDrafts(scope:string):Record<string,DealScheduleDraft>{
  try{
    const value:unknown=JSON.parse(window.localStorage.getItem(DATA_PREFIX+scope)??'{}');
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    const records:Record<string,DealScheduleDraft>={};
    for(const [id,raw] of Object.entries(value)){
      const draft=raw as DealScheduleDraft;
      if(verify(draft,id))records[id]=draft;
    }
    return records;
  }catch{return {};}
}
export type TimelineBetaPatch=Partial<Pick<DealScheduleRow,
  'plannedStart'|'plannedFinish'|'status'>>;
type PhaseType='import'|'building';
function appendPhase(draft:DealScheduleDraft,scope:PhaseType):DealScheduleDraft{
  const root=scope==='import'?'imports':'buildings';
  const name=scope==='import'?'Import':'Building';
  const groups=draft.rows.filter(row=>row.parentId===root);
  const max=groups.reduce((value,row)=>{
    const index=Number(row.label.startsWith(name+' ')?row.label.slice(name.length+1):0);
    return Number.isInteger(index)?Math.max(value,index):value;
  },0);
  const id=scope+'-'+crypto.randomUUID().slice(0,12);
  const example=createMultifamilyStarterSchedule({
    importNames:['Import 1'],buildingNames:['Building 1'],
  });
  const sample=scope+'-1';
  const added=example.rows.filter(row=>row.id===sample||row.parentId===sample).map(row=>({
    ...row,
    id:id+row.id.slice(sample.length),
    parentId:row.id===sample?root:id,
    label:row.id===sample?name+' '+Math.max(groups.length+1,max+1):row.label,
    predecessorIds:row.predecessorIds.map(pre=>
      pre===sample||pre.startsWith(sample+'-')?id+pre.slice(sample.length):pre),
  }));
  const result=draft.rows.slice();
  const last=result.reduce((index,row,pos)=>{
    if(row.id===root||row.parentId===root||
      result.some(group=>group.parentId===root&&row.parentId===group.id))return pos;
    return index;
  },-1);
  result.splice(last+1,0,...added);
  if(scope==='building'){
    for(const row of result){
      if(row.id==='all-buildings-complete')row.predecessorIds=[...row.predecessorIds,id+'-punch'];
      if(row.id==='final-billing')row.predecessorIds=[...row.predecessorIds,id+'-invoice'];
    }
  }
  return {...draft,rows:result};
}
function validatePatch(row:DealScheduleRow,patch:TimelineBetaPatch):boolean{
  const next={...row,...patch};
  for(const date of [next.plannedStart,next.plannedFinish]){
    if(!date)continue;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
    const parsed=new Date(date+'T00:00:00Z');
    if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return false;
  }
  return !(next.plannedStart&&next.plannedFinish&&next.plannedFinish<next.plannedStart);
}
interface State{
  enabled:boolean;
  loadedScope:string|null;
  drafts:Record<string,DealScheduleDraft>;
  error:string|null;
  setEnabled:(value:boolean)=>void;
  load:(scope:string)=>void;
  start:(scope:string,dealId:string)=>void;
  patch:(scope:string,dealId:string,rowId:string,change:TimelineBetaPatch)=>void;
  addPhase:(scope:string,dealId:string,phase:PhaseType)=>void;
}
export const useDealTimelineBetaStore=create<State>((set,get)=>{
  const persist=(scope:string,next:Record<string,DealScheduleDraft>)=>{
    if(get().loadedScope!==scope)return;
    try{
      window.localStorage.setItem(DATA_PREFIX+scope,JSON.stringify(next));
      set({drafts:next,error:null});
    }catch{set({error:'Timeline could not be saved on this device. Check browser storage.'});}
  };
  const modify=(scope:string,dealId:string,change:(draft:DealScheduleDraft)=>DealScheduleDraft)=>{
    if(get().loadedScope!==scope)return;
    const previous=get().drafts[dealId];if(!previous)return;
    const next=change(previous);
    if(!verify(next,dealId)){set({error:'Invalid timeline changes. Nothing was saved.'});return;}
    persist(scope,{...get().drafts,[dealId]:next});
  };
  return {
    enabled:readEnabled(),loadedScope:null,drafts:{},error:null,
    setEnabled:(value)=>{
      try{window.localStorage.setItem(FEATURE_KEY,value?'1':'0');}
      catch{/* preference is session-only if storage is blocked */}
      set({enabled:value});
    },
    load:(scope)=>{
      if(get().loadedScope===scope)return;
      set({loadedScope:scope,drafts:readDrafts(scope),error:null});
    },
    start:(scope,dealId)=>{
      if(get().loadedScope!==scope||get().drafts[dealId])return;
      const draft=createMultifamilyStarterSchedule({dealId});
      persist(scope,{...get().drafts,[dealId]:draft});
    },
    patch:(scope,dealId,rowId,change)=>modify(scope,dealId,draft=>{
      const row=draft.rows.find(item=>item.id===rowId);
      if(!row||row.kind==='group'||!validatePatch(row,change)){
        set({error:'Check the planned dates. The finish cannot be before the start.'});
        return draft;
      }
      return {...draft,rows:draft.rows.map(item=>item.id===rowId?{...item,...change}:item)};
    }),
    addPhase:(scope,dealId,phase)=>modify(scope,dealId,draft=>appendPhase(draft,phase)),
  };
});
export const timelineBetaStatuses:readonly {value:DealScheduleStatus;label:string}[]=[
  {value:'not-started',label:'Not started'},{value:'in-progress',label:'In progress'},
  {value:'on-hold',label:'On hold'},{value:'complete',label:'Complete'},
];
