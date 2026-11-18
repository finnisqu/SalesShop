import {useState} from 'react';
import {gmailOAuthDiagnosticReport,inspectGmailOAuthEnvironment,
 type GmailOAuthDiagnostics} from '../services/gmailOAuthDiagnostics388';
import './gmail-connection-checks388.css';

/** Optional on-demand diagnosis: only public OAuth configuration and response
 * headers are inspected. No tokens, messages or mailbox identifiers. */
export function GmailConnectionChecks388(){
 const [checks,setChecks]=useState<GmailOAuthDiagnostics|null>(null);
 const [checking,setChecking]=useState(false);
 const [copyNotice,setCopyNotice]=useState('');
 const run=async()=>{
  if(checking)return;
  setChecking(true);setCopyNotice('');
  try{setChecks(await inspectGmailOAuthEnvironment());}
  finally{setChecking(false);}
 };
 const copy=async()=>{
  if(!checks)return;
  try{
   await navigator.clipboard.writeText(gmailOAuthDiagnosticReport(checks));
   setCopyNotice('Safe connection report copied. No Gmail content or token is included.');
  }catch{setCopyNotice('Could not copy. You can select the fields above manually.');}
 };
 return <details className="ss-gmail-connection-checks">
  <summary>Connection checks</summary>
  <div className="ss-gmail-connection-checks-body">
   <p>Google reported a popup problem, but that alone does not prove which setting
    caused it. Check this browser and compare its public configuration with Google Cloud.</p>
   <button type="button" onClick={()=>{void run();}} disabled={checking}>
    {checking?'Checking…':'Check this browser'}
   </button>
   {checks&&<>
    <dl>
     <div><dt>SalesShop origin</dt><dd><code>{checks.origin}</code></dd></div>
     <div><dt>Public OAuth Web client ID</dt><dd><code>{checks.publicClientId||'Not configured'}</code></dd></div>
     <div><dt>Google library</dt><dd>{checks.googleLibraryReady?'Loaded':'Not loaded or blocked'}</dd></div>
     <div><dt>Embedded page</dt><dd>{checks.embedded===null?'Unknown':checks.embedded?'Yes — open SalesShop directly':'No'}</dd></div>
     <div><dt>Deployed COOP header</dt><dd><code>{checks.coopHeader}</code></dd></div>
     <div><dt>Popup header check</dt><dd>{checks.coopStatus==='compatible'
      ?'Allows popup communication'
      :checks.coopStatus==='incompatible'
       ?'May block Google popup communication'
       :checks.coopStatus==='missing'?'No COOP header returned'
       :'Could not verify automatically'}</dd></div>
    </dl>
    {checks.coopStatus==='incompatible'&&<p role="alert">
     The deployed page appears to enforce a popup-isolating COOP policy.
     SalesShop should serve <code>same-origin-allow-popups</code> for its HTML document.</p>}
    <button type="button" onClick={()=>{void copy();}}>Copy safe report</button>
    {copyNotice&&<small role="status">{copyNotice}</small>}
   </>}
   <div className="ss-gmail-connection-checks-steps">
    <strong>Verify in Google Cloud</strong>
    <ol>
     <li>Open <b>Google Auth Platform → Clients</b> (or APIs &amp; Services → Credentials).
      Choose the Web OAuth client with the exact public client ID shown above.</li>
     <li>Under <b>Authorized JavaScript origins</b>, add
      <code> https://app.salesshop.work</code> (no trailing slash), then Save.
      The root domain alone is not sufficient.</li>
     <li>Confirm Gmail API access is enabled and, if the OAuth app is in
      <b> Testing</b>, that your Google address is an authorized test user.</li>
     <li>In your browser, allow popups for SalesShop, temporarily check whether a
      privacy extension is blocking Google, then retry <b>Connect Gmail</b>.
      If Google shows an explicit error, note its code rather than closing the popup.</li>
    </ol>
   </div>
   <small>Client ID and response headers are public diagnostic information.
    Gmail tokens and message contents are never read by this checker.</small>
  </div>
 </details>;
}
