import {useEffect,useMemo,useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {loadSignedShopOutcomes} from '../services/shopOutcomesService';
import type {SignedShopOutcome} from '../services/shopOutcomeProjection';
import './shop-outcomes.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const readableDate=(value:string)=>{
  const date=new Date(value);
  return Number.isFinite(date.getTime())
    ?date.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric'})
    :'Date unavailable';
};

/**
 * Not a quote library. This screen never receives a quote store, full
 * accepted snapshot, CRM record, internal cost, customer identity, or
 * employee activity. Only the server-approved signed outcome fields.
 */
export function ShopOutcomesWorkspace({onShowMine}:{onShowMine:()=>void}){
  const orgId=useAuthStore(s=>s.organizationId);
  const userId=useAuthStore(s=>s.user?.id);
  const role=useAuthStore(s=>s.teamRole);
  const currentScope=`${orgId??''}:${userId??''}:${role??''}`;
  const [loadedScope,setLoadedScope]=useState('');
  const [outcomes,setOutcomes]=useState<SignedShopOutcome[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [query,setQuery]=useState('');

  useEffect(()=>{
    let cancelled=false;
    // Clear previously authorized data immediately on account/org change.
    setOutcomes([]);
    setLoadedScope('');
    setError('');
    if(!orgId||!userId||(role!=='owner'&&role!=='admin')){
      setLoading(false);
      setError('Shop outcomes require an authorized company account.');
      return ()=>{cancelled=true;};
    }
    setLoading(true);
    void loadSignedShopOutcomes().then(result=>{
      if(!cancelled){setOutcomes(result);setLoadedScope(currentScope);setLoading(false);}
    }).catch((cause:unknown)=>{
      if(!cancelled){
        setOutcomes([]);
        setLoadedScope('');
        setError(cause instanceof Error?cause.message:'Shop outcomes could not be loaded.');
        setLoading(false);
      }
    });
    return ()=>{cancelled=true;};
  },[orgId,userId,role,currentScope,refresh]);

  // A role/account switch must never show stale previous-user data, even for
  // the single render that occurs before a React effect clears state.
  const visibleOutcomes=loadedScope===currentScope&&(role==='owner'||role==='admin')?outcomes:[];
  const matches=useMemo(()=>{
    const search=query.trim().toLocaleLowerCase();
    return visibleOutcomes.filter(outcome=>!search
      ||[outcome.title,outcome.quoteNumber,outcome.companyName]
        .some(value=>value?.toLocaleLowerCase().includes(search)))
      .slice().sort((a,b)=>b.acceptedAt.localeCompare(a.acceptedAt));
  },[visibleOutcomes,query]);
  const total=matches.reduce((sum,outcome)=>sum+outcome.acceptedTotal,0);

  return <main className="shop-outcomes" aria-label="Signed Shop Outcomes">
    <header className="shop-outcomes-head">
      <div><span className="shop-outcomes-eyebrow">SIGNED CUSTOMER COMMITMENTS</span>
        <h1>Shop Outcomes</h1>
        <p>Accepted customer work only. Draft quotes, seller activity, costs, margins, contact details, and signatures are not included.</p></div>
      <div className="shop-outcomes-head-actions">
        <button type="button" onClick={onShowMine}>← My Quotes</button>
        <button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={loading}>
          {loading?'Loading…':'Refresh'}
        </button>
      </div>
    </header>
    {error&&<p className="shop-outcomes-error" role="alert">{error}</p>}
    {loading?<p role="status">Loading signed outcomes…</p>:!error&&<>
      <section className="shop-outcomes-summary" aria-label="Visible accepted commitments">
        <div><span>Signed commitments</span><strong>{matches.length}</strong></div>
        <div><span>Accepted value in results</span><strong>{money.format(total)}</strong></div>
      </section>
      <label className="shop-outcomes-search">
        <span>Find a signed commitment</span>
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
          placeholder="Document number, project or company" />
      </label>
      <div className="shop-outcomes-list">
        {matches.map(item=><article key={item.signatureId} className="shop-outcomes-item">
          <div>
            <small>{item.quoteNumber} · Revision {item.revision} · {readableDate(item.acceptedAt)}</small>
            <h2>{item.title||'Signed customer commitment'}</h2>
            {item.companyName&&<p>{item.companyName}</p>}
          </div>
          <strong>{money.format(item.acceptedTotal)}</strong>
        </article>)}
        {!matches.length&&<p className="shop-outcomes-empty">
          {query.trim()?'No signed commitments match this search.':'No signed customer commitments are available.'}
        </p>}
      </div>
      <small className="shop-outcomes-footnote">Showing up to the most recent 100 signed records; this is not a full financial ledger.</small>
    </>}
  </main>;
}
