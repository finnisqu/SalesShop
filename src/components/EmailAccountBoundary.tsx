import {useEffect} from 'react';
import {useAuthStore} from '../store/authStore';
import {useGmailSessionStore} from '../store/gmailSession359a';
import {useEmailThreadLinkStore} from '../store/emailThreadLinkStore359a';
import {emailWorkspaceScope} from '../services/emailThreadLinks359a';
/** Global identity boundary. A Gmail token cannot be reused after SalesShop
 * switches users or organizations, even if Records never mounted. */
export function EmailAccountBoundary(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const scope=emailWorkspaceScope(mode,org,user);
 useEffect(()=>{
  useGmailSessionStore.getState().bindScope(scope);
  useEmailThreadLinkStore.getState().hydrate(scope);
 },[scope]);
 return null;
}
