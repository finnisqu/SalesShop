import { Field } from '../design-system/components';
import { QUOTE_STATUSES, type Quote, type QuoteStatus } from '../types/quote';

/**
 * Internal quote editor controls only. These never appear inside the
 * customer-facing quote document or its printable/previewed presentation.
 * All changes still go through the parent QuoteStore actions.
 */
export function QuoteDocumentSetupFields({
  quote, onStatusChange, onDateChange,
}: {
  quote: Pick<Quote, 'status' | 'quoteDate'>;
  onStatusChange: (status: QuoteStatus) => void;
  onDateChange: (date: string) => void;
}) {
  return <div className="quote-document-meta-fields quote-foundation-fields">
    <Field id="quote-document-status" label="Status">
      {(control) => <select {...control} value={quote.status} disabled={quote.status === 'Signed'}
        onChange={(event) => onStatusChange(event.target.value as QuoteStatus)}>
        {QUOTE_STATUSES.map((status) =>
          <option key={status} disabled={
            (status === 'Signed' && quote.status !== 'Signed') ||
            (status === 'Sent' && quote.status !== 'Sent')
          }>{status}</option>)}
      </select>}
    </Field>
    <Field id="quote-document-date" label="Document date">
      {(control) => <input {...control} type="date" value={quote.quoteDate}
        onChange={(event) => onDateChange(event.target.value)} />}
    </Field>
  </div>;
}

export function QuoteRevisionLabelField({
  value, onChange,
}: { value: string; onChange: (next: string) => void }) {
  return <Field id="quote-revision-label" className="quote-revision-label-field"
    label="Revision / option label">
    {(control) => <input {...control} value={value} onChange={(event) => onChange(event.target.value)}
      placeholder="Option A, VE alternate…" />}
  </Field>;
}

export function QuoteNotesFields({
  customerNotes, internalNotes, onCustomerChange, onInternalChange,
}: {
  customerNotes: string;
  internalNotes: string;
  onCustomerChange: (text: string) => void;
  onInternalChange: (text: string) => void;
}) {
  return <section className="quote-notes-grid quote-foundation-notes">
    <Field id="quote-customer-notes" label="Customer notes" className="quote-foundation-note">
      {(control) => <textarea {...control} value={customerNotes}
        onChange={(event) => onCustomerChange(event.target.value)}
        placeholder="Appears on customer document" />}
    </Field>
    <Field id="quote-internal-notes" label="Internal notes · private"
      className="quote-foundation-note internal-notes">
      {(control) => <textarea {...control} value={internalNotes}
        onChange={(event) => onInternalChange(event.target.value)}
        placeholder="Pricing thoughts, negotiation notes, reminders…" />}
    </Field>
  </section>;
}
