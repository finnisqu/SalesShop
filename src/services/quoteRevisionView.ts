import type {Quote,QuoteRevisionSnapshot} from '../types/quote';
import {quoteLinesTotal} from '../types/quote';

/** Rehydrate one issued customer revision without borrowing any later customer's
 * scope, materials, pricing, terms, or internal notes from the active record.
 * Old snapshots lacking optional fields must default to absent, not "latest". */
export function historicalCustomerQuote(quote:Quote,snapshot:QuoteRevisionSnapshot):Quote {
  return {
    ...quote,
    ...structuredClone(snapshot),
    id:quote.id,
    quoteNumber:quote.quoteNumber,
    revision:snapshot.revision,
    revisionLabel:snapshot.label,
    status:snapshot.status,
    documentType:snapshot.documentType??quote.documentType,
    templateId:snapshot.templateId,
    templateOrigin:snapshot.templateOrigin?structuredClone(snapshot.templateOrigin):undefined,
    projectMaterials:snapshot.projectMaterials?structuredClone(snapshot.projectMaterials):[],
    attachSelectionsSheet:snapshot.attachSelectionsSheet??false,
    sections:structuredClone(snapshot.sections),
    lines:structuredClone(snapshot.lines),
    customerColumns:{...snapshot.customerColumns},
    customerNotes:snapshot.customerNotes,
    pricingSchedule:snapshot.pricingSchedule?structuredClone(snapshot.pricingSchedule):undefined,
    internalNotes:'',
    history:[],
    archivedAt:undefined,
    sentAt:snapshot.capturedAt,
    viewedAt:undefined,
    signedAt:undefined,
  };
}

/** Displayed revision prices must come from the frozen data, not a later draft.
 * This is safe to call after a revision changes, archival, and catalog updates. */
export function frozenRevisionTotal(snapshot:QuoteRevisionSnapshot):number {
  return quoteLinesTotal(snapshot.lines);
}
