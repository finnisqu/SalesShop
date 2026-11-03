import {useAuthStore} from '../store/authStore';
import {useActivityCloudStatusStore} from '../store/activityCloudStatusStore';
import {readPendingActivities} from '../services/activityCloudOutbox';

export function ActivityCloudIndicator(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const status=useActivityCloudStatusStore(s=>s.status),
  message=useActivityCloudStatusStore(s=>s.message),
  reportedCount=useActivityCloudStatusStore(s=>s.pendingCount);
 if(mode!=='cloud'||!org||!user||status==='idle')return null;
 const count=Math.max(reportedCount,readPendingActivities({organizationId:org,userId:user}).length);
 if(!count&&status!=='saved')return null;
 const label=status==='saved'?'✓ CRM activity saved to cloud':
   status==='syncing'?'Saving '+count+' interaction'+(count===1?'':'s')+'…':
   status==='error'?'Activity cloud save failed · safely queued on this device':
   count+' interaction'+(count===1?'':'s')+' queued for cloud';
 return <div className={'sales-activity-cloud-state is-'+status} role="status" aria-live="polite">
  <span>{label}</span>
  {message&&status==='error'&&<small title={message}>{message}</small>}
  {count>0&&<button type="button" onClick={()=>
    window.dispatchEvent(new Event('salesshop:retry-activity-cloud'))}>Retry save</button>}
 </div>;
}
