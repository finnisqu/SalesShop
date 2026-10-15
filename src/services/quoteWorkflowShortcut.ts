import type { Quote } from '../types/quote';
import { isGeneralTakeoffSection } from './quoteCustomerPresentation';
import { quoteIsCommerciallyEditable } from './quoteIntegrity';

export type QuoteAreaShortcut =
  | { kind: 'open'; areaId: string; label: string }
  | { kind: 'create'; label: string };

/** A quote's Details page can advance without detouring through Build.
 * This is navigation only: callers explicitly decide whether to create an Area. */
export function nextQuoteAreaShortcut(quote: Quote): QuoteAreaShortcut | null {
  if (quote.documentType === 'pricing-schedule') return null;
  const first = quote.sections.find(section => !isGeneralTakeoffSection(section));
  if (first) return {
    kind: 'open', areaId: first.id,
    label: 'Continue to ' + (first.title.trim() || 'first Area') + ' ›',
  };
  if (!quoteIsCommerciallyEditable(quote)) return null;
  return { kind: 'create', label: '+ Start first Area ›' };
}
