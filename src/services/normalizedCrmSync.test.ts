import {describe,expect,it} from 'vitest';
import type {Activity} from '../types/crm';
import {activityNeedsUpload} from './normalizedCrmSync';

const activity=(editedAt?:string):Activity=>({
 id:'activity1',type:'manual-touchpoint',summary:'Spoke with builder',
 occurredAt:'2026-11-03T13:00:00Z',
 metadata:editedAt?{editedAt,interactionMethod:'call'}:{interactionMethod:'call'}
});
describe('CRM synchronization safeguards',()=>{
 it('uploads only new Activities when cloud row is missing',()=>{
  expect(activityNeedsUpload(activity(),undefined)).toBe(true);
  expect(activityNeedsUpload(activity('2026-11-03T14:00:00Z'),undefined)).toBe(true);
 });
 it('does not overwrite an existing corrected Activity with a stale local copy',()=>{
  expect(activityNeedsUpload(activity(),{editedAt:'2026-11-03T15:00:00Z'})).toBe(false);
  expect(activityNeedsUpload(activity('2026-11-03T14:00:00Z'),{
   editedAt:'2026-11-03T15:00:00Z'
  })).toBe(false);
  expect(activityNeedsUpload(activity('2026-11-03T15:00:00Z'),{
   editedAt:'2026-11-03T15:00:00Z'
  })).toBe(false);
 });
 it('accepts a newer explicit correction and avoids rewriting unchanged history',()=>{
  expect(activityNeedsUpload(activity('2026-11-03T16:00:00Z'),{
   editedAt:'2026-11-03T15:00:00Z'
  })).toBe(true);
  expect(activityNeedsUpload(activity(),null)).toBe(false);
  expect(activityNeedsUpload(activity('2026-11-03T16:00:00Z'),null)).toBe(true);
 });
});
