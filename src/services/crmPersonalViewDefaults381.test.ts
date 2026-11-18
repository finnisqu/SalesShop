import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createCrmGuidedPreset} from './crmGuidedSetup380';
import {
 personalRecordLayoutStorageKey,personalCrmSetupStorageKey,
 parseRecordLayoutOverrides,readPersonalCrmLayoutDefaults,
 resolvePersonalRecordLayouts,withManualRecordLayout,withoutManualRecordLayout,
 type RecordLayoutIdentity,
} from './crmPersonalViewDefaults381';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const identity=(organizationId:string,userId:string):RecordLayoutIdentity=>({
 mode:'cloud',organizationId,userId,
});

describe('#381 — Personal CRM Setup Table/Board defaults',()=>{
 it('keeps existing Records defaults when there is no saved guided setup',()=>{
  expect(resolvePersonalRecordLayouts({},null)).toEqual({companies:'table',deals:'board'});
  expect(resolvePersonalRecordLayouts({companies:'board'},null))
   .toEqual({companies:'board',deals:'board'});
 });
 it('applies both choices from the exact saved user/workspace guide',()=>{
  const guided=createCrmGuidedPreset('professional_services');
  guided.views.companies='board';guided.views.deals='table';
  const a=identity('org-a','user-a');
  const raw=new Map([[personalCrmSetupStorageKey(a),JSON.stringify(guided)]]);
  const stored=readPersonalCrmLayoutDefaults(key=>raw.get(key)??null,a);
  expect(stored?.template).toBe('professional_services');
  expect(resolvePersonalRecordLayouts({},stored))
   .toEqual({companies:'board',deals:'table'});
 });
 it('manual choices override the guide independently and remain until explicitly reset',()=>{
  const guided=createCrmGuidedPreset('professional_services');
  guided.views.companies='board';guided.views.deals='table';
  const selected=withManualRecordLayout({},'deals','board');
  expect(resolvePersonalRecordLayouts(selected,guided))
   .toEqual({companies:'board',deals:'board'});
  const second=withManualRecordLayout(selected,'companies','table');
  expect(resolvePersonalRecordLayouts(second,guided))
   .toEqual({companies:'table',deals:'board'});
  expect(withoutManualRecordLayout(second,'deals')).toEqual({companies:'table'});
  expect(resolvePersonalRecordLayouts(withoutManualRecordLayout(second,'deals'),guided))
   .toEqual({companies:'table',deals:'table'});
  expect(withoutManualRecordLayout({},'deals')).toEqual({});
  expect(guided.views).toEqual({companies:'board',deals:'table'});
 });
 it('never persists a resolved default as a manual override',()=>{
  const guided=createCrmGuidedPreset('real_estate');
  const overrides={};
  const resolved=resolvePersonalRecordLayouts(overrides,guided);
  expect(resolved.deals).toBe('board');
  guided.views.deals='table';
  expect(resolvePersonalRecordLayouts(overrides,guided).deals).toBe('table');
  expect(Object.keys(overrides)).toHaveLength(0);
 });
 it('is account-, organization- and local-mode-scoped',()=>{
  const a=identity('org-a','user-a');
  expect(personalRecordLayoutStorageKey(a))
   .not.toBe(personalRecordLayoutStorageKey(identity('org-a','user-b')));
  expect(personalRecordLayoutStorageKey(a))
   .not.toBe(personalRecordLayoutStorageKey(identity('org-b','user-a')));
  expect(personalCrmSetupStorageKey(a))
   .not.toBe(personalCrmSetupStorageKey(identity('org-b','user-a')));
  expect(personalRecordLayoutStorageKey(a))
   .not.toBe(personalRecordLayoutStorageKey({mode:'local',organizationId:null}));
  const saved=new Map([[personalCrmSetupStorageKey(a),
   JSON.stringify(createCrmGuidedPreset('professional_services'))]]);
  expect(readPersonalCrmLayoutDefaults(key=>saved.get(key)??null,
   identity('org-b','user-a'))).toBeNull();
  expect(readPersonalCrmLayoutDefaults(key=>saved.get(key)??null,
   identity('org-a','user-b'))).toBeNull();
 });
 it('rejects malformed, oversized and unknown override values rather than trusting them',()=>{
  expect(parseRecordLayoutOverrides('{')).toEqual({});
  expect(parseRecordLayoutOverrides('[]')).toEqual({});
  expect(parseRecordLayoutOverrides('"board"')).toEqual({});
  expect(parseRecordLayoutOverrides(JSON.stringify({
   companies:'board',deals:'not-a-layout',role:'owner',
  }))).toEqual({companies:'board'});
  expect(parseRecordLayoutOverrides(JSON.stringify({
   companies:'table',deals:'board',
  }))).toEqual({companies:'table',deals:'board'});
  expect(parseRecordLayoutOverrides('x'.repeat(257))).toEqual({});
  expect(()=>withManualRecordLayout({},'deals','other' as never)).toThrow();
 });
 it('fails safely when local storage is blocked or the setup profile is corrupt',()=>{
  const a=identity('org-a','user-a');
  expect(readPersonalCrmLayoutDefaults(()=>'{bad',a)).toBeNull();
  expect(readPersonalCrmLayoutDefaults(()=>{throw Error('blocked');},a)).toBeNull();
  expect(resolvePersonalRecordLayouts({},null)).toEqual({companies:'table',deals:'board'});
 });
 it('wires both desktop and mobile Table/Board toggles without touching CRM records',()=>{
  const connections=source('components/Connections.tsx');
  const helper=source('services/crmPersonalViewDefaults381.ts');
  const guided=source('components/CrmGuidedSetup380.tsx');
  expect(connections).toContain('const layoutScope=personalRecordLayoutStorageKey(layoutIdentity);');
  expect(connections).toContain('readPersonalCrmLayoutDefaults(');
  expect(connections).toContain('resolvePersonalRecordLayouts(layoutOverrides,guidedSetup)');
  expect(connections).toContain('withManualRecordLayout(previous,kind,value)');
  expect(connections).toContain('withoutManualRecordLayout(previous,kind)');
  expect(connections).toContain('Use my CRM Setup default');
  expect(connections).toContain('aria-label="Table layout"');
  expect(connections).toContain('aria-label="Board layout"');
  expect(connections).toContain("className=\"connections-mobile-layout-action\"");
  expect(connections).toContain("authMode==='local'?");
  expect(connections).toContain('localStorage.setItem(key,JSON.stringify(value))');
  expect(helper).not.toContain('supabase.from(');
  expect(helper).not.toContain('updateProject(');
  expect(guided).toContain('Table/Board preferences will be used as personal');
 });
});
