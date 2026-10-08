import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type TouchEvent } from 'react';
import { createPricingScheduleData } from '../services/pricingSchedule';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import {
  QUOTE_AREA_SCOPE_META,
  QUOTE_AREA_SCOPE_VISIBLE_FIELDS,
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
import { useNavigationStore, type AppView } from '../store/navigationStore';
import { useQuoteStore } from '../store/quoteStore';
import {
  commercialDocumentLabel,
  displayQuoteNumber,
  QUOTE_STATUSES,
  quoteLineAmount,
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


function quoteLinePricingComplete(line: QuoteLine, guideMultiplier: number) {
  if (line.pricingMode === 'none') return true;
  if (line.pricingMode === 'direct') return Number.isFinite(line.amount);
  if (line.pricingMode === 'quantity-rate') return Number.isFinite(line.quantity) && Number.isFinite(line.rate);
  if (line.pricingMode === 'slab-multiplier') {
    return Number.isFinite(line.materialReference?.sourceSlabCost)
      && Number.isFinite(line.materialReference?.slabMultiplier ?? guideMultiplier)
      && Number.isFinite(line.materialReference?.slabCount);
  }
  return false;
}

function quoteLinePricingSummary(line: QuoteLine, guideMultiplier: number) {
  if (line.pricingMode === 'none') return 'No price';
  if (line.pricingMode === 'direct') return line.amount === undefined ? 'Amount needed' : `Amount · ${money.format(line.amount)}`;
  if (line.pricingMode === 'quantity-rate') {
    const quantity = line.quantity === undefined ? 'Qty needed' : String(line.quantity);
    const rate = line.rate === undefined ? 'Rate needed' : money.format(line.rate);
    return `${quantity} × ${rate}`;
  }
  const slabCost = line.materialReference?.sourceSlabCost ?? line.materialReference?.catalogSlabCost;
  const multiplier = line.materialReference?.slabMultiplier ?? guideMultiplier;
  const slabs = line.materialReference?.slabCount;
  const slabLabel = slabCost === undefined ? 'Slab cost needed' : `${money.format(slabCost)}/slab`;
  const slabCountLabel = slabs === undefined ? 'Slabs needed' : `${slabs} slab${slabs === 1 ? '' : 's'}`;
  return `${slabLabel} × ${multiplier} × ${slabCountLabel}`;
}

function quoteLineReminderLabels(line: QuoteLine, pricingComplete: boolean, scopeChanged: boolean) {
  const reminders: string[] = [];
  if (!pricingComplete && line.pricingMode !== 'none') reminders.push('Price');
  if (line.kind === 'material' && line.materialReference?.snapshot) {
    const hasCost = line.pricingMode === 'slab-multiplier'
      ? line.materialReference.snapshot.slabCost !== undefined
      : line.materialReference.snapshot.costPerSf !== undefined;
    if (!hasCost) reminders.push('Cost');
  }
  if (line.kind === 'sink' && line.sinkReference?.snapshot?.internalCost === undefined) reminders.push('Cost');
  if (line.kind === 'rate' && line.rateReference?.snapshot?.internalCost === undefined) reminders.push('Cost');
  if (scopeChanged) reminders.push('Scope');
  return [...new Set(reminders)];
}

function quoteIssueGuide(reminders: string[], line: QuoteLine, areaTitle?: string) {
  if (reminders.includes('Price')) {
    return {
      title: 'Pricing needs attention',
      body: line.pricingMode === 'slab-multiplier'
        ? 'Finish the slab cost, multiplier, and slab count. This reminder does not block the quote.'
        : 'Finish the quantity/rate or amount for this line. This reminder does not block the quote.',
    };
  }
  if (reminders.includes('Scope')) {
    return {
      title: 'Area quantity changed',
      body: `${areaTitle || 'This area'} has a newer takeoff quantity. Update this line if you want it to follow the current Area Scope; otherwise its captured quantity stays frozen.`,
    };
  }
  if (reminders.includes('Cost')) {
    return {
      title: 'Internal cost is missing',
      body: 'Customer pricing can still be quoted. Add or update the private source cost when you want complete margin coverage.',
    };
  }
  return {
    title: 'Review this line',
    body: 'There is a quote reminder attached to this line.',
  };
}

function LineEditor({
  quote,
  line,
  dragActive,
  dragging,
  onDragStart,
  onDrop,
  onDragEnd,
  issueGuide,
  issuePosition,
  issueTotal,
  onDismissIssue,
}: {
  quote: Quote;
  line: QuoteLine;
  dragActive: boolean;
  dragging: boolean;
  onDragStart: (lineId: string) => void;
  onDrop: (lineId: string) => void;
  onDragEnd: () => void;
  issueGuide?: { title: string; body: string };
  issuePosition?: number;
  issueTotal?: number;
  onDismissIssue?: () => void;
}) {
  const updateLine = useQuoteStore((state) => state.updateLine);
  const deleteLine = useQuoteStore((state) => state.deleteLine);
  const guideMultiplier = useMaterialLevelGuideStore((state) => state.guide.slabPricingMultiplier);
  const lineRef = useRef<HTMLDivElement>(null);
  const [pricingEditing, setPricingEditing] = useState(false);
  const pricingPopoverRef = useRef<HTMLDivElement>(null);
  const pricingButtonRef = useRef<HTMLButtonElement>(null);
  const textLine = isTextLine(line);
  const materialLine = line.kind === 'material';
  const sinkLine = line.kind === 'sink';
  const rateLine = line.kind === 'rate';
  const manualCostLine = line.kind === 'item' && line.pricingMode !== 'none';
  const catalogLine = materialLine || sinkLine || rateLine;
  const pricedLine = !textLine;
  const databaseSelected = Boolean(
    line.materialReference?.materialId
    || line.materialReference?.customMaterialName
    || line.sinkReference?.snapshot
    || line.rateReference?.snapshot
    || sinkLine
    || rateLine,
  );

  const areaSection = line.sectionId ? quote.sections.find((section) => section.id === line.sectionId) : undefined;
  const compatibleScopeFields = areaSection ? compatibleAreaScopeFields(line) : [];
  const availableScopeFields = compatibleScopeFields.filter((field) => scopeValue(areaSection?.scope, field) !== undefined);
  const quantityScopeState = resolveLineAreaScopeState(quote, line);
  const selectedQuantitySource = line.quantitySource?.kind === 'area-scope' ? line.quantitySource.field : '';
  const pricingComplete = quoteLinePricingComplete(line, guideMultiplier);
  const pricingSummary = quoteLinePricingSummary(line, guideMultiplier);
  const reminders = quoteLineReminderLabels(line, pricingComplete, Boolean(quantityScopeState?.changed));
  const showPricingEditor = pricedLine && pricingEditing;

  useEffect(() => {
    if (!pricingEditing) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (pricingPopoverRef.current?.contains(target) || pricingButtonRef.current?.contains(target)) return;
      setPricingEditing(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [pricingEditing]);

  useEffect(() => {
    const collapse = () => setPricingEditing(false);
    const focusLine = (event: Event) => {
      const detail = (event as CustomEvent<{ lineId?: string; openPricing?: boolean }>).detail;
      if (detail?.lineId !== line.id) return;
      if (detail.openPricing) setPricingEditing(true);
    };
    const closePricing = (event: Event) => {
      const detail = (event as CustomEvent<{ lineId?: string }>).detail;
      if (detail?.lineId !== line.id) return;
      setPricingEditing(false);
    };
    window.addEventListener('sales-shop:quote-collapse-all', collapse);
    window.addEventListener('sales-shop:quote-focus-line', focusLine);
    window.addEventListener('sales-shop:quote-close-pricing', closePricing);
    return () => {
      window.removeEventListener('sales-shop:quote-collapse-all', collapse);
      window.removeEventListener('sales-shop:quote-focus-line', focusLine);
      window.removeEventListener('sales-shop:quote-close-pricing', closePricing);
    };
  }, [line.id]);

  const openPricingEditor = () => {
    setPricingEditing(true);
  };

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
        quantitySource: undefined,
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
        quantitySource: pricingMode === 'quantity-rate' ? line.quantitySource : undefined,
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

    updateLine(quote.id, line.id, { pricingMode, quantitySource: pricingMode === 'quantity-rate' ? line.quantitySource : undefined });
  };

  const updateSlabField = (patch: Parameters<typeof slabReferencePatch>[2]) => {
    const next = slabReferencePatch(line, guideMultiplier, patch);
    updateLine(quote.id, line.id, {
      materialReference: next.materialReference,
      amount: next.amount,
    });
  };

  const beginDrag = (event: DragEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest('input, textarea, select, button, a, [contenteditable="true"]')) {
      event.preventDefault();
      return;
    }
    onDragStart(line.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', line.id);
  };

  return (
    <div
      ref={lineRef}
      className={`quote-line-editor kind-${line.kind} ${pricedLine ? 'is-priced-line' : ''} ${catalogLine ? 'is-catalog-line' : ''} ${databaseSelected ? 'has-database-selection' : ''} ${pricingEditing ? 'is-line-editing' : ''} ${issueGuide ? 'has-active-issue-guide' : ''} ${dragging ? 'is-dragging' : ''}`}
      data-quote-line-id={line.id}
      draggable={!pricingEditing}
      onDragStart={beginDrag}
      onDragEnd={onDragEnd}
      title={pricingEditing ? undefined : 'Drag row to reorder'}
      onDragOver={(event) => { if (dragActive) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
      onDrop={(event) => { if (dragActive) { event.preventDefault(); onDrop(line.id); } }}
    >
      <div className="quote-line-main">
        {!databaseSelected && <div className="quote-line-topline">
          <span className="quote-line-kind">{lineKinds.find(([kind]) => kind === line.kind)?.[1]}</span>
          {textLine && <button
            type="button"
            className={`quote-line-eye ${line.customerVisible ? 'is-visible' : 'is-hidden'}`}
            onClick={() => updateLine(quote.id, line.id, { customerVisible: !line.customerVisible })}
            title={line.customerVisible ? 'Shown on customer quote' : 'Hidden from customer quote'}
            aria-label={line.customerVisible ? 'Hide from customer quote' : 'Show on customer quote'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
              <circle cx="12" cy="12" r="2.7" />
              {!line.customerVisible && <path className="quote-line-eye-slash" d="M4 4l16 16" />}
            </svg>
          </button>}
        </div>}

        {materialLine && <QuoteMaterialLineFields quoteId={quote.id} line={line} />}
        {sinkLine && <QuoteSinkLineFields quoteId={quote.id} line={line} />}
        {rateLine && <QuoteRateLineFields quote={quote} line={line} />}

        {pricedLine && line.pricingMode !== 'none' && <strong className="quote-line-resting-total">{pricingComplete ? money.format(quoteLineAmount(line)) : '—'}</strong>}

        {pricedLine && (
          <div className={`quote-line-resting-pricing ${pricingEditing ? 'is-open' : ''}`}>
            <div className="quote-pricing-passive">
              <span>{pricingSummary}</span>
              <button ref={pricingButtonRef} type="button" onClick={openPricingEditor} title="Edit pricing" aria-label="Edit pricing">✎</button>
            </div>
          </div>
        )}

        {pricedLine && reminders.length > 0 && (
          <div className="quote-line-reminders quote-line-reminders-overlay">{reminders.map((label) => <span key={label}>{label}</span>)}</div>
        )}

        <textarea value={line.description} onChange={(event) => updateLine(quote.id, line.id, { description: event.target.value })} rows={textLine ? 2 : 1} aria-label="Line description" />
      </div>

      {!textLine && showPricingEditor && (
        <div ref={pricedLine ? pricingPopoverRef : undefined} className={`quote-line-pricing is-editing ${pricedLine ? 'quote-pricing-popover' : ''} ${manualCostLine ? 'has-internal-cost' : ''}`} onFocusCapture={() => setPricingEditing(true)}>
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

          {line.pricingMode !== 'none' && <strong>{money.format(quoteLineAmount(line))}</strong>}

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
        </div>
      )}

      <button type="button" className="quote-line-delete" onClick={() => deleteLine(quote.id, line.id)} title="Delete row">×</button>

      {issueGuide && <aside className="quote-issue-coachmark" role="status" aria-live="polite">
        <span className="quote-issue-coachmark-kicker">Next issue{issuePosition && issueTotal ? ` · ${issuePosition}/${issueTotal}` : ''}</span>
        <strong>{issueGuide.title}</strong>
        <p>{issueGuide.body}</p>
        <button type="button" onClick={onDismissIssue} aria-label="Dismiss issue helper" title="Dismiss">×</button>
      </aside>}
    </div>
  );
}

function AreaEditor({ quote, sectionId, lines, onAddLine, onMoveArea }: { quote: Quote; sectionId: string; lines: QuoteLine[]; onAddLine: (kind: QuoteLineKind, sectionId: string) => void; onMoveArea?: (direction: -1 | 1) => void }) {
  const section = quote.sections.find((candidate) => candidate.id === sectionId);
  const updateSection = useQuoteStore((state) => state.updateSection);
  const deleteSection = useQuoteStore((state) => state.deleteSection);
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeButtonRef = useRef<HTMLButtonElement>(null);
  const scopePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scopeOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (scopeButtonRef.current?.contains(target) || scopePopoverRef.current?.contains(target)) return;
      setScopeOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [scopeOpen]);

  useEffect(() => {
    const collapse = () => setScopeOpen(false);
    window.addEventListener('sales-shop:quote-collapse-all', collapse);
    return () => window.removeEventListener('sales-shop:quote-collapse-all', collapse);
  }, []);

  if (!section) return null;

  const summary = areaScopeSummary(section);
  const updateScopeField = (field: QuoteAreaScopeField, value: number | undefined) => {
    const nextScope = { ...(section.scope ?? {}), [field]: value };
    updateSection(quote.id, section.id, { scope: nextScope });
  };
  const fields: QuoteAreaScopeField[] = QUOTE_AREA_SCOPE_VISIBLE_FIELDS;

  return (
    <div className="quote-area-header">
      <button type="button" className="quote-area-drag-handle" draggable title="Drag Area to reorder" aria-label="Drag Area to reorder"><span aria-hidden="true">⠿</span></button>
      <div className="quote-area-mobile-order" aria-label="Reorder Area">
        <button type="button" onClick={() => onMoveArea?.(-1)} title="Move Area up" aria-label="Move Area up">↑</button>
        <button type="button" onClick={() => onMoveArea?.(1)} title="Move Area down" aria-label="Move Area down">↓</button>
      </div>
      <button type="button" className={`quote-visibility ${section.customerVisible ? 'is-visible' : ''}`} onClick={() => updateSection(quote.id, section.id, { customerVisible: !section.customerVisible })} title={section.customerVisible ? 'Area visible to customer' : 'Area hidden from customer'}>{section.customerVisible ? '●' : '○'}</button>

      <div className="quote-area-title">
        <div className="quote-area-kicker">
          <span>Area</span>
          <span aria-hidden="true">·</span>
          <button ref={scopeButtonRef} type="button" className={`quote-area-scope-toggle ${scopeOpen ? 'active' : ''}`} onClick={() => setScopeOpen((value) => !value)}>
            {summary ? `Scope · ${summary}` : 'Scope · add'}
          </button>
        </div>
        <input value={section.title} onChange={(event) => updateSection(quote.id, section.id, { title: event.target.value })} />
      </div>

      <div className="quote-area-actions">
        <button type="button" className="quote-area-add-material" onClick={() => onAddLine('material', section.id)}>+ Material</button>
        <button type="button" className="quote-area-add-sink" onClick={() => onAddLine('sink', section.id)}>+ Sink</button>
        <button type="button" className="quote-area-add-rate" onClick={() => onAddLine('rate', section.id)}>+ Rate</button>
        <button type="button" onClick={() => onAddLine('item', section.id)}>+ Line</button>
        <button type="button" onClick={() => onAddLine('scope', section.id)}>+ Scope</button>
      </div>

      <div className="quote-area-summary"><span>{lines.length} item{lines.length === 1 ? '' : 's'}</span><strong>{money.format(quoteLinesTotal(lines))}</strong></div>
      <button type="button" className="quote-area-remove" onClick={() => deleteSection(quote.id, section.id)} title="Remove area. Its rows will move to General.">×</button>

      {scopeOpen && <div ref={scopePopoverRef} className="quote-area-scope-popover">
        <div className="quote-area-scope-popover-heading">
          <strong>Area quantities</strong>
          <small>Select the takeoff values, then click anywhere else to tuck this away.</small>
        </div>
        <div className="quote-area-scope-grid">
          {fields.map((field) => {
            const meta = QUOTE_AREA_SCOPE_META[field];
            const integerField = field === 'kitchenSinkCount' || field === 'vanitySinkCount';
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
    </div>
  );
}


function GeneralAreaHeader({ lines, onAddLine, onAddArea }: { lines: QuoteLine[]; onAddLine: (kind: QuoteLineKind) => void; onAddArea: () => void }) {
  const [otherOpen, setOtherOpen] = useState(false);
  const otherButtonRef = useRef<HTMLButtonElement>(null);
  const otherPopoverRef = useRef<HTMLDivElement>(null);
  const otherKinds: Array<{ kind: QuoteLineKind; label: string; detail: string }> = [
    { kind: 'scope', label: 'Scope', detail: 'Customer-facing scope text' },
    { kind: 'warranty', label: 'Warranty', detail: 'Warranty or coverage note' },
    { kind: 'tax', label: 'Tax', detail: 'Tax or percentage charge' },
    { kind: 'allowance', label: 'Allowance', detail: 'Allowance or budget amount' },
    { kind: 'discount', label: 'Discount', detail: 'Price reduction' },
    { kind: 'note', label: 'Note', detail: 'Customer or quote note row' },
  ];

  useEffect(() => {
    if (!otherOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (otherButtonRef.current?.contains(target) || otherPopoverRef.current?.contains(target)) return;
      setOtherOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [otherOpen]);

  useEffect(() => {
    const collapse = () => setOtherOpen(false);
    window.addEventListener('sales-shop:quote-collapse-all', collapse);
    return () => window.removeEventListener('sales-shop:quote-collapse-all', collapse);
  }, []);

  const addOther = (kind: QuoteLineKind) => {
    onAddLine(kind);
    setOtherOpen(false);
  };

  return (
    <div className="quote-area-header quote-general-header">
      <span className="quote-general-header-spacer" aria-hidden="true" />

      <div className="quote-area-title quote-general-title">
        <div className="quote-area-kicker"><span>General</span></div>
        <strong>General</strong>
        <small>Rows not assigned to a specific area</small>
      </div>

      <div className="quote-area-actions">
        <button type="button" className="quote-area-add-area" onClick={onAddArea}>+ Area</button>
        <button type="button" className="quote-area-add-material" onClick={() => onAddLine('material')}>+ Material</button>
        <button type="button" className="quote-area-add-sink" onClick={() => onAddLine('sink')}>+ Sink</button>
        <button type="button" className="quote-area-add-rate" onClick={() => onAddLine('rate')}>+ Rate</button>
        <button type="button" onClick={() => onAddLine('item')}>+ Line</button>
        <button ref={otherButtonRef} type="button" className={otherOpen ? 'active' : ''} onClick={() => setOtherOpen((value) => !value)}>+ Other</button>
      </div>

      <div className="quote-area-summary"><span>{lines.length} item{lines.length === 1 ? '' : 's'}</span><strong>{money.format(quoteLinesTotal(lines))}</strong></div>
      <span className="quote-general-header-end-spacer" aria-hidden="true" />

      {otherOpen && <div ref={otherPopoverRef} className="quote-general-other-popover">
        <div className="quote-config-popover-heading">
          <strong>Add another quote row</strong>
          <small>Choose the less-common item type, then keep building.</small>
        </div>
        <div className="quote-general-other-grid">
          {otherKinds.map((item) => <button type="button" key={item.kind} onClick={() => addOther(item.kind)}>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </button>)}
        </div>
      </div>}
    </div>
  );
}

function StandardCustomerPreview({ quote }: { quote: Quote }) {
  const visibleSections = quote.sections.filter((section) => section.customerVisible);
  const visibleLines = quote.lines.filter((line) => line.customerVisible);
  const renderLines = (lines: QuoteLine[]) => lines.map((line) => {
    const priced = line.pricingMode !== 'none';
    return <div key={line.id} className={`customer-quote-row kind-${line.kind}`}><div className="customer-line-description">{line.description || '—'}</div>{quote.customerColumns.quantity && <div>{line.pricingMode === 'quantity-rate' ? line.quantity ?? '' : ''}</div>}{quote.customerColumns.rate && <div>{line.pricingMode === 'quantity-rate' && line.rate !== undefined ? money.format(line.rate) : ''}</div>}{quote.customerColumns.lineAmount && <div className="customer-line-amount">{priced ? money.format(quoteLineAmount(line)) : ''}</div>}</div>;
  });
  const renderAreaSummary = (title: string, total: number) => <div className="customer-quote-row customer-area-summary-row"><div className="customer-line-description">{title}</div><div className="customer-line-amount">{money.format(total)}</div></div>;
  const allSectionIds = new Set(quote.sections.map((section) => section.id));
  const looseLines = visibleLines.filter((line) => !line.sectionId || !allSectionIds.has(line.sectionId));
  const documentLabel = commercialDocumentLabel(quote);
  return (
    <article className="customer-quote-paper">
      <header className="customer-quote-letterhead"><div><CustomerDocumentBrand /><strong>{documentLabel.toUpperCase()}</strong></div><dl><div><dt>Document</dt><dd>{displayQuoteNumber(quote)}</dd></div><div><dt>Date</dt><dd>{quote.quoteDate}</dd></div></dl></header>
      <section className="customer-quote-recipient"><div><span>Prepared for</span><strong>{quote.companyName || quote.contactName || 'Customer'}</strong>{quote.contactName && quote.companyName && <p>{quote.contactName}</p>}{quote.address && <p>{quote.address}</p>}</div><div><span>Project</span><strong>{quote.title}</strong>{quote.revisionLabel && <p>{quote.revisionLabel}</p>}</div></section>
      <div className={`customer-quote-table columns-q${Number(quote.customerColumns.quantity)}-r${Number(quote.customerColumns.rate)}-a${Number(quote.customerColumns.lineAmount)}`}><div className="customer-quote-row customer-quote-table-head"><div>Description</div>{quote.customerColumns.quantity && <div>Qty</div>}{quote.customerColumns.rate && <div>Rate</div>}{quote.customerColumns.lineAmount && <div>Amount</div>}</div>{renderLines(looseLines)}{visibleSections.map((section) => {
        const allSectionLines = quote.lines.filter((line) => line.sectionId === section.id);
        const sectionLines = visibleLines.filter((line) => line.sectionId === section.id);
        if ((section.customerDisplayMode ?? 'detail') === 'summary') {
          const total = quoteLinesTotal(allSectionLines);
          if (!allSectionLines.length) return null;
          return <div className="customer-quote-section is-summary" key={section.id}>{renderAreaSummary(section.title, total)}</div>;
        }
        if (!sectionLines.length) return null;
        return <div className="customer-quote-section" key={section.id}><h3>{section.title}</h3>{renderLines(sectionLines)}</div>;
      })}</div>
      <div className="customer-quote-total"><span>Total</span><strong>{money.format(quoteTotal(quote))}</strong></div>
      {quote.customerNotes && <div className="customer-quote-notes"><strong>Notes</strong><p>{quote.customerNotes}</p></div>}
      <footer>{quote.status === 'Signed' ? 'Accepted electronically with SalesShop.' : `Prepared with SalesShop · Electronic acceptance is available for this ${documentLabel.toLowerCase()}.`}</footer>
    </article>
  );
}

function CustomerPreview({ quote }: { quote: Quote }) {
  return quote.documentType === 'pricing-schedule' ? <PricingScheduleCustomerPreview quote={quote} /> : <StandardCustomerPreview quote={quote} />;
}

function QuoteEditor({ quote, mode, onModeChange, onOpenMobileNavigator }: { quote: Quote; mode: QuoteViewMode; onModeChange: (mode: QuoteViewMode) => void; onOpenMobileNavigator: () => void }) {
  const quotes = useQuoteStore((state) => state.quotes);
  const updateQuote = useQuoteStore((state) => state.updateQuote);
  const deleteQuote = useQuoteStore((state) => state.deleteQuote);
  const addLine = useQuoteStore((state) => state.addLine);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const addSection = useQuoteStore((state) => state.addSection);
  const reorderSection = useQuoteStore((state) => state.reorderSection);
  const setCustomerColumns = useQuoteStore((state) => state.setCustomerColumns);
  const recordSent = useQuoteStore((state) => state.recordSent);
  const createRevision = useQuoteStore((state) => state.createRevision);
  const createChangeOrder = useQuoteStore((state) => state.createChangeOrder);
  const restoreQuote = useQuoteStore((state) => state.restoreQuote);
  const undoQuote = useQuoteStore((state) => state.undoQuote);
  const redoQuote = useQuoteStore((state) => state.redoQuote);
  const undoDepth = useQuoteStore((state) => state.undoStacks[quote.id]?.length ?? 0);
  const redoDepth = useQuoteStore((state) => state.redoStacks[quote.id]?.length ?? 0);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [draggingLineId, setDraggingLineId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [metaPanel, setMetaPanel] = useState<'document' | 'project' | 'visibility' | null>(null);
  const [issueCursor, setIssueCursor] = useState(0);
  const [activeIssueLineId, setActiveIssueLineId] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState<'view' | 'tools' | null>(null);
  const mobileMenuRef = useDismissibleLayer<HTMLDivElement>(Boolean(mobileMenu), () => setMobileMenu(null));
  const mobileToolbarRef = useRef<HTMLElement>(null);
  const [workspaceZoom, setWorkspaceZoom] = useState(() => {
    const stored = Number(window.localStorage.getItem('sales-shop:quote-workspace-zoom'));
    return Number.isFinite(stored) && stored >= 80 && stored <= 160 ? stored : 100;
  });
  const metaHostRef = useRef<HTMLElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const pricingSchedule = quote.documentType === 'pricing-schedule';
  const commerciallyEditable = quoteIsCommerciallyEditable(quote);
  const effectiveMode: QuoteViewMode = pricingSchedule && mode === 'split' ? 'edit' : mode;
  const viewModes: QuoteViewMode[] = pricingSchedule ? ['edit', 'workbook', 'customer'] : ['edit', 'split', 'customer'];

  const guideMultiplier = useMaterialLevelGuideStore((state) => state.guide.slabPricingMultiplier);
  const customerVisibilitySummary = [
    quote.customerColumns.quantity ? 'Qty' : undefined,
    quote.customerColumns.rate ? 'Rate' : undefined,
    quote.customerColumns.lineAmount ? 'Amount' : undefined,
  ].filter(Boolean).join(' · ') || 'Description only';
  const projectDetailsSummary = [quote.title, quote.companyName || quote.contactName].filter(Boolean).join(' · ');
  const issueLineIds = quote.lines
    .filter((line) => quoteLineReminderLabels(
      line,
      quoteLinePricingComplete(line, guideMultiplier),
      Boolean(resolveLineAreaScopeState(quote, line)?.changed),
    ).length > 0)
    .map((line) => line.id);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      if (event.shiftKey) redoQuote(quote.id);
      else undoQuote(quote.id);
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [quote.id, undoQuote, redoQuote]);

  useEffect(() => {
    if (!metaPanel) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!metaHostRef.current?.contains(event.target as Node)) setMetaPanel(null);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [metaPanel]);

  useEffect(() => {
    if (!mobileMenu) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!mobileToolbarRef.current?.contains(event.target as Node)) setMobileMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenu(null);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenu]);

  useEffect(() => {
    setIssueCursor(0);
    setActiveIssueLineId(null);
    setMetaPanel(null);
    setMobileMenu(null);
  }, [quote.id]);

  useEffect(() => {
    if (activeIssueLineId && !issueLineIds.includes(activeIssueLineId)) setActiveIssueLineId(null);
  }, [activeIssueLineId, issueLineIds]);

  useEffect(() => {
    window.localStorage.setItem('sales-shop:quote-workspace-zoom', String(workspaceZoom));
  }, [workspaceZoom]);

  const adjustWorkspaceZoom = (direction: -1 | 1) => {
    setWorkspaceZoom((current) => Math.max(80, Math.min(160, current + direction * 10)));
  };

  const collapseAll = () => {
    setMetaPanel(null);
    setActiveIssueLineId(null);
    window.dispatchEvent(new Event('sales-shop:quote-collapse-all'));
  };

  const focusNextIssue = () => {
    if (!issueLineIds.length) return;
    const issueIndex = issueCursor % issueLineIds.length;
    const lineId = issueLineIds[issueIndex];
    const targetLine = quote.lines.find((line) => line.id === lineId);
    const targetReminders = targetLine
      ? quoteLineReminderLabels(
          targetLine,
          quoteLinePricingComplete(targetLine, guideMultiplier),
          Boolean(resolveLineAreaScopeState(quote, targetLine)?.changed),
        )
      : [];
    setIssueCursor((current) => current + 1);
    setMetaPanel(null);
    setActiveIssueLineId(lineId);
    window.dispatchEvent(new Event('sales-shop:quote-collapse-all'));
    window.setTimeout(() => {
      document.querySelector(`[data-quote-line-id="${lineId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.dispatchEvent(new CustomEvent('sales-shop:quote-focus-line', {
        detail: { lineId, openPricing: targetReminders.includes('Price') || targetReminders.includes('Scope') },
      }));
    }, 40);
  };

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
      <header className="quote-mobile-commandbar" ref={mobileToolbarRef}>
        <button type="button" className="quote-mobile-nav-button" onClick={() => { setMobileMenu(null); onOpenMobileNavigator(); }} aria-label="Open SalesShop and quote navigation">☰</button>

        <div className="quote-mobile-current-document">
          <span>{displayQuoteNumber(quote)}</span>
          <strong>{quote.title}</strong>
        </div>

        <button type="button" className={`quote-mobile-view-button ${mobileMenu === 'view' ? 'active' : ''}`} aria-expanded={mobileMenu === 'view'} aria-haspopup="dialog" onClick={() => setMobileMenu((current) => current === 'view' ? null : 'view')}>
          {effectiveMode === 'customer' ? 'Customer' : effectiveMode[0].toUpperCase() + effectiveMode.slice(1)} <span aria-hidden="true">⌄</span>
        </button>

        <button type="button" className={`quote-mobile-more-button ${mobileMenu === 'tools' ? 'active' : ''}`} aria-expanded={mobileMenu === 'tools'} aria-haspopup="dialog" onClick={() => setMobileMenu((current) => current === 'tools' ? null : 'tools')} aria-label="Quote tools">•••</button>
        {mobileMenu && <div className="quote-mobile-menu-scrim" aria-hidden="true" onPointerDown={() => setMobileMenu(null)} />}

        {mobileMenu === 'view' && <div ref={mobileMenuRef} className="quote-mobile-menu quote-mobile-view-menu" role="dialog" aria-modal="true" aria-label="Quote view">
          <div className="quote-mobile-menu-header"><strong>Choose a view</strong><button type="button" data-dialog-initial-focus onClick={() => setMobileMenu(null)} aria-label="Close view menu">×</button></div>
          {viewModes.map((viewMode) => <button type="button" key={viewMode} className={effectiveMode === viewMode ? 'active' : ''} onClick={() => { onModeChange(viewMode); setMobileMenu(null); }}>
            <strong>{viewMode === 'customer' ? 'Customer' : viewMode[0].toUpperCase() + viewMode.slice(1)}</strong>
            <small>{viewMode === 'edit' ? 'Build the quote' : viewMode === 'split' ? 'Editor + customer sheet' : viewMode === 'workbook' ? 'Pricing workspace' : 'Customer document'}</small>
          </button>)}
        </div>}

        {mobileMenu === 'tools' && <div ref={mobileMenuRef} className="quote-mobile-menu quote-mobile-tools-menu" role="dialog" aria-modal="true" aria-label="Quote tools">
          <div className="quote-mobile-menu-header"><strong>Quote tools</strong><button type="button" data-dialog-initial-focus onClick={() => setMobileMenu(null)} aria-label="Close quote tools">×</button></div>
          <div className="quote-mobile-menu-section">
            <span className="quote-mobile-menu-heading">Editing</span>
            <div className="quote-mobile-tool-grid">
              <button type="button" disabled={!commerciallyEditable || undoDepth === 0} onClick={() => undoQuote(quote.id)}><span>↶</span><small>Undo</small></button>
              <button type="button" disabled={!commerciallyEditable || redoDepth === 0} onClick={() => redoQuote(quote.id)}><span>↷</span><small>Redo</small></button>
              <button type="button" onClick={() => { collapseAll(); setMobileMenu(null); }}><span>⌃</span><small>Collapse</small></button>
              <button type="button" disabled={!issueLineIds.length} onClick={() => { focusNextIssue(); setMobileMenu(null); }}><span>!</span><small>Next issue{issueLineIds.length ? ` · ${issueLineIds.length}` : ''}</small></button>
            </div>
          </div>

          <div className="quote-mobile-menu-section">
            <span className="quote-mobile-menu-heading">Quote setup</span>
            <div className="quote-mobile-setup-grid">
              <button type="button" onClick={() => { setMetaPanel('document'); setMobileMenu(null); }}><strong>Document</strong><small>{setupTypeLabel} · {quote.status}</small></button>
              <button type="button" onClick={() => { setMetaPanel('project'); setMobileMenu(null); }}><strong>Project</strong><small>{projectDetailsSummary || 'Customer & project'}</small></button>
              {!pricingSchedule && <button type="button" onClick={() => { setMetaPanel('visibility'); setMobileMenu(null); }}><strong>Visibility</strong><small>{customerVisibilitySummary}</small></button>}
            </div>
          </div>

          <div className="quote-mobile-menu-section quote-mobile-zoom-section">
            <span className="quote-mobile-menu-heading">Workspace zoom</span>
            <div className="quote-mobile-zoom-row">
              <button type="button" disabled={workspaceZoom <= 80} onClick={() => adjustWorkspaceZoom(-1)}>−</button>
              <button type="button" onClick={() => setWorkspaceZoom(100)}>{workspaceZoom}%</button>
              <button type="button" disabled={workspaceZoom >= 160} onClick={() => adjustWorkspaceZoom(1)}>+</button>
            </div>
          </div>

          <div className="quote-mobile-menu-section">
            <span className="quote-mobile-menu-heading">Document actions</span>
            <div className="quote-mobile-document-actions">
              {(quote.status === 'Draft' || quote.status === 'Ready') && <button type="button" className="is-send" disabled={sending} onClick={() => void send()}>{sending ? 'Sending…' : `Send ${documentLabel}`}</button>}
              <QuoteShareControl />
              {canSign && <button type="button" className="is-sign" onClick={() => { setSignatureOpen(true); setMobileMenu(null); }}>Sign now</button>}
              {quote.status === 'Signed' && <button type="button" onClick={() => { setSignatureOpen(true); setMobileMenu(null); }}>View signature</button>}
              {canRevise && <button type="button" onClick={() => { createRevision(quote.id); setMobileMenu(null); }}>Create revision</button>}
              {canCreateChangeOrder && <button type="button" onClick={() => { createChangeOrder(quote.id); setMobileMenu(null); }}>Change Order</button>}
            </div>
          </div>
          <button type="button" className="quote-mobile-menu-done" onClick={() => setMobileMenu(null)}>Done · Back to quote</button>
        </div>}
      </header>

      <header className="quote-workbench-header">
        <div>
          <span className="quote-number">{displayQuoteNumber(quote)}</span>
          <input className="quote-title-input" value={quote.title} readOnly={!commerciallyEditable} onChange={(event) => updateQuote(quote.id, { title: event.target.value, projectId: undefined })} />
          {quote.documentType === 'change-order' && parent && <small>Changes original agreement {displayQuoteNumber(parent)}</small>}
        </div>
        <div className="quote-header-actions">
          <div className="quote-undo-redo" aria-label="Quote editing tools">
            <button type="button" disabled={!commerciallyEditable || undoDepth === 0} onClick={() => undoQuote(quote.id)} title="Undo last quote edit">↶</button>
            <button type="button" disabled={!commerciallyEditable || redoDepth === 0} onClick={() => redoQuote(quote.id)} title={redoDepth ? 'Redo quote edit' : 'Redo becomes available after Undo'}>↷</button>
            <button type="button" onClick={collapseAll} title="Collapse all open quote controls" aria-label="Collapse all open quote controls">⌃</button>
            <button type="button" disabled={!issueLineIds.length} onClick={focusNextIssue} title={issueLineIds.length ? `Go to next quote issue · ${issueLineIds.length} open` : 'No quote issues'} aria-label="Go to next quote issue">!</button>
          </div>
          <div className="quote-workspace-zoom" aria-label="Quote workspace zoom">
            <button type="button" disabled={workspaceZoom <= 80} onClick={() => adjustWorkspaceZoom(-1)} title="Zoom quote workspace out" aria-label="Zoom quote workspace out">−</button>
            <button type="button" className="quote-workspace-zoom-value" onClick={() => setWorkspaceZoom(100)} title="Reset quote workspace zoom to 100%">{workspaceZoom}%</button>
            <button type="button" disabled={workspaceZoom >= 160} onClick={() => adjustWorkspaceZoom(1)} title="Zoom quote workspace in" aria-label="Zoom quote workspace in">+</button>
          </div>
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
      <div className={`quote-workbench-body ${pricingSchedule ? 'is-swipeable' : ''}`} style={{ '--quote-workspace-zoom': workspaceZoom / 100 } as CSSProperties} onTouchStart={beginPricingSwipe} onTouchEnd={finishPricingSwipe} onTouchCancel={() => { swipeStart.current = null; }}>
        {pricingSchedule && effectiveMode === 'workbook' ? <div className="quote-editor-pane pricing-schedule-editor-pane"><PricingScheduleWorkbook quote={quote} /></div> : effectiveMode !== 'customer' ? (
          <div className="quote-editor-pane">
            <section className="quote-configuration-strip" ref={metaHostRef}>
              <button type="button" className={metaPanel === 'document' ? 'active' : ''} onClick={() => setMetaPanel((current) => current === 'document' ? null : 'document')}>
                <span>Document setup</span>
                <small>{setupTypeLabel} · {quote.status} · {setupDateLabel}</small>
              </button>
              <button type="button" className={metaPanel === 'project' ? 'active' : ''} onClick={() => setMetaPanel((current) => current === 'project' ? null : 'project')}>
                <span>Project details</span>
                <small>{projectDetailsSummary || 'Project · customer · contact'}</small>
              </button>
              {!pricingSchedule && <button type="button" className={metaPanel === 'visibility' ? 'active' : ''} onClick={() => setMetaPanel((current) => current === 'visibility' ? null : 'visibility')}>
                <span>Customer visibility</span>
                <small>{customerVisibilitySummary}</small>
              </button>}

              {metaPanel === 'document' && <div className="quote-config-popover is-document">
                <div className="quote-config-popover-heading"><strong>Document setup</strong><small>Choose the document behavior, then click away.</small></div>
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
              </div>}

              {metaPanel === 'project' && <div className="quote-config-popover is-project">
                <div className="quote-config-popover-heading"><strong>Project details</strong><small>CRM links and project context stay tucked away after selection.</small></div>
                <div className="quote-project-details-grid">
                  <QuoteCrmFields quote={quote} />
                  <label className="quote-revision-label-field"><span>Revision / option label</span><input value={quote.revisionLabel ?? ''} onChange={(event) => updateQuote(quote.id, { revisionLabel: event.target.value })} placeholder="Option A, VE alternate…" /></label>
                </div>
              </div>}

              {metaPanel === 'visibility' && !pricingSchedule && <div className="quote-config-popover is-visibility">
                <div className="quote-config-popover-heading"><strong>Customer visibility</strong><small>Choose how much pricing detail appears on the customer document.</small></div>
                <div className="quote-customer-visibility-options">
                  <label><input type="checkbox" checked={quote.customerColumns.quantity} onChange={(event) => setCustomerColumns(quote.id, { quantity: event.target.checked })} /> <span>Quantity column</span></label>
                  <label><input type="checkbox" checked={quote.customerColumns.rate} onChange={(event) => setCustomerColumns(quote.id, { rate: event.target.checked })} /> <span>Rate column</span></label>
                  <label><input type="checkbox" checked={quote.customerColumns.lineAmount} onChange={(event) => setCustomerColumns(quote.id, { lineAmount: event.target.checked })} /> <span>Line amount</span></label>
                </div>
                <small className="quote-config-footnote">Area and line visibility stay independent from these column choices.</small>
              </div>}
            </section>
            {pricingSchedule ? <section className="pricing-schedule-summary-card"><div><span className="quote-control-heading">Pricing schedule</span><p>{quote.pricingSchedule?.customerItems.length ?? 0} published customer rows</p></div><small>Choose Simple Rates, Plan Pricing, or Spreadsheet in the Pricing workspace. Only the selected published source becomes contractual.</small><div className="pricing-schedule-summary-actions"><button type="button" onClick={() => onModeChange('workbook')}>Open pricing workspace</button><button type="button" onClick={() => onModeChange('customer')}>Preview customer schedule</button></div></section> : <><section className="quote-lines-editor">
  <header><div><span className="quote-control-heading">{documentLabel} areas & scope</span><small>Organize the job by Kitchen, Bath, Unit Type, Clubhouse, or any other pricing area.</small></div><strong>{money.format(quoteTotal(quote))}</strong></header>
  <div className="quote-area-card quote-area-general" onDragOver={(event) => { if (draggingLineId) event.preventDefault(); }} onDrop={(event) => { if (draggingLineId) { event.preventDefault(); moveLineToArea(draggingLineId, undefined); setDraggingLineId(null); } }}>
    <GeneralAreaHeader lines={generalLines} onAddLine={(kind) => addLine(quote.id, kind)} onAddArea={() => addSection(quote.id)} />
    <div className="quote-area-lines">
      {generalLines.map((line) => <LineEditor key={line.id} quote={quote} line={line} dragActive={Boolean(draggingLineId)} dragging={draggingLineId === line.id} onDragStart={setDraggingLineId} onDrop={(targetId) => { if (draggingLineId) reorderLine(draggingLineId, targetId); setDraggingLineId(null); }} onDragEnd={() => setDraggingLineId(null)} issueGuide={activeIssueLineId === line.id ? quoteIssueGuide(quoteLineReminderLabels(line, quoteLinePricingComplete(line, guideMultiplier), Boolean(resolveLineAreaScopeState(quote, line)?.changed)), line, 'General') : undefined} issuePosition={activeIssueLineId === line.id ? issueLineIds.indexOf(line.id) + 1 : undefined} issueTotal={activeIssueLineId === line.id ? issueLineIds.length : undefined} onDismissIssue={() => setActiveIssueLineId(null)} />)}
      {!generalLines.length && <div className="quote-area-empty">General is ready for rows that do not belong to a named area.</div>}
    </div>
  </div>
  {quote.sections.map((section, sectionIndex) => {
    const areaLines = linesForArea(section.id);
    return <div
      className={`quote-area-card ${draggingSectionId === section.id ? 'is-area-dragging' : ''}`}
      key={section.id}
      draggable={false}
      onDragStart={(event) => {
        const target = event.target as Element;
        if (!target.closest('.quote-area-drag-handle')) return;
        setDraggingSectionId(section.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', section.id);
      }}
      onDragEnd={() => setDraggingSectionId(null)}
      onDragOver={(event) => {
        if (draggingLineId || draggingSectionId) event.preventDefault();
      }}
      onDrop={(event) => {
        if (draggingSectionId) {
          event.preventDefault();
          reorderSection(quote.id, draggingSectionId, section.id);
          setDraggingSectionId(null);
          return;
        }
        if (draggingLineId) {
          event.preventDefault();
          moveLineToArea(draggingLineId, section.id);
          setDraggingLineId(null);
        }
      }}
    >
      <AreaEditor
        quote={quote}
        sectionId={section.id}
        lines={areaLines}
        onAddLine={addAreaLine}
        onMoveArea={(direction) => {
          const target = quote.sections[sectionIndex + direction];
          if (target) reorderSection(quote.id, section.id, target.id);
        }}
      />
      <div className="quote-area-lines">
        {areaLines.map((line) => <LineEditor key={line.id} quote={quote} line={line} dragActive={Boolean(draggingLineId)} dragging={draggingLineId === line.id} onDragStart={setDraggingLineId} onDrop={(targetId) => { if (draggingLineId) reorderLine(draggingLineId, targetId); setDraggingLineId(null); }} onDragEnd={() => setDraggingLineId(null)} issueGuide={activeIssueLineId === line.id ? quoteIssueGuide(quoteLineReminderLabels(line, quoteLinePricingComplete(line, guideMultiplier), Boolean(resolveLineAreaScopeState(quote, line)?.changed)), line, line.sectionId ? quote.sections.find((section) => section.id === line.sectionId)?.title : 'General') : undefined} issuePosition={activeIssueLineId === line.id ? issueLineIds.indexOf(line.id) + 1 : undefined} issueTotal={activeIssueLineId === line.id ? issueLineIds.length : undefined} onDismissIssue={() => setActiveIssueLineId(null)} />)}
        {!areaLines.length && <div className="quote-area-empty">No scope yet. Add a material, priced line, or scope note for this area.</div>}
      </div>
    </div>;
  })}
</section></>}
            <section className="quote-notes-grid"><label><span>Customer notes</span><textarea value={quote.customerNotes} onChange={(event) => updateQuote(quote.id, { customerNotes: event.target.value })} placeholder="Appears on customer document" /></label><label className="internal-notes"><span>Internal notes · private</span><textarea value={quote.internalNotes} onChange={(event) => updateQuote(quote.id, { internalNotes: event.target.value })} placeholder="Pricing thoughts, negotiation notes, reminders…" /></label></section>
            {!pricingSchedule && <QuoteInternalPricingSummary quote={quote} />}
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
  const setView = useNavigationStore((state) => state.setView);
  const hydrate = useQuoteStore((state) => state.hydrate);
  const hydrated = useQuoteStore((state) => state.hydrated);
  const quotes = useQuoteStore((state) => state.quotes);
  const activeQuoteId = useQuoteStore((state) => state.activeQuoteId);
  const selectQuote = useQuoteStore((state) => state.selectQuote);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const recentCatalogInsert = useQuoteStore((state) => state.recentCatalogInsert);
  const clearCatalogInsert = useQuoteStore((state) => state.clearCatalogInsert);
  const hydrateCrm = useCrmStore((state) => state.hydrate);
  const [mobileNavigatorOpen, setMobileNavigatorOpen] = useState(false);
  const navigatorRef = useDismissibleLayer<HTMLElement>(mobileNavigatorOpen, () => setMobileNavigatorOpen(false));
  const [mode, setMode] = useState<QuoteViewMode>(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px)').matches
      ? 'edit'
      : 'split'
  ));
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => { hydrate(); hydrateCrm(); }, [hydrate, hydrateCrm]);
  const quote = quotes.find((candidate) => candidate.id === activeQuoteId) ?? quotes[0] ?? null;
  useEffect(() => {
    if (!recentCatalogInsert || recentCatalogInsert.quoteId !== quote?.id) return;
    let highlightTimer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      const line = Array.from(document.querySelectorAll<HTMLElement>('[data-quote-line-id]'))
        .find((element) => element.dataset.quoteLineId === recentCatalogInsert.lineId);
      if (!line) return;
      line.scrollIntoView({ behavior: 'smooth', block: 'center' });
      line.classList.add('is-catalog-inserted');
      clearCatalogInsert();
      highlightTimer = window.setTimeout(() => line.classList.remove('is-catalog-inserted'), 3500);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (highlightTimer !== undefined) window.clearTimeout(highlightTimer);
    };
  }, [recentCatalogInsert, quote?.id, clearCatalogInsert]);
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

  const appDestinations: Array<{ view: AppView; label: string }> = [
    { view: 'notebook', label: 'Notebook' },
    { view: 'board', label: 'Board' },
    { view: 'quotes', label: 'Quotes' },
    { view: 'catalog', label: 'Catalog' },
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'settings', label: 'Settings' },
  ];

  return <main className="quotes-view">
    {mobileNavigatorOpen && <div className="quote-mobile-navigator-backdrop" onPointerDown={() => setMobileNavigatorOpen(false)}>
      <section ref={navigatorRef} className="quote-mobile-navigator" role="dialog" aria-modal="true" aria-label="Quotes navigation" onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>SalesShop</span><strong>Quotes & COs</strong></div>
          <button type="button" data-dialog-initial-focus onClick={() => setMobileNavigatorOpen(false)} aria-label="Close navigation">×</button>
        </header>

        <nav className="quote-mobile-app-nav" aria-label="SalesShop sections">
          {appDestinations.map((destination) => <button type="button" key={destination.view} className={destination.view === 'quotes' ? 'active' : ''} onClick={() => {
            setMobileNavigatorOpen(false);
            setView(destination.view);
          }}>{destination.label}</button>)}
        </nav>

        <div className="quote-mobile-document-heading">
          <div><strong>Documents</strong><small>{sortedQuotes.length} shown</small></div>
          <button type="button" onClick={() => { createQuote(); setMobileNavigatorOpen(false); }}>+ New</button>
        </div>

        {archivedCount > 0 && <button type="button" className="quote-mobile-archive-toggle" onClick={() => setShowArchived((value) => !value)}>{showArchived ? 'Hide archived' : `Show archived · ${archivedCount}`}</button>}

        <div className="quote-mobile-document-list">
          {sortedQuotes.map((item) => <button key={item.id} type="button" className={`${item.id === quote.id ? 'active' : ''} ${item.archivedAt ? 'is-archived' : ''}`} onClick={() => { selectQuote(item.id); setMobileNavigatorOpen(false); }}>
            <div><span>{displayQuoteNumber(item)}</span><strong>{item.title}</strong><small>{commercialDocumentLabel(item)} · {item.companyName || 'No customer'} · {item.archivedAt ? 'Archived' : item.status}</small></div>
            <b>{item.documentType === 'pricing-schedule' ? `${item.pricingSchedule?.customerItems.length ?? 0} rows` : money.format(quoteTotal(item))}</b>
          </button>)}
        </div>
      </section>
    </div>}

    <aside className="quotes-sidebar"><header><div><span>Commercial documents</span><strong>Quotes & COs</strong></div><button type="button" onClick={() => createQuote()}>+ New</button></header>{archivedCount > 0 && <div className="quote-archive-filter"><button type="button" className={showArchived ? 'active' : ''} onClick={() => setShowArchived((value) => !value)}>{showArchived ? 'Hide archived' : `Archived · ${archivedCount}`}</button></div>}<div className="quote-list">{sortedQuotes.map((item) => <button key={item.id} type="button" className={`quote-list-item ${item.id === quote.id ? 'active' : ''} ${item.archivedAt ? 'is-archived' : ''}`} onClick={() => selectQuote(item.id)}><span>{displayQuoteNumber(item)}</span><strong>{item.title}</strong><small>{commercialDocumentLabel(item)} · {item.companyName || 'No customer'} · {item.archivedAt ? 'Archived' : item.status}</small><b>{item.documentType === 'pricing-schedule' ? `${item.pricingSchedule?.customerItems.length ?? 0} rows` : money.format(quoteTotal(item))}</b></button>)}</div></aside>
    <QuoteEditor quote={quote} mode={mode} onModeChange={setMode} onOpenMobileNavigator={() => setMobileNavigatorOpen(true)} />
  </main>;
}
