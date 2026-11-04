/** Privacy-safe, device-local diagnostics for tab reloads and auth revalidation.
 * No account IDs, customer records, email addresses or tokens are collected. */
const KEY='salesshop-tab-lifecycle-v1';
const STARTUP_TIMING_KEY='salesshop-startup-timings-v1';
type BootReason='browser-discard'|'page-reload'|'history-restore'|'fresh-navigation';
interface BootStats{
 reason:BootReason;
 bootAt:number;
 authReused:number;
 authReinitialized:number;
 lastAuthEvent?:string;
 pageShowRestored?:boolean;
}
const read=():BootStats|null=>{
 try{
  const data=window.sessionStorage.getItem(KEY);
  const parsed=data?JSON.parse(data) as BootStats:null;
  return parsed&&typeof parsed.bootAt==='number'?parsed:null;
 }catch{return null;}
};
const save=(entry:BootStats)=>{
 try{window.sessionStorage.setItem(KEY,JSON.stringify(entry));}catch{/* storage unavailable */}
};
export function recordSalesShopBoot():void{
 if(typeof window==='undefined')return;
 const nav=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
 const reason:BootReason=(document as Document&{wasDiscarded?:boolean}).wasDiscarded
  ?'browser-discard':nav?.type==='reload'?'page-reload':
  nav?.type==='back_forward'?'history-restore':'fresh-navigation';
 save({reason,bootAt:Date.now(),authReused:0,authReinitialized:0});
 try{window.sessionStorage.removeItem(STARTUP_TIMING_KEY);}catch{/* optional metrics */}
 window.addEventListener('pageshow',event=>{
  if(event.persisted){
   const previous=read();
   if(previous)save({...previous,pageShowRestored:true});
  }
 });
}
export function recordAuthLifecycle(event:string,reused:boolean):void{
 const previous=read();
 if(!previous)return;
 save({...previous,lastAuthEvent:event,
  authReused:previous.authReused+(reused?1:0),
  authReinitialized:previous.authReinitialized+(reused?0:1)});
}
export function lifecycleSummary():string{
 const value=read();
 if(!value)return'Browser lifecycle diagnostics unavailable';
 const boot=value.pageShowRestored?'Back-forward cache restore':value.reason.replaceAll('-',' ');
 return 'Tab start: '+boot+' · Auth checks reused: '+value.authReused+
  ' · Workspace initializations: '+value.authReinitialized+
  (value.lastAuthEvent?' · Latest auth event: '+value.lastAuthEvent:'')+
  (startupTimingSummary()?' · '+startupTimingSummary():'');
}

// Browser-local timing of named startup operations. No IDs, customer data,
// filenames or tokens are stored or transmitted.
export type StartupPhase='session'|'developer-check'|'workspace'|'membership'|'crm'|'quotes'|'signatures'|'notebook';
type PhaseTiming={durationMs:number;ok:boolean};
type TimingReport=Partial<Record<StartupPhase,PhaseTiming>>;
export async function timeStartupStep<T>(phase:StartupPhase,operation:()=>PromiseLike<T>):Promise<T>{
 const started=performance.now();
 let ok=false;
 try{
  const value=await operation();
  ok=true;
  return value;
 }finally{
  if(typeof window!=='undefined'){
   try{
    const raw=window.sessionStorage.getItem(STARTUP_TIMING_KEY);
    const previous=(raw?JSON.parse(raw):{}) as TimingReport;
    previous[phase]={durationMs:Math.max(0,Math.round(performance.now()-started)),ok};
    window.sessionStorage.setItem(STARTUP_TIMING_KEY,JSON.stringify(previous));
   }catch{/* optional diagnostics must never stop loading */}
  }
 }
}
export function startupTimingSummary():string{
 if(typeof window==='undefined')return'';
 try{
  const raw=window.sessionStorage.getItem(STARTUP_TIMING_KEY);
  const values=(raw?JSON.parse(raw):{}) as TimingReport;
  const phases:StartupPhase[]=['session','developer-check','workspace','membership','crm','quotes','signatures','notebook'];
  return phases.filter(phase=>values[phase]).map(phase=>{
   const value=values[phase]!;
   return phase+': '+(value.durationMs/1000).toFixed(1)+'s'+(value.ok?'':' (failed)');
  }).join(' · ');
 }catch{return'';}
}
