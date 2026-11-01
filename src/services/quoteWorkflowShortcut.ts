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

/** Navigate the next existing Area before ever offering to add a new one.
 * General Takeoffs isn't a customer Area; leaving it starts at the first Area.
 * This only describes an action: no write occurs until the user clicks. */
export function nextQuoteAreaAfter(quote: Quote, currentAreaId: string): QuoteAreaShortcut | null {
  if (quote.documentType === 'pricing-schedule') return null;
  const areas = quote.sections.filter(section => !isGeneralTakeoffSection(section));
  const index = areas.findIndex(section => section.id === currentAreaId);
  const inGeneral = quote.sections.some(section =>
    section.id === currentAreaId && isGeneralTakeoffSection(section));
  if (index < 0 && !inGeneral) return null;
  const next = areas[index + 1];
  if (next) return {
    kind: 'open', areaId: next.id,
    label: 'Next: ' + (next.title.trim() || 'Area') + ' ›',
  };
  if (!quoteIsCommerciallyEditable(quote)) return null;
  return { kind: 'create', label: '+ Add Area ›' };
}
