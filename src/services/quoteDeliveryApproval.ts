import type {Quote} from '../types/quote';

/** Ephemeral approval of what was actually previewed. Any saved edit, new
 * document, or revision makes the earlier approval ineligible for issue. */
/** Timestamp collisions can happen when two edits occur within one ms.
 * Bind approval to the document data as well, so a changed customer copy
 * cannot reuse an old Preview approval even if updatedAt is unchanged.
 * No private notes, bearer tokens, or activities are placed in this key. */
type ApprovedDocumentFields=Partial<Pick<Quote,
  'documentType'|'title'|'quoteDate'|'revisionLabel'|'companyId'|'companyName'|
  'contactId'|'contactName'|'contactEmail'|'address'|'pricingDivision'|
  'sections'|'lines'|'customerColumns'|'customerNotes'|'pricingSchedule'|
  'attachSelectionsSheet'|'projectMaterials'
>>;
type ApprovalDocument=Pick<Quote,'id'|'revision'|'updatedAt'> & ApprovedDocumentFields;
export function quoteDeliveryApprovalKey(
  quote: ApprovalDocument,
): string {
  return JSON.stringify([
    quote.id,quote.revision,quote.updatedAt,
    quote.documentType,quote.title,quote.quoteDate,quote.revisionLabel,
    quote.companyId,quote.companyName,quote.contactId,quote.contactName,
    quote.contactEmail,quote.address,quote.pricingDivision,
    quote.sections,quote.lines,quote.customerColumns,quote.customerNotes,
    quote.pricingSchedule,quote.attachSelectionsSheet,quote.projectMaterials,
  ]);
}

/** Review-item acknowledgement survives Preview navigation only while the
 * quote contents and actual findings are unchanged. Never persist the decision
 * to cloud storage or across a different quote/revision. */
export function quoteDeliveryReviewKey(
  quote: ApprovalDocument,
  findings: ReadonlyArray<{id:string;severity:string}>,
): string {
  return JSON.stringify([
    quoteDeliveryApprovalKey(quote),
    findings.map(finding=>[finding.id,finding.severity]),
  ]);
}

export function approvedCustomerDraft(
  quote: ApprovalDocument & Pick<Quote,'status'>,
  previewedKey:string|null,approvedKey:string|null,
): boolean {
  if(quote.status!=='Draft'&&quote.status!=='Ready')return false;
  const key=quoteDeliveryApprovalKey(quote);
  return previewedKey===key&&approvedKey===key;
}

/** A shared link is authorized for the exact stored revision, not whatever
 * revision the salesperson happens to be viewing now. */
export function shareMatchesQuoteRevision(
  quote:Pick<Quote,'revision'>,share:{revision:number},
):boolean {
  return quote.revision===share.revision;
}
