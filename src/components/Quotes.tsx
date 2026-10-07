import { useEffect, useMemo, useRef, useState, type DragEvent, type TouchEvent } from 'react';
import { createPricingScheduleData } from '../services/pricingSchedule';
import {
  QUOTE_AREA_SCOPE_META,
  applyAreaScopeQuantity,
  areaScopeSummary,
  compatibleAreaScopeFields,
  resolveLineAreaScopeState,
  scopeValue,
} from '../services/quoteAreaScope';
import {
  canPermanentlyDeleteQuote,
  quoteCanCreateRevision,
  quoteIsCommerciallyEditable,
} from '../services/quoteIntegrity';
import { useCrmStore } from '../store/crmStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useQuoteStore } from '../store/quoteStore';
import {
  commercialDocumentLabel,
  displayQuoteNumber,
  QUOTE_STATUSES,
  quoteLineTotal,
  quoteLinesTotal,
  quoteTotal,
  type CommercialDocumentType,
  type Quote,
  type QuoteAreaScopeField,
  type QuoteLine,
  type QuoteLineKind,
  type QuotePricingMode,
  type QuoteStatus,
} from '../types/quote';
import { CustomerDocumentBrand } from './CustomerDocumentBrand';
import { PricingScheduleCustomerPreview } from './PricingScheduleCustomerPreview';
import { PricingScheduleWorkbook } from './PricingScheduleWorkbook';
import { QuoteCrmFields } from './QuoteCrmFields';
import { QuoteInternalPricingSummary } from './QuoteInternalPricingSummary';
import { QuoteMaterialLineFields, slabReferencePatch } from './QuoteMaterialLineFields';
import { QuoteRateLineFields } from './QuoteRateLineFields';
import { QuoteSinkLineFields } from './QuoteSinkLineFields';
import { QuoteShareControl } from './QuoteShareControl';
import { QuoteSignatureDialog } from './QuoteSignatureDialog';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const lineKinds: Array<[QuoteLineKind, string]> = [
  ['item', 'Line'],
  ['material', 'Material'],
  ['sink', 'Sink'],
  ['rate', 'Rate'],
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

function LineEditor({
  quote,
  line,
  dragActive,
  dragging,
  onDragStart,
  onDrop,
  onDragEnd,
  onMoveBy,
}: {
  quote: Quote;
  line: QuoteLine;
  dragActive: boolean;
  dragging: boolean;
  onDragStart: (lineId: string) => void;
  onDrop: (lineId: string) => void;
  onDragEnd: () => void;
  onMoveBy: (lineId: string, direction: -1 | 1) => void;
}) {
  const updateLine = useQuoteStore((state) => state.updateLine);
  const deleteLine = useQuoteStore((state) => state.deleteLine);
  const guideMultiplier = useMaterialLevelGuideStore((state) => state.guide.slabPricingMultiplier);
  const textLine = isTextLine(line);
  const materialLine = line.kind === 'material';
  const sinkLine = line.kind === 'sink';
  const rateLine = line.kind === 'rate';
  const manualCostLine = line.kind === 'item' && line.pricingMode !== 'none';
  const areaSection = line.sectionId ? quote.sections.find((section) => section.id === line.sectionId) : undefined;
  const compatibleScopeFields = areaSection ? compatibleAreaScopeFields(line) : [];
  const availableScopeFields = compatibleScopeFields.filter((field) => scopeValue(areaSection?.scope, field) !== undefined);
  const quantityScopeState = resolveLineAreaScopeState(quote, line);
  const selectedQuantitySource = line.quantitySource?.kind === 'area-scope' ? line.quantitySource.field : '';


  const changePricingMode = (pricingMode: QuotePricingMode) => {
    if (pricingMode === 'slab-multiplier' && materialLine) {
      const baseCost = line.materialReference?.catalogSlabCost ?? line.materialReference?.sourceSlabCost;
      const next = slabReferencePatch(line, guideMultiplier, {
        sourceSlabCost: baseCost,
        slabMultiplier: line.materialReference?.slabMultiplier ?? guideMultiplier,
        slabCount: line.materialReference?.slabCount,
      });
      updateLine(quote.id, line.id, {
        pricingMode,
        quantity: undefined,
        rate: undefined,
        amount: next.amount,
        materialReference: next.materialReference,
      });
      return;
    }

    if (materialLine && line.materialReference) {
      updateLine(quote.id, line.id, {
        pricingMode,
        amount: pricingMode === 'quantity-rate' ? undefined : line.amount,
        materialReference: {
          ...line.materialReference,
          pricingSource: 'manual-line-rate',
          sourceSlabCost: undefined,
          slabCostOverride: undefined,
          slabMultiplier: undefined,
          slabCount: undefined,
          customerPricePerSlab: undefined,
        },
      });
      return;
    }

    updateLine(quote.id, line.id, { pricingMode });
  };

  const updateSlabField = (
    patch: Parameters<typeof slabReferencePatch>[2],
  ) => {
    const next = slabReferencePatch(line, guideMultiplier, patch);
    updateLine(quote.id, line.id, {
      materialReference: next.materialReference,
      amount: next.amount,
    });
  };

  const beginDrag = (event: DragEvent<HTMLButtonElement>) => {
    onDragStart(line.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', line.id);
  };

  return (
    <div
      className={`quote-line-editor kind-${line.kind} ${dragging ? 'is-dragging' : ''}`}
      data-quote-line-id={line.id}
      onDragOver={(event) => { if (dragActive) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
      onDrop={(event) => { if (dragActive) { event.preventDefault(); onDrop(line.id); } }}
    >
      <button
        type="button"
        className="quote-line-drag-handle"
        draggable
        onDragStart={beginDrag}
        onDragEnd={onDragEnd}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') { event.preventDefault(); onMoveBy(line.id, -1); }
          if (event.key === 'ArrowDown') { event.preventDefault(); onMoveBy(line.id, 1); }
        }}
        aria-label={`Reorder ${line.description || 'quote line'}`}
        aria-keyshortcuts="ArrowUp ArrowDown"
        title="Drag to reorder. With this handle focused, ↑ / ↓ also moves the row."
      ><span aria-hidden="true">⋮⋮</span></button>
      <button type="button" className={`quote-visibility ${line.customerVisible ? 'is-visible' : ''}`} onClick={() => updateLine(quote.id, line.id, { customerVisible: !line.customerVisible })} title={line.customerVisible ? 'Visible to customer' : 'Private / hidden from customer'}>{line.customerVisible ? '●' : '○'}</button>
      <div className="quote-line-main">
        <div className="quote-line-topline">
          <span className="quote-line-kind">{lineKinds.find(([kind]) => kind === line.kind)?.[1]}</span>
          <select value={line.sectionId ?? ''} onChange={(event) => updateLine(quote.id, line.id, { sectionId: event.target.value || undefined, quantitySource: undefined })} aria-label="Quote area"><option value="">General / no area</option>{quote.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select>
        </div>
        {materialLine && <QuoteMaterialLineFields quoteId={quote.id} line={line} />}
        {sinkLine && <QuoteSinkLineFields quoteId={quote.id} line={line} />}
        {rateLine && <QuoteRateLineFields quote={quote} line={line} />}
        <textarea value={line.description} onChange={(event) => updateLine(quote.id, line.id, { description: event.target.value })} rows={textLine ? 2 : 1} aria-label="Line description" />
      </div>
      {!textLine && (
        <div className={`quote-line-pricing ${manualCostLine ? 'has-internal-cost' : ''}`}>
          <select value={line.pricingMode} onChange={(event) => changePricingMode(event.target.value as QuotePricingMode)} aria-label="Pricing mode">
            {materialLine && <option value="quantity-rate">Qty × Rate</option>}
            {materialLine && <option value="slab-multiplier">Slab × Mult.</option>}
            <option value="direct">Amount</option>
            {!materialLine && <option value="quantity-rate">Qty × Rate</option>}
            <option value="none">No price</option>
          </select>
          {line.pricingMode === 'direct' && <label className="quote-money-input"><span>$</span><input type="number" step="0.01" value={line.amount ?? ''} onChange={(event) => updateLine(quote.id, line.id, { amount: numberValue(event.target.value) })} aria-label="Line amount" /></label>}
          {line.pricingMode === 'quantity-rate' && <div className="quote-qty-rate-stack">
            <div className="quote-qty-rate"><input type="number" step="0.01" placeholder="Qty" value={line.quantity ?? ''} onChange={(event) => updateLine(quote.id, line.id, { quantity: numberValue(event.target.value), quantitySource: undefined })} aria-label="Quantity" /><span>×</span><input type="number" step="0.01" placeholder="Rate" value={line.rate ?? ''} onChange={(event) => updateLine(quote.id, line.id, { rate: numberValue(event.target.value) })} aria-label="Rate" /></div>
            {areaSection && (availableScopeFields.length > 0 || selectedQuantitySource) && <div className={`quote-area-quantity-link ${quantityScopeState?.changed ? 'is-changed' : ''}`}>
              <label>
                <span>Qty source</span>
                <select value={selectedQuantitySource} onChange={(event) => {
                  const field = event.target.value as QuoteAreaScopeField | '';
                  if (!field) {
                    updateLine(quote.id, line.id, { quantitySource: undefined });
                    return;
                  }
                  const patch = applyAreaScopeQuantity(areaSection, field);
                  if (patch) updateLine(quote.id, line.id, patch);
                }} aria-label="Quantity source">
                  <option value="">Manual</option>
                  {compatibleScopeFields.map((field) => {
                    const value = scopeValue(areaSection.scope, field);
                    if (value === undefined && field !== selectedQuantitySource) return null;
                    const meta = QUOTE_AREA_SCOPE_META[field];
                    return <option key={field} value={field}>{meta.shortLabel}{value === undefined ? ' · missing' : ` · ${value} ${meta.unit}`}</option>;
                  })}
                </select>
              </label>
              {line.quantitySource && <small>{QUOTE_AREA_SCOPE_META[line.quantitySource.field].label} · captured {line.quantitySource.capturedValue} {QUOTE_AREA_SCOPE_META[line.quantitySource.field].unit}</small>}
              {quantityScopeState?.changed && quantityScopeState.currentValue !== undefined && <button type="button" onClick={() => {
                const patch = applyAreaScopeQuantity(areaSection, line.quantitySource!.field);
                if (patch) updateLine(quote.id, line.id, patch);
              }}>Update to {quantityScopeState.currentValue}</button>}
              {quantityScopeState?.changed && quantityScopeState.currentValue === undefined && <span className="quote-area-quantity-warning">Area value removed</span>}
            </div>}
          </div>}
          {materialLine && line.pricingMode === 'slab-multiplier' && <div className="quote-slab-line-pricing">
            <label><span>$</span><input type="number" step="0.01" min="0" placeholder="Slab cost" value={line.materialReference?.sourceSlabCost ?? ''} onChange={(event) => updateSlabField({ sourceSlabCost: numberValue(event.target.value) })} aria-label="Slab cost" /></label>
            <span>×</span>
            <input type="number" step="0.01" min="0.01" placeholder="2.2" value={line.materialReference?.slabMultiplier ?? guideMultiplier} onChange={(event) => updateSlabField({ slabMultiplier: numberValue(event.target.value) })} aria-label="Multiplier" />
            <span>×</span>
            <input type="number" step="1" min="1" placeholder="Slabs" value={line.materialReference?.slabCount ?? ''} onChange={(event) => updateSlabField({ slabCount: numberValue(event.target.value) })} aria-label="Slab count" />
          </div>}
          {line.pricingMode !== 'none' && <strong>{money.format(quoteLineTotal(line))}</strong>}
          {manualCostLine && (
            <label className="quote-internal-cost-input" title="Private total internal cost for this line. Never shown to the customer.">
              <span>Internal cost</span>
              <span className="quote-internal-cost-money"><span>$</span><input type="number" min="0" step="0.01" placeholder="Cost" value={line.internalCost ?? ''} onChange={(event) => {
                const value = numberValue(event.target.value);
                updateLine(quote.id, line.id, { internalCost: value === undefined ? undefined : Math.max(0, value) });
              }} aria-label="Private internal cost" /></span>
              <small>Private total</small>
            </label>
          )}
          <label className="quote-total-toggle" title="Include this amount in quote total"><input type="checkbox" checked={line.includeInTotal} onChange={(event) => updateLine(quote.id, line.id, { includeInTotal: event.target.checked })} /> Total</label>
        </div>
      )}
      <button type="button" className="quote-line-delete" onClick={() => deleteLine(quote.id, line.id)} title="Delete row">×</button>
    </div>
  );
}

function AreaEditor({ quote, sectionId, lines, onAddLine }: { quote: Quote; sectionId: string; lines: QuoteLine[]; onAddLine: (kind: QuoteLineKind, sectionId: string) => void }) {
  const section = quote.sections.find((candidate) => candidate.id === sectionId);
  const updateSection = useQuoteStore((state) => state.updateSection);
  const deleteSection = useQuoteStore((state) => state.deleteSection);
  const [scopeOpen, setScopeOpen] = useState(() => Boolean(section && areaScopeSummary(section)));
  if (!section) return null;

  const summary = areaScopeSummary(section);
  const updateScopeField = (field: QuoteAreaScopeField, value: number | undefined) => {
    const nextScope = { ...(section.scope ?? {}), [field]: value };
    updateSection(quote.id, section.id, { scope: nextScope });
  };

  const fields: QuoteAreaScopeField[] = ['countertopSf', 'splashLf', 'fullHeightSplashSf', 'kitchenSinkCount', 'vanitySinkCount', 'cutoutCount'];

  return <>
    <div className="quote-area-header">
      <button type="button" className={`quote-visibility ${section.customerVisible ? 'is-visible' : ''}`} onClick={() => updateSection(quote.id, section.id, { customerVisible: !section.customerVisible })} title={section.customerVisible ? 'Area visible to customer' : 'Area hidden from customer'}>{section.customerVisible ? '●' : '○'}</button>
      <div className="quote-area-title">
        <span>Area</span>
        <input value={section.title} onChange={(event) => updateSection(quote.id, section.id, { title: event.target.value })} />
        <button type="button" className={`quote-area-scope-toggle ${scopeOpen ? 'active' : ''}`} onClick={() => setScopeOpen((value) => !value)}>
          {summary ? `Scope · ${summary}` : 'Add area scope'}
        </button>
      </div>
      <div className="quote-area-summary"><span>{lines.length} item{lines.length === 1 ? '' : 's'}</span><strong>{money.format(quoteLinesTotal(lines))}</strong></div>
      <div className="quote-area-actions"><button type="button" className="quote-area-add-material" onClick={() => onAddLine('material', section.id)}>+ Material</button><button type="button" className="quote-area-add-sink" onClick={() => onAddLine('sink', section.id)}>+ Sink</button><button type="button" className="quote-area-add-rate" onClick={() => onAddLine('rate', section.id)}>+ Rate</button><button type="button" onClick={() => onAddLine('item', section.id)}>+ Line</button><button type="button" onClick={() => onAddLine('scope', section.id)}>+ Scope</button></div>
      <button type="button" className="quote-area-remove" onClick={() => deleteSection(quote.id, section.id)} title="Remove area. Its rows will move to General.">×</button>
    </div>
    {scopeOpen && <div className="quote-area-scope-panel">
      <div className="quote-area-scope-heading">
        <div><strong>Area quantities</strong><small>Private takeoff-lite values. Quote rows only change when you explicitly link or update them.</small></div>
        {summary && <span>{summary}</span>}
      </div>
      <div className="quote-area-scope-grid">
        {fields.map((field) => {
          const meta = QUOTE_AREA_SCOPE_META[field];
          const integerField = field === 'kitchenSinkCount' || field === 'vanitySinkCount' || field === 'cutoutCount';
          return <label key={field}>
            <span>{meta.label}</span>
            <div><input type="number" min="0" step={integerField ? '1' : '0.01'} value={section.scope?.[field] ?? ''} onChange={(event) => {
              const next = numberValue(event.target.value);
              updateScopeField(field, next === undefined ? undefined : Math.max(0, next));
            }} /><b>{meta.unit}</b></div>
          </label>;
        })}
      </div>
    </div>}
  </>;
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
  const updateLine = useQuoteStore((state) => state.updateLine);
  const addSection = useQuoteStore((state) => state.addSection);
  const setCustomerColumns = useQuoteStore((state) => state.setCustomerColumns);
  const recordSent = useQuoteStore((state) => state.recordSent);
  const createRevision = useQuoteStore((state) => state.createRevision);
  const createChangeOrder = useQuoteStore((state) => state.createChangeOrder);
  const restoreQuote = useQuoteStore((state) => state.restoreQuote);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [draggingLineId, setDraggingLineId] = useState<string | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const pricingSchedule = quote.documentType === 'pricing-schedule';
  const commerciallyEditable = quoteIsCommerciallyEditable(quote);
  const effectiveMode: QuoteViewMode = pricingSchedule && mode === 'split' ? 'edit' : mode;
  const viewModes: QuoteViewMode[] = pricingSchedule ? ['edit', 'workbook', 'customer'] : ['edit', 'split', 'customer'];

  const setDocumentType = (documentType: CommercialDocumentType) => {
    updateQuote(quote.id, { documentType, ...(documentType === 'pricing-schedule' && !quote.pricingSchedule ? { pricingSchedule: createPricingScheduleData(quote.id) } : {}) });
    onModeChange('edit');
  };

  const reorderLine = (lineId: string, targetLineId: string) => {
    if (lineId === targetLineId) return;
    const fromIndex = quote.lines.findIndex((line) => line.id === lineId);
    const originalTargetIndex = quote.lines.findIndex((line) => line.id === targetLineId);
    const target = quote.lines[originalTargetIndex];
    if (fromIndex < 0 || originalTargetIndex < 0 || !target) return;
    const lines = [...quote.lines];
    const [moved] = lines.splice(fromIndex, 1);
    const targetIndex = lines.findIndex((line) => line.id === targetLineId);
    if (!moved || targetIndex < 0) return;
    moved.sectionId = target.sectionId;
    const insertAt = fromIndex < originalTargetIndex ? targetIndex + 1 : targetIndex;
    lines.splice(insertAt, 0, moved);
    updateQuote(quote.id, { lines });
  };

  const moveLineBy = (lineId: string, direction: -1 | 1) => {
    const current = quote.lines.find((line) => line.id === lineId);
    if (!current) return;
    const siblings = quote.lines.filter((line) => line.sectionId === current.sectionId);
    const siblingIndex = siblings.findIndex((line) => line.id === lineId);
    const targetSibling = siblings[siblingIndex + direction];
    if (!targetSibling) return;
    const fromIndex = quote.lines.findIndex((line) => line.id === lineId);
    const targetIndex = quote.lines.findIndex((line) => line.id === targetSibling.id);
    if (fromIndex < 0 || targetIndex < 0) return;
    const lines = [...quote.lines];
    [lines[fromIndex], lines[targetIndex]] = [lines[targetIndex], lines[fromIndex]];
    updateQuote(quote.id, { lines });
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

  const canRevise = !quote.archivedAt && quoteCanCreateRevision(quote);
  const canSign = !quote.archivedAt && quote.status !== 'Signed' && quote.status !== 'Declined' && quote.status !== 'Expired';
  const parent = quote.parentQuoteId ? quotes.find((candidate) => candidate.id === quote.parentQuoteId) : null;
  const hasChangeOrders = quotes.some((candidate) => candidate.parentQuoteId === quote.id);
  const canCreateChangeOrder = quote.status === 'Signed';
  const documentLabel = commercialDocumentLabel(quote);
  const setupTypeLabel = quote.documentType === 'quote' ? 'Quick Quote' : quote.documentType === 'pricing-schedule' ? 'Pricing Schedule' : 'Change Order';
  const setupDateLabel = quote.quoteDate
    ? new Date(`${quote.quoteDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'No date';
  const documentTypeLocked = !commerciallyEditable;
  const permanentDelete = canPermanentlyDeleteQuote(quote, quotes);
  const validAreaIds = new Set(quote.sections.map((section) => section.id));
  const generalLines = quote.lines.filter((line) => !line.sectionId || !validAreaIds.has(line.sectionId));
  const linesForArea = (sectionId: string) => quote.lines.filter((line) => line.sectionId === sectionId);
  const addAreaLine = (kind: QuoteLineKind, sectionId: string) => { addLine(quote.id, kind, sectionId); };
  const moveLineToArea = (lineId: string, sectionId?: string) => {
    const line = quote.lines.find((candidate) => candidate.id === lineId);
    if (!line || line.sectionId === sectionId) return;
    updateLine(quote.id, lineId, { sectionId, quantitySource: undefined });
  };

  return (
    <section className={`quotes-workbench view-${effectiveMode}`}>
      <header className="quote-workbench-header">
        <div>
          <span className="quote-number">{displayQuoteNumber(quote)}</span>
          <input className="quote-title-input" value={quote.title} readOnly={!commerciallyEditable} onChange={(event) => updateQuote(quote.id, { title: event.target.value, projectId: undefined })} />
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
      {quote.archivedAt ? (
        <div className="quote-integrity-banner is-archived">
          <div><strong>Archived business record</strong><span>This document is retained for audit/history and cannot be edited or shared while archived.</span></div>
          <button type="button" onClick={() => restoreQuote(quote.id)}>Restore</button>
        </div>
      ) : !commerciallyEditable ? (
        <div className="quote-integrity-banner">
          <div><strong>Frozen revision</strong><span>Customer-facing content is locked. Create a revision to make commercial changes without altering what was previously sent.</span></div>
        </div>
      ) : null}
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
            {pricingSchedule ? <section className="pricing-schedule-summary-card"><div><span className="quote-control-heading">Pricing schedule</span><p>{quote.pricingSchedule?.customerItems.length ?? 0} published customer rows</p></div><small>Choose Simple Rates, Plan Pricing, or Spreadsheet in the Pricing workspace. Only the selected published source becomes contractual.</small><div className="pricing-schedule-summary-actions"><button type="button" onClick={() => onModeChange('workbook')}>Open pricing workspace</button><button type="button" onClick={() => onModeChange('customer')}>Preview customer schedule</button></div></section> : <><section className="quote-customer-controls"><div><span className="quote-control-heading">Customer columns</span><small>Keep the sent document minimal or expose pricing detail.</small></div><label><input type="checkbox" checked={quote.customerColumns.quantity} onChange={(event) => setCustomerColumns(quote.id, { quantity: event.target.checked })} /> Qty</label><label><input type="checkbox" checked={quote.customerColumns.rate} onChange={(event) => setCustomerColumns(quote.id, { rate: event.target.checked })} /> Rate</label><label><input type="checkbox" checked={quote.customerColumns.lineAmount} onChange={(event) => setCustomerColumns(quote.id, { lineAmount: event.target.checked })} /> Line amount</label></section><section className="quote-lines-editor">
  <header><div><span className="quote-control-heading">{documentLabel} areas & scope</span><small>Organize the job by Kitchen, Bath, Unit Type, Clubhouse, or any other pricing area.</small></div><strong>{money.format(quoteTotal(quote))}</strong></header>
  {generalLines.length > 0 && <div className="quote-area-card quote-area-general" onDragOver={(event) => { if (draggingLineId) event.preventDefault(); }} onDrop={(event) => { if (draggingLineId) { event.preventDefault(); moveLineToArea(draggingLineId, undefined); setDraggingLineId(null); } }}><div className="quote-area-general-header"><div><span>General</span><small>Rows not assigned to a specific area</small></div><strong>{money.format(quoteLinesTotal(generalLines))}</strong></div><div className="quote-area-lines">{generalLines.map((line) => <LineEditor key={line.id} quote={quote} line={line} dragActive={Boolean(draggingLineId)} dragging={draggingLineId === line.id} onDragStart={setDraggingLineId} onDrop={(targetId) => { if (draggingLineId) reorderLine(draggingLineId, targetId); setDraggingLineId(null); }} onDragEnd={() => setDraggingLineId(null)} onMoveBy={moveLineBy} />)}</div></div>}
  {quote.sections.map((section) => { const areaLines = linesForArea(section.id); return <div className="quote-area-card" key={section.id} onDragOver={(event) => { if (draggingLineId) event.preventDefault(); }} onDrop={(event) => { if (draggingLineId) { event.preventDefault(); moveLineToArea(draggingLineId, section.id); setDraggingLineId(null); } }}><AreaEditor quote={quote} sectionId={section.id} lines={areaLines} onAddLine={addAreaLine} /><div className="quote-area-lines">{areaLines.map((line) => <LineEditor key={line.id} quote={quote} line={line} dragActive={Boolean(draggingLineId)} dragging={draggingLineId === line.id} onDragStart={setDraggingLineId} onDrop={(targetId) => { if (draggingLineId) reorderLine(draggingLineId, targetId); setDraggingLineId(null); }} onDragEnd={() => setDraggingLineId(null)} onMoveBy={moveLineBy} />)}{!areaLines.length && <div className="quote-area-empty">No scope yet. Add a material, priced line, or scope note for this area.</div>}</div></div>; })}
  <div className="quote-add-row"><button type="button" className="quote-add-area" onClick={() => addSection(quote.id)}>+ Area</button><button type="button" className="quote-add-material" onClick={() => addLine(quote.id, 'material')}>+ General material</button><button type="button" className="quote-add-sink" onClick={() => addLine(quote.id, 'sink')}>+ General sink</button><button type="button" className="quote-add-rate" onClick={() => addLine(quote.id, 'rate')}>+ General rate</button><button type="button" onClick={() => addLine(quote.id, 'item')}>+ General line</button><button type="button" onClick={() => addLine(quote.id, 'scope')}>+ General scope</button><button type="button" onClick={() => addLine(quote.id, 'warranty')}>+ Warranty</button><button type="button" onClick={() => addLine(quote.id, 'tax')}>+ Tax</button><button type="button" onClick={() => addLine(quote.id, 'allowance')}>+ Allowance</button><button type="button" onClick={() => addLine(quote.id, 'discount')}>+ Discount</button><button type="button" onClick={() => addLine(quote.id, 'note')}>+ Note</button></div>
</section><QuoteInternalPricingSummary quote={quote} /></>}
            <section className="quote-notes-grid"><label><span>Customer notes</span><textarea value={quote.customerNotes} onChange={(event) => updateQuote(quote.id, { customerNotes: event.target.value })} placeholder="Appears on customer document" /></label><label className="internal-notes"><span>Internal notes · private</span><textarea value={quote.internalNotes} onChange={(event) => updateQuote(quote.id, { internalNotes: event.target.value })} placeholder="Pricing thoughts, negotiation notes, reminders…" /></label></section>
            {quote.history.length > 0 && <section className="quote-history"><span className="quote-control-heading">Sent history</span>{quote.history.map((revision) => <div key={`${revision.revision}-${revision.capturedAt}`}><strong>{quote.quoteNumber}{revision.revision ? `-R${revision.revision}` : ''}</strong><span>{revision.label || revision.status}</span><time>{revision.quoteDate}</time></div>)}</section>}
            {hasChangeOrders && permanentDelete && <small>This agreement has Change Orders attached and cannot be permanently deleted.</small>}
            {!quote.archivedAt && <button type="button" className="quote-delete-button" onClick={() => {
              const action = permanentDelete ? 'Delete' : 'Archive';
              if (window.confirm(`${action} ${displayQuoteNumber(quote)}?${permanentDelete ? '' : ' The business record and revisions will be retained.'}`)) deleteQuote(quote.id);
            }}>{permanentDelete ? `Delete ${documentLabel.toLowerCase()}` : `Archive ${documentLabel.toLowerCase()}`}</button>}
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
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => { hydrate(); hydrateCrm(); }, [hydrate, hydrateCrm]);
  const quote = quotes.find((candidate) => candidate.id === activeQuoteId) ?? quotes[0] ?? null;
  const archivedCount = quotes.filter((item) => Boolean(item.archivedAt)).length;
  const sortedQuotes = useMemo(() => quotes
    .filter((item) => showArchived || !item.archivedAt || item.id === quote?.id)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [quotes, quote?.id, showArchived]);
  useEffect(() => {
    if (quote?.documentType === 'pricing-schedule') setMode('edit');
  }, [quote?.id, quote?.documentType]);
  useEffect(() => {
    if (quote?.documentType === 'pricing-schedule' && mode === 'split') setMode('edit');
    if (quote?.documentType !== 'pricing-schedule' && mode === 'workbook') setMode('edit');
  }, [quote?.documentType, mode]);
  if (!hydrated || !quote) return <div className="quotes-loading">Opening quotes…</div>;
  return <main className="quotes-view"><aside className="quotes-sidebar"><header><div><span>Commercial documents</span><strong>Quotes & COs</strong></div><button type="button" onClick={() => createQuote()}>+ New</button></header>{archivedCount > 0 && <div className="quote-archive-filter"><button type="button" className={showArchived ? 'active' : ''} onClick={() => setShowArchived((value) => !value)}>{showArchived ? 'Hide archived' : `Archived · ${archivedCount}`}</button></div>}<div className="quote-list">{sortedQuotes.map((item) => <button key={item.id} type="button" className={`quote-list-item ${item.id === quote.id ? 'active' : ''} ${item.archivedAt ? 'is-archived' : ''}`} onClick={() => selectQuote(item.id)}><span>{displayQuoteNumber(item)}</span><strong>{item.title}</strong><small>{commercialDocumentLabel(item)} · {item.companyName || 'No customer'} · {item.archivedAt ? 'Archived' : item.status}</small><b>{item.documentType === 'pricing-schedule' ? `${item.pricingSchedule?.customerItems.length ?? 0} rows` : money.format(quoteTotal(item))}</b></button>)}</div></aside><QuoteEditor quote={quote} mode={mode} onModeChange={setMode} /></main>;
}
