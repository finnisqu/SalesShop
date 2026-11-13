import {useRef,useState,type FormEvent} from 'react';
import type {Project} from '../types/crm';
import {validExternalQuoteSentDate} from '../services/externalQuoteDate';
import {useCrmStore} from '../store/crmStore';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {readPendingExternalQuoteSubmission,savePendingExternalQuoteSubmission,
 clearPendingExternalQuoteSubmission,type PendingExternalQuoteSubmission,
 type ExternalQuotePendingIdentity} from '../services/externalQuotePendingSubmission';
import '../external-quote.css';

function localToday(){
 const today=new Date();
 return [today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),
  String(today.getDate()).padStart(2,'0')].join('-');
}
function currentPendingIdentity(dealId:string):ExternalQuotePendingIdentity|null{
 const auth=useAuthStore.getState();
 return auth.mode==='cloud'&&auth.organizationId&&auth.user?.id
  ?{organizationId:auth.organizationId,userId:auth.user.id,dealId}:null;
}

export function ExternalQuoteSentForm({deal,onCancel,onRecorded,initialSentDate}:{
 deal:Project;onCancel:()=>void;onRecorded?:(bidSentDate:string)=>void;initialSentDate?:string;
}){
 const recordExternalQuoteSent=useCrmStore(s=>s.recordExternalQuoteSent);
 const historical=['Closed Won','Completed','Closed Lost','Discarded'].includes(deal.stage);
 const completeSubmissionTasks=usePersonalTaskStore(s=>s.completeDealSubmissionTasks);
 const [pendingAttempt,setPendingAttempt]=useState<PendingExternalQuoteSubmission|null>(()=>{
  const identity=currentPendingIdentity(deal.id);
  return identity?readPendingExternalQuoteSubmission(identity):null;
 });
 const [amount,setAmount]=useState(()=>
  pendingAttempt?String(pendingAttempt.amount):deal.amount===undefined?'':String(deal.amount));
 const [bidSentDate,setBidSentDate]=useState(()=>
  pendingAttempt?.bidSentDate??(initialSentDate&&
   validExternalQuoteSentDate(initialSentDate,localToday())
   ?initialSentDate:localToday()));
 const [format,setFormat]=useState(pendingAttempt?.format??'');
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const [recorded,setRecorded]=useState(false);
 // A ref blocks Enter + click before the button rerenders disabled.
 const savingRef=useRef(false);
 const submissionId=useRef(pendingAttempt?.id??'activity_'+crypto.randomUUID());
 const recordedAt=useRef(pendingAttempt?.recordedAt??new Date().toISOString());

 const discardPending=()=>{
  if(!pendingAttempt||savingRef.current)return;
  if(!window.confirm(
   'Only discard this pending attempt after checking Activity history. If it already reached SalesShop, starting a new submission could create a duplicate. Discard and start fresh?'
  ))return;
  if(!clearPendingExternalQuoteSubmission(pendingAttempt)){
   setError('Could not clear the pending submission. Reopen this form before trying again.');
   return;
  }
  submissionId.current='activity_'+crypto.randomUUID();
  recordedAt.current=new Date().toISOString();
  setPendingAttempt(null);setError('');
 };

 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(savingRef.current||recorded)return;
  const total=Number(amount);
  if(!amount.trim()||!Number.isFinite(total)||total<0){
   setError('Enter a valid total contract value.');return;
  }
  if(!validExternalQuoteSentDate(bidSentDate,localToday())){
   setError('Select the date the quote was actually sent.');return;
  }
  const identity=currentPendingIdentity(deal.id);
  if(pendingAttempt&&!identity){
   setError('Your account changed. Reopen this Deal in the original workspace before retrying.');
   return;
  }
  let attempt=pendingAttempt;
  if(identity){
   const stored=readPendingExternalQuoteSubmission(identity);
   if(attempt){
    if(!stored||stored.id!==attempt.id||stored.recordedAt!==attempt.recordedAt){
     setError('The pending submission changed in another tab. Reopen this Deal to review it.');
     return;
    }
   }else if(stored){
    // Another tab already allocated this immutable Activity identity.
    setPendingAttempt(stored);setAmount(String(stored.amount));
    setBidSentDate(stored.bidSentDate);setFormat(stored.format);
    submissionId.current=stored.id;recordedAt.current=stored.recordedAt;
    setError('Recovered an unfinished submission. Review it and select Retry confirmation.');
    return;
   }else{
    attempt={...identity,version:1,id:'activity_'+crypto.randomUUID(),
     recordedAt:new Date().toISOString(),amount:total,bidSentDate,
     format:format.trim().slice(0,120)};
    // Never initiate a cloud submission with an ID that cannot survive refresh.
    if(!savePendingExternalQuoteSubmission(attempt)){
     setError('Browser storage is unavailable. No submission was sent. Enable browser storage and retry.');
     return;
    }
    setPendingAttempt(attempt);
   }
  }else if(!attempt){
   submissionId.current='activity_'+crypto.randomUUID();
   recordedAt.current=new Date().toISOString();
  }
  if(attempt){
   submissionId.current=attempt.id;recordedAt.current=attempt.recordedAt;
  }
  savingRef.current=true;setSaving(true);setError('');
  try{
   const saved=await recordExternalQuoteSent(deal.id,total,bidSentDate,format,
    submissionId.current,recordedAt.current);
   if(!saved){
    setError('Unable to record this submission. Check the Deal stage and date.');
    return;
   }
   // Only after the Activity and any required Deal update are acknowledged.
   if(attempt)clearPendingExternalQuoteSubmission(attempt);
   setPendingAttempt(null);setRecorded(true);
   if(!historical)completeSubmissionTasks(deal.id);
   onRecorded?.(bidSentDate);
  }catch(reason){
   setError(reason instanceof Error?reason.message:'Unable to save this external quote.');
  }finally{savingRef.current=false;setSaving(false);}
 };

 const locked=Boolean(pendingAttempt)||saving||recorded;
 return <form className="external-quote-form" onSubmit={submit}
  aria-label="Record quote sent using another tool" aria-busy={saving}>
  <strong>Quote sent outside SalesShop</strong>
  <p>Record the submitted contract value and actual send date. No SalesShop quote will be created.
   {historical?' This is a historical entry: your Deal stage, final amount, deadline, and tasks remain unchanged.':''}
  </p>
  {pendingAttempt&&<p role="status" className="external-quote-explanation">
   An unfinished submission was recovered. Its date, value, format and Activity ID
   are locked to prevent duplicates. Retry confirmation, or inspect Activity history
   before explicitly discarding the attempt.
  </p>}
  {recorded&&<p role="status" className="external-quote-explanation">
   Submission recorded. Close this form to return to the Deal.
  </p>}
  <div className="external-quote-fields">
   <label>Date sent <span>(defaults to today)</span>
    <input type="date" required max={localToday()} aria-label="Date quote was sent"
     value={bidSentDate} disabled={locked}
     onChange={event=>{setBidSentDate(event.target.value);setError('');}}/>
   </label>
   <label>Total contract value ($)
    <input type="number" inputMode="decimal" min="0" step="0.01" required
     value={amount} disabled={locked}
     onChange={event=>{setAmount(event.target.value);setError('');}}
     placeholder="0.00"/>
   </label>
  </div>
  <label>Tool or format <span>(optional)</span>
   <input maxLength={120} value={format} placeholder="Excel, PDF, another quoting tool…"
    disabled={locked} onChange={event=>setFormat(event.target.value)}/>
  </label>
  <small className="external-quote-explanation">The Quote Sent calendar badge uses Date sent.
   The Activity history shows when you recorded it.
   {historical
    ?'Historical backfill adds a dated CRM quote-sent event only. Existing Deal status, totals and tasks stay intact.'
    :'For an open Deal this records the submission, updates the Deal to Bid Sent when appropriate, clears its bid deadline and completes Submit Quote tasks.'}
  </small>
  {error&&<p role="alert" className="external-quote-error">{error}</p>}
  <div className="external-quote-actions">
   <button type="button" onClick={onCancel} disabled={saving}>{recorded?'Close':'Cancel'}</button>
   {pendingAttempt&&!recorded&&<button type="button" onClick={discardPending}
    disabled={saving}>Discard pending attempt</button>}
   <button type="submit" className="connections-record-primary"
    disabled={saving||recorded||!amount.trim()||!bidSentDate}>
    {saving?'Saving…':recorded?'Recorded':pendingAttempt?'Retry confirmation':'Mark bid sent'}
   </button>
  </div>
 </form>;
}
