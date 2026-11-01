import {describe,expect,it} from 'vitest';
import {quoteReviewNextAction,type QuoteReviewJourneyInput} from './quoteReviewJourney';
const draft:QuoteReviewJourneyInput={editable:true,issued:false,canIssue:true,needsRecheck:false,
  blockers:0,decisions:0,acknowledged:false,previewed:false,approved:false};
describe('review next action is guidance only',()=>{
 it('prioritizes rechecking and real blockers',()=>{
  expect(quoteReviewNextAction({...draft,needsRecheck:true,blockers:2}).kind).toBe('check');
  expect(quoteReviewNextAction({...draft,blockers:1}).label).toContain('1 pricing issue');
 });
 it('does not mistake an acknowledged decision for approval',()=>{
  expect(quoteReviewNextAction({...draft,decisions:2}).kind).toBe('check');
  expect(quoteReviewNextAction({...draft,decisions:2,acknowledged:true}).kind).toBe('preview');
 });
 it('requires separate preview, approval and issue actions',()=>{
  expect(quoteReviewNextAction(draft).kind).toBe('preview');
  expect(quoteReviewNextAction({...draft,previewed:true}).label).toContain('Approve');
  expect(quoteReviewNextAction({...draft,previewed:true,approved:true}).label).toContain('Issue');
  expect(quoteReviewNextAction({...draft,previewed:true,approved:true,canIssue:false}).label).toContain('permissions');
 });
 it('treats frozen revisions separately',()=>{
  expect(quoteReviewNextAction({...draft,editable:false,issued:true}).description).toContain('sharing');
  expect(quoteReviewNextAction({...draft,editable:false,issued:false}).label).toContain('read-only');
 });
});