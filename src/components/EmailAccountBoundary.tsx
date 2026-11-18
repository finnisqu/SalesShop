import {useEffect} from 'react';
import {useAuthStore} from '../store/authStore';
import {useGmailSessionStore} from '../store/gmailSession359a';
import {useEmailThreadLinkStore} from '../store/emailThreadLinkStore359a';
import {emailWorkspaceScope} from '../services/emailThreadLinks359a';
import {isGmailRedirectCallback} from '../services/gmailRedirect389';
import {useNavigationStore} from '../store/navigationStore';
/** Global identity boundary. A Gmail token cannot be reused after SalesShop
 * switches users or organizations, even if Records never mounted. */
export function EmailAccountBoundary(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const scope=emailWorkspaceScope(mode,org,user);
 useEffect(()=>{
  useGmailSessionStore.getState().bindScope(scope);
  useEmailThreadLinkStore.getState().hydrate(scope);
  if(scope&&isGmailRedirectCallback()){
   // Consume the callback only after SalesShop has restored its real account.
   // finishRedirect removes code/state from the URL before awaiting Google.
   void useGmailSessionStore.getState().finishRedirect();
   useNavigationStore.getState().setView('tools');
  }
  return ()=>{
   // On logout/identity handoff, clear in-memory Gmail headers and token even
   // if React unmounts App before rendering the next SalesShop identity.
   useGmailSessionStore.getState().bindScope(null);
   useEmailThreadLinkStore.getState().hydrate(null);
  };
 },[scope]);
 return null;
}
