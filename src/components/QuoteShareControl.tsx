import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useQuoteStore } from '../store/quoteStore';
import {
  createQuoteShare,
  getQuoteShare,
  quoteShareUrl,
  revokeQuoteShare,
  type QuoteShare,
} from '../services/quoteShareService';
import { displayQuoteNumber } from '../types/quote';
import { customerShareCreationBlocker } from '../services/quoteShareReadiness';
import {shareMatchesQuoteRevision} from '../services/quoteDeliveryApproval';
import {useCrmStore} from '../store/crmStore';
import {confirmedQuoteDeliveries} from '../services/quoteDeliveryLifecycle';
import {quoteHandoffStatus} from '../services/quoteHandoffStatus';
import '../quote-share.css';

function dateLabel(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function QuoteShareControl({inline=false,allowCreation=true,autoOpenOnIssue=false}:{inline?:boolean;allowCreation?:boolean;autoOpenOnIssue?:boolean}={}) {
  const mode = useAuthStore((state) => state.mode);
  const activities=useCrmStore(state=>state.activities);
  const organizationId = useAuthStore((state) => state.organizationId);
  const quotes = useQuoteStore((state) => state.quotes);
  const activeQuoteId = useQuoteStore((state) => state.activeQuoteId);
  const quote = useMemo(
    () => quotes.find((candidate) => candidate.id === activeQuoteId) ?? null,
    [quotes, activeQuoteId],
  );
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<QuoteShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const previousStatus=useRef<{id:string;status:string}|null>(null);
  useEffect(()=>{
    const previous=previousStatus.current;
    if(inline&&autoOpenOnIssue&&quote&&previous?.id===quote.id&&
      (previous.status==='Draft'||previous.status==='Ready')&&
      (quote.status==='Sent'||quote.status==='Viewed'||quote.status==='Signed')){
      setOpen(true);
    }
    previousStatus.current=quote?{id:quote.id,status:quote.status}:null;
  },[quote?.id,quote?.status,inline,autoOpenOnIssue]);

  useEffect(() => {
    // Issued quotes reopen at their next *explicit* action, creating/sharing a
    // secure link, even when Review is opened after a page refresh.
    setOpen(Boolean(inline&&autoOpenOnIssue&&quote&&
      ['Sent','Viewed','Signed'].includes(quote.status)));
    setShare(null);
    setError('');
    setCopied(false);
  }, [activeQuoteId,inline,autoOpenOnIssue]);

  useEffect(() => {
    // Never show a link fetched for the old revision while checking the new one.
    setShare(null);
    if (!open || !quote || mode !== 'cloud' || !organizationId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void getQuoteShare(quote.id)
      .then((value) => { if (!cancelled) setShare(value); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load customer link.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, quote?.id, quote?.revision, mode, organizationId]);

  if (!quote) return null;

  const makeLink = async (regenerate = false) => {
    const requestedQuoteId=quote.id;
    setWorking(true);
    setError('');
    setCopied(false);
    try {
      const next = await createQuoteShare(requestedQuoteId, regenerate);
      // Navigating to another quote while the network request is pending must
      // never show the previous customer's bearer link in the new panel.
      if(useQuoteStore.getState().activeQuoteId===requestedQuoteId)setShare(next);
    } catch (reason) {
      if(useQuoteStore.getState().activeQuoteId===requestedQuoteId)
        setError(reason instanceof Error ? reason.message : 'Could not create customer link.');
    } finally {
      setWorking(false);
    }
  };

  const revoke = async () => {
    if (!share || !window.confirm('Revoke this customer link? Anyone using it will lose access immediately.')) return;
    setWorking(true);
    setError('');
    try {
      await revokeQuoteShare(quote.id, share.id);
      if(useQuoteStore.getState().activeQuoteId===quote.id)setShare({ ...share, status: 'revoked' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not revoke customer link.');
    } finally {
      setWorking(false);
    }
  };

  const copy = async () => {
    if (!share || share.quoteId!==quote.id || !active) return;
    try {
      await navigator.clipboard.writeText(quoteShareUrl(share));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copy failed. Select the link and copy it manually.');
    }
  };

  const nativeShare = async () => {
    if (!share || share.quoteId!==quote.id || !active) return;
    const url = quoteShareUrl(share);
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: `${displayQuoteNumber(quote)} · ${quote.title}`,
        text: `Review ${displayQuoteNumber(quote)} from SalesShop.`,
        url,
      });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Could not open the share sheet.');
    }
  };

  const cloudReady = mode === 'cloud' && Boolean(organizationId);
  const currentShare=share&&share.quoteId===quote.id&&shareMatchesQuoteRevision(quote,share)
    ?share:null;
  const url = currentShare ? quoteShareUrl(currentShare) : '';
  const deliveries=confirmedQuoteDeliveries(quote,activities);
  const handoff=quoteHandoffStatus(quote,currentShare,deliveries.length>0);
  // A link for a different customer or revision is never displayed or shareable.
  const active=handoff.linkUsable;
  const creationBlocker=customerShareCreationBlocker(quote);
  const creationReady=allowCreation&&!creationBlocker;

  return (
    <div className={'quote-share-control'+(inline?' is-inline':'')}>
      <button
        type="button"
        className="quote-share-launcher"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title={cloudReady ? 'Create or manage the customer quote link' : 'Customer links require Cloud mode'}
      >
        <span>↗</span> {inline?'Customer link & sharing':'Share quote'}
      </button>

      {open && (
        <section className="quote-share-panel" aria-label="Customer quote link">
          <header>
            <div>
              <span>Customer link</span>
              <strong>{displayQuoteNumber(quote)}</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close customer link panel">×</button>
          </header>

          {(!cloudReady||!loading)&&<div className="quote-handoff-status" role="status" aria-label="Quote delivery progress">
                <strong>{handoff.headline}</strong>
                <p>{handoff.detail}</p>
                <div className="quote-handoff-milestones" aria-label="Delivery milestones">
                  {([
                    ['Issued',handoff.issued],
                    ['Link created',handoff.linkCreated],
                    ['Delivery confirmed',handoff.deliveryConfirmed],
                    ['Viewed',handoff.viewed],
                    ['Signed',handoff.signed],
                  ] as const).map(([label,reached])=>
                    <span key={label} className={reached?'is-complete':'is-pending'}
                      aria-label={label+(reached?' completed':' pending')}>
                      <span aria-hidden="true">{reached?'✓':'○'}</span> {label}
                    </span>)}
                </div>
              </div>}
          {!cloudReady ? (
            <p className="quote-share-message">Customer links are available when SalesShop is connected to your Cloud workspace.</p>
          ) : loading ? (
            <p className="quote-share-message">Checking this quote…</p>
          ) : (
            <>
              {!currentShare && (
                <div className="quote-share-empty">
                  <strong>No customer link yet</strong>
                  <p>{!allowCreation
                    ? 'Complete the customer document approval and issue flow in Review before creating a link.'
                    : creationBlocker??'Create a secure link to this issued, frozen customer revision.'}</p>
                  {!allowCreation&&<p className="quote-share-review-needed">
                    No customer document will be issued or sent by opening this panel.
                  </p>}
                  <button type="button" onClick={() => void makeLink(false)} disabled={working || !creationReady}>
                    {working ? 'Creating…' : 'Create secure customer link'}
                  </button>
                </div>
              )}

              {currentShare && (
                <div className="quote-share-active">
                  <div className="quote-share-revision" aria-label="Customer link revision">
                    <strong>Link for current revision</strong>
                    <span>Revision {currentShare.revision} · {currentShare.status==='revoked'?'Revoked':handoff.linkExpired?'Expired · generate a replacement link':'Customer-visible content is frozen at issue'}</span>
                  </div>
                  <div className="quote-share-status-row">
                    <span className={`quote-share-status status-${handoff.linkExpired?'expired':currentShare.status}`}>{currentShare.status === 'signed' ? 'Signed' : currentShare.status === 'revoked' ? 'Revoked' : handoff.linkExpired ? 'Expired' : currentShare.viewCount > 0 ? 'Viewed' : 'Ready'}</span>
                    {currentShare.viewCount > 0 && <span>{currentShare.viewCount} view{currentShare.viewCount === 1 ? '' : 's'}</span>}
                    {currentShare.expiresAt && currentShare.status === 'active' && <span>{handoff.linkExpired?'Expired':'Expires'} {dateLabel(currentShare.expiresAt)}</span>}
                  </div>

                  {active && (
                    <>
                      <label className="quote-share-url">
                        <span>Secure customer URL</span>
                        <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
                      </label>
                      <div className="quote-share-primary-actions" aria-label="Customer link actions">
                        <button type="button" className="primary" onClick={() => void nativeShare()}>Share…</button>
                        <button type="button" onClick={() => void copy()}>{copied ? 'Copied ✓' : 'Copy link'}</button>
                      </div>
                      <small>Sharing or copying a link is not proof of delivery. Confirm receipt separately below.</small>
                    </>
                  )}

                  {handoff.linkExpired&&<p className="quote-share-review-needed" role="alert">This URL is no longer customer-accessible. Create a new link before sharing; previously confirmed delivery remains in the CRM history.</p>}
                  <small>{deliveries.length
                    ? 'Delivery confirmed by salesperson · '+new Date(deliveries[0].occurredAt).toLocaleString()
                    :currentShare.firstViewedAt?'Customer opened this link. Delivery was not manually confirmed.'
                    :'Link created. No customer delivery has been confirmed.'}</small>
                  {currentShare.firstViewedAt && <small>First opened {new Date(currentShare.firstViewedAt).toLocaleString()}</small>}
                  {currentShare.signedAt && <small>Accepted {new Date(currentShare.signedAt).toLocaleString()}</small>}

                  <div className="quote-share-secondary-actions">
                    {currentShare.status !== 'revoked' && <button type="button" onClick={() => void revoke()} disabled={working}>Revoke</button>}
                    <button type="button" onClick={() => void makeLink(true)} disabled={working || !creationReady}>
                      {working ? 'Working…' : currentShare.status === 'revoked'||handoff.linkExpired ? 'Create new link' : 'Regenerate link'}
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="quote-share-error" role="alert">{error}</div>}
            </>
          )}
        </section>
      )}
    </div>
  );
}
