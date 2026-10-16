import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { TeamRole } from '../services/teamAccess';

type OwnershipMember = { user_id:string; displayName:string; role:TeamRole };
type Transfer = {
  id:string; organizationId:string; currentOwnerId:string; successorId:string;
  formerOwnerAccess:'remove'|'member'; createdAt:string; expiresAt:string;
};
type AccessAfter = 'remove' | 'member';

function formatDate(value:string) {
  const dt=new Date(value);
  return Number.isFinite(dt.getTime()) ? dt.toLocaleString(undefined, {
    month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit',
  }) : '—';
}

/**
 * UI collects intent and confirmation only. All eligibility, serialization,
 * expiry, former-Owner demotion, and audit rules live in trusted SQL RPCs.
 */
export function OwnershipTransferPanel({
  orgId, myRole, members,
}: { orgId:string; myRole:TeamRole|null; members:OwnershipMember[] }) {
  const userId=useAuthStore(state=>state.user?.id);
  const [transfer,setTransfer]=useState<Transfer|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [targetId,setTargetId]=useState('');
  const [formerAccess,setFormerAccess]=useState<AccessAfter>('remove');
  const [initiateText,setInitiateText]=useState('');
  const [acceptText,setAcceptText]=useState('');

  const refresh=useCallback(async()=>{
    if(!supabase||!orgId)return;
    setLoading(true);
    const {data,error:readError}=await supabase.rpc('get_ownership_transfer', {
      target_organization:orgId,
    });
    if(readError)setError(readError.message);
    else {setTransfer(data && typeof data==='object' && !Array.isArray(data) ? data as Transfer : null);setError('');}
    setLoading(false);
  },[orgId]);
  useEffect(()=>{void refresh();},[refresh]);

  const request=async()=>{
    if(!supabase||myRole!=='owner'||!orgId||!targetId||targetId===userId||
      initiateText.trim().toUpperCase()!=='TRANSFER'||busy)return;
    const candidate=members.find(m=>m.user_id===targetId);
    if(!candidate||candidate.role==='owner')return;
    if(!window.confirm(`Send an ownership transfer request to ${candidate.displayName}? No ownership changes until that person accepts from their account.`))return;
    setBusy(true);setError('');setNotice('');
    const {error:requestError}=await supabase.rpc('request_ownership_transfer',{
      target_organization:orgId,successor_user_id:targetId,former_owner_access:formerAccess,
    });
    setBusy(false);
    if(requestError){setError(requestError.message);return;}
    setTargetId('');setInitiateText('');
    setNotice('Request sent. The successor must sign in and accept within seven days; you remain Owner until then.');
    await refresh();
  };

  const cancel=async()=>{
    if(!supabase||!transfer||busy)return;
    const declining=userId===transfer.successorId;
    if(!window.confirm(declining?'Decline this ownership transfer?':'Cancel the pending ownership transfer?'))return;
    setBusy(true);setError('');setNotice('');
    const {error:cancelError}=await supabase.rpc('cancel_ownership_transfer',{request_id:transfer.id});
    setBusy(false);
    if(cancelError){setError(cancelError.message);return;}
    setNotice(declining?'Transfer declined.':'Transfer cancelled.');setTransfer(null);
  };

  const accept=async()=>{
    if(!supabase||!transfer||userId!==transfer.successorId||busy||
      acceptText.trim().toUpperCase()!=='ACCEPT')return;
    if(!window.confirm('Accept legal and administrative responsibility as this company\'s new SalesShop Owner? The former Owner will immediately lose Owner privileges.'))return;
    setBusy(true);setError('');
    const {error:acceptError}=await supabase.rpc('accept_ownership_transfer',{request_id:transfer.id});
    setBusy(false);
    if(acceptError){setError(acceptError.message);return;}
    // The JWT remains the same, but the org role and hydrated company state
    // need a fresh authorization boundary before any further editing.
    window.location.reload();
  };

  const isSuccessor=!!transfer&&userId===transfer.successorId;
  const isInitiator=!!transfer&&userId===transfer.currentOwnerId;
  const otherMembers=members.filter(m=>m.user_id!==userId && m.role!=='owner');
  const selectedName=members.find(m=>m.user_id===transfer?.successorId)?.displayName ?? 'Selected teammate';
  const ownerName=members.find(m=>m.user_id===transfer?.currentOwnerId)?.displayName ?? 'Current Owner';

  if(myRole!=='owner'&&!isSuccessor&&!loading)return null;
  return <article className="company-settings-card ownership-transfer-panel" aria-label="Company ownership transfer">
    <header><div><strong>Company ownership handoff</strong>
      <small>Owner initiation + successor acceptance · database-enforced · audited</small></div></header>
    <p className="ownership-transfer-help">
      Company ownership is different from SalesShop Developer access. A Developer uses a separate login and
      cannot belong to a customer workspace. This transfer never assigns platform privileges.
    </p>
    {loading && <p role="status" className="ownership-transfer-help">Checking pending transfers…</p>}
    {error && <p role="alert" className="ownership-transfer-error">{error}</p>}
    {notice && <p role="status" className="ownership-transfer-success">{notice}</p>}
    {transfer && (isInitiator||isSuccessor) && <section className="ownership-transfer-pending">
      <div className="ownership-transfer-status"><strong>Awaiting successor</strong>
        <span>Expires {formatDate(transfer.expiresAt)}</span></div>
      <p>Current Owner: <strong>{ownerName}</strong> · Successor: <strong>{selectedName}</strong></p>
      <p>After acceptance: former Owner {transfer.formerOwnerAccess==='remove'
        ? 'leaves the company workspace entirely'
        : 'becomes a Member (Salesperson)'}.</p>
      {isSuccessor && <div className="ownership-transfer-actions">
        <p><strong>You were nominated to own this company.</strong> Accepting gives you Owner authority for its settings,
          membership and records. The transfer cannot be undone without another accepted handoff.</p>
        <label><span>Type ACCEPT to confirm</span><input aria-label="Type ACCEPT to confirm ownership"
          value={acceptText} autoComplete="off" onChange={event=>setAcceptText(event.target.value)}/></label>
        <button type="button" className="settings-primary-button" disabled={busy||acceptText.trim().toUpperCase()!=='ACCEPT'}
          onClick={()=>void accept()}>{busy?'Transferring…':'Accept company ownership'}</button>
      </div>}
      <button type="button" disabled={busy} onClick={()=>void cancel()}>
        {isSuccessor?'Decline handoff':'Cancel request'}
      </button>
    </section>}
    {!loading&&!transfer&&myRole==='owner'&&<section className="ownership-transfer-actions">
      <p>The successor must already be an invited, email-verified team member. Initiating a request does not
        change anyone’s role. The nominated successor must sign in and accept within seven days.</p>
      <label><span>New company Owner</span><select aria-label="New company Owner" value={targetId}
        onChange={event=>setTargetId(event.target.value)}>
        <option value="">Select an existing teammate</option>
        {otherMembers.map(member=><option key={member.user_id} value={member.user_id}>
          {member.displayName} · {member.role}</option>)}
      </select></label>
      {!otherMembers.length&&<p className="ownership-transfer-help">Invite your successor in Team Settings first. They must accept
        their invitation and verify their email before ownership can transfer.</p>}
      <label><span>My company access after handoff</span><select aria-label="Former Owner access" value={formerAccess}
        onChange={event=>setFormerAccess(event.target.value as AccessAfter)}>
        <option value="remove">Remove my company membership (recommended for Developer separation)</option>
        <option value="member">Remain a Salesperson Member</option>
      </select></label>
      {formerAccess==='member'
        ? <p className="ownership-transfer-help">A Member still has access to shared company CRM information under
          current permissions. Choose removal if you need no access to employee and sales data.</p>
        : <p className="ownership-transfer-help">Your current company login will lose workspace access after acceptance.
          Use a separately provisioned Developer account for SalesShop Platform Studio.</p>}
      <label><span>Type TRANSFER to prepare the request</span><input
        aria-label="Type TRANSFER to initiate ownership request" autoComplete="off"
        value={initiateText} onChange={event=>setInitiateText(event.target.value)}/></label>
      <button type="button" className="settings-primary-button"
        disabled={busy||!targetId||initiateText.trim().toUpperCase()!=='TRANSFER'}
        onClick={()=>void request()}>{busy?'Submitting…':'Request ownership handoff'}</button>
    </section>}
  </article>;
}
