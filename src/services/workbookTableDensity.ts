import {useEffect,useSyncExternalStore} from 'react';

/** A single browser-local preference for directory and Catalog workbook rows.
 * Quote takeoff cells keep their dedicated editor controls.
 */
export type WorkbookTableDensity='comfortable'|'compact';
export const WORKBOOK_TABLE_DENSITY_KEY='salesshop-workbook-density-v1';
const EVENT='salesshop:workbook-density-changed';
let sessionFallback:WorkbookTableDensity='comfortable';
export function normalizeWorkbookTableDensity(value:unknown):WorkbookTableDensity{
 return value==='compact'?'compact':'comfortable';
}
export function getWorkbookTableDensity():WorkbookTableDensity{
 if(typeof window==='undefined')return 'comfortable';
 try{return normalizeWorkbookTableDensity(window.localStorage.getItem(WORKBOOK_TABLE_DENSITY_KEY));}
 catch{return sessionFallback;}
}
function applyWorkbookTableDensity(value:WorkbookTableDensity){
 if(typeof document!=='undefined')document.documentElement.dataset.ssWorkbookDensity=value;
}
export function setWorkbookTableDensity(value:WorkbookTableDensity){
 const next=normalizeWorkbookTableDensity(value);
 sessionFallback=next;
 if(typeof window==='undefined')return;
 try{window.localStorage.setItem(WORKBOOK_TABLE_DENSITY_KEY,next);}catch{/* preference storage is optional */}
 applyWorkbookTableDensity(next);
 window.dispatchEvent(new Event(EVENT));
}
function subscribeToDensityChange(callback:()=>void){
 if(typeof window==='undefined')return ()=>{};
 const onStorage=(event:StorageEvent)=>{
  if(event.key===WORKBOOK_TABLE_DENSITY_KEY||event.key===null)callback();
 };
 window.addEventListener(EVENT,callback);
 window.addEventListener('storage',onStorage);
 return ()=>{
  window.removeEventListener(EVENT,callback);
  window.removeEventListener('storage',onStorage);
 };
}
/** Synchronizes controls across workspaces, tabs and the same browser window. */
export function useWorkbookTableDensity(){
 const density=useSyncExternalStore(subscribeToDensityChange,getWorkbookTableDensity,()=> 'comfortable');
 useEffect(()=>applyWorkbookTableDensity(density),[density]);
 return [density,setWorkbookTableDensity] as const;
}
