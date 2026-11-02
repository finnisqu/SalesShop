import type {Quote} from '../types/quote';
import {auditQuoteDraft} from './quoteDraftAudit';

/** Choose a live audit finding when returning from a repair.
 * A resolved finding cannot be focused; fall through to another real issue. */
export function nextReviewFocus(quote:Quote,previousId:string|null):string{
 const report=auditQuoteDraft(quote);
 if(previousId&&report.findings.some(f=>f.id===previousId))return previousId;
 return report.blockers[0]?.id??report.review[0]?.id??'__delivery__';
}
