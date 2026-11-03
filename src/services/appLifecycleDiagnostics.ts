/** Privacy-safe, device-local diagnostics for tab reloads and auth revalidation.
 * No account IDs, customer records, email addresses or tokens are collected. */
const KEY='salesshop-tab-lifecycle-v1';
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
  (value.lastAuthEvent?' · Latest auth event: '+value.lastAuthEvent:'');
}
