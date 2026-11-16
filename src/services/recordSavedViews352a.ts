import {visibleConnectionColumns} from './connectionsTablePreferences';

export interface RecordViewSort {key:string;reverse:boolean;}
export interface SavedRecordView {
 id:string;
 name:string;
 columns:string[];
 sort:RecordViewSort;
 pageSize:number;
}
export const MAX_SAVED_RECORD_VIEWS=12;
export const RECORD_VIEW_NAME_LIMIT=48;

/** Names are presentation-only. Persist in the current browser and isolate
 * cloud accounts and organizations, rather than sharing private preferences. */
export function recordViewsStorageKey(
 directory:string,mode:'local'|'cloud',organizationId:string|null,userId?:string,
):string{
 return 'salesshop-record-views-v1:'+JSON.stringify([
  mode,mode==='cloud'?organizationId??'signed-out':'local',
  mode==='cloud'?userId??'signed-out':'local',directory,
 ]);
}

export function normalizeSavedRecordViews(
 raw:unknown,available:readonly string[],fallback:RecordViewSort,
 allowedPageSizes:readonly number[],defaultPageSize:number,
):SavedRecordView[]{
 if(!Array.isArray(raw))return [];
 const known=new Set(available);
 const uniqueIds=new Set<string>(),uniqueNames=new Set<string>();
 const result:SavedRecordView[]=[];
 for(const input of raw.slice(0,100)){
  if(!input||typeof input!=='object')continue;
  const row=input as Record<string,unknown>;
  const id=typeof row.id==='string'?row.id.trim():'';
  const name=typeof row.name==='string'?row.name.trim().slice(0,RECORD_VIEW_NAME_LIMIT):'';
  const slug=name.toLocaleLowerCase();
  if(!id||id.length>100||!name||uniqueIds.has(id)||uniqueNames.has(slug))continue;
  const sourceColumns=Array.isArray(row.columns)?
   row.columns.filter((x):x is string=>typeof x==='string'):[];
  const columns=visibleConnectionColumns(sourceColumns,available as string[]);
  const savedSort=(row.sort&&typeof row.sort==='object')?
   row.sort as Record<string,unknown>:{};
  const sortKey=typeof savedSort.key==='string'&&known.has(savedSort.key)?
   savedSort.key:(known.has(fallback.key)?fallback.key:available[0]??'name');
  const pageSize=typeof row.pageSize==='number'&&allowedPageSizes.includes(row.pageSize)?
   row.pageSize:defaultPageSize;
  result.push({id,name,columns,sort:{key:sortKey,reverse:savedSort.reverse===true},pageSize});
  uniqueIds.add(id);uniqueNames.add(slug);
  if(result.length>=MAX_SAVED_RECORD_VIEWS)break;
 }
 return result;
}

export function readSavedRecordViews(
 raw:string|null,available:readonly string[],fallback:RecordViewSort,
 allowedPageSizes:readonly number[],defaultPageSize:number,
):SavedRecordView[]{
 try{return normalizeSavedRecordViews(JSON.parse(raw??'[]'),available,
  fallback,allowedPageSizes,defaultPageSize);}
 catch{return [];}
}

export function createSavedRecordView(
 existing:readonly SavedRecordView[],name:string,id:string,
 layout:Pick<SavedRecordView,'columns'|'sort'|'pageSize'>,
):SavedRecordView[]{
 const cleaned=name.trim().slice(0,RECORD_VIEW_NAME_LIMIT);
 if(!cleaned)throw new Error('Enter a name for this view.');
 if(existing.length>=MAX_SAVED_RECORD_VIEWS)
  throw new Error('You can save up to 12 views per directory. Delete one to add another.');
 if(existing.some(view=>view.name.toLocaleLowerCase()===cleaned.toLocaleLowerCase()))
  throw new Error('A view with that name already exists. Choose another name.');
 if(!id||existing.some(view=>view.id===id))
  throw new Error('Could not assign a unique view ID. Please retry.');
 return [...existing,{id,name:cleaned,columns:[...layout.columns],sort:{...layout.sort},pageSize:layout.pageSize}];
}

export function updateSavedRecordView(
 existing:readonly SavedRecordView[],id:string,
 layout:Pick<SavedRecordView,'columns'|'sort'|'pageSize'>,
):SavedRecordView[]{
 return existing.map(view=>view.id!==id?view:{
  ...view,columns:[...layout.columns],sort:{...layout.sort},pageSize:layout.pageSize,
 });
}

export function removeSavedRecordView(existing:readonly SavedRecordView[],id:string):SavedRecordView[]{
 return existing.filter(view=>view.id!==id);
}

export function savedRecordViewMatches(
 view:SavedRecordView,layout:Pick<SavedRecordView,'columns'|'sort'|'pageSize'>,
):boolean{
 return view.pageSize===layout.pageSize&&view.sort.key===layout.sort.key&&
  view.sort.reverse===layout.sort.reverse&&
  view.columns.length===layout.columns.length&&
  view.columns.every((key,index)=>key===layout.columns[index]);
}
