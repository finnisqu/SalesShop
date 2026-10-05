import { useEffect, useMemo, useState } from 'react';
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
import '../quote-share.css';

function dateLabel(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function QuoteShareControl() {
  const mode = useAuthStore((state) => state.mode);
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
  }, [open, quote, mode, organizationId]);

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

  const cloudReady = mode === 'cloud' && Boolean(organizationId);
  const url = share ? quoteShareUrl(share) : '';
  const active = share?.status === 'active' || share?.status === 'signed';

  return (
    <div className="quote-share-control">
      <button
        type="button"
        className="quote-share-launcher"
        onClick={() => setOpen((value) => !value)}
        title={cloudReady ? 'Create or manage the customer quote link' : 'Customer links require Cloud mode'}
      >
        <span>↗</span> Share quote
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
                    ? 'Creating the link will send and freeze this exact revision before it becomes customer-accessible.'
                    : 'Create a secure link to this frozen quote revision.'}</p>
                  <button type="button" onClick={() => void makeLink(false)} disabled={working || quote.status === 'Declined' || quote.status === 'Expired'}>
                    {working ? 'Creating…' : 'Create customer link'}
                  </button>
                </div>
              )}

              {share && (
                <div className="quote-share-active">
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
                        <button type="button" className="primary" onClick={() => void copy()}>{copied ? 'Copied ✓' : 'Copy link'}</button>
                        <button type="button" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Open</button>
                      </div>
                    </>
                  )}

                  {share.firstViewedAt && <small>First opened {new Date(share.firstViewedAt).toLocaleString()}</small>}
                  {share.signedAt && <small>Accepted {new Date(share.signedAt).toLocaleString()}</small>}

                  <div className="quote-share-secondary-actions">
                    {share.status !== 'revoked' && <button type="button" onClick={() => void revoke()} disabled={working}>Revoke</button>}
                    <button type="button" onClick={() => void makeLink(true)} disabled={working || quote.status === 'Declined' || quote.status === 'Expired'}>
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
