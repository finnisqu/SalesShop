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
   // Existing full-page callback remains available as a legacy alternative.
   void useGmailSessionStore.getState().finishRedirect();
   useNavigationStore.getState().setView('tools');
  }else if(scope){
   // Only fetch Google authorization on the Worker after tenant identity is
   // restored. No saved Gmail token is ever kept by the browser.
   void useGmailSessionStore.getState().restorePersistent();
  }
  return ()=>{
   // On logout/identity handoff, clear in-memory Gmail headers and token even
   // if React unmounts App before rendering the next SalesShop identity.
   useGmailSessionStore.getState().bindScope(null);
   useEmailThreadLinkStore.getState().hydrate(null);
  };
 },[scope]);
 const persistent=useGmailSessionStore(s=>s.persistent);
 const expiresAt=useGmailSessionStore(s=>s.expiresAt);
 useEffect(()=>{
  if(!scope||!persistent)return;
  // A focused tab or an awake browser renews shortly before expiry;
  // search() also renews on demand for suspended/background tabs.
  const renew=()=>{void useGmailSessionStore.getState().renewPersistent();};
  const delay=Math.max(1200,expiresAt-Date.now()-4*60*1000);
  const timer=window.setTimeout(renew,delay);
  window.addEventListener('focus',renew);
  return()=>{window.clearTimeout(timer);window.removeEventListener('focus',renew);};
 },[scope,persistent,expiresAt]);
 return null;
}
