import type {Quote} from '../types/quote';

export type BetaDocumentAction={
  mobile:string;
  desktop:string;
  ariaLabel:string;
  help:string;
};

/** One lifecycle vocabulary shared by mobile footer, desktop inspector and
 * library badges. This is navigation only: review never issues or sends. */
export function quoteBetaStatusLabel(
  quote:Pick<Quote,'status'|'archivedAt'>,
):string {
  if(quote.archivedAt)return 'Archived';
  if(quote.status==='Sent')return 'Issued';
  if(quote.status==='Ready')return 'Ready for review';
  return quote.status;
}

export function quoteBetaPrimaryAction(
  quote:Pick<Quote,'documentType'|'status'|'archivedAt'>,
  pricingBlockers=0,
):BetaDocumentAction {
  const schedule=quote.documentType==='pricing-schedule';
  const subject=schedule?'schedule':'quote';
  if(quote.archivedAt)return {
    mobile:'View archived '+subject+' ›',desktop:'View archived '+subject,
    ariaLabel:'Review archived '+subject,
    help:'Archived documents are read-only. Restore before editing or sharing.',
  };
  if(quote.status==='Signed')return {
    mobile:'View signed '+subject+' ›',desktop:'View signed '+subject,
    ariaLabel:'Review signed '+subject,
    help:'View the signed revision and its customer receipt. This document is frozen.',
  };
  if(quote.status==='Declined'||quote.status==='Expired')return {
    mobile:'Review revision options ›',desktop:'Review revision options',
    ariaLabel:'Review '+subject+' revision options',
    help:'This document cannot be shared as current. Create an editable revision to continue.',
  };
  if(quote.status==='Sent'||quote.status==='Viewed')return {
    mobile:'Share issued '+subject+' ›',desktop:'Share issued '+subject,
    ariaLabel:'Review customer sharing',
    help:'Issued does not mean delivered. Create a secure link and confirm actual delivery separately.',
  };
  if(schedule)return {
    mobile:'Review Pricing Schedule ›',desktop:'Review schedule',
    ariaLabel:'Review Pricing Schedule delivery',
    help:'Review the published customer rows and issue explicitly. No email is sent.',
  };
  if(pricingBlockers>0)return {
    mobile:'Resolve '+pricingBlockers+' pricing issue'+(pricingBlockers===1?'':'s')+' ›',
    desktop:'Review & issue',ariaLabel:'Review and issue quote',
    help:pricingBlockers+' pricing blocker'+(pricingBlockers===1?'':'s')+' must be resolved before issue.',
  };
  return {
    mobile:'Review & issue ›',desktop:'Review & issue',
    ariaLabel:'Review and issue quote',
    help:'Preview and approve the customer document before issuing. No message is sent.',
  };
}
