import type { Quote, QuoteLine } from '../types/quote';

/**
 * Presentation-independent quote ordering. All transformations preserve line
 * identities, quoted prices, catalog snapshots and the overall quote total.
 */
export function reorderQuoteLine(quote: Quote, lineId: string, direction: -1 | 1): Quote {
  const index = quote.lines.findIndex(line => line.id === lineId);
  if (index < 0 || (direction !== -1 && direction !== 1)) return quote;
  const selected = quote.lines[index];
  const peers = quote.lines.filter(line => line.sectionId === selected.sectionId);
  const peerIndex = peers.findIndex(line => line.id === lineId);
  const neighbor = peers[peerIndex + direction];
  if (!neighbor) return quote;
  const neighborIndex = quote.lines.findIndex(line => line.id === neighbor.id);
  const lines = [...quote.lines];
  [lines[index], lines[neighborIndex]] = [lines[neighborIndex], lines[index]];
  return { ...quote, lines };
}

/**
 * Managed sink charges and live SF charges belong to the takeoff that generates
 * them. Moving them by themselves would silently break pricing synchronization.
 * Captured/manual quantity links may move, retaining their frozen quantity but
 * dropping the no-longer-valid Area source reference.
 */
export function moveQuoteLineToArea(quote: Quote, lineId: string, sectionId?: string): Quote {
  if (sectionId && !quote.sections.some(section => section.id === sectionId)) return quote;
  const source = quote.lines.find(line => line.id === lineId);
  if (!source || source.sectionId === sectionId || source.takeoffSinkId ||
      source.quantitySource?.syncMode === 'live') return quote;
  const lines = quote.lines.filter(line => line.id !== lineId);
  const moved: QuoteLine = { ...source, sectionId, quantitySource: undefined };
  const lastPeerIndex = lines.reduce((last, line, index) =>
    line.sectionId === sectionId ? index : last, -1);
  lines.splice(lastPeerIndex < 0 ? lines.length : lastPeerIndex + 1, 0, moved);
  return { ...quote, lines };
}

/** Classic parity: removing an Area retains its priced lines in General. */
export function deleteQuoteAreaToGeneral(quote: Quote, sectionId: string): Quote {
  if (!quote.sections.some(section => section.id === sectionId)) return quote;
  return {
    ...quote,
    sections: quote.sections.filter(section => section.id !== sectionId),
    lines: quote.lines.map(line => line.sectionId !== sectionId ? line : {
      ...line,
      sectionId: undefined,
      quantitySource: undefined,
      // The takeoff sink is removed with the Area. Retain its frozen line
      // price in General, but never leave a dangling "managed" sink handle.
      takeoffSinkId: undefined,
    }),
  };
}

/** Deliberate destructive choice: remove the Area and every quote row it owns. */
export function deleteQuoteAreaWithContents(quote: Quote, sectionId: string): Quote {
  if (!quote.sections.some(section => section.id === sectionId)) return quote;
  return {
    ...quote,
    sections: quote.sections.filter(section => section.id !== sectionId),
    lines: quote.lines.filter(line => line.sectionId !== sectionId),
  };
}

/** Commit the reorder panel in one atomic undoable change, never partial movement. */
export function setQuoteAreaOrder(quote: Quote, orderedIds: string[]): Quote {
  const originalIds = quote.sections.map(section => section.id);
  if (originalIds.length !== orderedIds.length ||
    orderedIds.some(id => !originalIds.includes(id)) ||
    new Set(orderedIds).size !== originalIds.length ||
    originalIds.every((id, i) => id === orderedIds[i])) return quote;
  const byId = new Map(quote.sections.map(section => [section.id, section]));
  return { ...quote, sections: orderedIds.map(id => byId.get(id)!) };
}
