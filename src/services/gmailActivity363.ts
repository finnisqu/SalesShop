/** Explicit Gmail -> CRM Activity adapter, with no persisted mailbox, message or thread IDs.
 * A deterministic SHA-256 source key makes retries safe even across reloads.
 */
import type {Activity} from '../types/crm';
import {extractAddresses,type GmailVisibleMessage} from './gmailRead359a';
import {personEmailAddress} from './emailAutoMatch361';

const gmailId=/^[a-zA-Z0-9_-]{3,128}$/;
export function gmailMessageDate(message:GmailVisibleMessage,now=Date.now()):string|null{
 const date=Date.parse(message.date);
 return gmailId.test(message.id)&&Number.isFinite(date)&&
  date>=Date.parse('2000-01-01T00:00:00Z')&&date<=now+60_000
  ?new Date(date).toISOString():null;
}
export function gmailMessageDirection(message:GmailVisibleMessage,mailbox:string):'sent'|'received'{
 const own=personEmailAddress(mailbox);
 return own&&extractAddresses(message.from).includes(own)?'sent':'received';
}
export async function gmailActivitySourceKey(organizationId:string,mailbox:string,
 messageId:string):Promise<string>{
 const normalized=personEmailAddress(mailbox);
 if(!organizationId||!normalized||!gmailId.test(messageId))
  throw new Error('A connected Gmail account and a valid message are required.');
 if(!crypto?.subtle)throw new Error('Secure browser cryptography is required to log Gmail Activities.');
 const bytes=new TextEncoder().encode(['gmail-activity-v1',organizationId,normalized,messageId].join('\n'));
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function gmailActivityId(sourceKey:string):string{
 if(!/^[a-f0-9]{64}$/.test(sourceKey))throw new Error('Invalid Gmail Activity source key.');
 return 'activity_gmail_'+sourceKey.slice(0,40);
}
export function loggedGmailActivity(activities:readonly Activity[],sourceKey:string):Activity|undefined{
 return activities.find(activity=>activity.metadata?.gmailMessageFingerprint===sourceKey&&
  activity.type==='manual-touchpoint'&&activity.metadata.interactionMethod==='email');
}
