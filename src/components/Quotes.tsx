import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { createPricingScheduleData } from '../services/pricingSchedule';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import {
  commercialDocumentLabel,
  displayQuoteNumber,
  QUOTE_STATUSES,
  quoteLineTotal,
  quoteTotal,
  type CommercialDocumentType,
  type Quote,
  type QuoteLine,
  type QuoteLineKind,
  type QuotePricingMode,
  type QuoteStatus,
} from '../types/quote';
import { CustomerDocumentBrand } from './CustomerDocumentBrand';
import { PricingScheduleCustomerPreview } from './PricingScheduleCustomerPreview';
import { PricingScheduleWorkbook } from './PricingScheduleWorkbook';
import { QuickMaterialQuote } from './QuickMaterialQuote';
import { QuoteCrmFields } from './QuoteCrmFields';
import { QuoteShareControl } from './QuoteShareControl';
import { QuoteSignatureDialog } from './QuoteSignatureDialog';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const lineKinds: Array<[QuoteLineKind, string]> = [
  ['item', 'Line'],
  ['allowance', 'Allowance'],
  ['discount', 'Discount'],
  ['tax', 'Tax'],
  ['scope', 'Scope'],
  ['warranty', 'Warranty'],
  ['note', 'Note'],
];

type QuoteViewMode = 'edit' | 'split' | 'workbook' | 'customer';

function numberValue(value: string) {
  return value.trim() === '' ? undefined : Number(value);
}

function isTextLine(line: QuoteLine) {
  return line.kind === 'note' || line.kind === 'scope' || line.kind === 'warranty';
}

function isPricingSwipeBlocked(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    'input, textarea, select, button, a, [contenteditable="true"], .pricing-schedule-workbook-host, .pricing-schedule-workbook-actions, .pricing-schedule-route-grid, .quote-crm-suggestions',
  ));
}

function LineEditor({ quote, line }: { quote: Quote; line: QuoteLine }) {
  const updateLine = useQuoteStore((state) => state.updateLine);
  const deleteLine = useQuoteStore((state) => state.deleteLine);
  const textLine = isTextLine(line);

  return (
    <div className={`quote-line-editor kind-${line.kind}`}>
      <button type="button" className={`quote-visibility ${line.customerVisible ? 'is-visible' : ''}`} onClick={() => updateLine(quote.id, line.id, { customerVisible: !line.customerVisible })} title={line.customerVisible ? 'Visible to customer' : 'Private / hidden from customer'}>{line.customerVisible ? '●' : '○'}</button>
      <div className="quote-line-main">
        <div className="quote-line-topline">
          <span className="quote-line-kind">{lineKinds.find(([kind]) => kind === line.kind)?.[1]}</span>
          <select value={line.sectionId ?? ''} onChange={(event) => updateLine(quote.id, line.id, { sectionId: event.target.value || undefined })} aria-label="Quote section"><option value="">No section</option>{quote.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select>
        </div>
        <textarea value={line.description} onChange={(event) => updateLine(quote.id, line.id, { description: event.target.value })} rows={textLine ? 2 : 1} aria-label="Line description" />
      </div>
      {!textLine && (
        <div className="quote-line-pricing">
          <select value={line.pricingMode} onChange={(event) => updateLine(quote.id, line.id, { pricingMode: event.target.value as QuotePricingMode })} aria-label="Pricing mode"><option value="direct">Amount</option><option value="quantity-rate">Qty × Rate</option><option value="none">No price</option></select>
          {line.pricingMode === 'direct' && <label className="quote-money-input"><span>$</span><input type="number" step="0.01" value={line.amount ?? ''} onChange={(event) => updateLine(quote.id, line.id, { amount: numberValue(event.target.value) })} aria-label="Line amount" /></label>}
          {line.pricingMode === 'quantity-rate' && <div className="quote-qty-rate"><input type="number" step="0.01" placeholder="Qty" value={line.quantity ?? ''} onChange={(event) => updateLine(quote.id, line.id, { quantity: numberValue(event.target.value) })} aria-label="Quantity" /><span>×</span><input type="number" step="0.01" placeholder="Rate" value={line.rate ?? ''} onChange={(event) => updateLine(quote.id, line.id, { rate: numberValue(event.target.value) })} aria-label="Rate" /></div>}
          {line.pricingMode !== 'none' && <strong>{money.format(quoteLineTotal(line))}</strong>}
          <label className="quote-total-toggle" title="Include this amount in quote total"><input type="checkbox" checked={line.includeInTotal} onChange={(event) => updateLine(quote.id, line.id, { includeInTotal: event.target.checked })} /> Total</label>
        </div>
      )}
      <button type="button" className="quote-line-delete" onClick={() => deleteLine(quote.id, line.id)} title="Delete row">×</button>
    </div>
  );
}

function SectionEditor({ quote, sectionId }: { quote: Quote; sectionId: string }) {
  const section = quote.sections.find((candidate) => candidate.id === sectionId);
  const updateSection = useQuoteStore((state) => state.updateSection);
  const deleteSection = useQuoteStore((state) => state.deleteSection);
  if (!section) return null;
  return <div className="quote-section-editor"><button type="button" className={`quote-visibility ${section.customerVisible ? 'is-visible' : ''}`} onClick={() => updateSection(quote.id, section.id, { customerVisible: !section.customerVisible })} title={section.customerVisible ? 'Section visible to customer' : 'Section hidden from customer'}>{section.customerVisible ? '●' : '○'}</button><input value={section.title} onChange={(event) => updateSection(quote.id, section.id, { title: event.target.value })} /><button type="button" onClick={() => deleteSection(quote.id, section.id)} title="Remove section">×</button></div>;
}

function StandardCustomerPreview({ quote }: { quote: Quote }) {
  const visibleSections = quote.sections.filter((section) => section.customerVisible);
  const visibleLines = quote.lines.filter((line) => line.customerVisible);
  const renderLines = (lines: QuoteLine[]) => lines.map((line) => {
    const priced = line.pricingMode !== 'none';
    return <div key={line.id} className={`customer-quote-row kind-${line.kind}`}><div className="customer-line-description">{line.description || '—'}</div>{quote.customerColumns.quantity && <div>{line.pricingMode === 'quantity-rate' ? line.quantity ?? '' : ''}</div>}{quote.customerColumns.rate && <div>{line.pricingMode === 'quantity-rate' && line.rate !== undefined ? money.format(line.rate) : ''}</div>}{quote.customerColumns.lineAmount && <div className="customer-line-amount">{priced ? money.format(quoteLineTotal(line)) : ''}</div>}</div>;
  });
  const looseLines = visibleLines.filter((line) => !line.sectionId || !visibleSections.some((section) => section.id === line.sectionId));
  const documentLabel = commercialDocumentLabel(quote);
  return (
    <article className="customer-quote-paper">
      <header className="customer-quote-letterhead"><div><CustomerDocumentBrand /><strong>{documentLabel.toUpperCase()}</strong></div><dl><div><dt>Document</dt><dd>{displayQuoteNumber(quote)}</dd></div><div><dt>Date</dt><dd>{quote.quoteDate}</dd></div></dl></header>
      <section className="customer-quote-recipient"><div><span>Prepared for</span><strong>{quote.companyName || quote.contactName || 'Customer'}</strong>{quote.contactName && quote.companyName && <p>{quote.contactName}</p>}{quote.address && <p>{quote.address}</p>}</div><div><span>Project</span><strong>{quote.title}</strong>{quote.revisionLabel && <p>{quote.revisionLabel}</p>}</div></section>
      <div className={`customer-quote-table columns-q${Number(quote.customerColumns.quantity)}-r${Number(quote.customerColumns.rate)}-a${Number(quote.customerColumns.lineAmount)}`}><div className="customer-quote-row customer-quote-table-head"><div>Description</div>{quote.customerColumns.quantity && <div>Qty</div>}{quote.customerColumns.rate && <div>Rate</div>}{quote.customerColumns.lineAmount && <div>Amount</div>}</div>{renderLines(looseLines)}{visibleSections.map((section) => { const sectionLines = visibleLines.filter((line) => line.sectionId === section.id); if (!sectionLines.length) return null; return <div className="customer-quote-section" key={section.id}><h3>{section.title}</h3>{renderLines(sectionLines)}</div>; })}</div>
      <div className="customer-quote-total"><span>Total</span><strong>{money.format(quoteTotal(quote))}</strong></div>
      {quote.customerNotes && <div className="customer-quote-notes"><strong>Notes</strong><p>{quote.customerNotes}</p></div>}
      <footer>{quote.status === 'Signed' ? 'Accepted electronically with SalesShop.' : `Prepared with SalesShop · Electronic acceptance is available for this ${documentLabel.toLowerCase()}.`}</footer>
    </article>
  );
}

function CustomerPreview({ quote }: { quote: Quote }) {
  return quote.documentType === 'pricing-schedule' ? <PricingScheduleCustomerPreview quote={quote} /> : <StandardCustomerPreview quote={quote} />;
}

function QuoteEditor({ quote, mode, onModeChange }: { quote: Quote; mode: QuoteViewMode; onModeChange: (mode: QuoteViewMode) => void }) {
  const quotes = useQuoteStore((state) => state.quotes);
  const updateQuote = useQuoteStore((state) => state.updateQuote);
  const deleteQuote = useQuoteStore((state) => state.deleteQuote);
  const addLine = useQuoteStore((state) => state.addLine);
  const addSection = useQuoteStore((state) => state.addSection);
  const setCustomerColumns = useQuoteStore((state) => state.setCustomerColumns);
  const recordSent = useQuoteStore((state) => state.recordSent);
  const createRevision = useQuoteStore((state) => state.createRevision);
  const createChangeOrder = useQuoteStore((state) => state.createChangeOrder);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const pricingSchedule = quote.documentType === 'pricing-schedule';
  const effectiveMode: QuoteViewMode = pricingSchedule && mode === 'split' ? 'edit' : mode;
  const viewModes: QuoteViewMode[] = pricingSchedule ? ['edit', 'workbook', 'customer'] : ['edit', 'split', 'customer'];

  const setDocumentType = (documentType: CommercialDocumentType) => {
    updateQuote(quote.id, { documentType, ...(documentType === 'pricing-schedule' && !quote.pricingSchedule ? { pricingSchedule: createPricingScheduleData(quote.id) } : {}) });
    onModeChange('edit');
  };

  const beginPricingSwipe = (event: TouchEvent<HTMLDivElement>) => {
    if (!pricingSchedule || event.touches.length !== 1 || isPricingSwipeBlocked(event.target)) {
      swipeStart.current = null;
      return;
    }
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const finishPricingSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!pricingSchedule || !start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const pages: QuoteViewMode[] = ['edit', 'workbook', 'customer'];
    const currentIndex = pages.indexOf(effectiveMode);
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(pages.length - 1, currentIndex + (dx < 0 ? 1 : -1)));
    if (nextIndex !== currentIndex) onModeChange(pages[nextIndex]);
  };

  const send = async () => {
    setSending(true); setSendError('');
    try { await recordSent(quote.id); } catch (reason) { setSendError(reason instanceof Error ? reason.message : 'The document could not be sent.'); } finally { setSending(false); }
  };

  const canRevise = quote.status !== 'Draft' && quote.status !== 'Ready' && quote.status !== 'Signed';
  const canSign = quote.status !== 'Signed' && quote.status !== 'Declined' && quote.status !== 'Expired';
  const parent = quote.parentQuoteId ? quotes.find((candidate) => candidate.id === quote.parentQuoteId) : null;
  const hasChangeOrders = quotes.some((candidate) => candidate.parentQuoteId === quote.id);
  const canCreateChangeOrder = quote.status === 'Signed';
  const documentLabel = commercialDocumentLabel(quote);
  const setupTypeLabel = quote.documentType === 'quote' ? 'Quick Quote' : quote.documentType === 'pricing-schedule' ? 'Pricing Schedule' : 'Change Order';
  const setupDateLabel = quote.quoteDate
    ? new Date(`${quote.quoteDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'No date';
  const documentTypeLocked = quote.status !== 'Draft' && quote.status !== 'Ready';

  return (
    <section className={`quotes-workbench view-${effectiveMode}`}>
      <header className="quote-workbench-header">
        <div>
          <span className="quote-number">{displayQuoteNumber(quote)}</span>
          <input className="quote-title-input" value={quote.title} onChange={(event) => updateQuote(quote.id, { title: event.target.value, projectId: undefined })} />
          {quote.documentType === 'change-order' && parent && <small>Changes original agreement {displayQuoteNumber(parent)}</small>}
        </div>
        <div className="quote-header-actions">
          <div className="quote-view-switch" aria-label="Document view">
            {viewModes.map((viewMode) => <button type="button" key={viewMode} className={effectiveMode === viewMode ? 'active' : ''} onClick={() => onModeChange(viewMode)}>{viewMode === 'customer' ? 'Customer' : viewMode[0].toUpperCase() + viewMode.slice(1)}</button>)}
          </div>
          <div className="quote-document-actions">
            {(quote.status === 'Draft' || quote.status === 'Ready') && (
              <button type="button" className="quote-send-button quote-action-button" disabled={sending} onClick={() => void send()}>
                <span className="quote-action-icon" aria-hidden="true">↑</span>
                <span className="quote-action-label">{sending ? 'Sending…' : `Send ${documentLabel}`}</span>
              </button>
            )}
            <QuoteShareControl />
            {canSign && (
              <button type="button" className="quote-sign-button quote-action-button" onClick={() => setSignatureOpen(true)}>
                <span className="quote-action-icon" aria-hidden="true">✎</span>
                <span className="quote-action-label">Sign now</span>
              </button>
            )}
            {quote.status === 'Signed' && (
              <button type="button" className="quote-signature-receipt-button quote-action-button" onClick={() => setSignatureOpen(true)}>
                <span className="quote-action-icon" aria-hidden="true">✓</span>
                <span className="quote-action-label">View signature</span>
              </button>
            )}
            {canRevise && (
              <button type="button" className="quote-revision-button quote-action-button" onClick={() => createRevision(quote.id)}>
                <span className="quote-action-icon" aria-hidden="true">↻</span>
                <span className="quote-action-label">Create revision</span>
              </button>
            )}
            {canCreateChangeOrder && (
              <button type="button" className="quote-revision-button quote-action-button" onClick={() => createChangeOrder(quote.id)}>
                <span className="quote-action-icon" aria-hidden="true">+</span>
                <span className="quote-action-label">Change Order</span>
              </button>
            )}
          </div>
        </div>
      </header>
      {sendError && <div className="quote-share-error" role="alert">{sendError}</div>}
      <div className={`quote-workbench-body ${pricingSchedule ? 'is-swipeable' : ''}`} onTouchStart={beginPricingSwipe} onTouchEnd={finishPricingSwipe} onTouchCancel={() => { swipeStart.current = null; }}>
        {pricingSchedule && effectiveMode === 'workbook' ? <div className="quote-editor-pane pricing-schedule-editor-pane"><PricingScheduleWorkbook quote={quote} /></div> : effectiveMode !== 'customer' ? (
          <div className="quote-editor-pane">
            <section className="quote-details-grid">
              <details className="quote-document-setup">
                <summary>
                  <span className="quote-document-setup-heading">Document setup</span>
                  <span className="quote-document-setup-summary">{setupTypeLabel} · {quote.status} · {setupDateLabel}</span>
                  <span className="quote-document-setup-chevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="quote-document-setup-body">
                  <div className="quote-document-type-row">
                    <span>Document type</span>
                    <div className="quote-document-type-switch" role="group" aria-label="Document type">
                      {quote.documentType === 'change-order' ? (
                        <button type="button" className="active" disabled>Change Order</button>
                      ) : (
                        <>
                          <button type="button" className={quote.documentType === 'quote' ? 'active' : ''} disabled={documentTypeLocked} onClick={() => setDocumentType('quote')}>Quick Quote</button>
                          <button type="button" className={quote.documentType === 'pricing-schedule' ? 'active' : ''} disabled={documentTypeLocked} onClick={() => setDocumentType('pricing-schedule')}>Pricing Schedule</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="quote-document-meta-fields">
                    <label><span>Status</span><select value={quote.status} disabled={quote.status === 'Signed'} onChange={(event) => updateQuote(quote.id, { status: event.target.value as QuoteStatus })}>{QUOTE_STATUSES.map((status) => <option key={status} disabled={(status === 'Signed' && quote.status !== 'Signed') || (status === 'Sent' && quote.status !== 'Sent')}>{status}</option>)}</select></label>
                    <label><span>Document date</span><input type="date" value={quote.quoteDate} onChange={(event) => updateQuote(quote.id, { quoteDate: event.target.value })} /></label>
                  </div>
                </div>
              </details>
              <label className="quote-revision-label-field"><span>Revision / option label</span><input value={quote.revisionLabel ?? ''} onChange={(event) => updateQuote(quote.id, { revisionLabel: event.target.value })} placeholder="Option A, VE alternate…" /></label>
              <QuoteCrmFields quote={quote} />
            </section>
            {pricingSchedule ? <section className="pricing-schedule-summary-card"><div><span className="quote-control-heading">Pricing schedule</span><p>{quote.pricingSchedule?.customerItems.length ?? 0} published customer rows</p></div><small>Choose Simple Rates, Plan Pricing, or Spreadsheet in the Pricing workspace. Only the selected published source becomes contractual.</small><div className="pricing-schedule-summary-actions"><button type="button" onClick={() => onModeChange('workbook')}>Open pricing workspace</button><button type="button" onClick={() => onModeChange('customer')}>Preview customer schedule</button></div></section> : <><QuickMaterialQuote quote={quote} /><section className="quote-customer-controls"><div><span className="quote-control-heading">Customer columns</span><small>Keep the sent document minimal or expose pricing detail.</small></div><label><input type="checkbox" checked={quote.customerColumns.quantity} onChange={(event) => setCustomerColumns(quote.id, { quantity: event.target.checked })} /> Qty</label><label><input type="checkbox" checked={quote.customerColumns.rate} onChange={(event) => setCustomerColumns(quote.id, { rate: event.target.checked })} /> Rate</label><label><input type="checkbox" checked={quote.customerColumns.lineAmount} onChange={(event) => setCustomerColumns(quote.id, { lineAmount: event.target.checked })} /> Line amount</label></section><section className="quote-lines-editor"><header><div><span className="quote-control-heading">{documentLabel} content</span><small>Structure is optional. Add only what helps this document.</small></div><strong>{money.format(quoteTotal(quote))}</strong></header>{quote.sections.map((section) => <SectionEditor key={section.id} quote={quote} sectionId={section.id} />)}{quote.lines.map((line) => <LineEditor key={line.id} quote={quote} line={line} />)}<div className="quote-add-row"><button type="button" onClick={() => addLine(quote.id, 'item')}>+ Line</button><button type="button" onClick={() => addSection(quote.id)}>+ Section</button><button type="button" onClick={() => addLine(quote.id, 'scope')}>+ Scope</button><button type="button" onClick={() => addLine(quote.id, 'warranty')}>+ Warranty</button><button type="button" onClick={() => addLine(quote.id, 'tax')}>+ Tax</button><button type="button" onClick={() => addLine(quote.id, 'allowance')}>+ Allowance</button><button type="button" onClick={() => addLine(quote.id, 'discount')}>+ Discount</button><button type="button" onClick={() => addLine(quote.id, 'note')}>+ Note</button></div></section></>}
            <section className="quote-notes-grid"><label><span>Customer notes</span><textarea value={quote.customerNotes} onChange={(event) => updateQuote(quote.id, { customerNotes: event.target.value })} placeholder="Appears on customer document" /></label><label className="internal-notes"><span>Internal notes · private</span><textarea value={quote.internalNotes} onChange={(event) => updateQuote(quote.id, { internalNotes: event.target.value })} placeholder="Pricing thoughts, negotiation notes, reminders…" /></label></section>
            {quote.history.length > 0 && <section className="quote-history"><span className="quote-control-heading">Sent history</span>{quote.history.map((revision) => <div key={`${revision.revision}-${revision.capturedAt}`}><strong>{quote.quoteNumber}{revision.revision ? `-R${revision.revision}` : ''}</strong><span>{revision.label || revision.status}</span><time>{revision.quoteDate}</time></div>)}</section>}
            {hasChangeOrders && <small>This agreement has Change Orders attached and cannot be deleted.</small>}
            <button type="button" className="quote-delete-button" disabled={hasChangeOrders} onClick={() => { if (window.confirm(`Delete ${displayQuoteNumber(quote)}?`)) deleteQuote(quote.id); }}>Delete {documentLabel.toLowerCase()}</button>
          </div>
        ) : null}
        {effectiveMode === 'customer' && <div className="quote-preview-pane"><CustomerPreview quote={quote} /></div>}
        {!pricingSchedule && effectiveMode === 'split' && <div className="quote-preview-pane"><CustomerPreview quote={quote} /></div>}
      </div>
      {signatureOpen && <QuoteSignatureDialog quote={quote} onClose={() => setSignatureOpen(false)} />}
    </section>
  );
}

export function Quotes() {
  const hydrate = useQuoteStore((state) => state.hydrate);
  const hydrated = useQuoteStore((state) => state.hydrated);
  const quotes = useQuoteStore((state) => state.quotes);
  const activeQuoteId = useQuoteStore((state) => state.activeQuoteId);
  const selectQuote = useQuoteStore((state) => state.selectQuote);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const hydrateCrm = useCrmStore((state) => state.hydrate);
  const [mode, setMode] = useState<QuoteViewMode>('split');
  useEffect(() => { hydrate(); hydrateCrm(); }, [hydrate, hydrateCrm]);
  const quote = quotes.find((candidate) => candidate.id === activeQuoteId) ?? quotes[0] ?? null;
  const sortedQuotes = useMemo(() => [...quotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [quotes]);
  useEffect(() => {
    if (quote?.documentType === 'pricing-schedule') setMode('edit');
  }, [quote?.id, quote?.documentType]);
  useEffect(() => {
    if (quote?.documentType === 'pricing-schedule' && mode === 'split') setMode('edit');
    if (quote?.documentType !== 'pricing-schedule' && mode === 'workbook') setMode('edit');
  }, [quote?.documentType, mode]);
  if (!hydrated || !quote) return <div className="quotes-loading">Opening quotes…</div>;
  return <main className="quotes-view"><aside className="quotes-sidebar"><header><div><span>Commercial documents</span><strong>Quotes & COs</strong></div><button type="button" onClick={() => createQuote()}>+ New</button></header><div className="quote-list">{sortedQuotes.map((item) => <button key={item.id} type="button" className={`quote-list-item ${item.id === quote.id ? 'active' : ''}`} onClick={() => selectQuote(item.id)}><span>{displayQuoteNumber(item)}</span><strong>{item.title}</strong><small>{commercialDocumentLabel(item)} · {item.companyName || 'No customer'} · {item.status}</small><b>{item.documentType === 'pricing-schedule' ? `${item.pricingSchedule?.customerItems.length ?? 0} rows` : money.format(quoteTotal(item))}</b></button>)}</div></aside><QuoteEditor quote={quote} mode={mode} onModeChange={setMode} /></main>;
}
