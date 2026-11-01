import { useState } from 'react';
import type { Quote } from '../types/quote';
import { auditQuoteDraft } from '../services/quoteDraftAudit';
import { quoteBuilderProgress, type QuoteBuilderStageId } from '../services/quoteBuilderProgress';
import './quote-beta-progress.css';

type Props = {
  quote: Quote;
  current: QuoteBuilderStageId;
  editable: boolean;
  onDetails: () => void;
  onAreas: () => void;
  onOpenArea: (id: string) => void;
  onAddArea: () => void;
  onPricing: () => void;
  onReview: () => void;
};

/** Guided but non-linear: nothing here creates or edits quote data until the
 * salesperson explicitly chooses an Area action. Review uses the existing gate. */
export function QuoteBetaProgress({
  quote, current, editable, onDetails, onAreas, onOpenArea, onAddArea, onPricing, onReview,
}: Props) {
  const [areasExpanded, setAreasExpanded] = useState(false);
  const report = auditQuoteDraft(quote);
  const progress = quoteBuilderProgress(quote, report);
  const visit = (stage: QuoteBuilderStageId) => {
    if (stage === 'areas') {
      setAreasExpanded(true);
      onAreas();
      return;
    }
    setAreasExpanded(false);
    if (stage === 'details') onDetails();
    if (stage === 'pricing') onPricing();
    if (stage === 'review') onReview();
  };
  const next: QuoteBuilderStageId | null = current === 'details' ? 'areas'
    : current === 'areas' ? 'pricing' : current === 'pricing' ? 'review' : null;
  const nextStage = progress.stages.find(stage => stage.id === next);
  return <section className="qmb-guide" aria-label="Quote builder progress">
    <div className="qmb-guide-heading">
      <strong>Quote builder</strong>
      <small>Work in any order · autosaved</small>
    </div>
    <nav className="qmb-guide-steps" aria-label="Jump to quote stage">
      {progress.stages.map((stage, index) =>
        <button key={stage.id} type="button"
          className={'qmb-guide-step is-' + stage.state + (current === stage.id ? ' is-current' : '')}
          aria-current={current === stage.id ? 'step' : undefined}
          aria-label={stage.label + ': ' + stage.status}
          onClick={() => visit(stage.id)}>
          <span className="qmb-guide-step-number" aria-hidden="true">
            {stage.state === 'done' ? '✓' : stage.state === 'attention' ? '!' : index + 1}
          </span>
          <span className="qmb-guide-step-text"><strong>{stage.label}</strong><small>{stage.status}</small></span>
        </button>
      )}
    </nav>
    <div className="qmb-guide-progress" role="progressbar" aria-label="Quote milestones reached"
      aria-valuemin={0} aria-valuemax={4} aria-valuenow={progress.readyCount}>
      {progress.stages.map(stage => <span key={stage.id}
        className={'qmb-guide-progress-piece is-' + stage.state}/>)}
    </div>
    {areasExpanded && <div className="qmb-guide-area-links" aria-label="Quick access to quote Areas">
      <button type="button" className="qmb-guide-area-link" onClick={() => {
        setAreasExpanded(false);
        onAreas();
      }}>All Areas</button>
      {progress.areas.map(area => {
        const unresolved = report.blockers.filter(f =>
          f.destination.view === 'area' && f.destination.areaId === area.id).length;
        return <button type="button" key={area.id} className="qmb-guide-area-link"
          onClick={() => { setAreasExpanded(false); onOpenArea(area.id); }}>
          {area.title || 'Untitled Area'}{unresolved ? ' · ' + unresolved + ' price issue' + (unresolved === 1 ? '' : 's') : ''}
        </button>;
      })}
      {editable && <button type="button" className="qmb-guide-area-link is-add"
        onClick={() => { setAreasExpanded(false); onAddArea(); }}>+ Add Area</button>}
      <button type="button" className="qmb-guide-area-close" aria-label="Close Area shortcuts"
        onClick={() => setAreasExpanded(false)}>×</button>
    </div>}
    <div className="qmb-guide-caption">
      <small>Optional fields never block drafting. Pricing issues are checked at Review.</small>
      {next && nextStage && <button type="button" className="qmb-guide-next"
        onClick={() => visit(next)}>Continue: {nextStage.label} <span aria-hidden="true">›</span></button>}
    </div>
  </section>;
}
