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
import { reviewItemsBlockingDirectShare } from '../services/quoteShareReadiness';
import {shareMatchesQuoteRevision} from '../services/quoteDeliveryApproval';
import {useCrmStore} from '../store/crmStore';
import {confirmedQuoteDeliveries} from '../services/quoteDeliveryLifecycle';
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
    setOpen(false);
    setShare(null);
    setError('');
  }, [activeQuoteId]);

  useEffect(() => {
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
    setWorking(true);
    setError('');
    setCopied(false);
    try {
      const next = await createQuoteShare(quote.id, regenerate);
      setShare(next);
    } catch (reason) {
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
      setShare({ ...share, status: 'revoked' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not revoke customer link.');
    } finally {
      setWorking(false);
    }
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(quoteShareUrl(share));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copy failed. Select the link and copy it manually.');
    }
  };

  const nativeShare = async () => {
    if (!share) return;
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
  const url = share ? quoteShareUrl(share) : '';
  const correctRevision=Boolean(share&&shareMatchesQuoteRevision(quote,share));
  const active = correctRevision&&(share?.status === 'active' || share?.status === 'signed');
  const deliveries=confirmedQuoteDeliveries(quote,activities);
  const reviewedItemsNeedingIssue=reviewItemsBlockingDirectShare(quote);
  const creationReady=allowCreation&&reviewedItemsNeedingIssue===0;

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

          {!cloudReady ? (
            <p className="quote-share-message">Customer links are available when SalesShop is connected to your Cloud workspace.</p>
          ) : loading ? (
            <p className="quote-share-message">Checking this quote…</p>
          ) : (
            <>
              {!share && (
                <div className="quote-share-empty">
                  <strong>No customer link yet</strong>
                  <p>{quote.status === 'Draft' || quote.status === 'Ready'
                    ? !allowCreation
                      ? 'Approve and issue the customer revision from Review before creating a link.'
                      : reviewedItemsNeedingIssue>0
                      ? 'Issue the draft from Review to freeze this exact revision before sharing it.'
                      : 'Creating the link will issue and freeze this exact revision before it becomes customer-accessible.'
                    : 'Create a secure link to this frozen quote revision.'}</p>
                  {reviewedItemsNeedingIssue>0
                    ?<p className="quote-share-review-needed">This quote has {reviewedItemsNeedingIssue} review {reviewedItemsNeedingIssue===1?'item':'items'} to acknowledge. Issue it from Review first; then create the customer link here.</p>
                    :!allowCreation&&<p className="quote-share-review-needed">Recheck and complete Review before creating a new customer link.</p>}
                  <button type="button" onClick={() => void makeLink(false)} disabled={working || !creationReady || quote.status === 'Declined' || quote.status === 'Expired'}>
                    {working ? 'Creating…' : 'Create customer link'}
                  </button>
                </div>
              )}

              {share && (
                <div className="quote-share-active">
                  <div className="quote-share-revision" aria-label="Customer link revision">
                    <strong>{correctRevision?'Link for current revision':'Link for a different revision'}</strong>
                    <span>Revision {share.revision} · {share.status==='revoked'?'Revoked':'Customer-visible content is frozen at issue'}</span>
                  </div>
                  {!correctRevision&&<p className="quote-share-review-needed" role="status">
                    This link is for revision {share.revision}, not revision {quote.revision}. It cannot be shared as the current quote. Create a link for this revision instead.
                  </p>}
                  <div className="quote-share-status-row">
                    <span className={`quote-share-status status-${share.status}`}>{share.status === 'signed' ? 'Signed' : share.status === 'revoked' ? 'Revoked' : share.viewCount > 0 ? 'Viewed' : 'Ready'}</span>
                    {share.viewCount > 0 && <span>{share.viewCount} view{share.viewCount === 1 ? '' : 's'}</span>}
                    {share.expiresAt && share.status === 'active' && <span>Expires {dateLabel(share.expiresAt)}</span>}
                  </div>

                  {active && (
                    <>
                      <label className="quote-share-url">
                        <span>Secure customer URL</span>
                        <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
                      </label>
                      <div className="quote-share-primary-actions">
                        <button type="button" className="primary" onClick={() => void nativeShare()}>Share…</button>
                        <button type="button" onClick={() => void copy()}>{copied ? 'Copied ✓' : 'Copy link'}</button>
                      </div>
                    </>
                  )}

                  <small>{deliveries.length
                    ? 'Delivery confirmed by salesperson · '+new Date(deliveries[0].occurredAt).toLocaleString()
                    :share.firstViewedAt?'Customer opened this link. Delivery was not manually confirmed.'
                    :'Link created. No customer delivery has been confirmed.'}</small>
                  {share.firstViewedAt && <small>First opened {new Date(share.firstViewedAt).toLocaleString()}</small>}
                  {share.signedAt && <small>Accepted {new Date(share.signedAt).toLocaleString()}</small>}

                  <div className="quote-share-secondary-actions">
                    {share.status !== 'revoked' && <button type="button" onClick={() => void revoke()} disabled={working}>Revoke</button>}
                    <button type="button" onClick={() => void makeLink(true)} disabled={working || !creationReady || quote.status === 'Declined' || quote.status === 'Expired'}>
                      {working ? 'Working…' : share.status === 'revoked' ? 'Create new link' : 'Regenerate link'}
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
