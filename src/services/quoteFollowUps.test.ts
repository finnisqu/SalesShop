import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import type {Activity} from '../types/crm';
import {buildQuoteFollowUpQueue,latestQuoteFollowUp,quoteFollowUpCounts} from './quoteFollowUps';
const quote=(id:string,status:Quote['status']='Sent',revision=1):Quote=>
 ({id,status,revision,title:id,archivedAt:undefined} as Quote);
const delivery=(id:string,revision=1,occurredAt='2026-10-10T10:00:00Z'):Activity=>
 ({id:'delivery-'+id,quoteId:id,type:'quote-sent',occurredAt,summary:'',
 metadata:{revision,source:'manual',deliveryConfirmed:true}});
const event=(id:string,action:'scheduled'|'contacted'|'cleared',dueDate?:string,revision=1,occurredAt='2026-10-12T10:00:00Z'):Activity=>
 ({id:'event-'+id+action,quoteId:id,type:'quote-follow-up',summary:'',occurredAt,
 metadata:{revision,source:'manual',followUpAction:action,followUpDueDate:dueDate}});
describe('actionable quote follow-up queue',()=>{
 const today='2026-10-14';
 it('distinguishes issue from delivery and excludes terminal or archived documents',()=>{
  const data=buildQuoteFollowUpQueue([
   quote('issued'),quote('delivered'),quote('ready','Ready'),quote('draft','Draft'),
   quote('signed','Signed'),{...quote('archived'),archivedAt:'2026-10-14'}],
   [delivery('delivered')],today);
  expect(data.map(x=>[x.quote.id,x.priority])).toEqual([
   ['issued','needs-delivery'],['ready','ready-to-review'],['delivered','awaiting-reply']]);
 });
 it('sorts overdue and today before upcoming; keeps exact quote revision',()=>{
  const data=buildQuoteFollowUpQueue([
   quote('later'),quote('overdue'),quote('today'),quote('revision', 'Sent',2)],
   [delivery('later'),delivery('overdue'),delivery('today'),delivery('revision',1),
    event('later','scheduled','2026-10-20'),event('overdue','scheduled','2026-10-12'),
    event('today','scheduled','2026-10-14'),
    event('revision','contacted',undefined,1)],today);
  expect(data.map(x=>x.quote.id)).toEqual(['overdue','today','revision','later']);
  expect(data.find(x=>x.quote.id==='revision')?.priority).toBe('needs-delivery');
  expect(quoteFollowUpCounts(data)).toEqual({total:4,due:2,needsDelivery:1,awaiting:0,scheduled:1});
 });
 it('a recorded contact clears a due date; a later plan reopens it',()=>{
  const q=quote('a');
  const events=[delivery('a'),event('a','scheduled','2026-10-10'),
   event('a','contacted',undefined,1,'2026-10-13T10:00:00Z')];
  expect(buildQuoteFollowUpQueue([q],events,today)).toEqual([]);
  events.push(event('a','scheduled','2026-10-17',1,'2026-10-14T10:00:00Z'));
  expect(latestQuoteFollowUp(q,events)?.metadata?.followUpDueDate).toBe('2026-10-17');
  expect(buildQuoteFollowUpQueue([q],events,today)[0].priority).toBe('upcoming');
 });
 it('legacy issued activities are not delivery confirmations',()=>{
  const q=quote('a');const activities=[{...delivery('a'),metadata:{revision:1,source:'quote' as const}}];
  expect(buildQuoteFollowUpQueue([q],activities,today)[0].priority).toBe('needs-delivery');
 });
});
