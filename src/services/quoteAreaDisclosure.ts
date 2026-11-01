import type { Quote, QuoteSection } from '../types/quote';

/** Read-only display defaults. A populated optional section must be visible
 * when an Area is first opened; the user may still collapse it afterward. */
export function quoteAreaDisclosure(quote:Quote, section:QuoteSection) {
  const sinks=section.scope?.takeoffSinks?.length??0;
  const lines=quote.lines.filter(line=>line.sectionId===section.id);
  const primary=lines.find(line=>
    line.quantitySource?.syncMode==='live'&&line.quantitySource.field==='countertopSf')
    ??lines.find(line=>line.kind==='material'&&!line.takeoffSinkId);
  const extras=lines.filter(line=>!line.takeoffSinkId&&line.id!==primary?.id).length;
  return {sinks,extras,sinksOpen:sinks>0,extrasOpen:extras>0};
}
