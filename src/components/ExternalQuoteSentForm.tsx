import {useState,type FormEvent} from 'react';
import type {Project} from '../types/crm';
import {useCrmStore} from '../store/crmStore';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import '../external-quote.css';

function localToday() {
  const today=new Date();
  return [today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),
    String(today.getDate()).padStart(2,'0')].join('-');
}

export function ExternalQuoteSentForm({deal,onCancel,onRecorded}:{
  deal:Project;onCancel:()=>void;onRecorded?:()=>void;
}){
  const recordExternalQuoteSent=useCrmStore(s=>s.recordExternalQuoteSent);
  const historical=['Closed Won','Completed','Closed Lost','Discarded'].includes(deal.stage);
  const completeSubmissionTasks=usePersonalTaskStore(s=>s.completeDealSubmissionTasks);
  const [amount,setAmount]=useState(deal.amount===undefined?'':String(deal.amount));
  const [bidSentDate,setBidSentDate]=useState(localToday);
  const [format,setFormat]=useState('');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(saving)return;
    const total=Number(amount);
    if(!amount.trim()||!Number.isFinite(total)||total<0){
      setError('Enter a valid total contract value.');return;
    }
    if(!bidSentDate||bidSentDate>localToday()){
      setError('Select the date the quote was actually sent.');return;
    }
    setSaving(true);setError('');
    try{
      const saved=recordExternalQuoteSent(deal.id,total,bidSentDate,format);
      if(!saved){setError('Unable to record this submission. Check the Deal stage and date.');return;}
      if(!historical)completeSubmissionTasks(deal.id);
      onRecorded?.();
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Unable to save this external quote.');
    }finally{setSaving(false);}
  };
  return <form className="external-quote-form" onSubmit={submit}
    aria-label="Record quote sent using another tool" aria-busy={saving}>
    <strong>Quote sent outside SalesShop</strong>
    <p>Record the submitted contract value and actual send date. No SalesShop quote will be created.
      {historical?' This is a historical entry: your Deal stage, final amount, deadline, and tasks remain unchanged.':''}</p>
    <div className="external-quote-fields">
      <label>Total contract value ($)
        <input type="number" inputMode="decimal" min="0" step="0.01" required
          value={amount} onChange={event=>{setAmount(event.target.value);setError('');}}
          placeholder="0.00"/>
      </label>
      <label>Bid sent date
        <input type="date" required max={localToday()} value={bidSentDate}
          onChange={event=>{setBidSentDate(event.target.value);setError('');}}/>
      </label>
    </div>
    <label>Tool or format <span>(optional)</span>
      <input maxLength={120} value={format} placeholder="Excel, PDF, another quoting tool…"
        onChange={event=>setFormat(event.target.value)}/>
    </label>
    <small className="external-quote-explanation">
      {historical
        ?'Historical backfill adds a dated CRM quote-sent event only. Existing Deal status, totals and tasks stay intact.'
        :'For an open Deal this records the submission, updates the Deal to Bid Sent when appropriate, clears its bid deadline and completes Submit Quote tasks.'}
    </small>
    {error&&<p role="alert" className="external-quote-error">{error}</p>}
    <div className="external-quote-actions">
      <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      <button type="submit" className="connections-record-primary" disabled={saving||!amount.trim()||!bidSentDate}>
        {saving?'Recording…':'Mark bid sent'}
      </button>
    </div>
  </form>;
}
