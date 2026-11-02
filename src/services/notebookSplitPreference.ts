/** Device-local split presentation. Notebook documents themselves remain in their existing store. */
export interface NotebookSplitPreference{rightId:string|null;stacked:boolean}
export const defaultNotebookSplitPreference=():NotebookSplitPreference=>({rightId:null,stacked:false});
export function decodeNotebookSplitPreference(
 raw:unknown,leftId:string,availableIds:readonly string[],
):NotebookSplitPreference{
 if(!raw||typeof raw!=='object')return defaultNotebookSplitPreference();
 const value=raw as Record<string,unknown>;
 const rightId=typeof value.rightId==='string'&&value.rightId!==leftId
   &&availableIds.includes(value.rightId)?value.rightId:null;
 return {rightId,stacked:value.stacked===true};
}
const key=(scope:string)=>'salesshop-notebook-split-v1:'+scope;
export function readNotebookSplitPreference(scope:string,leftId:string,ids:readonly string[]){
 try{return decodeNotebookSplitPreference(JSON.parse(localStorage.getItem(key(scope))??'null'),leftId,ids);}
 catch{return defaultNotebookSplitPreference();}
}
export function writeNotebookSplitPreference(scope:string,preference:NotebookSplitPreference){
 try{localStorage.setItem(key(scope),JSON.stringify(preference));}
 catch{/* Device preferences are optional when browser storage is unavailable. */}
}
