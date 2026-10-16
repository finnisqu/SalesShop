import {useMemo,useState} from 'react';
import type {Quote} from '../types/quote';
import {quoteTotal,displayQuoteNumber} from '../types/quote';
import {useCrmStore} from '../store/crmStore';
import {recordQuoteFollowUp} from '../services/quoteFollowUpActions';
import {
  buildQuoteFollowUpQueue,followUpLocalDate,latestQuoteFollowUp,quoteFollowUpCounts,
  type FollowUpAction,type FollowUpMethod,type QuoteFollowUpItem,
} from '../services/quoteFollowUps';
import '../quotes-follow-up.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
type QueueFilter='attention'|'all'|'scheduled';
function badge(item:QuoteFollowUpItem){
  return item.priority==='due'?item.label:item.priority==='needs-delivery'?'Not delivered':
    item.priority==='ready-to-review'?'Review':item.priority==='upcoming'?'Scheduled':'Awaiting reply';
}

export function QuotesFollowUpDashboard({
  quotes,onOpen,canManage=true,
}:{quotes:readonly Quote[];onOpen:(id:string)=>void;canManage?:boolean}){
  const activities=useCrmStore(s=>s.activities);
  const [filter,setFilter]=useState<QueueFilter>('attention');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [showAll,setShowAll]=useState(false);
  const [dueDate,setDueDate]=useState(followUpLocalDate());
  const [note,setNote]=useState('');
  const [method,setMethod]=useState<FollowUpMethod>('call');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const entries=useMemo(()=>buildQuoteFollowUpQueue(quotes,activities),[quotes,activities]);
  const counts=quoteFollowUpCounts(entries);
  const filtered=entries.filter(item=>filter==='all'||(filter==='scheduled'
    ?item.priority==='upcoming':item.priority!=='upcoming'));
  const visible=showAll?filtered:filtered.slice(0,8);
  const choose=(item:QuoteFollowUpItem)=>{
    setExpanded(old=>old===item.quote.id?null:item.quote.id);
    setDueDate(item.dueDate&&item.dueDate>=followUpLocalDate()?item.dueDate:followUpLocalDate());
    setError('');setNotice('');setNote('');
  };
  const save=async(item:QuoteFollowUpItem,action:FollowUpAction)=>{
    if(saving||!canManage)return;
    setSaving(true);setError('');setNotice('');
    try{
      await recordQuoteFollowUp({
        quoteId:item.quote.id,revision:item.quote.revision,action,
        dueDate:action==='scheduled'?dueDate:undefined,
        method:action==='contacted'?method:undefined,note,
      });
      setNotice(action==='scheduled'?'Follow-up scheduled in CRM.':
        action==='contacted'?'Customer contact recorded in CRM.':'Follow-up cleared.');
      setExpanded(null);setNote('');
    }catch(err){setError(err instanceof Error?err.message:'Follow-up could not be saved.');}
    finally{setSaving(false);}
  };
  return <section className="qmb-followups" aria-label="Quote follow-up dashboard">
    <header className="qmb-followups-heading">
      <div><span>YOUR NEXT ACTIONS</span><h2>Quote follow-ups</h2>
        <p>See what needs delivery, customer contact or a scheduled check-in. No customer messages are sent here.</p></div>
      <strong>{counts.total} active</strong>
    </header>
    <div className="qmb-followups-stats" aria-label="Follow-up summary">
      <div><b>{counts.due}</b><span>Due now</span></div>
      <div><b>{counts.needsDelivery}</b><span>Need delivery</span></div>
      <div><b>{counts.awaiting}</b><span>Awaiting reply</span></div>
      <div><b>{counts.scheduled}</b><span>Upcoming</span></div>
    </div>
    <div className="qmb-followups-filters" role="group" aria-label="Follow-up queue filter">
      {([['attention','Needs attention'],['scheduled','Scheduled'],['all','All']] as const)
        .map(([key,label])=><button type="button" key={key} aria-pressed={filter===key}
          className={filter===key?'active':''}
          onClick={()=>{setFilter(key);setShowAll(false);setExpanded(null);setNotice('');setError('');}}>
          {label}</button>)}
    </div>
    {visible.length?<div className="qmb-followups-list">{visible.map(item=>{
      const q=item.quote,canLog=['awaiting-reply','due','upcoming'].includes(item.priority);
      const last=latestQuoteFollowUp(q,activities);
      return <article className="qmb-followups-item" key={q.id}>
        <div className="qmb-followups-item-top">
          <span className={'qmb-followups-label is-'+item.priority}>{badge(item)}</span>
          <small>{displayQuoteNumber(q)} · Rev {q.revision}</small>
        </div>
        <div className="qmb-followups-row">
          <div><strong>{q.title||'Untitled quote'}</strong>
            <small>{q.companyName||'Customer not selected'} · {money.format(quoteTotal(q))}</small></div>
          {item.dueDate&&<time dateTime={item.dueDate}>Due {item.dueDate}</time>}
        </div>
        <p>{item.reason}</p>
        {last?.summary&&<small className="qmb-followups-latest">{last.summary}</small>}
        <div className="qmb-followups-actions">
          <button type="button" onClick={()=>onOpen(q.id)}>
            {item.priority==='ready-to-review'?'Open to review':
              item.priority==='needs-delivery'?'Open to deliver':'Open quote'}</button>
          {canManage&&canLog&&<button type="button" className="is-secondary" aria-expanded={expanded===q.id}
            onClick={()=>choose(item)}>{expanded===q.id?'Close follow-up':'Plan / log follow-up'}</button>}
        </div>
        {expanded===q.id&&canManage&&canLog&&<div className="qmb-followups-editor" aria-label={'Follow-up for '+q.title}>
          <label>Next contact date
            <input aria-label="Next follow-up date" type="date" min={followUpLocalDate()}
              value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
          </label>
          <label>Contact method
            <select value={method} aria-label="Follow-up contact method" onChange={e=>setMethod(e.target.value as FollowUpMethod)}>
              <option value="call">Phone call</option><option value="email">Email</option>
              <option value="text">Text message</option><option value="meeting">Meeting</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Private note (optional)
            <textarea aria-label="Follow-up note" maxLength={500} rows={2}
              value={note} onChange={e=>setNote(e.target.value)}
              placeholder="What should happen next?"/>
          </label>
          <div className="qmb-followups-editor-actions">
            <button type="button" disabled={saving||!dueDate} onClick={()=>void save(item,'scheduled')}>Schedule</button>
            <button type="button" disabled={saving} onClick={()=>void save(item,'contacted')}>Log customer contact</button>
            {item.priority==='due'&&<button type="button" disabled={saving}
              onClick={()=>void save(item,'cleared')}>Clear reminder</button>}
          </div>
          <small>Only the CRM activity is saved; this does not send a text or email or change the quote.</small>
        </div>}
      </article>;
    })}</div>:<p className="qmb-followups-empty">No quotes in this view. You're caught up on this part of the queue.</p>}
    {filtered.length>8&&<button type="button" className="qmb-followups-more" onClick={()=>setShowAll(x=>!x)}>
      {showAll?'Show fewer':'Show all '+filtered.length+' follow-ups'}</button>}
    {error&&<p role="alert" className="qmb-followups-error">{error}</p>}
    {notice&&<p role="status" className="qmb-followups-notice">{notice}</p>}
  </section>;
}
