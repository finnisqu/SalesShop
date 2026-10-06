import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import '../signature.css';
import { completeQuoteSignature } from '../services/signatureService';
import { useSignatureStore } from '../store/signatureStore';
import { commercialDocumentLabel, displayQuoteNumber, quoteTotal, type Quote } from '../types/quote';
import type { SignatureMethod, SignatureStroke } from '../types/signature';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const CONSENT_TEXT = 'I agree to the commercial document shown and intend this electronic signature to confirm acceptance of this document and revision.';

function formatAcceptedAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function QuoteSignatureDialog({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const hydrate = useSignatureStore((state) => state.hydrate);
  const signatures = useSignatureStore((state) => state.signatures);
  const [method, setMethod] = useState<SignatureMethod>('drawn');
  const [signerName, setSignerName] = useState(quote.contactName ?? '');
  const [signerEmail, setSignerEmail] = useState(quote.contactEmail ?? '');
  const [consented, setConsented] = useState(false);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [activeStrokeId, setActiveStrokeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const padRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  const signature = useMemo(
    () => signatures.find((record) => record.quoteId === quote.id && record.revision === quote.revision) ?? null,
    [signatures, quote.id, quote.revision],
  );

  const pointFromEvent = (event: PointerEvent<SVGSVGElement>) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(600, ((event.clientX - rect.left) / rect.width) * 600)),
      y: Math.max(0, Math.min(180, ((event.clientY - rect.top) / rect.height) * 180)),
    };
  };

  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (method !== 'drawn') return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const id = `stroke_${crypto.randomUUID()}`;
    setActiveStrokeId(id);
    setStrokes((current) => [...current, { id, points: [point] }]);
  };

  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!activeStrokeId || method !== 'drawn' || !(event.buttons & 1 || event.pointerType === 'touch' || event.pointerType === 'pen')) return;
    const point = pointFromEvent(event);
    if (!point) return;
    setStrokes((current) => current.map((stroke) => stroke.id === activeStrokeId
      ? { ...stroke, points: [...stroke.points, point] }
      : stroke));
  };

  const finishStroke = () => setActiveStrokeId(null);

  const complete = async () => {
    setError('');
    const cleanName = signerName.trim();
    if (!cleanName) { setError('Enter the signer name.'); return; }
    if (!consented) { setError('Confirm acceptance before signing.'); return; }
    if (method === 'drawn' && !strokes.some((stroke) => stroke.points.length > 1)) {
      setError('Add a signature in the signature box, or choose Type name.');
      return;
    }

    setBusy(true);
    try {
      const record = await completeQuoteSignature(quote.id, {
        signerName: cleanName,
        signerEmail: signerEmail.trim() || undefined,
        method,
        signatureText: method === 'typed' ? cleanName : undefined,
        strokes,
        consentText: CONSENT_TEXT,
      });
      if (!record) setError('The signature could not be recorded.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The signature could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signature-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="signature-dialog" role="dialog" aria-modal="true" aria-label={`${commercialDocumentLabel(quote)} signature`}>
        <header className="signature-dialog-header">
          <div>
            <span className="signature-eyebrow">Electronic acceptance</span>
            <h2>{displayQuoteNumber(quote)}</h2>
            <p>{quote.title} · {money.format(quoteTotal(quote))}</p>
          </div>
          <button type="button" className="signature-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {signature ? (
          <div className="signature-receipt">
            <div className="signature-success-mark">✓</div>
            <div>
              <span className="signature-eyebrow">Accepted</span>
              <h3>Signed by {signature.signerName}</h3>
              <p>{formatAcceptedAt(signature.acceptedAt)}{signature.signerEmail ? ` · ${signature.signerEmail}` : ''}</p>
            </div>
            <div className="signature-receipt-card">
              <dl>
                <div><dt>Document</dt><dd>{signature.acceptedSnapshot.quoteNumber}</dd></div>
                <div><dt>Accepted total</dt><dd>{money.format(signature.acceptedSnapshot.acceptedTotal)}</dd></div>
                <div><dt>Revision</dt><dd>{signature.acceptedSnapshot.revisionLabel || (signature.acceptedSnapshot.revision ? `R${signature.acceptedSnapshot.revision}` : 'Original')}</dd></div>
              </dl>
              <div className="signature-receipt-signature">
                {signature.method === 'typed' ? (
                  <span className="typed-signature">{signature.signatureText || signature.signerName}</span>
                ) : (
                  <svg viewBox="0 0 600 180" aria-label={`Signature of ${signature.signerName}`}>
                    {signature.strokes.map((stroke) => (
                      <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} />
                    ))}
                  </svg>
                )}
              </div>
              <small>{signature.consentText}</small>
            </div>
            <button type="button" className="signature-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div className="signature-form">
            {(quote.status === 'Draft' || quote.status === 'Ready') && (
              <div className="signature-info">Signing in person will assign the official number, send, and accept this {commercialDocumentLabel(quote).toLowerCase()} in one step.</div>
            )}

            <div className="signature-identity-grid">
              <label><span>Full name</span><input value={signerName} onChange={(event) => setSignerName(event.target.value)} autoFocus /></label>
              <label><span>Email</span><input type="email" value={signerEmail} onChange={(event) => setSignerEmail(event.target.value)} placeholder="Optional" /></label>
            </div>

            <div className="signature-method-switch" aria-label="Signature method">
              <button type="button" className={method === 'drawn' ? 'active' : ''} onClick={() => setMethod('drawn')}>Draw signature</button>
              <button type="button" className={method === 'typed' ? 'active' : ''} onClick={() => setMethod('typed')}>Type name</button>
            </div>

            {method === 'drawn' ? (
              <div className="signature-pad-wrap">
                <svg
                  ref={padRef}
                  className="signature-pad"
                  viewBox="0 0 600 180"
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={finishStroke}
                  onPointerCancel={finishStroke}
                  onPointerLeave={finishStroke}
                >
                  <line x1="24" y1="148" x2="576" y2="148" className="signature-baseline" />
                  {strokes.map((stroke) => (
                    <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} />
                  ))}
                </svg>
                <div className="signature-pad-footer"><span>Sign above</span><button type="button" onClick={() => setStrokes([])}>Clear</button></div>
              </div>
            ) : (
              <div className="typed-signature-preview">{signerName || 'Your Name'}</div>
            )}

            <label className="signature-consent">
              <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
              <span>{CONSENT_TEXT}</span>
            </label>

            {error && <div className="signature-error" role="alert">{error}</div>}

            <div className="signature-actions">
              <button type="button" className="signature-secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="signature-primary" onClick={() => void complete()} disabled={busy}>
                {busy ? 'Recording acceptance…' : `Accept & Sign · ${money.format(quoteTotal(quote))}`}
              </button>
            </div>
            <small className="signature-prototype-note">Acceptance is tied to this exact numbered document and revision.</small>
          </div>
        )}
      </section>
    </div>
  );
}
