import {describe,it,expect} from 'vitest';
import type {PersonalTask} from '../store/personalTaskStore';
import {mergePrivateTasks} from './personalTaskCloudSync';
const t=(id:string,updatedAt:string,patch:Partial<PersonalTask>={}):PersonalTask=>({
  id,title:id,workspaceScope:'org:shop:user:owner',createdAt:updatedAt,updatedAt,...patch
});
describe('private task history merge',()=>{
 it('keeps a draft created on this device without overwriting cloud history',()=>{
  const result=mergePrivateTasks([t('local','2026-11-01T20:00:00Z')],[t('cloud','2026-11-01T19:00:00Z')]);
  expect(result.map(x=>x.id)).toEqual(['local','cloud']);
 });
 it('chooses the newest edit for the same id',()=>{
  const result=mergePrivateTasks([t('a','2026-11-01T18:00:00Z',{title:'older'})],
    [t('a','2026-11-01T19:00:00Z',{title:'newer'})]);
  expect(result).toHaveLength(1);
  expect(result[0].title).toBe('newer');
 });
 it('keeps a deletion over an equally timed edit, regardless of merge direction',()=>{
  const date='2026-11-03T20:00:00Z';
  const deleted=t('a',date,{deletedAt:date});
  const active=t('a',date,{title:'edited elsewhere'});
  expect(mergePrivateTasks([deleted],[active])[0].deletedAt).toBe(date);
  expect(mergePrivateTasks([active],[deleted])[0].deletedAt).toBe(date);
 });
 it('chooses consistent stable ordering for equal timestamps',()=>{
  const date='2026-11-03T20:00:00Z';
  expect(mergePrivateTasks([t('z',date),t('a',date)],[]).map(t=>t.id)).toEqual(['a','z']);
 });
 it('retains deletion tombstones across device merges',()=>{
  const result=mergePrivateTasks([t('a','2026-11-01T20:00:00Z',{deletedAt:'2026-11-01T20:00:00Z'})],
    [t('a','2026-11-01T19:00:00Z')]);
  expect(result[0].deletedAt).toBeDefined();
 });
});