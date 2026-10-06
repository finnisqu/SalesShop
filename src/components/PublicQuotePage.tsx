import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  signPublicQuote,
  viewPublicQuote,
  type PublicQuoteLine,
  type PublicQuoteResponse,
} from '../services/publicQuoteShareService';
import { commercialDocumentLabel } from '../types/quote';
import type { SignatureMethod, SignatureStroke } from '../types/signature';
import { DocumentBrand } from './CustomerDocumentBrand';
import { PricingScheduleCustomerTable } from './PricingScheduleCustomerTable';
import '../quotes.css';
import '../signature.css';
import '../public-quote.css';
import '../pricing-schedule.css';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function displayLineAmount(line: PublicQuoteLine) {
  if (line.pricingMode === 'none') return null;
  const raw = line.pricingMode === 'quantity-rate'
    ? Number(line.quantity ?? 0) * Number(line.rate ?? 0)
    : Number(line.amount ?? 0);
  return line.kind === 'discount' ? -Math.abs(raw) : raw;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function StandardQuoteBody({ data }: { data: PublicQuoteResponse }) {
  const { quote } = data;
  const sections = quote.sections;
  const lines = quote.lines;
  const loose = lines.filter((line) => !line.sectionId || !sections.some((section) => section.id === line.sectionId));
  const renderLines = (items: PublicQuoteLine[]) => items.map((line) => {
    const amount = displayLineAmount(line);
    return (
      <div key={line.id} className={`customer-quote-row kind-${line.kind}`}>
        <div className="customer-line-description">{line.description || '—'}</div>
        {quote.customerColumns.quantity && <div>{line.pricingMode === 'quantity-rate' ? line.quantity ?? '' : ''}</div>}
        {quote.customerColumns.rate && <div>{line.pricingMode === 'quantity-rate' && line.rate !== undefined ? money.format(line.rate) : ''}</div>}
        {quote.customerColumns.lineAmount && <div className="customer-line-amount">{amount === null ? '' : money.format(amount)}</div>}
      </div>
    );
  });

  return (
    <>
      <div className={`customer-quote-table columns-q${Number(quote.customerColumns.quantity)}-r${Number(quote.customerColumns.rate)}-a${Number(quote.customerColumns.lineAmount)}`}>
        <div className="customer-quote-row customer-quote-table-head">
          <div>Description</div>
          {quote.customerColumns.quantity && <div>Qty</div>}
          {quote.customerColumns.rate && <div>Rate</div>}
          {quote.customerColumns.lineAmount && <div>Amount</div>}
        </div>
        {renderLines(loose)}
        {sections.map((section) => {
          const sectionLines = lines.filter((line) => line.sectionId === section.id);
          if (!sectionLines.length) return null;
          return <div className="customer-quote-section" key={section.id}><h3>{section.title}</h3>{renderLines(sectionLines)}</div>;
        })}
      </div>
      <div className="customer-quote-total"><span>Total</span><strong>{money.format(quote.acceptedTotal)}</strong></div>
    </>
  );
}

function QuoteDocument({ data }: { data: PublicQuoteResponse }) {
  const { quote } = data;
  const documentLabel = commercialDocumentLabel(quote);
  const pricingSchedule = quote.documentType === 'pricing-schedule';
  const scheduleItems = quote.pricingSchedule?.customerItems ?? [];
  const rateSheet = scheduleItems.some((item) => item.displayType === 'rate-level' || item.displayType === 'rate-add-on');
  const brand = data.organization ?? { name: data.organizationName };

  return (
    <article className="customer-quote-paper public-customer-paper">
      <header className="customer-quote-letterhead">
        <div><DocumentBrand brand={brand} /><strong>{documentLabel.toUpperCase()}</strong></div>
        <dl><div><dt>Document</dt><dd>{quote.quoteNumber}</dd></div><div><dt>Date</dt><dd>{formatDate(quote.quoteDate)}</dd></div></dl>
      </header>

      <section className="customer-quote-recipient">
        <div>
          <span>Prepared for</span>
          <strong>{quote.companyName || quote.contactName || 'Customer'}</strong>
          {quote.contactName && quote.companyName && <p>{quote.contactName}</p>}
          {quote.address && <p>{quote.address}</p>}
        </div>
        <div><span>{rateSheet ? 'Account / pricing agreement' : 'Project'}</span><strong>{quote.title}</strong>{quote.revisionLabel && <p>{quote.revisionLabel}</p>}</div>
      </section>

      {pricingSchedule ? (
        <>
          <div className="pricing-schedule-contract-intro">
            <strong>{rateSheet ? 'Builder rate sheet' : 'Contract pricing schedule'}</strong>
            <p>{rateSheet
              ? 'Pricing below establishes the material levels, approved selections, sinks, and recurring add-on rates for this account.'
              : 'Pricing below applies to the listed plans, options, and configurations.'}</p>
          </div>
          <PricingScheduleCustomerTable items={scheduleItems} />
        </>
      ) : <StandardQuoteBody data={data} />}

      {quote.customerNotes && <div className="customer-quote-notes"><strong>Notes</strong><p>{quote.customerNotes}</p></div>}
      <footer>{data.signature ? 'Accepted electronically with SalesShop.' : `Secure ${documentLabel.toLowerCase()} prepared with SalesShop.`}</footer>
    </article>
  );
}

function SignatureReceipt({ data }: { data: PublicQuoteResponse }) {
  const signature = data.signature;
  if (!signature) return null;
  const pricingSchedule = data.quote.documentType === 'pricing-schedule';
  return (
    <section className="public-acceptance-card">
      <div className="signature-success-mark">✓</div>
      <div className="public-acceptance-heading">
        <span>Accepted</span>
        <h2>Thank you, {signature.signerName}.</h2>
        <p>{new Date(signature.acceptedAt).toLocaleString()}{signature.signerEmail ? ` · ${signature.signerEmail}` : ''}</p>
      </div>
      <dl>
        <div><dt>Document</dt><dd>{data.quote.quoteNumber}</dd></div>
        {pricingSchedule ? <div><dt>Pricing rows</dt><dd>{data.quote.pricingSchedule?.customerItems.length ?? 0}</dd></div> : <div><dt>Accepted total</dt><dd>{money.format(data.quote.acceptedTotal)}</dd></div>}
        <div><dt>Revision</dt><dd>{data.quote.revisionLabel || (data.quote.revision ? `R${data.quote.revision}` : 'Original')}</dd></div>
      </dl>
      <div className="public-receipt-signature">
        {signature.method === 'typed' ? <span className="typed-signature">{signature.signatureText || signature.signerName}</span> : (
          <svg viewBox="0 0 600 180" aria-label={`Signature of ${signature.signerName}`}>
            {signature.strokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} />)}
          </svg>
        )}
      </div>
      <small>{signature.consentText}</small>
      <p className="public-receipt-note">This page is your electronic acceptance receipt. You can return to this secure link to view it again.</p>
    </section>
  );
}

function AcceptanceForm({ token, data, onSigned }: { token: string; data: PublicQuoteResponse; onSigned: (next: PublicQuoteResponse) => void }) {
  const [method, setMethod] = useState<SignatureMethod>('drawn');
  const [signerName, setSignerName] = useState(data.quote.contactName ?? '');
  const [signerEmail, setSignerEmail] = useState(data.quote.contactEmail ?? '');
  const [consented, setConsented] = useState(false);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [activeStrokeId, setActiveStrokeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const padRef = useRef<SVGSVGElement | null>(null);
  const documentLabel = commercialDocumentLabel(data.quote);
  const pricingSchedule = data.quote.documentType === 'pricing-schedule';

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(600, ((event.clientX - rect.left) / rect.width) * 600)),
      y: Math.max(0, Math.min(180, ((event.clientY - rect.top) / rect.height) * 180)),
    };
  };

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (method !== 'drawn') return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const id = `stroke_${crypto.randomUUID()}`;
    setActiveStrokeId(id);
    setStrokes((current) => [...current, { id, points: [point] }]);
  };

  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeStrokeId || method !== 'drawn' || !(event.buttons & 1 || event.pointerType === 'touch' || event.pointerType === 'pen')) return;
    const point = pointFromEvent(event);
    if (!point) return;
    setStrokes((current) => current.map((stroke) => stroke.id === activeStrokeId ? { ...stroke, points: [...stroke.points, point] } : stroke));
  };

  const complete = async () => {
    setError('');
    const cleanName = signerName.trim();
    if (!cleanName) { setError('Enter your full name.'); return; }
    if (!consented) { setError('Confirm acceptance before signing.'); return; }
    if (method === 'drawn' && !strokes.some((stroke) => stroke.points.length > 1)) { setError('Add your signature above, or choose Type name.'); return; }
    setBusy(true);
    try {
      const next = await signPublicQuote(token, {
        signerName: cleanName,
        signerEmail: signerEmail.trim() || undefined,
        method,
        signatureText: method === 'typed' ? cleanName : undefined,
        strokes,
        consented: true,
      });
      onSigned(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your signature could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="public-sign-card">
      <header>
        <span>Electronic acceptance</span>
        <h2>Accept this {documentLabel.toLowerCase()}</h2>
        <p>{pricingSchedule ? `Sign below to accept pricing schedule ${data.quote.quoteNumber}.` : `Sign below to approve ${data.quote.quoteNumber} for ${money.format(data.quote.acceptedTotal)}.`}</p>
      </header>
      <div className="signature-identity-grid">
        <label><span>Full name</span><input value={signerName} onChange={(event) => setSignerName(event.target.value)} autoComplete="name" /></label>
        <label><span>Email</span><input type="email" value={signerEmail} onChange={(event) => setSignerEmail(event.target.value)} autoComplete="email" /></label>
      </div>
      <div className="signature-method-switch">
        <button type="button" className={method === 'drawn' ? 'active' : ''} onClick={() => setMethod('drawn')}>Draw signature</button>
        <button type="button" className={method === 'typed' ? 'active' : ''} onClick={() => setMethod('typed')}>Type name</button>
      </div>
      {method === 'drawn' ? (
        <div className="signature-pad-wrap">
          <svg ref={padRef} className="signature-pad" viewBox="0 0 600 180" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => setActiveStrokeId(null)} onPointerCancel={() => setActiveStrokeId(null)} onPointerLeave={() => setActiveStrokeId(null)}>
            <line x1="24" y1="148" x2="576" y2="148" className="signature-baseline" />
            {strokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} />)}
          </svg>
          <div className="signature-pad-footer"><span>Sign above</span><button type="button" onClick={() => setStrokes([])}>Clear</button></div>
        </div>
      ) : <div className="typed-signature-preview">{signerName || 'Your Name'}</div>}
      <label className="signature-consent"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span>{data.consentText}</span></label>
      {error && <div className="signature-error" role="alert">{error}</div>}
      <button type="button" className="public-accept-button" disabled={busy} onClick={() => void complete()}>
        {busy ? 'Recording acceptance…' : pricingSchedule ? 'Accept & Sign Pricing Schedule' : `Accept & Sign · ${money.format(data.quote.acceptedTotal)}`}
      </button>
      <small className="public-security-note">Your signature is attached to this exact numbered document and revision and recorded with the acceptance time.</small>
    </section>
  );
}

export function PublicQuotePage() {
  const token = useMemo(() => {
    const raw = window.location.pathname.startsWith('/q/') ? window.location.pathname.slice(3) : '';
    try { return decodeURIComponent(raw); } catch { return raw; }
  }, []);
  const [data, setData] = useState<PublicQuoteResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError('This document link is not valid.'); setLoading(false); return; }
    let cancelled = false;
    void viewPublicQuote(token)
      .then((value) => { if (!cancelled) setData(value); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'This document could not be opened.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <main className="public-quote-shell"><div className="public-quote-state"><span className="public-brand-mark">S</span><strong>Opening secure document…</strong></div></main>;
  if (error || !data) return <main className="public-quote-shell"><div className="public-quote-state error"><span className="public-brand-mark">S</span><h1>Document unavailable</h1><p>{error || 'This document link is not available.'}</p></div></main>;

  return (
    <main className="public-quote-shell">
      <header className="public-quote-header">
        <div className="public-brand"><span className="public-brand-mark">S</span><div><strong>{data.organizationName}</strong><small>Secure {commercialDocumentLabel(data.quote).toLowerCase()}</small></div></div>
        <div className={`public-share-state ${data.signature ? 'signed' : ''}`}>{data.signature ? '✓ Accepted' : 'Secure customer copy'}</div>
      </header>
      <div className="public-quote-content">
        <QuoteDocument data={data} />
        {data.signature ? <SignatureReceipt data={data} /> : <AcceptanceForm token={token} data={data} onSigned={setData} />}
      </div>
      <footer className="public-page-footer">Protected customer document · SalesShop</footer>
    </main>
  );
}
