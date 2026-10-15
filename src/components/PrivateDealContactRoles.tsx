import { useEffect, useMemo, useRef, useState } from 'react';
import type { Contact } from '../types/crm';
import type { Quote } from '../types/quote';
import { useAuthStore } from '../store/authStore';
import {
  PRIVATE_DEAL_CONTACT_ROLES, isPrivateDealRole, loadPrivateDealRoles,
  ownedQuoteContactIds, writePrivateDealRole, type PrivateDealContactRole,
} from '../services/privateDealContactRoles';
import { RecordCard } from './RecordPageLayout';

/** Never infer roles from a company match. Server RLS independently enforces
 * ownership of an exact Deal+contact Quote before reading or writing labels. */
export function PrivateDealContactRoles({
  dealId, contacts, quotes,
}: { dealId: string; contacts: readonly Contact[]; quotes: readonly Quote[] }) {
  const mode = useAuthStore(s => s.mode);
  const organizationId = useAuthStore(s => s.organizationId);
  const userId = useAuthStore(s => s.user?.id);
  const [roles, setRoles] = useState<Record<string,PrivateDealContactRole>>({});
  const [availability, setAvailability] = useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
  const [pendingContact, setPendingContact] = useState<string|null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const currentKeyRef = useRef('');
  const [error, setError] = useState('');
  const eligibleIds = useMemo(
    () => ownedQuoteContactIds(dealId,userId,quotes),[dealId,userId,quotes],
  );
  const eligibleKey = eligibleIds.join('|');
  const eligiblePeople = useMemo(() => contacts.filter(person => eligibleIds.includes(person.id))
    .slice().sort((a,b) => a.name.localeCompare(b.name)),[contacts,eligibleKey]);
  const scope = mode === 'cloud' && organizationId && userId
    ? {organizationId,dealId,ownerId:userId} : null;
  const scopeKey = scope ? [scope.organizationId,scope.ownerId,scope.dealId,eligibleKey].join('|') : '';
  currentKeyRef.current = scopeKey;
  const roleEditingReady = availability === 'ready' && loadedKey === scopeKey;

  useEffect(() => {
    let cancelled = false;
    setRoles({});setError('');setLoadedKey('');setPendingContact(null);
    if (!scope || !eligibleKey) { setAvailability('idle'); return; }
    setAvailability('loading');
    void loadPrivateDealRoles(scope).then(rows => {
      if(cancelled || currentKeyRef.current !== scopeKey)return;
      const eligible = new Set(eligibleKey.split('|'));
      setRoles(Object.fromEntries(rows.filter(row => eligible.has(row.contactId))
        .map(row => [row.contactId,row.role])));
      setLoadedKey(scopeKey);
      setAvailability('ready');
    }).catch(() => {
      if(cancelled || currentKeyRef.current !== scopeKey)return;
      setAvailability('unavailable');
    });
    return () => {cancelled = true;};
  },[scope?.organizationId,scope?.dealId,scope?.ownerId,eligibleKey]);

  const changeRole = async (contactId:string,value:string) => {
    if(!scope || !roleEditingReady || pendingContact || !eligibleIds.includes(contactId))return;
    if(value && !isPrivateDealRole(value))return;
    const next=value ? value as PrivateDealContactRole : null;
    setPendingContact(contactId);setError('');
    try{
      await writePrivateDealRole(scope,contactId,next);
      if(currentKeyRef.current !== scopeKey)return;
      setRoles(previous => {
        const update={...previous};
        if(next)update[contactId]=next;
        else delete update[contactId];
        return update;
      });
    }catch{
      if(currentKeyRef.current === scopeKey)
        setError('Could not save this private contact label. No changes were made.');
    }finally{
      if(currentKeyRef.current === scopeKey)setPendingContact(null);
    }
  };
  return <RecordCard title="My Deal contact roles">
    <p className="connections-record-helper">
      Private labels for contacts explicitly selected on your own quotes.
      They do not grant access or assign company-wide responsibilities.
    </p>
    {!scope && <p className="connections-record-empty">
      Personal role editing requires a signed-in company account and verified server permissions.
    </p>}
    {scope && eligiblePeople.length === 0 && <p className="connections-record-empty">
      Add a contact to one of your own quotes linked to this Deal to label their role.
    </p>}
    {scope && eligiblePeople.length > 0 && availability === 'loading' && loadedKey !== scopeKey &&
      <p className="connections-record-helper" role="status">Checking private role permissions…</p>}
    {scope && eligiblePeople.length > 0 && availability === 'unavailable' && loadedKey !== scopeKey &&
      <p className="connections-record-empty" role="status">
        Role editing is unavailable until the private permissions migration is verified and enabled.
        Existing quote-contact links remain unchanged.
      </p>}
    {scope && roleEditingReady && <div className="connections-private-role-list">
      {eligiblePeople.map(person => <label key={person.id} className="connections-private-role-row">
        <span><strong>{person.name || person.email || 'Unnamed contact'}</strong>
          <small>Linked from your quote · private to you</small></span>
        <select aria-label={'My role for '+(person.name || person.email || person.id)}
          value={roles[person.id] ?? ''} disabled={Boolean(pendingContact)}
          onChange={event => void changeRole(person.id,event.target.value)}>
          <option value="">No private label</option>
          {PRIVATE_DEAL_CONTACT_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
        </select>
      </label>)}
    </div>}
    {pendingContact && <p role="status" className="connections-record-helper">Saving private role…</p>}
    {error && <p role="alert" className="connections-record-error">{error}</p>}
  </RecordCard>;
}
