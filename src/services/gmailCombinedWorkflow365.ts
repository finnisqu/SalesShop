/** Gmail v0.3: suggestions based solely on conversation metadata.
 * Suggestions do not persist or send anything and are never a proof of silence.
 */
import type {Activity} from '../types/crm';
import type {GmailThreadDetails} from './gmailRead359a';
import {extractAddresses} from './gmailRead359a';
import {personEmailAddress} from './emailAutoMatch361';
import type {PersonalTask} from '../store/personalTaskStore';
import {existingGmailFollowUp} from './gmailFollowUp364';
import {loggedGmailActivity} from './gmailActivity363';
import {reviewAgeMatches,DEFAULT_GMAIL_REVIEW_RULES,type GmailReviewRules} from './gmailTriagePrefs370';

export interface GmailReplySuggestion {messageId:string;daysOld:number;description:string}
const automationSender=/^(?:no[\W_]*reply|do[\W_]*not[\W_]*reply|mailer[\W_]*daemon|notification[s]?|bounce)(?:[\W_]|$)/i;

/** Conservative hint: the newest loaded message is addressed to this mailbox,
 * came from a non-automated external sender, and is 1–14 days old.
 * Other messages or offline replies may exist; no action is automatic.
 */
export function suggestGmailReply(details:GmailThreadDetails,mailbox:string,
 now=Date.now(),rules:Readonly<GmailReviewRules>=DEFAULT_GMAIL_REVIEW_RULES):GmailReplySuggestion|null{
 const own=personEmailAddress(mailbox),last=details.messages.at(-1);
 if(!own||!last||!last.id||!Number.isFinite(now))return null;
 const senders=extractAddresses(last.from),recipients=extractAddresses(last.to);
 if(senders.length!==1||senders[0]===own||!recipients.includes(own))return null;
 const senderLocal=senders[0].slice(0,senders[0].indexOf('@'));
 if(automationSender.test(senderLocal))return null;
 const received=Date.parse(last.date);
 if(!Number.isFinite(received))return null;
 if(!reviewAgeMatches(last.date,now,rules))return null;
 const daysOld=Math.floor((now-received)/(24*60*60*1000));
 return {messageId:last.id,daysOld,
  description:'Latest loaded email is from a customer and about '+daysOld+
   (daysOld===1?' day':' days')+' old. Confirm in Gmail whether a response is needed.'};
}

export function gmailCombinedSaveState(activities:readonly Activity[],tasks:readonly PersonalTask[],
 fingerprint:string,includeTask:boolean){
 const activity=loggedGmailActivity(activities,fingerprint);
 const task=existingGmailFollowUp(tasks,fingerprint);
 return {activity,task,needsActivity:!activity,
  needsTask:includeTask&&!task,canSubmit:!activity||(includeTask&&!task)};
}
